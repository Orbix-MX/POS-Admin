"""Referencias a documentos en el borde público.

Una referencia es **siempre texto**: una ruta (`Domain/Compras.md`) o un título
(`Compras`). Su interpretación es una regla del Core; aquí solo se hace la validación
sintáctica mínima para poder rechazar entradas imposibles antes de tocar el motor.
"""

from __future__ import annotations

from brain.api.errors import InvalidReference

MAX_REFERENCE_LENGTH = 512


def normalize(reference: object) -> str:
    if not isinstance(reference, str):
        raise InvalidReference(
            "la referencia debe ser texto",
            details={"received": type(reference).__name__},
        )
    text = reference.strip()
    if not text:
        raise InvalidReference("la referencia está vacía")
    if len(text) > MAX_REFERENCE_LENGTH:
        raise InvalidReference(
            f"la referencia excede {MAX_REFERENCE_LENGTH} caracteres",
            details={"length": str(len(text))},
        )
    return text
