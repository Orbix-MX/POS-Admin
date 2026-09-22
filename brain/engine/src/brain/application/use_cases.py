"""Los casos de uso del Core.

Cada uno recibe primitivos y devuelve DTOs internos. No conocen SQLite, ni Markdown,
ni quién los llama. Los errores que lanzan son los de `application/errors.py`: nunca
excepciones del dominio ni de una tecnología concreta.
"""

from __future__ import annotations

import time

from brain.application.errors import (
    AmbiguousDocument,
    DocumentNotFound,
    InvalidReference,
    SourceError,
)
from brain.application.ports import DocumentSource, KnowledgeStore
from brain.application.views import (
    DocumentView,
    IndexFailureInfo,
    IndexReport,
    IndexStats,
    RelationLine,
    RelationsView,
    SearchHit,
)
from brain.domain.link_resolver import KnownDocument, LinkResolver
from brain.domain.models import (
    DocumentRevision,
    KnowledgeDocument,
    KnowledgeRelation,
    RelationStatus,
)
from brain.domain.values import InvalidValue, VaultPath, fold

#: Traducción de fallos de carga a un vocabulario cerrado.
_FAILURE_REASONS = {
    "unreadable": "no se pudo leer el documento",
    "encoding": "codificación no válida",
    "unknown": "fallo inesperado al procesar el documento",
}


# --------------------------------------------------------------------- indexar


class IndexVault:
    """Indexación incremental del vault completo.

    La resolución de enlaces es una fase aparte y global: un enlace solo puede
    juzgarse cuando se conoce el censo completo de documentos, o el resultado
    dependería del orden en que se recorrió el disco.
    """

    def __init__(self, source: DocumentSource, store: KnowledgeStore, taxonomy_fingerprint: str):
        self.source = source
        self.store = store
        self.taxonomy_fingerprint = taxonomy_fingerprint

    def execute(self, *, full: bool = False) -> IndexReport:
        started = time.perf_counter()
        rebuilt = _prepared(self.store, self.taxonomy_fingerprint)
        force = full or rebuilt

        indexed = self.store.indexed_revisions()
        available = self.source.revisions()

        created = updated = unchanged = deleted = 0
        failed: list[IndexFailureInfo] = []

        with self.store.transaction():
            for path, revision in available.items():
                known = indexed.get(path)
                if not force and known is not None and _looks_unchanged(revision, known):
                    unchanged += 1
                    continue
                document = _load(self.source, path, failed)
                if document is None:
                    continue
                if not force and known is not None and document.content_hash == known.content_hash:
                    # Cambió la fecha pero no el contenido: se refresca la huella y ya.
                    self.store.upsert_document(document)
                    unchanged += 1
                    continue
                self.store.upsert_document(document)
                if known is None:
                    created += 1
                else:
                    updated += 1

            for path in indexed.keys() - available.keys():
                self.store.delete_document(path)
                deleted += 1

        with self.store.transaction():
            counts = _resolve_all_links(self.source, self.store)
            self.store.mark_indexed()

        return IndexReport(
            created=created,
            updated=updated,
            unchanged=unchanged,
            deleted=deleted,
            failed=tuple(failed),
            rebuilt=rebuilt,
            duration_seconds=round(time.perf_counter() - started, 3),
            **counts,
        )


class ReindexDocument:
    """Reindexa un solo documento. Es la costura por la que entrará el watcher.

    Además de sus propios enlaces, reevalúa los enlaces *entrantes* que mencionan
    esta ruta: crear un documento repara los pendientes que ya lo apuntaban.
    """

    def __init__(self, source: DocumentSource, store: KnowledgeStore, taxonomy_fingerprint: str):
        self.source = source
        self.store = store
        self.taxonomy_fingerprint = taxonomy_fingerprint

    def execute(self, raw_path: str) -> IndexReport:
        started = time.perf_counter()
        rebuilt = _prepared(self.store, self.taxonomy_fingerprint)
        path = _as_path(raw_path)
        known = self.store.indexed_revisions().get(path)

        if not self.source.exists(path):
            if known is None:
                raise DocumentNotFound(raw_path)
            with self.store.transaction():
                self.store.delete_document(path)
            with self.store.transaction():
                counts = _resolve_affected(self.source, self.store, path)
            return IndexReport(
                deleted=1,
                rebuilt=rebuilt,
                duration_seconds=round(time.perf_counter() - started, 3),
                **counts,
            )

        document = self.source.load(path)
        with self.store.transaction():
            self.store.upsert_document(document)
        with self.store.transaction():
            counts = _resolve_affected(self.source, self.store, path, document)
        return IndexReport(
            created=0 if known else 1,
            updated=1 if known else 0,
            rebuilt=rebuilt,
            duration_seconds=round(time.perf_counter() - started, 3),
            **counts,
        )


