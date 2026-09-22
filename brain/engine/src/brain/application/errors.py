"""Errores de la capa de aplicación.

Frontera interna: **ninguna implementación de un puerto debe dejar escapar la excepción
de su tecnología**. El adaptador de SQLite traduce a `StorageError`, el de Markdown a
`SourceError`, y el dominio se traduce en el punto donde se interpreta la entrada.

La capa pública (`brain.api`) traduce estos errores a su propia jerarquía; nada de aquí
llega a un consumidor externo.
"""

from __future__ import annotations


class CoreError(Exception):
    """Raíz de todo error previsto del Core."""


class InvalidReference(CoreError):
    """La referencia recibida no puede designar un documento."""

    def __init__(self, reference: str, reason: str = "") -> None:
        super().__init__(reference)
        self.reference = reference
        self.reason = reason


class DocumentNotFound(CoreError):
    def __init__(self, reference: str) -> None:
        super().__init__(reference)
        self.reference = reference


class AmbiguousDocument(CoreError):
    """Varios documentos responden a la misma referencia. No se adivina: se informa."""

    def __init__(self, reference: str, candidates: tuple[str, ...]) -> None:
        super().__init__(reference)
        self.reference = reference
        #: rutas como texto — nunca objetos del dominio
        self.candidates = candidates


class StorageError(CoreError):
    """El índice no está disponible o no pudo leerse/escribirse."""


class SourceError(CoreError):
    """El vault no está disponible o no pudo leerse."""
