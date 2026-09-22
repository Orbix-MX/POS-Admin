"""Traduce una ruta del vault a área y alcance.

El dominio NO conoce los nombres de las carpetas: los recibe. Por eso cambiar el
vault de `10 Business/` a `Domain/` es configuración, no un cambio de código.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from enum import StrEnum

from brain.domain.models import UNCLASSIFIED_AREA
from brain.domain.values import VaultPath, fold


class ScopeRule(StrEnum):
    NONE = "none"
    #: el alcance es el primer subdirectorio bajo el área (p. ej. el sistema)
    CHILD = "child"


@dataclass(frozen=True, slots=True)
class AreaRule:
    folder: str
    area: str
    scope: ScopeRule = ScopeRule.NONE


@dataclass(frozen=True, slots=True)
class Taxonomy:
    rules: tuple[AreaRule, ...] = ()

    @classmethod
    def of(cls, rules: list[AreaRule] | tuple[AreaRule, ...]) -> Taxonomy:
        return cls(tuple(rules))

    def classify(self, path: VaultPath) -> tuple[str, str | None]:
        parts = path.parts
        if len(parts) < 2:
            return UNCLASSIFIED_AREA, None
        head = fold(parts[0])
        for rule in self.rules:
            if fold(rule.folder) != head:
                continue
            if rule.scope is ScopeRule.CHILD and len(parts) > 2:
                return rule.area, parts[1]
            return rule.area, None
        return UNCLASSIFIED_AREA, None

    def fingerprint(self) -> str:
        """Huella estable. Si cambia, el índice guardado deja de ser válido."""
        payload = "|".join(
            f"{r.folder}>{r.area}>{r.scope.value}" for r in sorted(self.rules, key=lambda r: r.folder)
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
