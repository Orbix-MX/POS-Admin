"""Alta de un puesto de trabajo: conecta este repositorio con la carpeta maestra.

Se ejecuta UNA vez, tras clonar:

    uv run scripts/setup-workspace.py            # aplica
    uv run scripts/setup-workspace.py --dry-run  # solo muestra qué haría

Hace tres cosas, y solo las que falten:

  1. Importa las reglas del vault en el CLAUDE.md de la carpeta maestra, con una línea
     `@<repo>/CLAUDE.knowledge.md`. Así las reglas se actualizan con `git pull` en vez
     de copiarse a mano.
  2. Añade el hook `Stop` a `<maestra>/.claude/settings.json` para reindexar en silencio
     al terminar cada turno.
  3. Registra el servidor MCP `orbix-brain` en ámbito usuario, con la ruta absoluta de ESTA
     máquina, para que funcione desde cualquier carpeta.

Por qué hace falta un script: la carpeta maestra no es un repositorio, así que nada
puede llegar ahí por `git clone`. Es idempotente: ejecutarlo dos veces no duplica nada.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MASTER = REPO.parent
IMPORT_LINE = f"@{REPO.name}/CLAUDE.knowledge.md"

HOOK_COMMAND = (
    f"cd {REPO.name} && "
    "{ uv run --project engine brain index || "
    "python -m uv run --project engine brain index; } >/dev/null 2>&1 || true"
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="No escribe nada.")
    args = parser.parse_args()

    print(f"repositorio     : {REPO}")
    print(f"carpeta maestra : {MASTER}\n")

    acciones = [
        ("reglas en CLAUDE.md", ensure_import),
        ("hook de reindexado", ensure_hook),
        ("servidor MCP", ensure_mcp),
    ]
    pendientes = 0
    for titulo, accion in acciones:
        estado, detalle = accion(args.dry_run)
        marca = {"ok": "=", "hecho": "+", "pendiente": "!"}[estado]
        print(f" {marca} {titulo:22s} {detalle}")
        pendientes += estado == "pendiente"

    print("\n[dry-run] no se modificó nada." if args.dry_run else "\nListo.")
    if not args.dry_run:
        print("Abre `/hooks` una vez (o reinicia Claude Code) para que el hook se cargue.")
    return 1 if pendientes else 0


# ----------------------------------------------------------------- 1. reglas


def ensure_import(dry_run: bool) -> tuple[str, str]:
    target = MASTER / "CLAUDE.md"
    texto = target.read_text(encoding="utf-8") if target.exists() else ""
    if IMPORT_LINE in texto:
        return "ok", f"ya importadas en {target.name}"
    if dry_run:
        return "hecho", f"se añadiría el import a {target.name}"

    bloque = f"\n{IMPORT_LINE}\n"
    if not texto:
        bloque = f"# Espacio de trabajo Orbix\n{bloque}"
    target.write_text(texto.rstrip("\n") + "\n" + bloque if texto else bloque, encoding="utf-8")
    return "hecho", f"import añadido a {target.name}"


# ------------------------------------------------------------------- 2. hook


def ensure_hook(dry_run: bool) -> tuple[str, str]:
    target = MASTER / ".claude" / "settings.json"
    datos: dict = {}
    if target.exists():
        try:
            datos = json.loads(target.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return "pendiente", f"{target} tiene JSON inválido: revísalo a mano"

    grupos = datos.setdefault("hooks", {}).setdefault("Stop", [])
    ya = any(
        "brain index" in h.get("command", "")
        for g in grupos
        for h in g.get("hooks", [])
    )
    if ya:
        return "ok", "ya configurado"
    if dry_run:
        return "hecho", f"se añadiría el hook Stop a {target}"

    grupos.append({"hooks": [{"type": "command", "command": HOOK_COMMAND, "timeout": 60}]})
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(datos, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return "hecho", "hook Stop añadido"


# -------------------------------------------------------------------- 3. MCP


def ensure_mcp(dry_run: bool) -> tuple[str, str]:
    claude = shutil.which("claude")
    if claude is None:
        return "pendiente", "no encontré el ejecutable `claude`; regístralo a mano (ver README)"

    try:
        listado = subprocess.run(
            [claude, "mcp", "list"], capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=120,
        ).stdout
    except Exception:
        listado = ""
    if listado and "orbix-brain:" in listado:
        return "ok", "ya registrado"
    if dry_run:
        return "hecho", "se registraría el servidor `orbix-brain` en ámbito usuario"

    destino = (REPO / "mcp").as_posix()
    resultado = subprocess.run(
        [claude, "mcp", "add", "orbix-brain", "--scope", "user", "--",
         "uv", "run", "--directory", destino, "brain-mcp"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120,
    )
    if resultado.returncode != 0:
        return "pendiente", f"falló el registro: {resultado.stderr.strip()[:120]}"
    return "hecho", "servidor `orbix-brain` registrado"


if __name__ == "__main__":
    sys.exit(main())
