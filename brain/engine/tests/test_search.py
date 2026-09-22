from pathlib import Path

import pytest

from brain.application.errors import DocumentNotFound
from brain.domain.taxonomy import AreaRule, ScopeRule, Taxonomy
from brain.infrastructure.config import BrainConfig
from brain.api._composition import build_session_from

TAXONOMY = Taxonomy.of(
    [
        AreaRule("Home", "home"),
        AreaRule("Domain", "domain"),
        AreaRule("Systems", "systems", ScopeRule.CHILD),
    ]
)


def write(vault: Path, rel: str, text: str) -> None:
    target = vault / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


@pytest.fixture
def buscador(tmp_path: Path):
    vault = tmp_path / "vault"
    write(
        vault,
        "Domain/Facturación y Cobranza.md",
        "---\ntitle: Facturación y Cobranza\ntype: business\ntags: [finanzas, cfdi]\n---\n\n"
        "# Facturación y Cobranza\n\n## Timbrado\n\n"
        "El timbrado certifica la factura ante el fisco.\n",
    )
    write(
        vault,
        "Domain/Compras.md",
        "---\ntitle: Compras\ntype: business\ntags: [negocio]\n---\n\n"
        "# Compras\n\nLa orden de compra se autoriza antes de enviarse al proveedor.\n",
    )
    write(
        vault,
        "Systems/ERP API/Finanzas/Finanzas.md",
        "---\ntitle: Módulo Finanzas\ntype: module\ntags: [finanzas]\n---\n\n"
        "# Finanzas\n\nFacturación electrónica y cuentas por cobrar.\n",
    )
    write(
        vault,
        "Systems/Machinery/Compras/Compras (Machinery).md",
        "---\ntitle: Módulo Compras Machinery\ntype: module\ntags: [machinery]\n---\n\n"
        "# Compras\n\nÓrdenes de compra de maquinaria.\n",
    )
    config = BrainConfig(
        root=tmp_path,
        vault_path=vault,
        index_path=tmp_path / ".brain" / "index.db",
        taxonomy=TAXONOMY,
    )
    with build_session_from(config) as brain:
        brain.index_vault().execute()
        yield brain


def titles(hits) -> list[str]:
    return [h.title for h in hits]


class TestTexto:
    def test_encuentra_sin_acentos(self, buscador):
        assert "Facturación y Cobranza" in titles(buscador.search_documents().execute("facturacion"))

    def test_encuentra_con_acentos(self, buscador):
        assert "Facturación y Cobranza" in titles(buscador.search_documents().execute("Facturación"))

    def test_ignora_mayusculas(self, buscador):
        assert titles(buscador.search_documents().execute("TIMBRADO")) == ["Facturación y Cobranza"]

    def test_busca_en_el_cuerpo(self, buscador):
        assert "Compras" in titles(buscador.search_documents().execute("proveedor"))

    def test_busca_en_encabezados(self, buscador):
        assert "Facturación y Cobranza" in titles(buscador.search_documents().execute("timbrado"))

    def test_busca_por_prefijo(self, buscador):
        assert titles(buscador.search_documents().execute("factur"))

    def test_el_titulo_pesa_mas_que_el_cuerpo(self, buscador):
        hits = buscador.search_documents().execute("compras")
        assert hits[0].title in ("Compras", "Módulo Compras Machinery")

    def test_devuelve_extracto(self, buscador):
        hit = buscador.search_documents().execute("timbrado")[0]
        assert "[" in hit.snippet and "]" in hit.snippet

    def test_consulta_sin_resultados_no_falla(self, buscador):
        assert buscador.search_documents().execute("xyzzy") == []

    def test_consulta_con_caracteres_raros_no_revienta(self, buscador):
        for query in ['"', "AND", "-", "a*b", "()", "NEAR/", "'"]:
            buscador.search_documents().execute(query)


class TestFiltros:
    def test_por_tipo(self, buscador):
        hits = buscador.search_documents().execute(type="module")
        assert set(titles(hits)) == {"Módulo Finanzas", "Módulo Compras Machinery"}

    def test_por_area(self, buscador):
        assert len(buscador.search_documents().execute(area="domain")) == 2

    def test_por_alcance(self, buscador):
        assert titles(buscador.search_documents().execute(scope="ERP API")) == ["Módulo Finanzas"]

    def test_por_etiqueta(self, buscador):
        assert len(buscador.search_documents().execute(tags=("finanzas",))) == 2

    def test_varias_etiquetas_exigen_todas(self, buscador):
        assert len(buscador.search_documents().execute(tags=("finanzas", "cfdi"))) == 1
        assert buscador.search_documents().execute(tags=("finanzas", "machinery")) == []

    def test_etiqueta_con_espacios_se_normaliza(self, buscador):
        assert buscador.search_documents().execute(tags=("FINANZAS",))

    def test_texto_mas_filtro(self, buscador):
        hits = buscador.search_documents().execute("facturación", type="module")
        assert titles(hits) == ["Módulo Finanzas"]

    def test_sin_texto_ordena_por_titulo(self, buscador):
        assert titles(buscador.search_documents().execute()) == sorted(
            titles(buscador.search_documents().execute()), key=str.lower
        )

    def test_respeta_el_limite(self, buscador):
        assert len(buscador.search_documents().execute(limit=1)) == 1


class TestLeerDocumento:
    def test_por_ruta(self, buscador):
        view = buscador.read_document().execute("Domain/Compras.md")
        assert view.title == "Compras"
        assert view.body is None

    def test_por_titulo(self, buscador):
        assert buscador.read_document().execute("Compras").path == "Domain/Compras.md"

    def test_el_cuerpo_viene_del_disco(self, buscador, tmp_path):
        # Se edita el archivo SIN reindexar: el índice queda viejo a propósito.
        target = tmp_path / "vault" / "Domain" / "Compras.md"
        target.write_text(
            "---\ntitle: Compras\n---\n\n# Compras\n\nTEXTO RECIÉN ESCRITO\n", encoding="utf-8"
        )
        view = buscador.read_document().execute("Domain/Compras.md", include_body=True)
        assert "TEXTO RECIÉN ESCRITO" in view.body

    def test_documento_inexistente(self, buscador):
        with pytest.raises(DocumentNotFound):
            buscador.read_document().execute("Fantasma")

    def test_expone_etiquetas_y_metadatos(self, buscador):
        view = buscador.read_document().execute("Facturación y Cobranza")
        assert set(view.tags) == {"finanzas", "cfdi"}
        assert view.type == "business"
