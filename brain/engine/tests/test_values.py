import pytest

from brain.domain.values import InvalidValue, Slug, Tag, VaultPath, fold


class TestFold:
    def test_ignora_acentos_y_mayusculas(self):
        assert fold("Facturación") == fold("FACTURACION") == "facturacion"

    def test_normaliza_unicode_compuesto_y_descompuesto(self):
        assert fold("Almacén") == fold("Almace\u0301n")


class TestVaultPath:
    def test_normaliza_separadores_de_windows(self):
        assert VaultPath.parse(r"Domain\Compras.md").value == "Domain/Compras.md"

    def test_quita_prefijo_relativo(self):
        assert VaultPath.parse("./Home/Inicio.md").value == "Home/Inicio.md"

    @pytest.mark.parametrize(
        "raw", ["/Home/Inicio.md", "C:/Home/Inicio.md", "../fuera.md", "Home/Inicio.txt", ""]
    )
    def test_rechaza_rutas_invalidas(self, raw):
        with pytest.raises(InvalidValue):
            VaultPath.parse(raw)

    def test_link_key_quita_la_extension(self):
        assert VaultPath.parse("Systems/ERP API/ERP API.md").link_key == "Systems/ERP API/ERP API"

    def test_folded_compara_sin_acentos(self):
        assert VaultPath.parse("Domain/Logística.md").folded == "domain/logistica"

    def test_es_hashable_e_inmutable(self):
        path = VaultPath.parse("Home/Inicio.md")
        assert {path: 1}[path] == 1
        with pytest.raises(Exception):
            path.value = "otra.md"


class TestSlug:
    def test_desde_ruta_usa_el_nombre_del_archivo(self):
        assert Slug.from_path(VaultPath.parse("Domain/Atención a Clientes.md")).value == (
            "atencion a clientes"
        )


class TestTag:
    def test_normaliza_almohadilla_y_mayusculas(self):
        assert Tag.of("#Negocio").value == "negocio"

    def test_convierte_espacios_en_guiones(self):
        assert Tag.of("cuentas por pagar").value == "cuentas-por-pagar"

    def test_conserva_jerarquia(self):
        assert Tag.of("arquitectura/seguridad").value == "arquitectura/seguridad"
