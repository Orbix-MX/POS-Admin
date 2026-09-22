"""Presentación. Dos formatos desde el primer día: humano y máquina.

Que una IA pueda consumir la CLI sin parsear tablas es requisito del proyecto, no un
adorno: es el primer adaptador de agentes que existe.
"""

from __future__ import annotations

import dataclasses
import json
from typing import Any

import typer


def emit_json(payload: Any) -> None:
    typer.echo(json.dumps(_plain(payload), ensure_ascii=False, indent=2, default=str))


def _plain(value: Any) -> Any:
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: _plain(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_plain(v) for v in value]
    return value


def table(rows: list[list[str]], headers: list[str]) -> None:
    if not rows:
        return
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))
    line = "  ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    typer.echo(typer.style(line, bold=True))
    typer.echo("  ".join("-" * w for w in widths))
    for row in rows:
        typer.echo("  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row)))


def kv(pairs: list[tuple[str, object]]) -> None:
    width = max((len(k) for k, _ in pairs), default=0)
    for key, value in pairs:
        typer.echo(f"{key.ljust(width)}  {value}")


def truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


def warn(message: str) -> None:
    typer.echo(typer.style(f"! {message}", fg=typer.colors.YELLOW), err=True)


def fail(message: str) -> None:
    typer.echo(typer.style(f"✗ {message}", fg=typer.colors.RED), err=True)
