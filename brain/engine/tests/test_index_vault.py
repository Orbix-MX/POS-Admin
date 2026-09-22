from pathlib import Path

import pytest

from brain.application.errors import DocumentNotFound
from brain.application.use_cases import IndexVault, ReindexDocument
from brain.domain.taxonomy import AreaRule, ScopeRule, Taxonomy
from brain.domain.values import VaultPath
from brain.infrastructure.config import BrainConfig
from brain.api._composition import build_session_from

TAXONOMY = Taxonomy.of(
    [AreaRule("Home", "home"), AreaRule("Domain", "domain"), AreaRule("Systems", "systems", ScopeRule.CHILD)]
)


@pytest.fixture
def brain(temp_vault: Path, tmp_path: Path):
    config = BrainConfig(
        root=tmp_path,
        vault_path=temp_vault,
        index_path=tmp_path / ".brain" / "index.db",
        taxonomy=TAXONOMY,
    )
    with build_session_from(config) as instance:
        yield instance


def write(vault: Path, rel: str, text: str) -> None:
    target = vault / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


class TestPrimeraIndexacion:
    def test_indexa_todo_el_vault(self, brain):
        report = brain.index_vault().execute()
        assert report.created == 2
        assert report.updated == 0
        assert brain.store.stats()["documents"] == 2

    def test_crea_el_esquema_la_primera_vez(self, brain):
        report = brain.index_vault().execute()
        assert report.rebuilt is True
        assert brain.store.get_meta("schema_version") == "1"

    def test_guarda_metadatos_y_taxonomia(self, brain):
        brain.index_vault().execute()
        doc = brain.store.get_document(VaultPath.parse("Domain/Compras.md"))
        assert doc is not None
        assert doc.metadata.title == "Compras"
        assert doc.area == "domain"
        assert [t.value for t in doc.metadata.tags] == ["negocio"]


class TestIncremental:
    def test_la_segunda_vez_no_reindexa_nada(self, brain):
        brain.index_vault().execute()
        report = brain.index_vault().execute()
        assert (report.created, report.updated, report.unchanged) == (0, 0, 2)

    def test_detecta_un_documento_modificado(self, brain, temp_vault):
        brain.index_vault().execute()
        write(temp_vault, "Domain/Compras.md", "---\ntitle: Compras v2\ntype: business\n---\n\n# Otro\n")
        report = brain.index_vault().execute()
        assert (report.created, report.updated) == (0, 1)
        doc = brain.store.get_document(VaultPath.parse("Domain/Compras.md"))
        assert doc.metadata.title == "Compras v2"

    def test_detecta_un_documento_nuevo(self, brain, temp_vault):
        brain.index_vault().execute()
        write(temp_vault, "Domain/Nuevo.md", "---\ntitle: Nuevo\n---\n\n# Nuevo\n")
        report = brain.index_vault().execute()
        assert (report.created, report.unchanged) == (1, 2)

    def test_detecta_un_documento_borrado(self, brain, temp_vault):
        brain.index_vault().execute()
        (temp_vault / "Domain" / "Compras.md").unlink()
        report = brain.index_vault().execute()
        assert report.deleted == 1
        assert brain.store.stats()["documents"] == 1

    def test_toque_sin_cambio_real_no_cuenta_como_actualizacion(self, brain, temp_vault):
        brain.index_vault().execute()
        target = temp_vault / "Domain" / "Compras.md"
        target.write_text(target.read_text(encoding="utf-8"), encoding="utf-8")
        report = brain.index_vault().execute()
        assert report.updated == 0
        assert report.unchanged == 2

    def test_full_reindexa_aunque_no_haya_cambios(self, brain):
        brain.index_vault().execute()
        report = brain.index_vault().execute(full=True)
        assert report.updated == 2
        assert report.unchanged == 0


class TestReconstruccion:
    def test_cambiar_la_taxonomia_fuerza_reconstruccion(self, brain, temp_vault, tmp_path):
        brain.index_vault().execute()
        otra = BrainConfig(
            root=tmp_path,
            vault_path=temp_vault,
            index_path=tmp_path / ".brain" / "index.db",
            taxonomy=Taxonomy.of([AreaRule("Domain", "negocio")]),
        )
        with build_session_from(otra) as reconfigurado:
            report = reconfigurado.index_vault().execute()
            assert report.rebuilt is True
            doc = reconfigurado.store.get_document(VaultPath.parse("Domain/Compras.md"))
            assert doc.area == "negocio"

    def test_borrar_el_indice_reproduce_el_mismo_estado(self, brain, tmp_path):
        primero = brain.index_vault().execute()
        antes = brain.store.stats()
        brain.store.close()
        (tmp_path / ".brain" / "index.db").unlink()
        segundo = brain.index_vault().execute()
        assert brain.store.stats() == antes
        assert segundo.created == primero.created


class TestResistencia:
    def test_un_documento_ilegible_no_aborta_el_indice(self, brain, temp_vault, monkeypatch):
        original = brain.source.load

        def explota(path):
            if path.value.endswith("Compras.md"):
                raise OSError("disco poseído")
            return original(path)

        monkeypatch.setattr(brain.source, "load", explota)
        report = brain.index_vault().execute()
        assert report.failed and "Compras.md" in report.failed[0].path
        # el nombre de la clase de excepción interna NO viaja en el reporte
        assert report.failed[0].code in ("unreadable", "unknown")
        assert "OSError" not in report.failed[0].reason
        assert brain.store.stats()["documents"] == 1

    def test_frontmatter_invalido_se_indexa_igual(self, brain, temp_vault):
        write(temp_vault, "Domain/Roto.md", "---\ntags: [a\n---\n\n# Roto\n")
        brain.index_vault().execute()
        doc = brain.store.get_document(VaultPath.parse("Domain/Roto.md"))
        assert doc is not None and doc.metadata.has_frontmatter is False


class TestReindexarUnDocumento:
    def test_actualiza_solo_ese_documento(self, brain, temp_vault):
        brain.index_vault().execute()
        write(temp_vault, "Domain/Compras.md", "---\ntitle: Compras v3\n---\n\n# V3\n")
        report = brain.reindex_document().execute("Domain/Compras.md")
        assert report.updated == 1
        assert report.created == 0
        assert brain.store.get_document(VaultPath.parse("Domain/Compras.md")).metadata.title == "Compras v3"

    def test_indexa_un_documento_nuevo(self, brain, temp_vault):
        brain.index_vault().execute()
        write(temp_vault, "Domain/Otro.md", "---\ntitle: Otro\n---\n\n# Otro\n")
        report = brain.reindex_document().execute("Domain/Otro.md")
        assert report.created == 1
        assert brain.store.stats()["documents"] == 3

    def test_borrado_desde_disco_se_refleja(self, brain, temp_vault):
        brain.index_vault().execute()
        (temp_vault / "Domain" / "Compras.md").unlink()
        report = brain.reindex_document().execute("Domain/Compras.md")
        assert report.deleted == 1
        assert brain.store.stats()["documents"] == 1

    def test_documento_inexistente_es_error_explicito(self, brain):
        brain.index_vault().execute()
        with pytest.raises(DocumentNotFound):
            brain.reindex_document().execute("Domain/Fantasma.md")


class TestPuertos:
    def test_los_casos_de_uso_no_conocen_la_implementacion(self):
        import inspect

        for use_case in (IndexVault, ReindexDocument):
            code = inspect.getsource(use_case)
            assert "sqlite" not in code.lower()
            assert "markdown" not in code.lower()
