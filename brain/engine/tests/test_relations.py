from pathlib import Path

import pytest

from brain.application.errors import AmbiguousDocument, DocumentNotFound
from brain.domain.taxonomy import AreaRule, ScopeRule, Taxonomy
from brain.domain.values import VaultPath
from brain.infrastructure.config import BrainConfig
from brain.api._composition import build_session_from

TAXONOMY = Taxonomy.of(
    [AreaRule("Home", "home"), AreaRule("Domain", "domain"), AreaRule("Systems", "systems", ScopeRule.CHILD)]
)


def write(vault: Path, rel: str, text: str) -> None:
    target = vault / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


@pytest.fixture
def grafo(tmp_path: Path):
    """Vault pequeño con: enlace normal, pendiente, ambigüedad y enlace repetido."""
    vault = tmp_path / "vault"
    write(vault, "Home/Inicio.md", "---\ntitle: Inicio\n---\n\n[[Compras]] [[Futuro]]\n")
    write(
        vault,
        "Domain/Compras.md",
        "---\ntitle: Compras\n---\n\n[[Domain/Requisiciones]] y otra vez "
        "[[Requisiciones]] y [[Domain/Requisiciones.md]]\n",
    )
    write(vault, "Domain/Requisiciones.md", "---\ntitle: Requisiciones\n---\n\n[[Compras]]\n")
    write(vault, "Systems/A/Nota.md", "---\ntitle: Nota A\n---\n\n[[Nota]]\n")
    write(vault, "Systems/B/Nota.md", "---\ntitle: Nota B\n---\n\ntexto\n")

    config = BrainConfig(
        root=tmp_path,
        vault_path=vault,
        index_path=tmp_path / ".brain" / "index.db",
        taxonomy=TAXONOMY,
    )
    with build_session_from(config) as brain:
        brain.index_vault().execute()
        yield brain


class TestConteos:
    def test_el_reporte_separa_resueltos_pendientes_y_ambiguos(self, grafo):
        report = grafo.index_vault().execute(full=True)
        assert report.resolved_links == 3      # Compras, Requisiciones(x3 fusionado), Compras
        assert report.unresolved_links == 1    # [[Futuro]]
        assert report.ambiguous_links == 1     # [[Nota]] con dos candidatos

    def test_fusiona_el_mismo_destino_y_suma_ocurrencias(self, grafo):
        relations = grafo.store.outbound(VaultPath.parse("Domain/Compras.md"))
        assert len(relations) == 1
        assert relations[0].occurrences == 3


class TestBacklinks:
    def test_los_entrantes_son_reales(self, grafo):
        view = grafo.get_related().execute("Domain/Compras.md")
        origenes = {line.path for line in view.inbound}
        assert origenes == {"Home/Inicio.md", "Domain/Requisiciones.md"}

    def test_los_salientes_traen_titulo_del_destino(self, grafo):
        view = grafo.get_related().execute("Domain/Compras.md", direction="out")
        assert [line.title for line in view.outbound] == ["Requisiciones"]
        assert view.inbound == ()

    def test_el_enlace_pendiente_aparece_sin_ruta(self, grafo):
        view = grafo.get_related().execute("Home/Inicio.md", direction="out")
        pendiente = next(line for line in view.outbound if line.status == "unresolved")
        assert pendiente.raw_target == "Futuro"
        assert pendiente.path is None

    def test_el_ambiguo_reporta_cuantos_candidatos(self, grafo):
        view = grafo.get_related().execute("Systems/A/Nota.md", direction="out")
        ambiguo = next(line for line in view.outbound if line.status == "ambiguous")
        assert ambiguo.candidate_count == 2
        assert ambiguo.path is None


class TestLocalizarDocumento:
    def test_acepta_ruta(self, grafo):
        assert grafo.get_related().execute("Domain/Compras.md").document.title == "Compras"

    def test_acepta_titulo(self, grafo):
        assert grafo.get_related().execute("Compras").document.path == "Domain/Compras.md"

    def test_titulo_ambiguo_no_adivina(self, grafo):
        with pytest.raises(AmbiguousDocument) as error:
            grafo.get_related().execute("Nota")
        assert len(error.value.candidates) == 2

    def test_documento_inexistente(self, grafo):
        with pytest.raises(DocumentNotFound):
            grafo.get_related().execute("No existe")


class TestCicloDeVida:
    def test_crear_el_destino_repara_el_pendiente(self, grafo, tmp_path):
        vault = tmp_path / "vault"
        write(vault, "Domain/Futuro.md", "---\ntitle: Futuro\n---\n\nYa existo.\n")
        grafo.reindex_document().execute("Domain/Futuro.md")
        view = grafo.get_related().execute("Home/Inicio.md", direction="out")
        futuro = next(line for line in view.outbound if line.raw_target == "Futuro")
        assert futuro.status == "resolved"
        assert futuro.path == "Domain/Futuro.md"

    def test_borrar_el_destino_deja_el_enlace_pendiente_no_lo_borra(self, grafo, tmp_path):
        (tmp_path / "vault" / "Domain" / "Compras.md").unlink()
        grafo.reindex_document().execute("Domain/Compras.md")
        view = grafo.get_related().execute("Home/Inicio.md", direction="out")
        compras = next(line for line in view.outbound if line.raw_target == "Compras")
        assert compras.status == "unresolved"
        assert compras.path is None

    def test_resolver_localizado_no_toca_documentos_ajenos(self, grafo, tmp_path):
        antes = grafo.store.outbound(VaultPath.parse("Domain/Requisiciones.md"))
        write(tmp_path / "vault", "Domain/Aislado.md", "---\ntitle: Aislado\n---\n\nnada\n")
        grafo.reindex_document().execute("Domain/Aislado.md")
        assert grafo.store.outbound(VaultPath.parse("Domain/Requisiciones.md")) == antes