def _prepared(store: KnowledgeStore, fingerprint: str) -> bool:
    """El almacén se prepara solo. Ningún llamador tiene que acordarse de hacerlo."""
    return store.prepare(fingerprint)


def _as_path(raw: str) -> VaultPath:
    """Traduce el error del dominio: fuera de aquí no circula `InvalidValue`."""
    try:
        return VaultPath.parse(raw)
    except InvalidValue as error:
        raise InvalidReference(str(raw), str(error)) from error


def _load(
    source: DocumentSource, path: VaultPath, failed: list[IndexFailureInfo]
) -> KnowledgeDocument | None:
    """Un documento ilegible no aborta la indexación: se registra y se sigue."""
    try:
        return source.load(path)
    except SourceError:
        failed.append(IndexFailureInfo(path.value, "unreadable", _FAILURE_REASONS["unreadable"]))
    except UnicodeError:
        failed.append(IndexFailureInfo(path.value, "encoding", _FAILURE_REASONS["encoding"]))
    except Exception:
        failed.append(IndexFailureInfo(path.value, "unknown", _FAILURE_REASONS["unknown"]))
    return None


def _looks_unchanged(current: DocumentRevision, indexed: DocumentRevision) -> bool:
    """Ruta rápida: tamaño y fecha. Evita leer el archivo."""
    return current.size_bytes == indexed.size_bytes and current.mtime_ns == indexed.mtime_ns


def _build_resolver(store: KnowledgeStore) -> LinkResolver:
    return LinkResolver([KnownDocument(path, title) for path, title in store.known_documents()])


def _resolve_all_links(source: DocumentSource, store: KnowledgeStore) -> dict[str, int]:
    resolver = _build_resolver(store)
    counts = {"resolved_links": 0, "unresolved_links": 0, "ambiguous_links": 0}
    for path, _title in store.known_documents():
        try:
            document = source.load(path)
        except Exception:
            continue
        relations = resolver.resolve_all(path, list(document.targets))
        store.replace_relations(path, relations)
        _tally(relations, counts)
    return counts


def _resolve_affected(
    source: DocumentSource,
    store: KnowledgeStore,
    path: VaultPath,
    document: KnowledgeDocument | None = None,
) -> dict[str, int]:
    """Resolución localizada: este documento y los que lo mencionan."""
    resolver = _build_resolver(store)
    counts = {"resolved_links": 0, "unresolved_links": 0, "ambiguous_links": 0}

    if document is not None:
        relations = resolver.resolve_all(path, list(document.targets))
        store.replace_relations(path, relations)
        _tally(relations, counts)

    affected: set[VaultPath] = set()
    for key in {path.folded, fold(path.stem)}:
        affected.update(store.sources_pointing_to(key))
    affected.discard(path)

    for other in affected:
        try:
            other_document = source.load(other)
        except Exception:
            continue
        relations = resolver.resolve_all(other, list(other_document.targets))
        store.replace_relations(other, relations)
        _tally(relations, counts)
    return counts


def _tally(relations: list[KnowledgeRelation], counts: dict[str, int]) -> None:
    for relation in relations:
        if relation.status is RelationStatus.RESOLVED:
            counts["resolved_links"] += 1
        elif relation.status is RelationStatus.AMBIGUOUS:
            counts["ambiguous_links"] += 1
        else:
            counts["unresolved_links"] += 1


