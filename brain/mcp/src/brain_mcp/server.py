"""Adaptador MCP de Project Brain.

Traduce entre el protocolo MCP y la API pública `brain`. Nada más: sin lógica de
negocio, sin caché, sin servicios, sin contexto automático.

Es de **solo lectura**. Mantener el índice al día es trabajo de `brain index`.
"""

from __future__ import annotations

import atexit

from mcp.server.mcpserver import MCPServer

from brain import Brain, BrainError, Document, RelationGraph, SearchResponse

mcp = MCPServer("orbix-brain")

_brain: Brain | None = None


def _open() -> Brain:
    """Una única instancia, perezosa y compartida.

    `Brain.open()` descubre `brain.toml` hacia arriba desde el directorio de trabajo:
    el adaptador no lee configuración ni sabe qué hay dentro.
    """
    global _brain
    if _brain is None:
        _brain = Brain.open()
        atexit.register(_brain.close)
    return _brain


def _failed(error: BrainError) -> RuntimeError:
    """El `code` estable de la API es el contrato; no se importan errores del SDK."""
    return RuntimeError(f"[{error.code}] {error.message}")


@mcp.tool()
def search_documents(
    query: str | None = None,
    type: str | None = None,
    area: str | None = None,
    scope: str | None = None,
    tags: list[str] | None = None,
    limit: int | None = None,
) -> SearchResponse:
    """Busca conocimiento en el vault por texto y/o por filtros.

    Ignora acentos y mayúsculas. Sin `query` devuelve todo lo que cumpla los filtros.

    query: texto libre; busca en título, encabezados, etiquetas y cuerpo.
    type:  business | system | module | architecture | adr | guide | index | ai-context…
    area:  home | domain | systems | architecture | decisions | guides | logs | ai
    scope: sistema concreto dentro de `systems` (p. ej. "ERP API").
    tags:  exige todas las indicadas.
    limit: por defecto el del perfil; la respuesta indica si hubo truncamiento.
    """
    try:
        return _open().search(
            query, type=type, area=area, scope=scope, tags=tuple(tags or ()), limit=limit
        )
    except BrainError as error:
        raise _failed(error) from None


@mcp.tool()
def read_document(ref: str, include_body: bool = False) -> Document:
    """Devuelve un documento del vault por ruta o por título.

    ref:          "Domain/Compras.md" o "Compras". Si el título designa varios
                  documentos, falla indicando los candidatos en vez de adivinar.
    include_body: por defecto solo metadatos. Pide el cuerpo cuando de verdad
                  necesites el contenido; se lee del vault, no del índice.
    """
    try:
        return _open().get(ref, include_body=include_body)
    except BrainError as error:
        raise _failed(error) from None


@mcp.tool()
def related_documents(ref: str, direction: str = "both") -> RelationGraph:
    """Devuelve los documentos relacionados con uno dado.

    Salientes son los que él enlaza; entrantes, los que lo enlazan a él.
    Un enlace `unresolved` apunta a un documento que aún no existe (conocimiento
    pendiente); uno `ambiguous` designa varios (defecto de nomenclatura).

    ref:       ruta o título.
    direction: both | out | in
    """
    try:
        return _open().related(ref, direction=direction)
    except BrainError as error:
        raise _failed(error) from None


def main() -> None:
    """Arranca el servidor sobre stdio, que es el transporte de Claude Code."""
    mcp.run()


if __name__ == "__main__":
    main()
