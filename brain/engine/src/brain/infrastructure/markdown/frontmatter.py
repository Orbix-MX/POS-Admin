"""Separa el frontmatter YAML del cuerpo y extrae enlaces y encabezados.

Regla: **nunca abortar por un documento malo**. Un frontmatter inválido produce un
documento con `has_frontmatter=False`, no una excepción; el vault sigue indexable y
`verify` (Fase 3) lo reportará.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import yaml

from brain.domain.models import LinkKind, LinkTarget

FRONTMATTER = re.compile(r"\A﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL)
WIKILINK = re.compile(r"(!?)\[\[([^\]\[|#]+)(#[^\]\[|]*)?(\|[^\]\[]*)?\]\]")
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*$", re.MULTILINE)
FENCE = re.compile(r"^```.*?^```", re.MULTILINE | re.DOTALL)
INLINE_CODE = re.compile(r"`[^`\n]*`")
# Cubre "requiere validación", "requieren validación" y "requerido validar".
NEEDS_VALIDATION = re.compile(r"requier\w*\s+valida", re.IGNORECASE)

#: campos del frontmatter que referencian otros documentos
METADATA_REF_FIELDS = ("related", "supersedes", "superseded_by", "system", "parent")


@dataclass(frozen=True, slots=True)
class ParsedMarkdown:
    frontmatter: dict[str, Any]
    has_frontmatter: bool
    body: str
    headings: tuple[str, ...]
    targets: tuple[LinkTarget, ...]
    needs_validation: bool
    word_count: int


def parse(text: str) -> ParsedMarkdown:
    frontmatter, has_frontmatter, body = _split(text)
    # Todo se analiza sobre el cuerpo enmascarado: un wikilink dentro de un bloque de
    # código es un ejemplo, no una relación del grafo.
    masked = _mask_code(body)
    return ParsedMarkdown(
        frontmatter=frontmatter,
        has_frontmatter=has_frontmatter,
        body=masked,
        headings=tuple(m.group(2).strip() for m in HEADING.finditer(masked) if m.group(2).strip()),
        targets=_targets(masked, frontmatter),
        # Solo en el cuerpo: `owner: Requiere validación` significa "no sabemos quién
        # es el dueño", no "este conocimiento está sin confirmar". Buscarlo en el
        # frontmatter marcaba casi el vault entero y volvía el dato inútil.
        needs_validation=bool(NEEDS_VALIDATION.search(masked)),
        word_count=len(masked.split()),
    )


def _split(text: str) -> tuple[dict[str, Any], bool, str]:
    match = FRONTMATTER.match(text)
    if match is None:
        return {}, False, text
    body = text[match.end() :]
    try:
        loaded = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return {}, False, body
    if not isinstance(loaded, dict):
        return {}, False, body
    return loaded, True, body


def _mask_code(body: str) -> str:
    """Vacía bloques y fragmentos de código conservando los saltos de línea.

    Conservarlos importa: los números de línea que reporta cada enlace se calculan
    contando saltos, y deben seguir apuntando al archivo real.
    """

    def blank(match: re.Match[str]) -> str:
        return "\n" * match.group(0).count("\n")

    return INLINE_CODE.sub(blank, FENCE.sub(blank, body))


def _targets(body: str, frontmatter: dict[str, Any]) -> tuple[LinkTarget, ...]:
    found: list[LinkTarget] = []
    offset = 0
    for match in WIKILINK.finditer(body):
        bang, raw, anchor, alias = match.groups()
        line = body.count("\n", offset, match.start()) + 1
        found.append(
            LinkTarget(
                raw=raw.strip(),
                kind=LinkKind.EMBED if bang else LinkKind.LINK,
                anchor=anchor.lstrip("#").strip() if anchor else None,
                label=alias[1:].strip() if alias else None,
                line=line,
            )
        )
    for field in METADATA_REF_FIELDS:
        for raw in as_list(frontmatter.get(field)):
            cleaned = str(raw).strip().strip("[]")
            if cleaned:
                found.append(LinkTarget(raw=cleaned, kind=LinkKind.METADATA_REF))
    return tuple(found)


def as_list(value: Any) -> list[Any]:
    if value is None or isinstance(value, bool):
        return []
    if isinstance(value, (list, tuple, set)):
        return [v for v in value if v is not None]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("[") and text.endswith("]"):
            return [p.strip() for p in text[1:-1].split(",") if p.strip()]
        if "," in text:
            return [p.strip() for p in text.split(",") if p.strip()]
        return [text]
    return [value]