# --------------------------------------------------------------------- consultar


class SearchDocuments:
    def __init__(self, store: KnowledgeStore) -> None:
        self.store = store

    def execute(
        self,
        query: str | None = None,
        *,
        type: str | None = None,
        area: str | None = None,
        scope: str | None = None,
        tags: tuple[str, ...] = (),
        limit: int = 20,
    ) -> list[SearchHit]:
        results = self.store.search(
            query, type=type, area=area, scope=scope, tags=tags, limit=limit
        )
        return [
            SearchHit(
                path=r.path.value,
                title=r.title,
                type=r.type,
                area=r.area,
                scope=r.scope,
                score=round(r.score, 4),
                snippet=r.snippet,
            )
            for r in results
        ]


class ReadDocument:
    """El cuerpo se lee del vault, nunca del índice.

    El índice guarda texto para *buscar*. Si estuviera desactualizado y sirviera el
    contenido, mentiría sobre lo que dice el vault.
    """

    def __init__(self, source: DocumentSource, store: KnowledgeStore) -> None:
        self.source = source
        self.store = store

    def execute(self, needle: str, *, include_body: bool = False) -> DocumentView:
        path = _locate(self.store, needle)
        document = self.store.get_document(path)
        if document is None:
            raise DocumentNotFound(needle)
        body = self.source.read_text(path) if include_body else None
        return _to_view(document, body)


class GetRelatedDocuments:
    def __init__(self, store: KnowledgeStore) -> None:
        self.store = store

    def execute(self, needle: str, *, direction: str = "both") -> RelationsView:
        path = _locate(self.store, needle)
        document = self.store.get_document(path)
        if document is None:
            raise DocumentNotFound(needle)
        titles = dict(self.store.known_documents())
        outbound = (
            tuple(_to_line(r, titles, outgoing=True) for r in self.store.outbound(path))
            if direction in ("both", "out")
            else ()
        )
        inbound = (
            tuple(_to_line(r, titles, outgoing=False) for r in self.store.inbound(path))
            if direction in ("both", "in")
            else ()
        )
        return RelationsView(document=_to_view(document, None), outbound=outbound, inbound=inbound)


class DescribeIndex:
    def __init__(self, store: KnowledgeStore) -> None:
        self.store = store

    def execute(self) -> IndexStats:
        return IndexStats(values=self.store.stats())


# --------------------------------------------------------------------- apoyo


def _locate(store: KnowledgeStore, needle: str) -> VaultPath:
    """Acepta ruta o título. Si hay varios candidatos, lo dice en vez de adivinar."""
    text = str(needle).strip()
    if not text:
        raise InvalidReference(needle, "la referencia está vacía")

    if text.endswith(".md"):
        candidate = _as_path(text)
        if store.get_document(candidate) is not None:
            return candidate

    matches = store.find_by_title(text)
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise AmbiguousDocument(text, tuple(p.value for p in matches))
    raise DocumentNotFound(text)


def _to_view(document: KnowledgeDocument, body: str | None) -> DocumentView:
    meta = document.metadata
    return DocumentView(
        path=document.path.value,
        title=meta.title,
        type=meta.type,
        area=document.area,
        scope=document.scope,
        owner=meta.owner,
        updated=meta.updated,
        tags=tuple(t.value for t in meta.tags),
        needs_validation=meta.needs_validation,
        has_frontmatter=meta.has_frontmatter,
        word_count=document.word_count,
        body=body,
    )


def _to_line(
    relation: KnowledgeRelation, titles: dict[VaultPath, str], *, outgoing: bool
) -> RelationLine:
    other = relation.target if outgoing else relation.source
    return RelationLine(
        path=other.value if other else None,
        title=titles.get(other) if other else None,
        raw_target=relation.raw_target,
        kind=str(relation.kind),
        status=str(relation.status),
        occurrences=relation.occurrences,
        candidate_count=relation.candidate_count,
    )


__all__ = [
    "DescribeIndex",
    "GetRelatedDocuments",
    "IndexVault",
    "ReadDocument",
    "ReindexDocument",
    "SearchDocuments",
]
