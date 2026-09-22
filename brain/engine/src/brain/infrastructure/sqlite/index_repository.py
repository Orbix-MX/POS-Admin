"""Implementación de `KnowledgeStore` sobre SQLite + FTS5.

Todo el SQL del sistema vive aquí. Si mañana el almacén fuera Postgres o DuckDB, este
es el único archivo que se reescribe.

Contrato del adaptador: **ningún `sqlite3.Error` sale de este módulo**. Todo se traduce
a `StorageError` mediante `@_guard`.
"""

from __future__ import annotations

import functools
import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator, TypeVar

from brain.application.errors import StorageError
from brain.domain.models import (
    UNCLASSIFIED_AREA,
    UNKNOWN_TYPE,
    DocumentMetadata,
    DocumentRevision,
    KnowledgeDocument,
    KnowledgeRelation,
    LinkKind,
    RelationStatus,
    SearchResult,
)
from brain.domain.values import Slug, Tag, VaultPath, fold

SCHEMA_VERSION = "1"
SCHEMA_FILE = Path(__file__).with_name("schema.sql")

# Pesos de bm25: el título manda, el cuerpo es el último recurso.
DEFAULT_WEIGHTS = (8.0, 3.0, 2.0, 1.0)

F = TypeVar("F", bound=Callable[..., Any])


def _guard(method: F) -> F:
    """Traduce cualquier fallo de SQLite a `StorageError`.

    Es la obligación del adaptador: la tecnología no sale de aquí. Sin esto, un
    `sqlite3.OperationalError` acabaría en la cara de un consumidor externo.
    """

    @functools.wraps(method)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        try:
            return method(*args, **kwargs)
        except sqlite3.Error as error:
            raise StorageError(str(error)) from error

    return wrapper  # type: ignore[return-value]


