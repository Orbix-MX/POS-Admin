"""Pruebas del borde público.

El informe de auditoría demostró que una regla que no se comprueba no existe. Estas
pruebas convierten las cuatro reglas del borde en garantías ejecutables:

  1. la API no ve infraestructura;
  2. sus DTOs solo contienen primitivos;
  3. ninguna excepción ajena a `BrainError` la cruza;
  4. la CLI no importa nada que no sea `brain`.
"""

from __future__ import annotations

import ast
import dataclasses
import json
import sqlite3
import threading
from pathlib import Path

import pytest

import brain
from brain import Brain, as_dict
from brain.api import errors as api_errors
from brain.api.contract import API_METHODS, API_VERSION, RESERVED_METHODS
from brain.api.dto import PUBLIC_DTOS
from brain.application import errors as core_errors

SRC = Path(__file__).resolve().parent.parent / "src" / "brain"

PRIMITIVOS = (str, int, float, bool, type(None))


@pytest.fixture
def proyecto(tmp_path: Path) -> Path:
    vault = tmp_path / "vault"
    (vault / "Domain").mkdir(parents=True)
    (vault / "Domain" / "Compras.md").write_text(
        "---\ntitle: Compras\ntype: business\ntags: [negocio]\n---\n\n"
        "# Compras\n\nLa orden se autoriza. [[Pendiente]]\n",
        encoding="utf-8",
    )
    (tmp_path / "brain.toml").write_text(
        '[vault]\npath = "vault"\n\n[index]\npath = ".brain/index.db"\n\n'
        '[[taxonomy.areas]]\nfolder = "Domain"\narea = "domain"\nscope = "none"\n',
        encoding="utf-8",
    )
    return tmp_path


@pytest.fixture
def abierto(proyecto: Path):
    with Brain.open(str(proyecto / "brain.toml")) as instance:
        instance.index()
        yield instance


# ---------------------------------------------------------------- 1. aislamiento


