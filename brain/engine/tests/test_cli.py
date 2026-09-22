"""Pruebas de punta a punta de la CLI.

Comprueban lo que un humano o un agente van a experimentar: códigos de salida,
salida JSON estable y que ningún comando reviente con el vault real.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from brain.interfaces.cli.app import app

runner = CliRunner()


@pytest.fixture
def proyecto(tmp_path: Path) -> Path:
    """Proyecto completo: brain.toml + vault, como lo tendría un usuario."""
    vault = tmp_path / "vault"
    (vault / "Domain").mkdir(parents=True)
    (vault / "Home").mkdir(parents=True)
    (vault / "Home" / "Inicio.md").write_text(
        "---\ntitle: Inicio\ntype: home\ntags: [moc]\n---\n\n# Inicio\n\n[[Compras]] [[Pendiente]]\n",
        encoding="utf-8",
    )
    (vault / "Domain" / "Compras.md").write_text(
        "---\ntitle: Compras\ntype: business\ntags: [negocio]\n---\n\n"
        "# Compras\n\nLa orden de compra se autoriza antes de enviarse.\n",
        encoding="utf-8",
    )
    (tmp_path / "brain.toml").write_text(
        '[vault]\npath = "vault"\n\n[index]\npath = ".brain/index.db"\n\n'
        '[[taxonomy.areas]]\nfolder = "Home"\narea = "home"\nscope = "none"\n\n'
        '[[taxonomy.areas]]\nfolder = "Domain"\narea = "domain"\nscope = "none"\n',
        encoding="utf-8",
    )
    return tmp_path


def run(proyecto: Path, *args: str):
    # --config es una opción de cada comando, así que va DESPUÉS del subcomando.
    return runner.invoke(app, [*args, "--config", str(proyecto / "brain.toml")])


class TestIndex:
    def test_indexa_y_reporta(self, proyecto):
        result = run(proyecto, "index")
        assert result.exit_code == 0
        assert "nuevos" in result.stdout

    def test_json_es_parseable(self, proyecto):
        result = run(proyecto, "index", "--json")
        payload = json.loads(result.stdout)
        assert payload["created"] == 2
        assert payload["unresolved_links"] == 1

    def test_crea_el_indice_sin_init_previo(self, proyecto):
        run(proyecto, "index")
        assert (proyecto / ".brain" / "index.db").is_file()

    def test_segunda_corrida_es_incremental(self, proyecto):
        run(proyecto, "index")
        payload = json.loads(run(proyecto, "index", "--json").stdout)
        assert payload["unchanged"] == 2
        assert payload["created"] == 0

    def test_reindexa_un_solo_documento(self, proyecto):
        run(proyecto, "index")
        payload = json.loads(run(proyecto, "index", "Domain/Compras.md", "--json").stdout)
        assert payload["updated"] == 1

    def test_documento_inexistente_devuelve_error(self, proyecto):
        run(proyecto, "index")
        result = run(proyecto, "index", "Domain/Fantasma.md")
        assert result.exit_code == 1

    def test_vault_ausente_devuelve_codigo_2(self, tmp_path):
        (tmp_path / "brain.toml").write_text('[vault]\npath = "no_existe"\n', encoding="utf-8")
        result = run(tmp_path, "index")
        assert result.exit_code == 2


class TestSearch:
    def test_encuentra_sin_acentos(self, proyecto):
        run(proyecto, "index")
        result = run(proyecto, "search", "compra")
        assert result.exit_code == 0
        assert "Compras" in result.stdout

    def test_sin_resultados_devuelve_codigo_1(self, proyecto):
        run(proyecto, "index")
        assert run(proyecto, "search", "xyzzy").exit_code == 1

    def test_json_con_filtros(self, proyecto):
        run(proyecto, "index")
        payload = json.loads(run(proyecto, "search", "--type", "business", "--json").stdout)
        assert [h["title"] for h in payload["items"]] == ["Compras"]

    def test_filtra_por_etiqueta(self, proyecto):
        run(proyecto, "index")
        payload = json.loads(run(proyecto, "search", "--tag", "negocio", "--json").stdout)
        assert payload["count"] == 1

    def test_la_respuesta_hace_eco_de_lo_consultado(self, proyecto):
        """Un consumidor remoto necesita saber qué se buscó y si hubo truncamiento."""
        run(proyecto, "index")
        payload = json.loads(run(proyecto, "search", "compra", "--json").stdout)
        assert payload["query"] == "compra"
        assert payload["truncated"] is False
        assert payload["limit"] > 0


class TestShow:
    def test_muestra_metadatos(self, proyecto):
        run(proyecto, "index")
        result = run(proyecto, "show", "Compras")
        assert "Domain/Compras.md" in result.stdout

    def test_incluye_el_cuerpo_si_se_pide(self, proyecto):
        run(proyecto, "index")
        result = run(proyecto, "show", "Compras", "--body")
        assert "se autoriza antes de enviarse" in result.stdout

    def test_documento_inexistente_devuelve_codigo_1(self, proyecto):
        run(proyecto, "index")
        assert run(proyecto, "show", "Fantasma").exit_code == 1


class TestRelated:
    def test_muestra_salientes_y_entrantes(self, proyecto):
        run(proyecto, "index")
        result = run(proyecto, "related", "Compras")
        assert "Entrantes" in result.stdout
        assert "Inicio" in result.stdout

    def test_json_incluye_el_pendiente(self, proyecto):
        run(proyecto, "index")
        payload = json.loads(run(proyecto, "related", "Inicio", "--json").stdout)
        estados = {line["status"] for line in payload["outbound"]}
        assert estados == {"resolved", "unresolved"}

    def test_direccion_invalida_devuelve_codigo_2(self, proyecto):
        run(proyecto, "index")
        assert run(proyecto, "related", "Compras", "-d", "arriba").exit_code == 2


class TestStats:
    def test_reporta_el_estado(self, proyecto):
        run(proyecto, "index")
        payload = json.loads(run(proyecto, "stats", "--json").stdout)
        assert payload["documents"] == 2
        assert payload["unresolved"] == 1


class TestSinConfiguracion:
    def test_avisa_y_usa_valores_por_defecto(self, tmp_path, monkeypatch):
        """Sin brain.toml el motor funciona con la taxonomía por defecto.

        Se cambia el directorio de trabajo a propósito: sin aislarlo, la búsqueda
        hacia arriba encontraría el brain.toml del repositorio y las pruebas
        indexarían el vault real.
        """
        (tmp_path / "vault" / "Domain").mkdir(parents=True)
        (tmp_path / "vault" / "Domain" / "Nota.md").write_text(
            "---\ntitle: Nota\ntype: business\n---\n\n# Nota\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)
        result = runner.invoke(app, ["index", "--json"])
        assert result.exit_code == 0
        assert json.loads(result.stdout)["created"] == 1
        assert (tmp_path / ".brain" / "index.db").is_file()
