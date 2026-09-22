from brain.domain.link_resolver import KnownDocument, LinkResolver
from brain.domain.models import LinkKind, LinkTarget, RelationStatus
from brain.domain.values import VaultPath

SOURCE = VaultPath.parse("Home/Inicio.md")


def paths(*raw: str) -> list[VaultPath]:
    return [VaultPath.parse(r) for r in raw]


def link(raw: str, **kw) -> LinkTarget:
    return LinkTarget(raw=raw, **kw)


class TestPrecedencia:
    def test_ruta_exacta(self):
        resolver = LinkResolver.from_paths(paths("Domain/Compras.md", "Systems/X/Compras.md"))
        rel = resolver.resolve(SOURCE, link("Domain/Compras"))
        assert rel.status is RelationStatus.RESOLVED
        assert rel.target == VaultPath.parse("Domain/Compras.md")

    def test_ruta_exacta_ignorando_mayusculas_y_acentos(self):
        resolver = LinkResolver.from_paths(paths("Domain/Logística.md"))
        rel = resolver.resolve(SOURCE, link("domain/LOGISTICA"))
        assert rel.status is RelationStatus.RESOLVED

    def test_nombre_unico_en_todo_el_vault(self):
        resolver = LinkResolver.from_paths(paths("Domain/Glosario.md"))
        assert resolver.resolve(SOURCE, link("Glosario")).status is RelationStatus.RESOLVED

    def test_titulo_unico_cuando_el_nombre_no_coincide(self):
        resolver = LinkResolver(
            [KnownDocument(VaultPath.parse("Decisions/ADR-0001 xtoken.md"), title="xtoken")]
        )
        assert resolver.resolve(SOURCE, link("xtoken")).status is RelationStatus.RESOLVED

    def test_la_ruta_gana_al_nombre(self):
        resolver = LinkResolver.from_paths(paths("A/Nota.md", "B/Nota.md", "Nota.md"))
        rel = resolver.resolve(SOURCE, link("A/Nota"))
        assert rel.target == VaultPath.parse("A/Nota.md")


class TestEstados:
    def test_varios_candidatos_es_ambiguo_y_no_elige(self):
        resolver = LinkResolver.from_paths(paths("A/README.md", "B/README.md", "C/README.md"))
        rel = resolver.resolve(SOURCE, link("README"))
        assert rel.status is RelationStatus.AMBIGUOUS
        assert rel.target is None
        assert rel.candidate_count == 3

    def test_destino_inexistente_queda_pendiente_no_roto(self):
        rel = LinkResolver.from_paths(paths("Home/Inicio.md")).resolve(SOURCE, link("Futuro"))
        assert rel.status is RelationStatus.UNRESOLVED
        assert rel.candidate_count == 0


class TestNormalizacion:
    def test_tolera_extension_explicita(self):
        resolver = LinkResolver.from_paths(paths("Domain/Compras.md"))
        assert resolver.resolve(SOURCE, link("Domain/Compras.md")).is_resolved

    def test_tolera_barra_invertida_de_tablas_markdown(self):
        resolver = LinkResolver.from_paths(paths("Domain/Compras.md"))
        assert resolver.resolve(SOURCE, link("Domain/Compras\\")).is_resolved

    def test_conserva_el_texto_original_del_enlace(self):
        resolver = LinkResolver.from_paths(paths("Domain/Compras.md"))
        rel = resolver.resolve(SOURCE, link("  Domain/Compras  ", label="Compras"))
        assert rel.raw_target == "  Domain/Compras  "
        assert rel.label == "Compras"


class TestAgregacion:
    def test_suma_ocurrencias_del_mismo_destino(self):
        resolver = LinkResolver.from_paths(paths("Domain/Compras.md"))
        rels = resolver.resolve_all(
            SOURCE, [link("Domain/Compras"), link("domain/compras"), link("Domain/Compras.md")]
        )
        assert len(rels) == 1
        assert rels[0].occurrences == 3

    def test_no_mezcla_enlace_con_incrustacion(self):
        resolver = LinkResolver.from_paths(paths("Domain/Compras.md"))
        rels = resolver.resolve_all(
            SOURCE, [link("Domain/Compras"), link("Domain/Compras", kind=LinkKind.EMBED)]
        )
        assert {r.kind for r in rels} == {LinkKind.LINK, LinkKind.EMBED}

    def test_conserva_el_ancla(self):
        resolver = LinkResolver.from_paths(paths("Domain/Compras.md"))
        rel = resolver.resolve(SOURCE, link("Domain/Compras", anchor="#Reglas"))
        assert rel.anchor == "#Reglas"