class SqliteKnowledgeStore:
    """Implementación de `KnowledgeStore` sobre SQLite + FTS5."""

    def __init__(self, db_path: Path, weights: tuple[float, ...] = DEFAULT_WEIGHTS) -> None:
        self.db_path = db_path
        self.weights = weights
        self._ready = False
        # Una conexión por hilo. SQLite ata cada conexión al hilo que la creó, y un
        # servidor de larga vida (MCP) atiende peticiones en varios: compartir una sola
        # conexión falla. WAL permite lectores concurrentes; el escritor único lo
        # garantiza el cerrojo de la fachada.
        self._local = threading.local()
        self._connections: list[sqlite3.Connection] = []
        self._connections_lock = threading.Lock()

    # ------------------------------------------------------------------ conexión
    @property
    def connection(self) -> sqlite3.Connection:
        existing = getattr(self._local, "conn", None)
        if existing is not None:
            return existing
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False solo para poder cerrarlas todas desde un hilo:
        # cada hilo sigue usando la suya, nunca se comparte una conexión viva.
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=5000")
        self._local.conn = conn
        with self._connections_lock:
            self._connections.append(conn)
        return conn

    def close(self) -> None:
        with self._connections_lock:
            for conn in self._connections:
                try:
                    conn.close()
                except sqlite3.Error:
                    pass
            self._connections.clear()
        self._local = threading.local()
        self._ready = False

    def __enter__(self) -> SqliteKnowledgeStore:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def is_ready(self) -> bool:
        return self._ready

    @contextmanager
    def transaction(self) -> Iterator[None]:
        """Agrupa escrituras: confirma al salir, deshace si algo falla.

        Sustituye a los `commit()` dispersos por los casos de uso: el momento de
        confirmar es una decisión del almacén, no de la lógica de negocio.
        """
        try:
            yield
        except Exception:
            try:
                self.connection.rollback()
            except sqlite3.Error:
                pass
            raise
        try:
            self.connection.commit()
        except sqlite3.Error as error:
            raise StorageError(str(error)) from error

    # ------------------------------------------------------------------ ciclo de vida
    @_guard
    def prepare(self, taxonomy_fingerprint: str) -> bool:
        """Deja el almacén listo. Devuelve True si tuvo que reconstruirlo desde cero."""
        conn = self.connection
        existing = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='meta'"
        ).fetchone()

        if existing is not None:
            stored = {
                row["key"]: row["value"] for row in conn.execute("SELECT key, value FROM meta")
            }
            if (
                stored.get("schema_version") == SCHEMA_VERSION
                and stored.get("taxonomy_fingerprint") == taxonomy_fingerprint
            ):
                self._ready = True
                return False
            self._drop_everything()

        conn.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
        self._set_meta("schema_version", SCHEMA_VERSION)
        self._set_meta("taxonomy_fingerprint", taxonomy_fingerprint)
        conn.commit()
        self._ready = True
        return True

    def _drop_everything(self) -> None:
        conn = self.connection
        conn.execute("PRAGMA foreign_keys=OFF")
        for row in conn.execute(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table','view')"
        ).fetchall():
            if row["name"].startswith("sqlite_") or "_fts_" in row["name"]:
                continue
            conn.execute(f'DROP {row["type"]} IF EXISTS "{row["name"]}"')
        conn.commit()
        conn.execute("PRAGMA foreign_keys=ON")

    def _set_meta(self, key: str, value: str) -> None:
        self.connection.execute(
            "INSERT INTO meta(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )

    def get_meta(self, key: str) -> str | None:
        row = self.connection.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None

    @_guard
    def last_indexed_at(self) -> str | None:
        return self.get_meta("last_index_at")

    @_guard
    def mark_indexed(self, when: str | None = None) -> None:
        self._set_meta("last_index_at", when or _now())

    # ------------------------------------------------------------------ escritura
    @_guard
    def indexed_revisions(self) -> dict[VaultPath, DocumentRevision]:
        rows = self.connection.execute(
            "SELECT path, size_bytes, mtime_ns, content_hash FROM documents"
        )
        return {
            VaultPath(row["path"]): DocumentRevision(
                row["size_bytes"], row["mtime_ns"], row["content_hash"]
            )
            for row in rows
        }

    @_guard
    def upsert_document(self, document: KnowledgeDocument) -> None:
        conn = self.connection
        meta = document.metadata
        conn.execute(
            """
            INSERT INTO documents (
                path, path_fold, slug, title, title_fold, type, owner, updated,
                area, scope, content_hash, size_bytes, mtime_ns, frontmatter_json,
                heading_count, word_count, has_frontmatter, needs_validation, indexed_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(path) DO UPDATE SET
                path_fold=excluded.path_fold, slug=excluded.slug, title=excluded.title,
                title_fold=excluded.title_fold, type=excluded.type, owner=excluded.owner,
                updated=excluded.updated, area=excluded.area, scope=excluded.scope,
                content_hash=excluded.content_hash, size_bytes=excluded.size_bytes,
                mtime_ns=excluded.mtime_ns, frontmatter_json=excluded.frontmatter_json,
                heading_count=excluded.heading_count, word_count=excluded.word_count,
                has_frontmatter=excluded.has_frontmatter,
                needs_validation=excluded.needs_validation, indexed_at=excluded.indexed_at
            """,
            (
                document.path.value,
                document.path.folded,
                document.slug.value,
                meta.title,
                fold(meta.title),
                meta.type,
                meta.owner,
                meta.updated,
                document.area,
                document.scope,
                document.content_hash,
                document.size_bytes,
                document.mtime_ns,
                json.dumps(_jsonable(meta.extra), ensure_ascii=False, default=str),
                len(document.headings),
                document.word_count,
                int(meta.has_frontmatter),
                int(meta.needs_validation),
                _now(),
            ),
        )
        document_id = self._document_id(document.path)
        self._replace_tags(document_id, meta.tags)
        self._replace_text(document_id, document)

    def _replace_tags(self, document_id: int, tags: Iterable[Tag]) -> None:
        conn = self.connection
        conn.execute("DELETE FROM document_tags WHERE document_id=?", (document_id,))
        for tag in tags:
            conn.execute("INSERT OR IGNORE INTO tags(name) VALUES(?)", (tag.value,))
            row = conn.execute("SELECT id FROM tags WHERE name=?", (tag.value,)).fetchone()
            conn.execute(
                "INSERT OR IGNORE INTO document_tags(document_id, tag_id) VALUES(?,?)",
                (document_id, row["id"]),
            )

    def _replace_text(self, document_id: int, document: KnowledgeDocument) -> None:
        conn = self.connection
        conn.execute("DELETE FROM documents_fts WHERE rowid=?", (document_id,))
        conn.execute(
            "INSERT INTO documents_fts(rowid, title, headings, tags, body) VALUES(?,?,?,?,?)",
            (
                document_id,
                document.metadata.title,
                " \n".join(document.headings),
                " ".join(t.value for t in document.metadata.tags),
                document.body_text,
            ),
        )

    @_guard
    def delete_document(self, path: VaultPath) -> None:
        conn = self.connection
        row = conn.execute("SELECT id FROM documents WHERE path=?", (path.value,)).fetchone()
        if row is None:
            return
        document_id = row["id"]
        # Los enlaces que apuntaban aquí quedan pendientes (target_id -> NULL por FK),
        # pero su `status` hay que corregirlo a mano: SQLite no lo deduce.
        conn.execute(
            "UPDATE links SET status=? WHERE target_id=?",
            (RelationStatus.UNRESOLVED.value, document_id),
        )
        conn.execute("DELETE FROM documents_fts WHERE rowid=?", (document_id,))
        conn.execute("DELETE FROM documents WHERE id=?", (document_id,))

    @_guard
    def replace_relations(self, source: VaultPath, relations: Iterable[KnowledgeRelation]) -> None:
        conn = self.connection
        source_id = self._document_id(source)
        conn.execute("DELETE FROM links WHERE source_id=?", (source_id,))
        for relation in relations:
            target_id = (
                self._document_id_or_none(relation.target) if relation.target is not None else None
            )
            conn.execute(
                """
                INSERT INTO links (
                    source_id, raw_target, target_key, label, anchor, kind, status,
                    target_id, candidate_count, occurrences
                ) VALUES (?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    source_id,
                    relation.raw_target,
                    relation.target_key,
                    relation.label,
                    relation.anchor,
                    relation.kind.value,
                    relation.status.value,
                    target_id,
                    relation.candidate_count,
                    relation.occurrences,
                ),
            )

    @_guard
    def known_documents(self) -> list[tuple[VaultPath, str]]:
        rows = self.connection.execute("SELECT path, title FROM documents ORDER BY path")
        return [(VaultPath(row["path"]), row["title"]) for row in rows]

    @_guard
    def sources_pointing_to(self, key: str) -> list[VaultPath]:
        rows = self.connection.execute(
            """
            SELECT DISTINCT d.path
            FROM links l JOIN documents d ON d.id = l.source_id
            WHERE l.target_key = ?
            """,
            (key,),
        )
        return [VaultPath(row["path"]) for row in rows]

    def _document_id(self, path: VaultPath) -> int:
        row = self.connection.execute(
            "SELECT id FROM documents WHERE path=?", (path.value,)
        ).fetchone()
        if row is None:
            raise KeyError(f"documento no indexado: {path}")
        return row["id"]

    def _document_id_or_none(self, path: VaultPath) -> int | None:
        row = self.connection.execute(
            "SELECT id FROM documents WHERE path=?", (path.value,)
        ).fetchone()
        return row["id"] if row else None

    # ------------------------------------------------------------------ lectura
    @_guard
    def search(
        self,
        query: str | None = None,
        *,
        type: str | None = None,
        area: str | None = None,
        scope: str | None = None,
        tags: tuple[str, ...] = (),
        limit: int = 20,
    ) -> list[SearchResult]:
        params: list[object] = []
        joins = ""
        where: list[str] = []
        order = "d.title COLLATE NOCASE"
        score = "0.0"
        snippet = "''"

        if query:
            joins += " JOIN documents_fts f ON f.rowid = d.id"
            where.append("documents_fts MATCH ?")
            params.append(_to_fts_query(query))
            score = "-bm25(documents_fts, ?, ?, ?, ?)"
            snippet = "snippet(documents_fts, -1, '[', ']', ' … ', 12)"
            order = "bm25(documents_fts, ?, ?, ?, ?)"

        if type:
            where.append("d.type = ?")
            params.append(type)
        if area:
            where.append("d.area = ?")
            params.append(area)
        if scope:
            where.append("LOWER(d.scope) = LOWER(?)")
            params.append(scope)
        for tag in tags:
            where.append(
                "EXISTS (SELECT 1 FROM document_tags dt JOIN tags t ON t.id = dt.tag_id "
                "WHERE dt.document_id = d.id AND t.name = ?)"
            )
            params.append(fold(tag).replace(" ", "-"))

        sql = (
            f"SELECT d.path, d.title, d.type, d.area, d.scope, {score} AS score, "
            f"{snippet} AS snippet FROM documents d{joins}"
        )
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += f" ORDER BY {order} LIMIT ?"

        bound: list[object] = []
        if query:
            bound.extend(self.weights)          # score
            bound.append(_to_fts_query(query))  # MATCH
            bound.extend(params[1:])            # filtros
            bound.extend(self.weights)          # ORDER BY
        else:
            bound.extend(params)
        bound.append(limit)

        rows = self.connection.execute(sql, bound)
        return [
            SearchResult(
                path=VaultPath(row["path"]),
                title=row["title"],
                type=row["type"],
                area=row["area"],
                scope=row["scope"],
                score=float(row["score"] or 0.0),
                snippet=(row["snippet"] or "").replace("\n", " ").strip(),
            )
            for row in rows
        ]

    @_guard
    def get_document(self, path: VaultPath) -> KnowledgeDocument | None:
        row = self.connection.execute(
            "SELECT * FROM documents WHERE path_fold=?", (path.folded,)
        ).fetchone()
        return self._to_document(row) if row else None

    @_guard
    def find_by_title(self, title: str) -> list[VaultPath]:
        rows = self.connection.execute(
            "SELECT path FROM documents WHERE title_fold=? OR slug=? ORDER BY path",
            (fold(title), fold(title)),
        )
        return [VaultPath(row["path"]) for row in rows]

    @_guard
    def outbound(self, path: VaultPath) -> list[KnowledgeRelation]:
        rows = self.connection.execute(
            """
            SELECT l.*, src.path AS source_path, tgt.path AS target_path
            FROM links l
            JOIN documents src ON src.id = l.source_id
            LEFT JOIN documents tgt ON tgt.id = l.target_id
            WHERE src.path_fold = ?
            ORDER BY l.status, l.raw_target
            """,
            (path.folded,),
        )
        return [self._to_relation(row) for row in rows]

    @_guard
    def inbound(self, path: VaultPath) -> list[KnowledgeRelation]:
        rows = self.connection.execute(
            """
            SELECT l.*, src.path AS source_path, tgt.path AS target_path
            FROM links l
            JOIN documents src ON src.id = l.source_id
            JOIN documents tgt ON tgt.id = l.target_id
            WHERE tgt.path_fold = ?
            ORDER BY src.path
            """,
            (path.folded,),
        )
        return [self._to_relation(row) for row in rows]

    @_guard
    def stats(self) -> dict[str, int]:
        conn = self.connection
        one = lambda sql: int(conn.execute(sql).fetchone()[0])  # noqa: E731
        return {
            "documents": one("SELECT COUNT(*) FROM documents"),
            "tags": one("SELECT COUNT(*) FROM tags"),
            "links": one("SELECT COUNT(*) FROM links"),
            "resolved": one("SELECT COUNT(*) FROM links WHERE status='resolved'"),
            "unresolved": one("SELECT COUNT(*) FROM links WHERE status='unresolved'"),
            "ambiguous": one("SELECT COUNT(*) FROM links WHERE status='ambiguous'"),
            "needs_validation": one("SELECT COUNT(*) FROM documents WHERE needs_validation=1"),
            "without_frontmatter": one("SELECT COUNT(*) FROM documents WHERE has_frontmatter=0"),
        }

    # ------------------------------------------------------------------ mapeo
    def _to_document(self, row: sqlite3.Row) -> KnowledgeDocument:
        tags = tuple(
            Tag(r["name"])
            for r in self.connection.execute(
                "SELECT t.name FROM tags t JOIN document_tags dt ON dt.tag_id = t.id "
                "WHERE dt.document_id = ? ORDER BY t.name",
                (row["id"],),
            )
        )
        path = VaultPath(row["path"])
        return KnowledgeDocument(
            path=path,
            slug=Slug(row["slug"]),
            metadata=DocumentMetadata(
                title=row["title"],
                type=row["type"] or UNKNOWN_TYPE,
                owner=row["owner"],
                updated=row["updated"],
                tags=tags,
                extra=json.loads(row["frontmatter_json"] or "{}"),
                has_frontmatter=bool(row["has_frontmatter"]),
                needs_validation=bool(row["needs_validation"]),
            ),
            area=row["area"] or UNCLASSIFIED_AREA,
            scope=row["scope"],
            content_hash=row["content_hash"],
            size_bytes=row["size_bytes"],
            mtime_ns=row["mtime_ns"],
            word_count=row["word_count"],
        )

    def _to_relation(self, row: sqlite3.Row) -> KnowledgeRelation:
        return KnowledgeRelation(
            source=VaultPath(row["source_path"]),
            raw_target=row["raw_target"],
            target_key=row["target_key"],
            kind=LinkKind(row["kind"]),
            status=RelationStatus(row["status"]),
            target=VaultPath(row["target_path"]) if row["target_path"] else None,
            anchor=row["anchor"],
            label=row["label"],
            candidate_count=row["candidate_count"],
            occurrences=row["occurrences"],
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _jsonable(mapping: object) -> dict[str, object]:
    try:
        return dict(mapping)  # type: ignore[arg-type]
    except Exception:
        return {}


def _to_fts_query(query: str) -> str:
    """Convierte lo que escribe una persona en una expresión FTS5 segura.

    Sin esto, un guion o una comilla en la consulta produce un error de sintaxis
    en lugar de resultados.
    """
    tokens = [t for t in _tokenize(query) if t]
    if not tokens:
        return '""'
    return " ".join(f'"{t}"*' for t in tokens)


def _tokenize(query: str) -> list[str]:
    current: list[str] = []
    tokens: list[str] = []
    for char in query:
        if char.isalnum() or char in "_/":
            current.append(char)
        else:
            tokens.append("".join(current))
            current = []
    tokens.append("".join(current))
    return tokens
