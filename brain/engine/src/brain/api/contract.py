"""El contrato público: versión, superficie y vocabularios cerrados.

Este módulo es la referencia de lo que un consumidor externo puede dar por estable.
Todo lo que no esté aquí es detalle interno y puede cambiar sin aviso.
"""

from __future__ import annotations

#: Versión del contrato público.
#: 0.x mientras no exista un consumidor externo estable: se admite romper con aviso.
#: Al llegar a 1.0 la política pasa a ser aditiva dentro de la misma mayor.
API_VERSION = "0.1.0"

#: Métodos publicados y ya implementados.
API_METHODS: tuple[str, ...] = (
    "open",
    "close",
    "info",
    "index",
    "search",
    "get",
    "related",
    "stats",
)

#: Nombres **reservados**: forman parte del contrato desde hoy aunque todavía no hagan
#: nada. Existen para que implementarlos mañana sea aditivo y no una ruptura.
#:   capabilities() -> qué sabe hacer esta instancia (adaptadores, funciones opcionales)
#:   health()       -> diagnóstico del motor y del índice
RESERVED_METHODS: tuple[str, ...] = (
    "capabilities",
    "health",
)

# --- Vocabularios cerrados -------------------------------------------------------
# Se publican como cadenas, no como enums: un consumidor remoto recibe JSON.

#: Estado de una relación entre documentos.
RELATION_STATUSES: tuple[str, ...] = ("resolved", "unresolved", "ambiguous")

#: Naturaleza de un enlace.
LINK_KINDS: tuple[str, ...] = ("link", "embed", "metadata_ref")

#: Dirección admitida al pedir relaciones.
DIRECTIONS: tuple[str, ...] = ("both", "out", "in")

#: Motivos por los que un documento puede quedar fuera del índice.
FAILURE_CODES: tuple[str, ...] = ("unreadable", "encoding", "unknown")
