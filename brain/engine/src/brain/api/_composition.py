"""Raíz de composición. **Módulo interno**: el único de `api/` que ve `infrastructure`.

Aquí se decide qué implementación concreta cumple cada puerto. Cambiar el almacén o la
fuente de documentos es cambiar este archivo y nada más: ni el dominio, ni los casos de
uso, ni la fachada, ni ningún consumidor se enteran.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from brain.application.ports import DocumentSource, KnowledgeStore
from brain.application.use_cases import (
    DescribeIndex,
    GetRelatedDocuments,
    IndexVault,
    ReadDocument,
    ReindexDocument,
    SearchDocuments,
)
from brain.infrastructure.config import BrainConfig, load_config
from brain.infrastructure.filesystem.vault_source import MarkdownVaultSource
from brain.infrastructure.sqlite.index_repository import SqliteKnowledgeStore


@dataclass(slots=True)
class CoreSession:
    """Casos de uso ya cableados, tipados contra **puertos**, no contra clases concretas."""

    config: BrainConfig
    source: DocumentSource
    store: KnowledgeStore

    @property
    def fingerprint(self) -> str:
        return self.config.taxonomy.fingerprint()

    def index_vault(self) -> IndexVault:
        return IndexVault(self.source, self.store, self.fingerprint)

    def reindex_document(self) -> ReindexDocument:
        return ReindexDocument(self.source, self.store, self.fingerprint)

    def search_documents(self) -> SearchDocuments:
        return SearchDocuments(self.store)

    def read_document(self) -> ReadDocument:
        return ReadDocument(self.source, self.store)

    def get_related(self) -> GetRelatedDocuments:
        return GetRelatedDocuments(self.store)

    def describe_index(self) -> DescribeIndex:
        return DescribeIndex(self.store)

    def close(self) -> None:
        self.store.close()

    def __enter__(self) -> CoreSession:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


def build_session(config_path: Path | None = None, start: Path | None = None) -> CoreSession:
    return build_session_from(load_config(config_path, start))


def build_session_from(config: BrainConfig) -> CoreSession:
    source = MarkdownVaultSource(config.vault_path, config.taxonomy, config.excludes)
    store = SqliteKnowledgeStore(config.index_path, config.weights)
    return CoreSession(config=config, source=source, store=store)
