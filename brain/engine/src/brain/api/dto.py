"""DTOs públicos.

Reglas del borde:
  * inmutables;
  * solo primitivos (`str`, `int`, `float`, `bool`, `None`), tuplas de primitivos o de
    DTOs públicos, y `dict[str, primitivo]`;
  * ni objetos del dominio, ni `Path`, ni enums, ni tipos de infraestructura.

Son un conjunto propio, distinto de `application/views.py`: el interior debe poder
evolucionar sin mover el contrato.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class BrainInfo:
    """Estado del motor. Sustituye a cualquier acceso a la configuración interna."""

    api_version: str
    vault_path: str
    config_path: str | None
    index_path: str
    index_ready: bool
    document_count: int
    last_indexed_at: str | None = None
    warnings: tuple[str, ...] = ()
    defaults: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class IndexFailure:
    """Un documento que no pudo indexarse. `code` es vocabulario cerrado."""

    path: str
    code: str
    reason: str


@dataclass(frozen=True, slots=True)
class IndexResult:
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    deleted: int = 0
    rebuilt: bool = False
    resolved_links: int = 0
    unresolved_links: int = 0
    ambiguous_links: int = 0
    duration_seconds: float = 0.0
    failures: tuple[IndexFailure, ...] = ()

    @property
    def touched(self) -> int:
        return self.created + self.updated + self.deleted


@dataclass(frozen=True, slots=True)
class DocumentSummary:
    path: str
    title: str
    type: str
    area: str
    scope: str | None = None
    score: float = 0.0
    snippet: str = ""


@dataclass(frozen=True, slots=True)
class Document:
    path: str
    title: str
    type: str
    area: str
    scope: str | None = None
    owner: str | None = None
    updated: str | None = None
    tags: tuple[str, ...] = ()
    word_count: int = 0
    needs_validation: bool = False
    has_frontmatter: bool = True
    #: solo presente si se pidió explícitamente; se lee del vault, no del índice
    body: str | None = None


@dataclass(frozen=True, slots=True)
class Relation:
    """Una arista del grafo, vista desde el documento consultado."""

    path: str | None
    title: str | None
    raw_target: str
    kind: str
    status: str
    occurrences: int = 1
    candidate_count: int = 0


@dataclass(frozen=True, slots=True)
class RelationGraph:
    document: Document
    outbound: tuple[Relation, ...] = ()
    inbound: tuple[Relation, ...] = ()


@dataclass(frozen=True, slots=True)
class SearchResponse:
    """Devuelve el eco de lo consultado: un cliente remoto lo necesita para paginar."""

    items: tuple[DocumentSummary, ...] = ()
    count: int = 0
    limit: int = 0
    truncated: bool = False
    query: str | None = None
    filters: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class VaultStats:
    documents: int = 0
    tags: int = 0
    links: int = 0
    resolved: int = 0
    unresolved: int = 0
    ambiguous: int = 0
    needs_validation: int = 0
    without_frontmatter: int = 0


PUBLIC_DTOS: tuple[type, ...] = (
    BrainInfo,
    IndexFailure,
    IndexResult,
    DocumentSummary,
    Document,
    Relation,
    RelationGraph,
    SearchResponse,
    VaultStats,
)


def as_dict(value: Any) -> Any:
    """Convierte cualquier DTO público a estructuras JSON.

    Se publica para que MCP, REST o la CLI no reinventen la serialización —y para que
    no lo hagan de tres formas distintas.
    """
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: as_dict(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, dict):
        return {str(k): as_dict(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [as_dict(v) for v in value]
    return value
