"""CLI de Project Brain.

Es un **consumidor de la API pública como cualquier otro**: importa `brain` y nada más.
Si esta CLI necesitara algo que `brain` no ofrece, sería señal de que la API pública
está incompleta —no de que la CLI necesite un atajo.

Aquí no hay lógica: parsea opciones, invoca, formatea y devuelve un código de salida.
"""

from __future__ import annotations

from typing import Optional

import typer

from brain import (
    AmbiguousReference,
    Brain,
    BrainError,
    DocumentNotFound,
    InvalidReference,
    NotImplementedYet,
    VaultUnavailable,
)
from brain.interfaces.cli import output

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="Project Brain — motor de conocimiento compartido entre desarrolladores e IA.",
)

ConfigOption = typer.Option(None, "--config", "-c", help="Ruta a brain.toml.")
JsonOption = typer.Option(False, "--json", help="Salida legible por máquina.")

#: Códigos de salida: 0 correcto · 1 no hay resultado · 2 entrada o entorno inválidos.
EXIT_BY_CODE = {
    "invalid_reference": 2,
    "configuration_invalid": 2,
    "vault_unavailable": 2,
    "index_unavailable": 2,
    "document_not_found": 1,
    "ambiguous_reference": 1,
    "not_implemented": 1,
    "operation_failed": 1,
}


def _fail(error: BrainError) -> typer.Exit:
    """Traduce un error público a mensaje y código de salida. Sin lógica de negocio."""
    output.fail(f"[{error.code}] {error.message}")
    if isinstance(error, AmbiguousReference):
        for candidate in error.candidates:
            typer.echo(f"    {candidate}")
    return typer.Exit(code=EXIT_BY_CODE.get(error.code, 1))


def _open(config: Optional[str]) -> Brain:
    brain = Brain.open(config)
    for warning in brain.info().warnings:
        output.warn(warning)
    return brain


@app.command("index")
def index_command(
    path: Optional[str] = typer.Argument(
        None, help="Documento concreto a reindexar. Sin argumento, indexa todo el vault."
    ),
    full: bool = typer.Option(False, "--full", help="Reindexa todo, ignorando el incremental."),
    config: Optional[str] = ConfigOption,
    as_json: bool = JsonOption,
) -> None:
    """Indexa el vault (incremental por defecto)."""
    try:
        with _open(config) as brain:
            result = brain.index(path, full=full)
    except (InvalidReference, DocumentNotFound, VaultUnavailable) as error:
        raise _fail(error) from None
    except BrainError as error:
        raise _fail(error) from None

    if as_json:
        output.emit_json(result)
    else:
        if result.rebuilt:
            output.warn("índice reconstruido: cambió el esquema o la taxonomía")
        output.kv(
            [
                ("nuevos", result.created),
                ("actualizados", result.updated),
                ("sin cambios", result.unchanged),
                ("borrados", result.deleted),
                ("enlaces resueltos", result.resolved_links),
                ("enlaces pendientes", result.unresolved_links),
                ("enlaces ambiguos", result.ambiguous_links),
                ("segundos", result.duration_seconds),
            ]
        )
        for failure in result.failures:
            output.warn(f"{failure.path}: {failure.reason} [{failure.code}]")

    raise typer.Exit(code=1 if result.failures else 0)


@app.command("search")
def search_command(
    query: Optional[str] = typer.Argument(None, help="Texto a buscar. Puede omitirse si filtras."),
    type_: Optional[str] = typer.Option(None, "--type", "-t", help="Tipo de documento."),
    area: Optional[str] = typer.Option(None, "--area", "-a", help="Área del vault."),
    scope: Optional[str] = typer.Option(None, "--scope", "-s", help="Sistema o alcance."),
    tag: list[str] = typer.Option([], "--tag", help="Etiqueta (repetible: exige todas)."),
    limit: Optional[int] = typer.Option(None, "--limit", "-n", help="Máximo de resultados."),
    config: Optional[str] = ConfigOption,
    as_json: bool = JsonOption,
) -> None:
    """Busca conocimiento por texto y/o por filtros."""
    try:
        with _open(config) as brain:
            response = brain.search(
                query, type=type_, area=area, scope=scope, tags=tuple(tag), limit=limit
            )
    except BrainError as error:
        raise _fail(error) from None

    if as_json:
        output.emit_json(response)
        raise typer.Exit(code=0 if response.count else 1)

    if not response.count:
        typer.echo("Sin resultados.")
        raise typer.Exit(code=1)

    output.table(
        [
            [
                output.truncate(item.title, 44),
                item.type,
                item.scope or item.area,
                output.truncate(item.snippet or item.path, 60),
            ]
            for item in response.items
        ],
        ["título", "tipo", "ámbito", "coincidencia"],
    )
    typer.echo(f"\n{response.count} resultado(s)" + (" (truncado)" if response.truncated else ""))


