"""`Brain`: la superficie pública del motor de conocimiento.

Un consumidor externo —CLI, MCP, REST, VSCode— solo conoce esta clase, sus DTOs y sus
errores. Nada de lo que cruza esta frontera pertenece al dominio ni a la infraestructura.

La fachada NO contiene reglas de conocimiento. Hace exactamente cinco cosas:
  1. gestionar el ciclo de vida (abrir, preparar, cerrar);
  2. interpretar referencias de documento;
  3. serializar las escrituras (cerrojo por instancia);
  4. traducir errores a la jerarquía pública;
  5. mapear los DTOs internos a los públicos.
Si alguna vez necesita decidir algo sobre el dominio, la decisión va al caso de uso.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Callable, Sequence, TypeVar

from brain.api import errors as api_errors
from brain.api import refs
from brain.api._composition import CoreSession, build_session
from brain.api.contract import API_VERSION, DIRECTIONS
from brain.api.dto import (
    BrainInfo,
    Document,
    DocumentSummary,
    IndexFailure,
    IndexResult,
    Relation,
    RelationGraph,
    SearchResponse,
    VaultStats,
)
from brain.application import errors as core_errors
from brain.application.views import (
    DocumentView,
    IndexReport,
    RelationLine,
    RelationsView,
    SearchHit,
)

T = TypeVar("T")


class Brain:
    """Punto de entrada único al motor.

    Uso::

        with Brain.open() as brain:
            brain.index()
            brain.search("facturacion")

    Concurrencia: admite lecturas concurrentes; las escrituras se serializan dentro de
    la instancia. Una instancia no se comparte entre procesos.
    """

    __slots__ = ("_session", "_write_lock", "_closed")

    def __init__(self, session: CoreSession) -> None:
        # Constructor interno: los consumidores usan Brain.open().
        self._session = session
        self._write_lock = threading.Lock()
        self._closed = False

    # ------------------------------------------------------------------ ciclo de vida
    @classmethod
    def open(cls, config: str | None = None, *, root: str | None = None) -> Brain:
        """Abre el motor y deja el índice listo para usarse.

        :param config: ruta a `brain.toml`. Si se omite, se busca hacia arriba.
        :param root: directorio desde el que buscar la configuración.
        :raises ConfigurationError: la configuración no puede leerse o es inválida.
        :raises VaultUnavailable: el vault configurado no existe.
        :raises IndexUnavailable: el índice no puede prepararse.
        """
        try:
            session = build_session(
                Path(config) if config else None,
                Path(root) if root else None,
            )
        except api_errors.BrainError:
            raise
        except Exception as error:
            raise api_errors.ConfigurationError(
                "no se pudo cargar la configuración"
            ) from error

        instance = cls(session)
        instance._prepare()
        return instance

    def _prepare(self) -> None:
        """Precondición del motor, no del consumidor: aquí y en ningún otro sitio."""
        if not self._session.source.available():
            raise api_errors.VaultUnavailable(
                f"el vault no existe o no es accesible: {self._session.config.vault_path}",
                details={"vault_path": str(self._session.config.vault_path)},
            )
        try:
            self._session.store.prepare(self._session.fingerprint)
        except core_errors.StorageError as error:
            raise api_errors.IndexUnavailable(str(error)) from error

    def close(self) -> None:
        """Libera recursos. Idempotente."""
        if not self._closed:
            self._session.close()
            self._closed = True

    def __enter__(self) -> Brain:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ------------------------------------------------------------------ operaciones
    def info(self) -> BrainInfo:
        """Estado del motor: qué vault, qué índice, qué versión de contrato."""

        def run() -> BrainInfo:
            store = self._session.store
            config = self._session.config
            ready = store.is_ready()
            documents = store.stats().get("documents", 0) if ready else 0
            return BrainInfo(
                api_version=API_VERSION,
                vault_path=str(config.vault_path),
                config_path=str(config.source_file) if config.source_file else None,
                index_path=str(config.index_path),
                index_ready=ready,
                document_count=documents,
                last_indexed_at=store.last_indexed_at() if ready else None,
                warnings=tuple(config.warnings),
                defaults={"search_limit": config.default_limit},
            )

        return self._guarded(run)

    def index(self, target: str | None = None, *, full: bool = False) -> IndexResult:
        """Indexa el vault, o un único documento si se indica `target`.

        Es la única operación que escribe: se serializa con el cerrojo de la instancia.

        :raises InvalidReference: `target` no puede designar un documento.
        :raises DocumentNotFound: `target` no está ni en el vault ni en el índice.
        :raises VaultUnavailable: el vault desapareció.
        :raises IndexUnavailable: el índice no pudo escribirse.
        """

        def run() -> IndexResult:
            with self._write_lock:
                self._ensure_open()
                if target is None:
                    report = self._session.index_vault().execute(full=full)
                else:
                    reference = refs.normalize(target)
                    report = self._session.reindex_document().execute(reference)
                return _to_index_result(report)

        return self._guarded(run)

    def search(
        self,
        query: str | None = None,
        *,
        type: str | None = None,
        area: str | None = None,
        scope: str | None = None,
        tags: Sequence[str] = (),
        limit: int | None = None,
    ) -> SearchResponse:
        """Busca por texto, por filtros o por ambos.

        `limit=None` significa el valor por defecto del perfil, nunca "sin límite":
        un consumidor remoto no debe poder pedir el vault entero por accidente.
        """

        def run() -> SearchResponse:
            self._ensure_open()
            effective_limit = limit if limit and limit > 0 else self._session.config.default_limit
            hits = self._session.search_documents().execute(
                query,
                type=type,
                area=area,
                scope=scope,
                tags=tuple(tags),
                limit=effective_limit,
            )
            filters = {
                key: value
                for key, value in (
                    ("type", type),
                    ("area", area),
                    ("scope", scope),
                    ("tags", ",".join(tags) if tags else None),
                )
                if value
            }
            return SearchResponse(
                items=tuple(_to_summary(hit) for hit in hits),
                count=len(hits),
                limit=effective_limit,
                truncated=len(hits) >= effective_limit,
                query=query,
                filters=filters,
            )

        return self._guarded(run)

    def get(self, ref: str, *, include_body: bool = False) -> Document:
        """Devuelve un documento por ruta o por título.

        El cuerpo, si se pide, se lee del vault: el índice nunca es fuente de verdad
        del contenido.

        :raises InvalidReference: la referencia es inválida.
        :raises DocumentNotFound: no existe.
        :raises AmbiguousReference: designa varios documentos.
        """

        def run() -> Document:
            self._ensure_open()
            reference = refs.normalize(ref)
            view = self._session.read_document().execute(reference, include_body=include_body)
            return _to_document(view)

        return self._guarded(run)

    def related(self, ref: str, *, direction: str = "both") -> RelationGraph:
        """Relaciones de un documento: salientes, entrantes o ambas."""

        def run() -> RelationGraph:
            self._ensure_open()
            reference = refs.normalize(ref)
            if direction not in DIRECTIONS:
                raise api_errors.InvalidReference(
                    f"dirección no admitida: {direction!r}",
                    details={"allowed": ", ".join(DIRECTIONS)},
                )
            view = self._session.get_related().execute(reference, direction=direction)
            return _to_graph(view)

        return self._guarded(run)

    def stats(self) -> VaultStats:
        """Cifras del conocimiento indexado."""

        def run() -> VaultStats:
            self._ensure_open()
            values = self._session.describe_index().execute().values
            return VaultStats(
                documents=values.get("documents", 0),
                tags=values.get("tags", 0),
                links=values.get("links", 0),
                resolved=values.get("resolved", 0),
                unresolved=values.get("unresolved", 0),
                ambiguous=values.get("ambiguous", 0),
                needs_validation=values.get("needs_validation", 0),
                without_frontmatter=values.get("without_frontmatter", 0),
            )

        return self._guarded(run)

    # ------------------------------------------------------------------ reservados
    def capabilities(self) -> dict[str, bool]:
        """**Reservado.** Qué sabe hacer esta instancia (funciones opcionales).

        El nombre forma parte del contrato desde 0.1.0 para que implementarlo mañana
        sea aditivo y no una ruptura.
        """
        raise api_errors.NotImplementedYet(
            "capabilities() está reservado en el contrato y aún no está implementado"
        )

    def health(self) -> dict[str, str]:
        """**Reservado.** Diagnóstico del motor y del índice (deriva, integridad)."""
        raise api_errors.NotImplementedYet(
            "health() está reservado en el contrato y aún no está implementado"
        )

    # ------------------------------------------------------------------ interno
    def _ensure_open(self) -> None:
        if self._closed:
            raise api_errors.IndexUnavailable("el motor está cerrado")
        if not self._session.store.is_ready():
            self._prepare()

    def _guarded(self, operation: Callable[[], T]) -> T:
        """Frontera de traducción: aquí muere toda excepción que no sea pública."""
        try:
            return operation()
        except api_errors.BrainError:
            raise
        except core_errors.InvalidReference as error:
            raise api_errors.InvalidReference(
                error.reason or f"referencia inválida: {error.reference}",
                details={"reference": error.reference},
            ) from error
        except core_errors.AmbiguousDocument as error:
            raise api_errors.AmbiguousReference(
                f"'{error.reference}' designa {len(error.candidates)} documentos",
                candidates=tuple(error.candidates),
                details={"reference": error.reference},
            ) from error
        except core_errors.DocumentNotFound as error:
            raise api_errors.DocumentNotFound(
                f"documento no encontrado: {error.reference}",
                details={"reference": error.reference},
            ) from error
        except core_errors.SourceError as error:
            raise api_errors.VaultUnavailable(str(error)) from error
        except core_errors.StorageError as error:
            raise api_errors.IndexUnavailable(str(error)) from error
        except Exception as error:
            # Red de seguridad: el tipo interno se pierde a propósito.
            raise api_errors.OperationFailed("la operación no pudo completarse") from error


# ---------------------------------------------------------------------- mapeo


def _to_index_result(report: IndexReport) -> IndexResult:
    return IndexResult(
        created=report.created,
        updated=report.updated,
        unchanged=report.unchanged,
        deleted=report.deleted,
        rebuilt=report.rebuilt,
        resolved_links=report.resolved_links,
        unresolved_links=report.unresolved_links,
        ambiguous_links=report.ambiguous_links,
        duration_seconds=report.duration_seconds,
        failures=tuple(
            IndexFailure(path=f.path, code=f.code, reason=f.reason) for f in report.failed
        ),
    )


def _to_summary(hit: SearchHit) -> DocumentSummary:
    return DocumentSummary(
        path=hit.path,
        title=hit.title,
        type=hit.type,
        area=hit.area,
        scope=hit.scope,
        score=hit.score,
        snippet=hit.snippet,
    )


def _to_document(view: DocumentView) -> Document:
    return Document(
        path=view.path,
        title=view.title,
        type=view.type,
        area=view.area,
        scope=view.scope,
        owner=view.owner,
        updated=view.updated,
        tags=tuple(view.tags),
        word_count=view.word_count,
        needs_validation=view.needs_validation,
        has_frontmatter=view.has_frontmatter,
        body=view.body,
    )


def _to_relation(line: RelationLine) -> Relation:
    return Relation(
        path=line.path,
        title=line.title,
        raw_target=line.raw_target,
        kind=line.kind,
        status=line.status,
        occurrences=line.occurrences,
        candidate_count=line.candidate_count,
    )


def _to_graph(view: RelationsView) -> RelationGraph:
    return RelationGraph(
        document=_to_document(view.document),
        outbound=tuple(_to_relation(line) for line in view.outbound),
        inbound=tuple(_to_relation(line) for line in view.inbound),
    )


def _unused(_: Any) -> None:  # pragma: no cover - marcador de intención
    """La fachada no importa `brain.domain`: si algún día lo necesita, es una señal."""
