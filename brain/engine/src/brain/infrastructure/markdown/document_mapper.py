"""Markdown crudo -> dominio.

Toda la coerción de tipos vive aquí, en un solo archivo. Si algún día entra Pydantic,
entra por esta puerta y no toca nada más.
"""

from __future__ import annotations

from datetime import date, datetime
from types import MappingProxyType
from typing import Any

from brain.domain.models import UNKNOWN_TYPE, DocumentMetadata, KnowledgeDocument
from brain.domain.taxonomy import Taxonomy
from brain.domain.values import Slug, Tag, VaultPath
from brain.infrastructure.markdown import frontmatter as fm

KNOWN_FIELDS = {"title", "type", "owner", "updated", "tags"}


def to_document(
    path: VaultPath,
    text: str,
    *,
    taxonomy: Taxonomy,
    content_hash: str,
    size_bytes: int,
    mtime_ns: int,
) -> KnowledgeDocument:
    parsed = fm.parse(text)
    area, scope = taxonomy.classify(path)
    return KnowledgeDocument(
        path=path,
        slug=Slug.from_path(path),
        metadata=_metadata(parsed, path),
        area=area,
        scope=scope,
        content_hash=content_hash,
        size_bytes=size_bytes,
        mtime_ns=mtime_ns,
        headings=parsed.headings,
        targets=parsed.targets,
        body_text=parsed.body,
        word_count=parsed.word_count,
    )


def _metadata(parsed: fm.ParsedMarkdown, path: VaultPath) -> DocumentMetadata:
    raw = parsed.frontmatter
    return DocumentMetadata(
        title=_title(raw.get("title"), parsed, path),
        type=_text(raw.get("type")) or UNKNOWN_TYPE,
        owner=_text(raw.get("owner")),
        updated=_date(raw.get("updated")),
        tags=_tags(raw.get("tags")),
        extra=MappingProxyType({k: v for k, v in raw.items() if k not in KNOWN_FIELDS}),
        has_frontmatter=parsed.has_frontmatter,
        needs_validation=parsed.needs_validation,
    )


def _title(value: Any, parsed: fm.ParsedMarkdown, path: VaultPath) -> str:
    """Título declarado; si falta, el primer encabezado; si falta, el nombre del archivo."""
    declared = _text(value)
    if declared:
        return declared
    if parsed.headings:
        return parsed.headings[0]
    return path.stem


def _text(value: Any) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    text = str(value).strip()
    return text or None


def _date(value: Any) -> str | None:
    """YAML convierte fechas a objetos por su cuenta: se normaliza todo a ISO."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return _text(value)


def _tags(value: Any) -> tuple[Tag, ...]:
    seen: dict[str, Tag] = {}
    for item in fm.as_list(value):
        try:
            tag = Tag.of(str(item))
        except Exception:
            continue
        seen.setdefault(tag.value, tag)
    return tuple(seen.values())