@app.command("show")
def show_command(
    document: str = typer.Argument(..., help="Ruta o título del documento."),
    body: bool = typer.Option(False, "--body", "-b", help="Incluye el contenido completo."),
    config: Optional[str] = ConfigOption,
    as_json: bool = JsonOption,
) -> None:
    """Muestra un documento: metadatos y, si se pide, su contenido."""
    try:
        with _open(config) as brain:
            found = brain.get(document, include_body=body)
    except BrainError as error:
        raise _fail(error) from None

    if as_json:
        output.emit_json(found)
        return

    output.kv(
        [
            ("título", found.title),
            ("ruta", found.path),
            ("tipo", found.type),
            ("área", found.area),
            ("ámbito", found.scope or "—"),
            ("responsable", found.owner or "—"),
            ("actualizado", found.updated or "—"),
            ("etiquetas", ", ".join(found.tags) or "—"),
            ("palabras", found.word_count),
            ("sin validar", "sí" if found.needs_validation else "no"),
        ]
    )
    if found.body:
        typer.echo("\n" + "-" * 60)
        typer.echo(found.body)


@app.command("related")
def related_command(
    document: str = typer.Argument(..., help="Ruta o título del documento."),
    direction: str = typer.Option(
        "both", "--direction", "-d", help="both | out | in (salientes, entrantes)."
    ),
    config: Optional[str] = ConfigOption,
    as_json: bool = JsonOption,
) -> None:
    """Muestra los documentos relacionados: salientes y entrantes."""
    try:
        with _open(config) as brain:
            graph = brain.related(document, direction=direction)
    except BrainError as error:
        raise _fail(error) from None

    if as_json:
        output.emit_json(graph)
        return

    typer.echo(typer.style(graph.document.title, bold=True) + f"  ({graph.document.path})")
    if graph.outbound:
        typer.echo("\nSalientes")
        output.table(
            [
                [output.truncate(r.title or r.raw_target, 46), r.status, r.path or "—"]
                for r in graph.outbound
            ],
            ["destino", "estado", "ruta"],
        )
    if graph.inbound:
        typer.echo("\nEntrantes")
        output.table(
            [[output.truncate(r.title or "", 46), r.path or "—"] for r in graph.inbound],
            ["origen", "ruta"],
        )
    if not graph.outbound and not graph.inbound:
        typer.echo("\nSin relaciones.")


@app.command("stats")
def stats_command(config: Optional[str] = ConfigOption, as_json: bool = JsonOption) -> None:
    """Muestra el estado del conocimiento indexado."""
    try:
        with _open(config) as brain:
            stats = brain.stats()
    except BrainError as error:
        raise _fail(error) from None

    if as_json:
        output.emit_json(stats)
    else:
        output.kv(
            [
                ("documentos", stats.documents),
                ("etiquetas", stats.tags),
                ("enlaces", stats.links),
                ("resueltos", stats.resolved),
                ("pendientes", stats.unresolved),
                ("ambiguos", stats.ambiguous),
                ("sin validar", stats.needs_validation),
                ("sin frontmatter", stats.without_frontmatter),
            ]
        )


@app.command("info")
def info_command(config: Optional[str] = ConfigOption, as_json: bool = JsonOption) -> None:
    """Muestra el estado del motor: vault, índice y versión del contrato."""
    try:
        with _open(config) as brain:
            info = brain.info()
    except BrainError as error:
        raise _fail(error) from None

    if as_json:
        output.emit_json(info)
    else:
        output.kv(
            [
                ("versión de la API", info.api_version),
                ("vault", info.vault_path),
                ("configuración", info.config_path or "— (valores por defecto)"),
                ("índice", info.index_path),
                ("índice listo", "sí" if info.index_ready else "no"),
                ("documentos", info.document_count),
                ("última indexación", info.last_indexed_at or "—"),
            ]
        )


@app.command("capabilities", hidden=True)
def capabilities_command(config: Optional[str] = ConfigOption) -> None:
    """Reservado en el contrato público; todavía sin implementación."""
    try:
        with _open(config) as brain:
            output.emit_json(brain.capabilities())
    except NotImplementedYet as error:
        raise _fail(error) from None
    except BrainError as error:
        raise _fail(error) from None


def main() -> None:
    app()


if __name__ == "__main__":
    main()
