"""Tipos que se validan a sí mismos.

Sin dependencias externas y sin E/S. `PurePosixPath` se usa solo como manipulación
de cadenas: nunca toca el disco.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from pathlib import PurePosixPath

MARKDOWN_SUFFIX = ".md"


def fold(text: str) -> str:
    """Normaliza para comparar: sin acentos, sin mayúsculas, unicode estable.

    Es la única definición de "igualdad de nombres" del sistema. Buscar
    "facturacion" tiene que encontrar "Facturación", y Windows no distingue
    mayúsculas: ambas cosas se resuelven aquí y en ningún otro sitio.
    """
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", stripped).casefold().strip()


class InvalidValue(ValueError):
    """Un value object recibió algo que no puede representar."""


@dataclass(frozen=True, slots=True, order=True)
class VaultPath:
    """Ruta de un documento relativa a la raíz del vault. Es la identidad.

    Siempre POSIX, siempre normalizada, siempre con extensión.
    """

    value: str

    def __post_init__(self) -> None:
        if not self.value:
            raise InvalidValue("la ruta no puede estar vacía")
        if self.value != unicodedata.normalize("NFC", self.value):
            raise InvalidValue(f"ruta sin normalizar unicode: {self.value!r}")
        if self.value.startswith("/") or ":" in self.value.split("/")[0]:
            raise InvalidValue(f"ruta absoluta no permitida: {self.value!r}")
        if ".." in PurePosixPath(self.value).parts:
            raise InvalidValue(f"la ruta escapa del vault: {self.value!r}")
        if not self.value.endswith(MARKDOWN_SUFFIX):
            raise InvalidValue(f"se esperaba un documento .md: {self.value!r}")

    @classmethod
    def parse(cls, raw: str) -> VaultPath:
        text = unicodedata.normalize("NFC", str(raw).strip().replace("\\", "/"))
        while text.startswith("./"):
            text = text[2:]
        # Una ruta absoluta se rechaza, NO se convierte en relativa: colapsar la
        # barra inicial haría pasar por documento del vault algo de fuera de él.
        if text.startswith("/") or ":" in text.split("/")[0]:
            raise InvalidValue(f"ruta absoluta no permitida: {raw!r}")
        return cls("/".join(part for part in text.split("/") if part))

    @property
    def parts(self) -> tuple[str, ...]:
        return PurePosixPath(self.value).parts

    @property
    def stem(self) -> str:
        return PurePosixPath(self.value).stem

    @property
    def link_key(self) -> str:
        """Cómo se referencia esta ruta desde un wikilink: sin extensión."""
        return self.value[: -len(MARKDOWN_SUFFIX)]

    @property
    def folded(self) -> str:
        return fold(self.link_key)

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True, slots=True, order=True)
class Slug:
    """Nombre canónico de un documento, para resolver enlaces por nombre corto."""

    value: str

    def __post_init__(self) -> None:
        if not self.value:
            raise InvalidValue("el slug no puede estar vacío")

    @classmethod
    def of(cls, text: str) -> Slug:
        return cls(fold(text))

    @classmethod
    def from_path(cls, path: VaultPath) -> Slug:
        return cls.of(path.stem)

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True, slots=True, order=True)
class Tag:
    """Etiqueta normalizada. Admite jerarquía con `/`."""

    value: str

    def __post_init__(self) -> None:
        if not self.value:
            raise InvalidValue("la etiqueta no puede estar vacía")
        if any(c.isspace() for c in self.value):
            raise InvalidValue(f"etiqueta con espacios: {self.value!r}")

    @classmethod
    def of(cls, text: str) -> Tag:
        cleaned = fold(str(text)).lstrip("#").strip("/")
        cleaned = "-".join(part for part in cleaned.split() if part)
        return cls(cleaned)

    def __str__(self) -> str:
        return self.value
