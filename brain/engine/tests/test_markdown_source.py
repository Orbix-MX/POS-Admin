from brain.domain.models import UNKNOWN_TYPE, LinkKind
from brain.domain.values import VaultPath
from brain.infrastructure.markdown import frontmatter as fm


def load(source, raw: str):
    return source.load(VaultPath.parse(raw))


class TestDescubrimiento:
    def test_encuentra_los_documentos_del_vault(self, source):
        found = {p.value for p in source.revisions()}
        assert "Home/Inicio.md" in found
        assert "Systems/ERP API/Compras/Compras.md" in found

    def test_excluye_la_carpeta_de_obsidian(self, source):
        assert all(".obsidian" not in p.value for p in source.revisions())

    def test_la_revision_trae_tamano_y_fecha(self, source):
        revision = source.revisions()[VaultPath.parse("Home/Inicio.md")]
        assert revision.size_bytes > 0
        assert revision.mtime_ns > 0


class TestFrontmatter:
    def test_lee_los_campos_conocidos(self, source):
        doc = load(source, "Domain/Facturación.md")
        assert doc.metadata.title == "Facturación y Cobranza"
        assert doc.metadata.type == "business"
        assert doc.metadata.updated == "2026-08-05"
        assert doc.metadata.has_frontmatter is True

    def test_normaliza_y_deduplica_etiquetas(self, source):
        tags = [t.value for t in load(source, "Domain/Facturación.md").metadata.tags]
        assert tags == ["negocio", "cuentas-por-cobrar"]

    def test_acepta_etiqueta_escalar(self, source):
        doc = load(source, "Systems/ERP API/Compras/Compras.md")
        assert [t.value for t in doc.metadata.tags] == ["modulo"]

    def test_detecta_conocimiento_sin_validar(self, source):
        assert load(source, "Domain/Facturación.md").metadata.needs_validation is True
        assert load(source, "Domain/Glosario.md").metadata.needs_validation is False

    def test_frontmatter_invalido_no_rompe_la_indexacion(self, source):
        doc = load(source, "Domain/Frontmatter roto.md")
        assert doc.metadata.has_frontmatter is False
        assert doc.metadata.type == UNKNOWN_TYPE
        assert doc.metadata.title == "Documento con frontmatter invalido"

    def test_sin_frontmatter_el_titulo_sale_del_primer_encabezado(self, source):
        assert load(source, "Domain/Glosario.md").metadata.title == "Glosario"

    def test_plantilla_con_campos_vacios_no_revienta(self, source):
        doc = load(source, "Templates/Business (plantilla).md")
        assert doc.metadata.title == "Plantilla vacia"
        assert doc.metadata.type == UNKNOWN_TYPE
        assert doc.metadata.owner is None

    def test_conserva_los_campos_no_modelados(self, source):
        assert "related" in load(source, "Domain/Facturación.md").metadata.extra


class TestEnlaces:
    def test_extrae_wikilinks(self, source):
        raws = {t.raw for t in load(source, "Home/Inicio.md").targets}
        assert "Facturación" in raws
        assert "Domain/Facturación" in raws

    def test_distingue_incrustacion(self, source):
        embeds = [t for t in load(source, "Home/Inicio.md").targets if t.kind is LinkKind.EMBED]
        assert [t.raw for t in embeds] == ["Glosario"]

    def test_separa_ancla_y_etiqueta(self, source):
        targets = load(source, "Home/Inicio.md").targets
        con_ancla = next(t for t in targets if t.anchor)
        assert con_ancla.raw == "Facturación"
        assert con_ancla.anchor == "Reglas"
        con_etiqueta = next(t for t in targets if t.label)
        assert con_etiqueta.label == "con ruta y etiqueta"

    def test_ignora_enlaces_dentro_de_codigo(self, source):
        raws = {t.raw for t in load(source, "Home/Inicio.md").targets}
        assert "EnlaceDentroDeCodigo" not in raws
        assert "TampocoEsteDeBloque" not in raws

    def test_las_referencias_del_frontmatter_tambien_son_enlaces(self, source):
        refs = [
            t for t in load(source, "Domain/Facturación.md").targets
            if t.kind is LinkKind.METADATA_REF
        ]
        assert [t.raw for t in refs] == ["Domain/Cobranza"]

    def test_registra_la_linea(self, source):
        target = next(t for t in load(source, "Home/Inicio.md").targets if t.raw == "Facturación")
        assert target.line and target.line > 1


class TestTaxonomiaAplicada:
    def test_asigna_area_y_alcance(self, source):
        doc = load(source, "Systems/ERP API/Compras/Compras.md")
        assert (doc.area, doc.scope) == ("systems", "ERP API")

    def test_area_sin_alcance(self, source):
        assert load(source, "Domain/Glosario.md").area == "domain"


class TestContenido:
    def test_el_cuerpo_excluye_el_codigo(self, source):
        body = load(source, "Home/Inicio.md").body_text
        assert "TampocoEsteDeBloque" not in body
        assert "Índice del vault" in body

    def test_cuenta_palabras_y_encabezados(self, source):
        doc = load(source, "Domain/Facturación.md")
        assert doc.word_count > 0
        assert "Reglas" in doc.headings

    def test_el_hash_cambia_con_el_contenido(self, source, temp_vault):
        from brain.infrastructure.filesystem.vault_source import hash_text

        assert hash_text("a") != hash_text("b")
        assert hash_text("a") == hash_text("a")

    def test_lee_el_texto_crudo_del_disco(self, source):
        text = source.read_text(VaultPath.parse("Domain/Facturación.md"))
        assert text.startswith("---")


class TestCoercion:
    def test_as_list_admite_escalar_lista_y_csv(self):
        assert fm.as_list("uno") == ["uno"]
        assert fm.as_list(["uno", "dos"]) == ["uno", "dos"]
        assert fm.as_list("uno, dos") == ["uno", "dos"]
        assert fm.as_list("[uno, dos]") == ["uno", "dos"]
        assert fm.as_list(None) == []
        assert fm.as_list("") == []
