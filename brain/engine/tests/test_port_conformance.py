"""Conformidad puerto ↔ implementación.

Es la prueba que habría cazado el bloqueante B5: `mark_indexed` se usaba en los casos
de uso sin estar declarado en el puerto, así que una segunda implementación habría
compilado, pasado las pruebas y reventado en la primera indexación.

`Protocol` es tipado estructural sin comprobación en ejecución: si nadie mira, nadie
se entera.
"""

from __future__ import annotations

import ast
import inspect
from pathlib import Path

import pytest

from brain.application.ports import DocumentSource, KnowledgeStore
from brain.infrastructure.filesystem.vault_source import MarkdownVaultSource
from brain.infrastructure.sqlite.index_repository import SqliteKnowledgeStore

SRC = Path(__file__).resolve().parent.parent / "src" / "brain"

PARES = [
    (KnowledgeStore, SqliteKnowledgeStore),
    (DocumentSource, MarkdownVaultSource),
]


def metodos_del_protocolo(protocolo: type) -> list[str]:
    return [
        name
        for name, value in vars(protocolo).items()
        if not name.startswith("_") and callable(value)
    ]


@pytest.mark.parametrize("protocolo,implementacion", PARES, ids=lambda v: v.__name__)
def test_la_implementacion_cumple_el_puerto(protocolo, implementacion):
    faltantes = [m for m in metodos_del_protocolo(protocolo) if not hasattr(implementacion, m)]
    assert not faltantes, f"{implementacion.__name__} no implementa: {faltantes}"


@pytest.mark.parametrize("protocolo,implementacion", PARES, ids=lambda v: v.__name__)
def test_las_firmas_son_compatibles(protocolo, implementacion):
    for nombre in metodos_del_protocolo(protocolo):
        esperada = inspect.signature(getattr(protocolo, nombre))
        real = inspect.signature(getattr(implementacion, nombre))
        esperados = [p for p in esperada.parameters if p != "self"]
        reales = [p for p in real.parameters if p != "self"]
        assert esperados == reales, f"{implementacion.__name__}.{nombre}: {reales} != {esperados}"


def _llamadas_sobre(atributo: str, fuente: str) -> set[str]:
    tree = ast.parse(fuente)
    encontradas: set[str] = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Attribute)
            and node.func.value.attr == atributo
        ):
            encontradas.add(node.func.attr)
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == atributo
        ):
            encontradas.add(node.func.attr)
    return encontradas


def test_los_casos_de_uso_solo_usan_metodos_declarados_en_el_puerto():
    """B5, en la dirección contraria: nada de lo usado puede faltar en el contrato."""
    fuente = (SRC / "application" / "use_cases.py").read_text(encoding="utf-8")
    declarados = set(metodos_del_protocolo(KnowledgeStore)) | set(
        metodos_del_protocolo(DocumentSource)
    )
    usados = _llamadas_sobre("store", fuente) | _llamadas_sobre("source", fuente)
    fuera = usados - declarados
    assert not fuera, f"usados por los casos de uso pero no declarados en un puerto: {fuera}"
