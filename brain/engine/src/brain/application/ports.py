"""Los dos únicos puertos del Core.

Un puerto existe si tiene al menos dos implementaciones plausibles o si hace falta
para probar. Todo lo demás sería ceremonia.

Contrato para cualquier implementación: **no debe dejar escapar la excepción de su
tecnología**. Traduce a `SourceError` o `StorageError` (`application/errors.py`).
"""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Iterable, Protocol

from brain.domain.models import (
    DocumentRevision,
    KnowledgeDocument,
    KnowledgeRelation,
    SearchResult,
)
from brain.domain.values import VaultPath


class DocumentSource(Protocol):
    """De dónde sale el conocimiento. Hoy Markdown en disco; mañana lo que sea."""

    def revisions(self) -> dict[VaultPath, DocumentRevision]:
        """Huella de cada documento disponible, sin leer el contenido completo."""

    def load(self, path: VaultPath) -> KnowledgeDocument:
        """Documento completo, ya en tipos del dominio."""

    def read_text(self, path: VaultPath) -> str:
        """Contenido crudo. La fuente de verdad del texto NUNCA es el índice."""

    def exists(self, path: VaultPath) -> bool: ...

    def available(self) -> bool:
        """Si la fuente puede consultarse (p. ej. el vault existe)."""


class KnowledgeStore(Protocol):
    """Dónde se proyecta el conocimiento para poder consultarlo.

    `KnowledgeStore`, no `KnowledgeIndex`: "índice" es lo que guarda, no lo que es.
    Y `prepare`, no `ensure_schema`: el Core no presupone que exista un esquema.
    """

    # --- ciclo de vida
    def prepare(self, taxonomy_fingerprint: str) -> bool:
        """Deja el almacén listo para usarse. Devuelve True si tuvo que reconstruirlo."""

    def is_ready(self) -> bool: ...
    def close(self) -> None: ...

    def transaction(self) -> AbstractContextManager[None]:
        """Agrupa escrituras. Confirma al salir; deshace si hubo excepción."""

    # --- escritura
    def indexed_revisions(self) -> dict[VaultPath, DocumentRevision]: ...
    def upsert_document(self, document: KnowledgeDocument) -> None: ...
    def delete_document(self, path: VaultPath) -> None: ...
    def replace_relations(self, source: VaultPath, relations: Iterable[KnowledgeRelation]) -> None: ...
    def mark_indexed(self, when: str | None = None) -> None:
        """Registra cuándo terminó la última indexación completa."""

    # --- lectura
    def known_documents(self) -> list[tuple[VaultPath, str]]:
        """(ruta, título) de todo lo almacenado: el censo que usa el resolvedor."""

    def sources_pointing_to(self, key: str) -> list[VaultPath]:
        """Documentos cuyos enlaces mencionan esta clave (resueltos o no)."""

    def search(
        self,
        query: str | None = None,
        *,
        type: str | None = None,
        area: str | None = None,
        scope: str | None = None,
        tags: tuple[str, ...] = (),
        limit: int = 20,
    ) -> list[SearchResult]: ...

    def get_document(self, path: VaultPath) -> KnowledgeDocument | None: ...
    def find_by_title(self, title: str) -> list[VaultPath]: ...
    def outbound(self, path: VaultPath) -> list[KnowledgeRelation]: ...
    def inbound(self, path: VaultPath) -> list[KnowledgeRelation]: ...
    def stats(self) -> dict[str, int]: ...
    def last_indexed_at(self) -> str | None: ...
