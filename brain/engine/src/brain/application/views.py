"""DTOs de salida. Ninguna entidad del dominio cruza hacia las interfaces."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class IndexFailureInfo:
    """Un documento que no pudo indexarse.

    `code` pertenece a un vocabulario cerrado y `reason` es texto para personas: el
    nombre de la clase de excepción interna no se propaga.
    """

    path: str
    code: str
    reason: str


@dataclass(frozen=True, slots=True)
class IndexReport:
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    deleted: int = 0
    failed: tuple[IndexFailureInfo, ...] = ()
    rebuilt: bool = False
    resolved_links: int = 0
    unresolved_links: int = 0
    ambiguous_links: int = 0
    duration_seconds: float = 0.0

    @property
    def touched(self) -> int:
        return self.created + self.updated + self.deleted


@dataclass(frozen=True, slots=True)
class SearchHit:
    path: str
    title: str
    type: str
    area: str
    scope: str | None = None
    score: float = 0.0
    snippet: str = ""


@dataclass(frozen=True, slots=True)
class RelationLine:
    """Un enlace visto desde fuera: sin objetos de dominio."""

    path: str | None
    title: str | None
    raw_target: str
    kind: str
    status: str
    occurrences: int = 1
    candidate_count: int = 0


@dataclass(frozen=True, slots=True)
class DocumentView:
    path: str
    title: str
    type: str
    area: str
    scope: str | None
    owner: str | None
    updated: str | None
    tags: tuple[str, ...] = ()
    needs_validation: bool = False
    has_frontmatter: bool = True
    word_count: int = 0
    body: str | None = None


@dataclass(frozen=True, slots=True)
class RelationsView:
    document: DocumentView
    outbound: tuple[RelationLine, ...] = ()
    inbound: tuple[RelationLine, ...] = ()


@dataclass(frozen=True, slots=True)
class IndexStats:
    values: dict[str, int] = field(default_factory=dict)
