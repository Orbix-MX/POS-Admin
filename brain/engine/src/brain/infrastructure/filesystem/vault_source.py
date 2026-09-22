"""Implementación de `DocumentSource` sobre archivos Markdown en disco.

Contrato del adaptador: **ningún `OSError` ni error de codificación sale de aquí**.
Todo se traduce a `SourceError`.
"""

from __future__ import annotations

import hashlib
import unicodedata
from fnmatch import fnmatch
from pathlib import Path

from brain.application.errors import SourceError
from brain.domain.models import DocumentRevision, KnowledgeDocument
from brain.domain.taxonomy import Taxonomy
from brain.domain.values import VaultPath
from brain.infrastructure.markdown.document_mapper import to_document

DEFAULT_EXCLUDES = (".obsidian/**", "**/.trash/**", "**/node_modules/**")


class MarkdownVaultSource:
    def __init__(
        self,
        root: Path,
        taxonomy: Taxonomy,
        excludes: tuple[str, ...] = DEFAULT_EXCLUDES,
    ) -> None:
        self.root = root.resolve()
        self.taxonomy = taxonomy
        self.excludes = excludes

    # ------------------------------------------------------------------ rutas
    def to_vault_path(self, absolute: Path) -> VaultPath:
        rel = absolute.resolve().relative_to(self.root).as_posix()
        return VaultPath.parse(unicodedata.normalize("NFC", rel))

    def to_absolute(self, path: VaultPath) -> Path:
        return self.root / path.value

    def _excluded(self, rel: str) -> bool:
        return any(fnmatch(rel, pattern) for pattern in self.excludes)

    # ------------------------------------------------------------------ puerto
    def available(self) -> bool:
        return self.root.is_dir()

    def revisions(self) -> dict[VaultPath, DocumentRevision]:
        if not self.root.is_dir():
            raise SourceError(f"el vault no existe: {self.root}")
        found: dict[VaultPath, DocumentRevision] = {}
        for absolute in sorted(self.root.rglob("*.md")):
            if not absolute.is_file():
                continue
            rel = absolute.relative_to(self.root).as_posix()
            if self._excluded(rel):
                continue
            try:
                path = VaultPath.parse(unicodedata.normalize("NFC", rel))
            except Exception:
                continue
            stat = absolute.stat()
            # El hash se deja vacío: es la ruta rápida. Solo se calcula si
            # tamaño o fecha difieren de lo indexado.
            found[path] = DocumentRevision(stat.st_size, stat.st_mtime_ns, "")
        return found

    def load(self, path: VaultPath) -> KnowledgeDocument:
        absolute = self.to_absolute(path)
        text = self.read_text(path)
        try:
            stat = absolute.stat()
        except OSError as error:
            raise SourceError(f"no se pudo leer {path}") from error
        return to_document(
            path,
            text,
            taxonomy=self.taxonomy,
            content_hash=hash_text(text),
            size_bytes=stat.st_size,
            mtime_ns=stat.st_mtime_ns,
        )

    def read_text(self, path: VaultPath) -> str:
        try:
            raw = self.to_absolute(path).read_bytes()
        except OSError as error:
            raise SourceError(f"no se pudo leer {path}") from error
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        return raw.decode("utf-8", errors="replace")

    def exists(self, path: VaultPath) -> bool:
        return self.to_absolute(path).is_file()


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]
