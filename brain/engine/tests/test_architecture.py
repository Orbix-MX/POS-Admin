"""La prueba que impide que la arquitectura se erosione.

Una regla de dependencia que nadie comprueba es una sugerencia. Esta la convierte
en garantía: falla el build si una capa importa lo que no debe.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parent.parent / "src" / "brain"

# Qué capa puede importar de qué otras (además de sí misma y de la stdlib).
#
# Desde que existe la API pública, `interfaces` es un consumidor externo más: solo ve
# `api`. Y dentro de `api`, únicamente `_composition.py` puede tocar `infrastructure`
# (eso lo verifica `test_public_api.py`, que distingue por archivo).
ALLOWED: dict[str, set[str]] = {
    "domain": set(),
    "application": {"domain"},
    "infrastructure": {"domain", "application"},
    "api": {"domain", "application", "infrastructure"},
    "interfaces": {"api"},
}

# Terceros prohibidos por capa: el núcleo no conoce frameworks ni formatos.
FORBIDDEN_THIRD_PARTY: dict[str, set[str]] = {
    "domain": {"yaml", "sqlite3", "typer", "click", "watchdog", "pydantic", "rich"},
    "application": {"yaml", "sqlite3", "typer", "click", "watchdog", "pydantic", "rich"},
    "interfaces": {"yaml", "sqlite3", "watchdog"},
}

STDLIB = set(sys.stdlib_module_names)


def modules() -> list[tuple[str, Path]]:
    found = []
    for path in sorted(SRC.rglob("*.py")):
        rel = path.relative_to(SRC)
        layer = rel.parts[0] if len(rel.parts) > 1 else rel.stem
        found.append((layer, path))
    return found


def imports_of(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.append(node.module)
    return names


@pytest.mark.parametrize("layer,path", modules(), ids=lambda v: str(v))
def test_capa_no_importa_lo_prohibido(layer, path):
    if layer not in ALLOWED:
        return
    for name in imports_of(path):
        root = name.split(".")[0]

        if name.startswith("brain."):
            target = name.split(".")[1]
            if target == layer:
                continue
            assert target in ALLOWED[layer], (
                f"{path.name} ({layer}) importa brain.{target}: viola la dirección de dependencias"
            )
            continue

        if root in STDLIB or root == "brain":
            continue

        forbidden = FORBIDDEN_THIRD_PARTY.get(layer, set())
        assert root not in forbidden, f"{path.name} ({layer}) importa {root}, prohibido en esta capa"


def test_el_dominio_no_depende_de_terceros():
    for layer, path in modules():
        if layer != "domain":
            continue
        for name in imports_of(path):
            root = name.split(".")[0]
            assert root in STDLIB or root == "brain", (
                f"{path.name} importa {root}: el dominio solo usa la librería estándar"
            )


def test_existen_las_capas_esperadas():
    assert (SRC / "domain").is_dir()
