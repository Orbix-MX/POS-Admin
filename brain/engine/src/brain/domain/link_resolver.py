"""Resolución de wikilinks: de un texto escrito por una persona a un documento.

Es la pieza que convierte un montón de archivos en un grafo, y la que decide qué
significa "este enlace está roto". Función pura: recibe el censo de documentos
conocidos, no lo consulta a nadie.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import PurePosixPath

from brain.domain.models import KnowledgeRelation, LinkTarget, RelationStatus
from brain.domain.values import VaultPath, fold


@dataclass(frozen=True, slots=True)
class KnownDocument:
    path: VaultPath
    title: str = ""


class LinkResolver:
    """Precedencia (primera coincidencia gana):

    1. ruta relativa exacta
    2. ruta relativa exacta ignorando mayúsculas y acentos  (Windows, español)
    3. nombre de archivo único en todo el vault              (estilo Obsidian)
    4. título único
    Varios candidatos -> ambiguo. Ninguno -> pendiente.
    """

    __slots__ = ("_by_path", "_by_name", "_by_title")

    def __init__(self, documents: list[KnownDocument] | tuple[KnownDocument, ...]) -> None:
        self._by_path: dict[str, VaultPath] = {}
        self._by_name: dict[str, list[VaultPath]] = defaultdict(list)
        self._by_title: dict[str, list[VaultPath]] = defaultdict(list)
        for doc in documents:
            self._by_path[doc.path.folded] = doc.path
            self._by_name[fold(doc.path.stem)].append(doc.path)
            if doc.title:
                self._by_title[fold(doc.title)].append(doc.path)

    @classmethod
    def from_paths(cls, paths: list[VaultPath] | tuple[VaultPath, ...]) -> LinkResolver:
        return cls([KnownDocument(path) for path in paths])

    def resolve(self, source: VaultPath, target: LinkTarget) -> KnowledgeRelation:
        key = _normalize_target(target.raw)
        candidates = self._candidates(key)

        if len(candidates) == 1:
            status = RelationStatus.RESOLVED
            resolved: VaultPath | None = candidates[0]
        elif len(candidates) > 1:
            status = RelationStatus.AMBIGUOUS
            resolved = None
        else:
            status = RelationStatus.UNRESOLVED
            resolved = None

        # Un enlace a uno mismo se resuelve, pero no aporta al grafo.
        return KnowledgeRelation(
            source=source,
            raw_target=target.raw,
            target_key=key,
            kind=target.kind,
            status=status,
            target=resolved,
            anchor=target.anchor,
            label=target.label,
            candidate_count=len(candidates),
            occurrences=target.occurrences,
        )

    def resolve_all(
        self, source: VaultPath, targets: list[LinkTarget] | tuple[LinkTarget, ...]
    ) -> list[KnowledgeRelation]:
        """Una arista por (documento destino, tipo), no una por grafía.

        La fusión ocurre DESPUÉS de resolver: `[[Domain/Compras]]` y `[[Compras]]`
        son la misma relación escrita de dos maneras, y el grafo debe verlas como
        una sola arista con dos ocurrencias. Los pendientes y los ambiguos, que no
        tienen documento destino, se agrupan por su clave textual.
        """
        merged: dict[tuple[str, str], KnowledgeRelation] = {}
        for target in targets:
            relation = self.resolve(source, target)
            identity = relation.target.value if relation.target else relation.target_key
            key = (identity, str(relation.kind))
            existing = merged.get(key)
            if existing is None:
                merged[key] = relation
            else:
                merged[key] = KnowledgeRelation(
                    source=existing.source,
                    raw_target=existing.raw_target,
                    target_key=existing.target_key,
                    kind=existing.kind,
                    status=existing.status,
                    target=existing.target,
                    anchor=existing.anchor or relation.anchor,
                    label=existing.label or relation.label,
                    candidate_count=existing.candidate_count,
                    occurrences=existing.occurrences + relation.occurrences,
                )
        return list(merged.values())

    def _candidates(self, key: str) -> list[VaultPath]:
        exact = self._by_path.get(key)
        if exact is not None:
            return [exact]
        name = fold(PurePosixPath(key).name)
        by_name = self._by_name.get(name, [])
        if by_name:
            return list(by_name)
        return list(self._by_title.get(key, []))


def _normalize_target(raw: str) -> str:
    """El destino tal cual se escribió, listo para comparar.

    Tolera la barra invertida que dejan los enlaces dentro de tablas Markdown
    (`[[ruta\\|Etiqueta]]`) y la extensión explícita.
    """
    text = raw.strip().replace("\\", "/").strip("/")
    text = fold(text)
    if text.endswith(".md"):
        text = text[:-3]
    return text
