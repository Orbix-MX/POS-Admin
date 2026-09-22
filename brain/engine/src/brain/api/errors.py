"""Jerarquía pública de errores.

Contrato: **ningún método público lanza algo que no herede de `BrainError`.**
Cada error lleva un `code` estable pensado para máquinas (MCP, REST): un consumidor
mapea por código, nunca parseando el mensaje.
"""

from __future__ import annotations


class BrainError(Exception):
    """Raíz de la jerarquía pública."""

    code = "brain_error"

    def __init__(self, message: str, *, details: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details: dict[str, str] = dict(details or {})

    def __str__(self) -> str:
        return self.message


class ConfigurationError(BrainError):
    """El perfil (`brain.toml`) es inválido o incoherente."""

    code = "configuration_invalid"


class VaultUnavailable(BrainError):
    """El vault no existe o no puede leerse."""

    code = "vault_unavailable"


class IndexUnavailable(BrainError):
    """El índice no puede prepararse, leerse o escribirse."""

    code = "index_unavailable"


class InvalidReference(BrainError):
    """La referencia no puede designar un documento (vacía, absoluta, sin `.md`…)."""

    code = "invalid_reference"


class DocumentNotFound(BrainError):
    code = "document_not_found"


class AmbiguousReference(BrainError):
    """La referencia designa varios documentos. Los candidatos viajan como texto."""

    code = "ambiguous_reference"

    def __init__(
        self,
        message: str,
        *,
        candidates: tuple[str, ...] = (),
        details: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message, details=details)
        self.candidates = candidates


class NotImplementedYet(BrainError):
    """Nombre reservado en el contrato, todavía sin implementación.

    Existe para que el día que se implemente no haya que romper la API.
    """

    code = "not_implemented"


class OperationFailed(BrainError):
    """Red de seguridad: fallo no previsto, ya traducido.

    El tipo interno de la excepción original **no** viaja en `details`.
    """

    code = "operation_failed"


PUBLIC_ERRORS: tuple[type[BrainError], ...] = (
    BrainError,
    ConfigurationError,
    VaultUnavailable,
    IndexUnavailable,
    InvalidReference,
    DocumentNotFound,
    AmbiguousReference,
    NotImplementedYet,
    OperationFailed,
)
