"""Entidades del conocimiento.

Markdown y SQLite no existen aquí. Un documento es conocimiento con metadatos,
alcance y enlaces; que venga de un `.md` y acabe en una tabla es problema de otras capas.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from types import MappingProxyType
from typing import Mapping

from brain.domain.values import Slug, Tag, VaultPath

UNKNOWN_TYPE = "unknown"
UNCLASSIFIED_AREA = "unclassified"


class LinkKind(StrEnum):
    LINK = "link"
    EMBED = "embed"
    METADATA_REF = "metadata_ref"


class RelationStatus(StrEnum):
    RESOLVED = "resolved"
    #: el destino no existe todavía — conocimiento pendiente, no un error
    UNRESOLVED = "unresolved"
    #: varios candidatos: defecto real de nomenclatura
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True, slots=True)
class DocumentMetadata:
    """Lo declarado en el frontmatter, ya coercionado a tipos del dominio."""

    title: str
    type: str = UNKNOWN_TYPE
    owner: str | None = None
    updated: str | None = None
    tags: tuple[Tag, ...] = ()
    extra: Mapping[str, object] = field(default_factory=lambda: MappingProxyType({}))
    has_frontmatter: bool = False
    #: el vault marca con "Requiere validación" el conocimiento sin confirmar
    needs_validation: bool = False


@dataclass(frozen=True, slots=True)
class LinkTarget:
    """Un wikilink tal como lo escribió una persona, sin interpretar."""

    raw: str
    kind: LinkKind = LinkKind.LINK
    anchor: str | None = None
    label: str | None = None
    occurrences: int = 1
    line: int | None = None


@dataclass(frozen=True, slots=True)
class KnowledgeDocument:
    """Una unidad de conocimiento."""

    path: VaultPath
    slug: Slug
    metadata: DocumentMetadata
    area: str = UNCLASSIFIED_AREA
    scope: str | None = None
    content_hash: str = ""
    size_bytes: int = 0
    mtime_ns: int = 0
    headings: tuple[str, ...] = ()
    targets: tuple[LinkTarget, ...] = ()
    body_text: str = ""
    word_count: int = 0

    @property
    def title(self) -> str:
        return self.metadata.title


@dataclass(frozen=True, slots=True)
class KnowledgeRelation:
    """Un enlace ya interpretado: de dónde sale, a dónde llega y con qué certeza."""

    source: VaultPath
    raw_target: str
    target_key: str
    kind: LinkKind
    status: RelationStatus
    target: VaultPath | None = None
    anchor: str | None = None
    label: str | None = None
    candidate_count: int = 0
    occurrences: int = 1

    @property
    def is_resolved(self) -> bool:
        return self.status is RelationStatus.RESOLVED


@dataclass(frozen=True, slots=True)
class SearchResult:
    path: VaultPath
    title: str
    type: str
    area: str
    scope: str | None = None
    score: float = 0.0
    snippet: str = ""


@dataclass(frozen=True, slots=True)
class DocumentRevision:
    """Huella de un archivo: sirve para saber si hay que reindexarlo."""

    size_bytes: int
    mtime_ns: int
    content_hash: str

    def unchanged_against(self, other: DocumentRevision | None) -> bool:
        if other is None:
            return False
        if self.content_hash and other.content_hash:
            return self.content_hash == other.content_hash
        return self.size_bytes == other.size_bytes and self.mtime_ns == other.mtime_ns
