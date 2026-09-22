"""Project Brain — motor de conocimiento compartido entre desarrolladores e IA.

**Este módulo es el contrato público.** Lo que se exporta aquí es lo que un consumidor
externo (CLI, MCP, REST, VSCode) puede usar y dar por estable. Todo lo demás
—`brain.domain`, `brain.application`, `brain.infrastructure`— es interior y puede
cambiar sin aviso.

Uso::

    from brain import Brain

    with Brain.open() as brain:
        brain.index()
        respuesta = brain.search("facturacion")

Garantías del borde:
  * ningún tipo devuelto pertenece al dominio o a la infraestructura;
  * ninguna excepción que salga hereda de otra cosa que no sea `BrainError`;
  * el ciclo de vida del índice lo gestiona `Brain`, no el consumidor.
"""

from brain.api.contract import (
    API_METHODS,
    API_VERSION,
    DIRECTIONS,
    FAILURE_CODES,
    LINK_KINDS,
    RELATION_STATUSES,
    RESERVED_METHODS,
)
from brain.api.dto import (
    BrainInfo,
    Document,
    DocumentSummary,
    IndexFailure,
    IndexResult,
    Relation,
    RelationGraph,
    SearchResponse,
    VaultStats,
    as_dict,
)
from brain.api.errors import (
    AmbiguousReference,
    BrainError,
    ConfigurationError,
    DocumentNotFound,
    IndexUnavailable,
    InvalidReference,
    NotImplementedYet,
    OperationFailed,
    VaultUnavailable,
)
from brain.api.facade import Brain

__version__ = "0.1.0"
__api_version__ = API_VERSION

__all__ = [
    # punto de entrada
    "Brain",
    # DTOs
    "BrainInfo",
    "Document",
    "DocumentSummary",
    "IndexFailure",
    "IndexResult",
    "Relation",
    "RelationGraph",
    "SearchResponse",
    "VaultStats",
    "as_dict",
    # errores
    "BrainError",
    "ConfigurationError",
    "VaultUnavailable",
    "IndexUnavailable",
    "InvalidReference",
    "DocumentNotFound",
    "AmbiguousReference",
    "NotImplementedYet",
    "OperationFailed",
    # contrato
    "API_VERSION",
    "API_METHODS",
    "RESERVED_METHODS",
    "RELATION_STATUSES",
    "LINK_KINDS",
    "DIRECTIONS",
    "FAILURE_CODES",
    "__api_version__",
    "__version__",
]