def imports_of(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.append(node.module)
    return names


class TestAislamiento:
    def test_solo_la_composicion_ve_infraestructura(self):
        for path in sorted((SRC / "api").glob("*.py")):
            if path.name == "_composition.py":
                continue
            infra = [i for i in imports_of(path) if i.startswith("brain.infrastructure")]
            assert not infra, f"{path.name} importa infraestructura: {infra}"

    def test_la_fachada_no_conoce_el_dominio(self):
        dominio = [
            i for i in imports_of(SRC / "api" / "facade.py") if i.startswith("brain.domain")
        ]
        assert not dominio, f"facade.py importa dominio: {dominio}"

    def test_la_cli_solo_consume_la_api_publica(self):
        prohibidos: list[str] = []
        for path in sorted((SRC / "interfaces").rglob("*.py")):
            for name in imports_of(path):
                if name.startswith(("brain.domain", "brain.application", "brain.infrastructure")):
                    prohibidos.append(f"{path.name} -> {name}")
        assert not prohibidos, prohibidos

    def test_el_paquete_publica_un_contrato_explicito(self):
        assert brain.__api_version__ == API_VERSION == "0.1.0"
        assert "Brain" in brain.__all__
        assert not any(n.startswith("_") for n in brain.__all__ if n not in ("__api_version__", "__version__"))


# ---------------------------------------------------------------- 2. pureza de DTOs


def es_publico(tipo: object) -> bool:
    return tipo in PUBLIC_DTOS


class TestDTOs:
    @pytest.mark.parametrize("dto", PUBLIC_DTOS, ids=lambda d: d.__name__)
    def test_solo_contienen_primitivos(self, dto):
        for campo in dataclasses.fields(dto):
            anotacion = str(campo.type)
            assert "brain.domain" not in anotacion, f"{dto.__name__}.{campo.name} expone dominio"
            assert "Path" not in anotacion, f"{dto.__name__}.{campo.name} expone Path"
            assert "Enum" not in anotacion, f"{dto.__name__}.{campo.name} expone un enum"

    @pytest.mark.parametrize("dto", PUBLIC_DTOS, ids=lambda d: d.__name__)
    def test_son_inmutables(self, dto):
        assert dto.__dataclass_params__.frozen

    def test_todo_lo_devuelto_es_serializable(self, abierto):
        for valor in (
            abierto.info(),
            abierto.index(),
            abierto.search("compras"),
            abierto.get("Compras"),
            abierto.related("Compras"),
            abierto.stats(),
        ):
            json.dumps(as_dict(valor), ensure_ascii=False)

    def test_ningun_valor_devuelto_es_de_dominio(self, abierto):
        def revisar(valor):
            if dataclasses.is_dataclass(valor) and not isinstance(valor, type):
                assert type(valor).__module__.startswith("brain.api"), type(valor).__module__
                for campo in dataclasses.fields(valor):
                    revisar(getattr(valor, campo.name))
            elif isinstance(valor, (list, tuple, set)):
                for item in valor:
                    revisar(item)
            elif isinstance(valor, dict):
                for item in valor.values():
                    revisar(item)
            else:
                assert isinstance(valor, PRIMITIVOS), type(valor)

        revisar(abierto.related("Compras"))
        revisar(abierto.search())


# ---------------------------------------------------------------- 3. cierre de errores


class TestErrores:
    def test_todos_heredan_de_brain_error(self):
        for error in api_errors.PUBLIC_ERRORS:
            assert issubclass(error, api_errors.BrainError)

    def test_cada_error_tiene_codigo_estable_y_unico(self):
        codigos = [e.code for e in api_errors.PUBLIC_ERRORS if e is not api_errors.BrainError]
        assert len(codigos) == len(set(codigos))
        assert all(c.islower() and " " not in c for c in codigos)

    def test_un_fallo_de_sqlite_no_cruza_la_frontera(self, abierto, monkeypatch):
        """El hallazgo B2 del informe: antes salía `sqlite3.OperationalError`."""

        def revienta(*_args, **_kwargs):
            raise sqlite3.OperationalError("no such table: documents")

        monkeypatch.setattr(abierto._session.store, "search", revienta)
        with pytest.raises(api_errors.BrainError) as error:
            abierto.search("compras")
        assert not isinstance(error.value, sqlite3.Error)

    def test_un_error_del_almacen_se_traduce(self, abierto, monkeypatch):
        monkeypatch.setattr(
            abierto._session.store,
            "stats",
            lambda: (_ for _ in ()).throw(core_errors.StorageError("índice ilegible")),
        )
        with pytest.raises(api_errors.IndexUnavailable):
            abierto.stats()

    def test_un_error_del_dominio_se_traduce(self, abierto):
        """El hallazgo G2: antes escapaba `InvalidValue` con traza."""
        with pytest.raises(api_errors.InvalidReference) as error:
            abierto.index("notas.txt")
        assert error.value.code == "invalid_reference"

    def test_una_excepcion_inesperada_se_convierte_en_operation_failed(self, abierto, monkeypatch):
        monkeypatch.setattr(
            abierto._session.store,
            "stats",
            lambda: (_ for _ in ()).throw(ZeroDivisionError("boom")),
        )
        with pytest.raises(api_errors.OperationFailed) as error:
            abierto.stats()
        assert "ZeroDivisionError" not in str(error.value)
        assert "ZeroDivisionError" not in json.dumps(error.value.details)

    def test_los_candidatos_ambiguos_viajan_como_texto(self, tmp_path):
        """El hallazgo G1: antes viajaban objetos `VaultPath` del dominio."""
        vault = tmp_path / "vault"
        for carpeta in ("A", "B"):
            (vault / carpeta).mkdir(parents=True)
            (vault / carpeta / "Nota.md").write_text(
                "---\ntitle: Nota\n---\n\n# Nota\n", encoding="utf-8"
            )
        (tmp_path / "brain.toml").write_text('[vault]\npath = "vault"\n', encoding="utf-8")
        with Brain.open(str(tmp_path / "brain.toml")) as instance:
            instance.index()
            with pytest.raises(api_errors.AmbiguousReference) as error:
                instance.get("Nota")
            assert all(isinstance(c, str) for c in error.value.candidates)
            assert len(error.value.candidates) == 2

    def test_documento_inexistente(self, abierto):
        with pytest.raises(api_errors.DocumentNotFound):
            abierto.get("Fantasma")

    def test_vault_ausente(self, tmp_path):
        (tmp_path / "brain.toml").write_text('[vault]\npath = "no_existe"\n', encoding="utf-8")
        with pytest.raises(api_errors.VaultUnavailable):
            Brain.open(str(tmp_path / "brain.toml"))


# ---------------------------------------------------------------- 4. ciclo de vida


class TestCicloDeVida:
    def test_open_deja_el_indice_listo_sin_intervencion(self, proyecto):
        """El hallazgo B3: antes el consumidor tenía que llamar a ensure_schema."""
        with Brain.open(str(proyecto / "brain.toml")) as instance:
            assert instance.info().index_ready is True
            assert instance.search("cualquier cosa").count == 0  # no revienta

    def test_close_es_idempotente(self, proyecto):
        instance = Brain.open(str(proyecto / "brain.toml"))
        instance.close()
        instance.close()

    def test_usar_una_instancia_cerrada_da_error_publico(self, proyecto):
        instance = Brain.open(str(proyecto / "brain.toml"))
        instance.close()
        with pytest.raises(api_errors.IndexUnavailable):
            instance.stats()

    def test_las_escrituras_se_serializan(self, abierto):
        """Contrato de concurrencia: `index()` es la única operación que escribe."""
        errores: list[BaseException] = []

        def indexar():
            try:
                abierto.index()
            except BaseException as error:  # noqa: BLE001
                errores.append(error)

        hilos = [threading.Thread(target=indexar) for _ in range(4)]
        for h in hilos:
            h.start()
        for h in hilos:
            h.join()
        assert not errores
        assert abierto.stats().documents == 1


# ---------------------------------------------------------------- 5. contrato


class TestContrato:
    def test_los_metodos_publicados_existen(self):
        for nombre in API_METHODS:
            assert hasattr(Brain, nombre), nombre

    def test_los_nombres_reservados_existen_y_avisan(self, abierto):
        for nombre in RESERVED_METHODS:
            assert hasattr(Brain, nombre), nombre
            with pytest.raises(api_errors.NotImplementedYet):
                getattr(abierto, nombre)()

    def test_reservados_y_publicados_no_se_solapan(self):
        assert not set(API_METHODS) & set(RESERVED_METHODS)

    def test_la_api_no_expone_nada_mas(self):
        publicos = {
            n
            for n in dir(Brain)
            if not n.startswith("_") and callable(getattr(Brain, n, None))
        }
        assert publicos == set(API_METHODS) | set(RESERVED_METHODS)
