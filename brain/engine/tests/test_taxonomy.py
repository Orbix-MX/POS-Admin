from brain.domain.taxonomy import AreaRule, ScopeRule, Taxonomy
from brain.domain.values import VaultPath

TAXONOMY = Taxonomy.of(
    [
        AreaRule("Home", "home"),
        AreaRule("Domain", "domain"),
        AreaRule("Systems", "systems", ScopeRule.CHILD),
        AreaRule("AI", "ai", ScopeRule.CHILD),
    ]
)


def classify(raw: str):
    return TAXONOMY.classify(VaultPath.parse(raw))


class TestClassify:
    def test_area_plana(self):
        assert classify("Domain/Compras.md") == ("domain", None)

    def test_alcance_es_el_sistema(self):
        assert classify("Systems/ERP API/ERP API.md") == ("systems", "ERP API")

    def test_alcance_tambien_en_modulos_anidados(self):
        assert classify("Systems/ERP API/Compras/Compras (ERP API).md") == ("systems", "ERP API")

    def test_carpeta_desconocida_no_es_error(self):
        assert classify("Otra/Cosa.md") == ("unclassified", None)

    def test_documento_en_la_raiz_no_tiene_area(self):
        assert classify("2026-08-05.md") == ("unclassified", None)

    def test_ignora_acentos_y_mayusculas_de_la_carpeta(self):
        taxonomy = Taxonomy.of([AreaRule("Decisiónes", "decisions")])
        assert taxonomy.classify(VaultPath.parse("DECISIONES/ADR.md")) == ("decisions", None)


class TestFingerprint:
    def test_es_estable_ante_el_orden(self):
        a = Taxonomy.of([AreaRule("Home", "home"), AreaRule("Domain", "domain")])
        b = Taxonomy.of([AreaRule("Domain", "domain"), AreaRule("Home", "home")])
        assert a.fingerprint() == b.fingerprint()

    def test_cambia_si_cambia_una_regla(self):
        a = Taxonomy.of([AreaRule("Domain", "domain")])
        b = Taxonomy.of([AreaRule("Domain", "negocio")])
        assert a.fingerprint() != b.fingerprint()
