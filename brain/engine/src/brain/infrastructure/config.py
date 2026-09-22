"""Carga de `brain.toml`. Todo tiene valor por defecto: borrar el archivo no rompe nada."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from brain.domain.taxonomy import AreaRule, ScopeRule, Taxonomy

CONFIG_NAME = "brain.toml"

DEFAULT_AREAS: tuple[tuple[str, str, str], ...] = (
    ("Home", "home", "none"),
    ("Domain", "domain", "none"),
    ("Systems", "systems", "child"),
    ("Architecture", "architecture", "none"),
    ("Decisions", "decisions", "none"),
    ("Guides", "guides", "none"),
    ("Logs", "logs", "none"),
    ("AI", "ai", "child"),
    ("Templates", "templates", "none"),
)

DEFAULT_EXCLUDES = (".obsidian/**", "**/.trash/**")
DEFAULT_WEIGHTS = {"title": 8.0, "headings": 3.0, "tags": 2.0, "body": 1.0}


@dataclass(frozen=True, slots=True)
class BrainConfig:
    root: Path
    vault_path: Path
    index_path: Path
    taxonomy: Taxonomy
    excludes: tuple[str, ...] = DEFAULT_EXCLUDES
    weights: tuple[float, ...] = (8.0, 3.0, 2.0, 1.0)
    default_limit: int = 20
    known_types: tuple[str, ...] = ()
    source_file: Path | None = None
    warnings: tuple[str, ...] = field(default_factory=tuple)


def find_config(start: Path | None = None) -> Path | None:
    """Busca `brain.toml` hacia arriba desde el directorio actual."""
    current = (start or Path.cwd()).resolve()
    for candidate in [current, *current.parents]:
        found = candidate / CONFIG_NAME
        if found.is_file():
            return found
    return None


def load_config(explicit: Path | None = None, start: Path | None = None) -> BrainConfig:
    config_file = explicit or find_config(start)
    if config_file is None:
        root = (start or Path.cwd()).resolve()
        return BrainConfig(
            root=root,
            vault_path=root / "vault",
            index_path=root / ".brain" / "index.db",
            taxonomy=_default_taxonomy(),
            warnings=("no se encontró brain.toml: se usan los valores por defecto",),
        )

    root = config_file.parent.resolve()
    with config_file.open("rb") as handle:
        data = tomllib.load(handle)

    warnings: list[str] = []
    vault = data.get("vault", {})
    index = data.get("index", {})
    search = data.get("search", {})
    types = data.get("types", {})

    rules, rule_warnings = _rules(data.get("taxonomy", {}).get("areas"))
    warnings.extend(rule_warnings)

    weights = search.get("weights", DEFAULT_WEIGHTS)
    ordered = tuple(
        float(weights.get(name, DEFAULT_WEIGHTS[name])) for name in ("title", "headings", "tags", "body")
    )

    return BrainConfig(
        root=root,
        vault_path=(root / str(vault.get("path", "vault"))).resolve(),
        index_path=(root / str(index.get("path", ".brain/index.db"))).resolve(),
        taxonomy=Taxonomy.of(rules),
        excludes=tuple(vault.get("exclude", DEFAULT_EXCLUDES)),
        weights=ordered,
        default_limit=int(search.get("default_limit", 20)),
        known_types=tuple(types.get("known", ())),
        source_file=config_file,
        warnings=tuple(warnings),
    )


def _default_taxonomy() -> Taxonomy:
    return Taxonomy.of([AreaRule(f, a, ScopeRule(s)) for f, a, s in DEFAULT_AREAS])


def _rules(raw: object) -> tuple[list[AreaRule], list[str]]:
    if not isinstance(raw, list) or not raw:
        return [AreaRule(f, a, ScopeRule(s)) for f, a, s in DEFAULT_AREAS], []
    rules: list[AreaRule] = []
    warnings: list[str] = []
    for entry in raw:
        if not isinstance(entry, dict) or "folder" not in entry:
            warnings.append(f"regla de taxonomía ignorada: {entry!r}")
            continue
        folder = str(entry["folder"])
        area = str(entry.get("area", folder)).lower()
        raw_scope = str(entry.get("scope", "none")).lower()
        try:
            scope = ScopeRule(raw_scope)
        except ValueError:
            warnings.append(f"alcance desconocido {raw_scope!r} en {folder!r}: se usa 'none'")
            scope = ScopeRule.NONE
        rules.append(AreaRule(folder, area, scope))
    if not rules:
        return [AreaRule(f, a, ScopeRule(s)) for f, a, s in DEFAULT_AREAS], warnings
    return rules, warnings
