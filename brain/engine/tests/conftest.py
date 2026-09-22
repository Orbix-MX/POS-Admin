from pathlib import Path

import pytest

from brain.domain.taxonomy import AreaRule, ScopeRule, Taxonomy
from brain.infrastructure.filesystem.vault_source import MarkdownVaultSource

SAMPLE_VAULT = Path(__file__).resolve().parent / "fixtures" / "sample_vault"

TAXONOMY = Taxonomy.of(
    [
        AreaRule("Home", "home"),
        AreaRule("Domain", "domain"),
        AreaRule("Systems", "systems", ScopeRule.CHILD),
        AreaRule("Templates", "templates"),
    ]
)


@pytest.fixture
def taxonomy() -> Taxonomy:
    return TAXONOMY


@pytest.fixture
def source() -> MarkdownVaultSource:
    return MarkdownVaultSource(SAMPLE_VAULT, TAXONOMY)


@pytest.fixture
def temp_vault(tmp_path: Path) -> Path:
    """Vault escribible: para pruebas que crean, editan y borran documentos."""
    (tmp_path / "Domain").mkdir()
    (tmp_path / "Home").mkdir()
    (tmp_path / "Home" / "Inicio.md").write_text(
        "---\ntitle: Inicio\ntype: home\ntags: [moc]\n---\n\n# Inicio\n\n[[Compras]]\n",
        encoding="utf-8",
    )
    (tmp_path / "Domain" / "Compras.md").write_text(
        "---\ntitle: Compras\ntype: business\ntags: [negocio]\n---\n\n"
        "# Compras\n\nLa orden de compra se autoriza antes de enviarse.\n",
        encoding="utf-8",
    )
    return tmp_path
