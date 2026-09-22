"""
Fase 0 — Migracion de layout del Vault (Project Brain).

Uso:
    python scripts/migrate_vault_layout.py --dry-run
    python scripts/migrate_vault_layout.py --apply

Que hace:
  1. Renombra las areas numeradas a la taxonomia acordada (10 Business -> Domain, etc.).
  2. Renombra las carpetas de sistema ambiguas (API -> ERP API, ERP -> ERP Front).
  3. Elimina los basename duplicados (38 README.md, 9 SYSTEM.md) renombrandolos al concepto.
  4. Consolida las bitacoras vacias en Logs/.
  5. Crea el area AI/ con Commands/ y Context/.
  6. Reescribe todos los wikilinks y las referencias de ruta en texto.
  7. Verifica que no queden enlaces rotos ni ambiguos por culpa de la migracion.

Es un script de un solo uso. No forma parte del engine.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VAULT = ROOT / "vault"

# ---------------------------------------------------------------- taxonomia

AREA_RENAMES = {
    "00 Home": "Home",
    "10 Business": "Domain",
    "20 Systems": "Systems",
    "30 Architecture": "Architecture",
    "40 Decisions": "Decisions",
    "50 Guides": "Guides",
    "60 Logs": "Logs",
    "90 Templates": "Templates",
}

SYSTEM_RENAMES = {
    "API": "ERP API",
    "ERP": "ERP Front",
}

NEW_AREAS = ["AI/Commands", "AI/Context"]

# Nombre del doc de cada modulo. Regla: el concepto a secas si el basename queda
# unico en todo el vault; calificado con el sistema si colisiona o si el concepto
# suelto seria ambiguo para un humano.
MODULE_DOC_NAMES = {
    ("ERP API", "Almacen"): "Almacen",
    ("ERP API", "Aprobaciones"): "Aprobaciones (ERP API)",
    ("ERP API", "Arrendamiento"): "Arrendamiento (ERP API)",
    ("ERP API", "Atencion a Clientes"): "Atencion a Clientes (ERP API)",
    ("ERP API", "Catalogos"): "Catalogos",
    ("ERP API", "Cola"): "Cola de trabajos (ERP API)",
    ("ERP API", "Compras"): "Compras (ERP API)",
    ("ERP API", "Finanzas"): "Finanzas",
    ("ERP API", "Integraciones"): "Integraciones (ERP API)",
    ("ERP API", "Inventario de Cliente"): "Inventario de Cliente",
    ("ERP API", "Logistica"): "Logistica (ERP API)",
    ("ERP API", "Notificaciones"): "Notificaciones (ERP API)",
    ("ERP API", "Recursos Humanos"): "Recursos Humanos (ERP API)",
    ("ERP API", "Reportes y KPIs"): "Reportes y KPIs",
    ("ERP API", "Requisiciones"): "Requisiciones (ERP API)",
    ("ERP API", "Seguridad"): "Seguridad (ERP API)",
    ("ERP API", "Servicio"): "Servicio",
    ("ERP Front", "Capa de API"): "Capa de API",
    ("ERP Front", "Cotizaciones"): "Cotizaciones (ERP Front)",
    ("ERP Front", "Flujos de Aprobacion"): "Flujos de Aprobacion",
    ("ERP Front", "Operacion y Monitoreo"): "Operacion y Monitoreo",
    ("ERP Front", "Ruteo y Menu"): "Ruteo y Menu",
    ("ERP Front", "Sesion y Permisos"): "Sesion y Permisos",
    ("Machinery Express API", "Catalogo de Maquinaria"): "Catalogo de Maquinaria",
    ("Machinery Express API", "Compras"): "Compras (Machinery Express API)",
    ("Machinery Express API", "Entregas"): "Entregas (Machinery Express API)",
    ("Machinery Express API", "Integracion con ILIOS"): "Integracion con ILIOS",
    ("Machinery Express API", "Inventario"): "Inventario (Machinery Express API)",
    ("Machinery Express API", "Seguridad"): "Seguridad (Machinery Express API)",
}

# Bitacoras vacias que quedan superadas por Logs/Bitacora <Sistema>.md
OBSOLETE_LOGS = ["API.md", "ERP.md", "Machienery Express.md"]

WIKILINK = re.compile(r"(!?)\[\[([^\]\[|#]+)(#[^\]\[|]*)?(\|[^\]\[]*)?\]\]")


def fold(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).casefold()


# ---------------------------------------------------------------- plan


def build_plan() -> tuple[list[tuple[Path, Path]], list[Path], dict[str, str]]:
    """Devuelve (movimientos, borrados, mapa_de_enlaces old->new sin extension)."""
    moves: list[tuple[Path, Path]] = []
    deletes: list[Path] = []
    link_map: dict[str, str] = {}

    for old_area, new_area in AREA_RENAMES.items():
        src = VAULT / old_area
        if not src.exists():
            continue

        if old_area != "20 Systems":
            moves.append((src, VAULT / new_area))
            for md in sorted(src.rglob("*.md")):
                rel = md.relative_to(VAULT).as_posix()
                link_map[rel[:-3]] = f"{new_area}/{md.relative_to(src).as_posix()[:-3]}"
            continue

        # Systems: renombres finos por sistema y por modulo
        for sys_dir in sorted(p for p in src.iterdir() if p.is_dir()):
            old_sys = sys_dir.name
            new_sys = SYSTEM_RENAMES.get(old_sys, old_sys)
            new_sys_dir = VAULT / new_area / new_sys

            for md in sorted(sys_dir.rglob("*.md")):
                rel_in_sys = md.relative_to(sys_dir)
                parts = rel_in_sys.parts

                if md.name == "SYSTEM.md" and len(parts) == 1:
                    target = new_sys_dir / f"{new_sys}.md"
                elif md.name == "README.md" and len(parts) == 1:
                    target = new_sys_dir / f"Modulos de {new_sys}.md"
                elif md.name == "Work Log.md" and len(parts) == 1:
                    target = VAULT / "Logs" / f"Bitacora {new_sys}.md"
                elif md.name == "README.md" and len(parts) == 2:
                    module = parts[0]
                    doc = MODULE_DOC_NAMES.get((new_sys, module))
                    if doc is None:
                        raise SystemExit(f"Modulo sin nombre asignado: {new_sys}/{module}")
                    target = new_sys_dir / module / f"{doc}.md"
                else:
                    target = new_sys_dir / rel_in_sys

                moves.append((md, target))
                old_rel = md.relative_to(VAULT).as_posix()[:-3]
                link_map[old_rel] = target.relative_to(VAULT).as_posix()[:-3]

    # Los borrados se resuelven contra la ruta POSTERIOR a la migracion:
    # "60 Logs/" ya se habra renombrado a "Logs/" cuando se ejecuten.
    for name in OBSOLETE_LOGS:
        current = VAULT / "60 Logs" / name
        if current.exists() and current.stat().st_size == 0:
            deletes.append(VAULT / "Logs" / name)

    return moves, deletes, link_map


# ---------------------------------------------------------------- enlaces


def rewrite_text(text: str, link_map: dict[str, str]) -> str:
    # 1) prefijos de area en texto plano y dentro de enlaces
    for old_area, new_area in AREA_RENAMES.items():
        text = text.replace(f"{old_area}/", f"{new_area}/")
    text = text.replace("Systems/API/", "Systems/ERP API/")
    text = text.replace("Systems/ERP/", "Systems/ERP Front/")

    # 2) destinos completos que cambiaron de nombre de archivo
    updated = {}
    for old, new in link_map.items():
        migrated_old = old
        for oa, na in AREA_RENAMES.items():
            migrated_old = migrated_old.replace(f"{oa}/", f"{na}/")
        migrated_old = migrated_old.replace("Systems/API/", "Systems/ERP API/")
        migrated_old = migrated_old.replace("Systems/ERP/", "Systems/ERP Front/")
        if migrated_old != new:
            updated[migrated_old] = new

    def replace(match: re.Match[str]) -> str:
        bang, target, anchor, alias = match.groups()
        key = target.strip()
        new_target = updated.get(key, key)
        return f"{bang}[[{new_target}{anchor or ''}{alias or ''}]]"

    text = WIKILINK.sub(replace, text)

    # 3) referencias en texto plano a archivos renombrados (p.ej. `.../SYSTEM.md`)
    for old, new in updated.items():
        text = text.replace(f"{old}.md", f"{new}.md")
    return text


# ---------------------------------------------------------------- verificacion


def repair() -> None:
    """Segunda pasada, idempotente, sobre el vault ya migrado.

    1. Los enlaces escritos dentro de tablas usan pipe escapado (`\\|`), asi que el
       destino queda con una barra invertida al final y no casa con ningun archivo.
    2. Los destinos `.../README` y `.../SYSTEM` sobrevivieron en esos enlaces:
       se resuelven contra el unico documento que hoy vive en esa carpeta.
    3. Las plantillas se marcan como tales para que `Templates/ADR` deje de competir
       con `Decisions/ADR`.
    """
    templates = VAULT / "Templates"
    for md in sorted(templates.glob("*.md")):
        if "(plantilla)" in md.stem:
            continue
        md.rename(templates / f"{md.stem} (plantilla).md")

    def resolve_folder_doc(rel: str) -> str | None:
        folder = VAULT / Path(rel).parent
        if not folder.is_dir():
            return None
        docs = sorted(folder.glob("*.md"))
        if len(docs) != 1:
            return None
        return docs[0].relative_to(VAULT).as_posix()[:-3]

    def replace(match: re.Match[str]) -> str:
        bang, target, anchor, alias = match.groups()
        raw = target.strip()
        trailing = "\\" if raw.endswith("\\") else ""
        clean = raw.rstrip("\\")
        if Path(clean).name in {"README", "SYSTEM"}:
            resolved = resolve_folder_doc(clean)
            if resolved:
                return f"{bang}[[{resolved}{trailing}{anchor or ''}{alias or ''}]]"
        return match.group(0)

    changed = 0
    for md in sorted(VAULT.rglob("*.md")):
        original = md.read_text(encoding="utf-8")
        updated = WIKILINK.sub(replace, original)
        for stem in ("ADR", "Business", "System", "Modulo", "Guia", "Work Log"):
            updated = updated.replace(
                f"Templates/{stem}.md", f"Templates/{stem} (plantilla).md"
            )
        if updated != original:
            md.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"Archivos reparados: {changed}")


def verify() -> int:
    docs = sorted(VAULT.rglob("*.md"))
    by_path = {d.relative_to(VAULT).as_posix()[:-3]: d for d in docs}
    by_path_fold = {fold(k): v for k, v in by_path.items()}
    by_slug: dict[str, list[Path]] = defaultdict(list)
    for d in docs:
        by_slug[fold(d.stem)].append(d)

    unresolved: list[tuple[str, str]] = []
    ambiguous: list[tuple[str, str, int]] = []
    total = 0

    for doc in docs:
        for match in WIKILINK.finditer(doc.read_text(encoding="utf-8")):
            total += 1
            target = match.group(2).strip()
            key = fold(target.removesuffix(".md"))
            if key in by_path_fold:
                continue
            hits = by_slug.get(fold(Path(target).stem), [])
            if len(hits) == 1:
                continue
            src = doc.relative_to(VAULT).as_posix()
            if len(hits) > 1:
                ambiguous.append((src, target, len(hits)))
            else:
                unresolved.append((src, target))

    print(f"\n  Enlaces totales      : {total}")
    print(f"  Ambiguos             : {len(ambiguous)}")
    print(f"  Sin resolver         : {len(unresolved)}")
    dup = {k: v for k, v in by_slug.items() if len(v) > 1}
    print(f"  Basenames duplicados : {len(dup)}")
    for k, v in sorted(dup.items()):
        print(f"      ! {k} -> {len(v)} archivos")
    for src, tgt, n in ambiguous[:20]:
        print(f"      AMBIGUO   {src} -> [[{tgt}]] ({n} candidatos)")
    for src, tgt in unresolved[:40]:
        print(f"      PENDIENTE {src} -> [[{tgt}]]")
    return len(ambiguous)


# ---------------------------------------------------------------- main


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--repair", action="store_true")
    args = parser.parse_args()

    if args.verify_only:
        return 1 if verify() else 0

    if args.repair:
        repair()
        print("\n--- verificacion ---")
        return 1 if verify() else 0

    if not (args.apply or args.dry_run):
        parser.error("usa --dry-run o --apply")

    moves, deletes, link_map = build_plan()
    print(f"Movimientos : {len(moves)}")
    print(f"Borrados    : {len(deletes)}")
    print(f"Areas nuevas: {len(NEW_AREAS)}")

    renames = [
        (o.relative_to(VAULT).as_posix(), n.relative_to(VAULT).as_posix())
        for o, n in moves
        if o.name != n.name
    ]
    print(f"\nRenombrados de archivo ({len(renames)}):")
    for o, n in renames:
        print(f"  {o}\n      -> {n}")
    print("\nBorrados (vacios):")
    for d in deletes:
        print(f"  {d.relative_to(VAULT).as_posix()}")

    if args.dry_run:
        print("\n[dry-run] nada se modifico.")
        return 0

    # Primero los renombres de directorio (areas), despues los archivos sueltos:
    # si "60 Logs" -> "Logs" corriera al final, shutil.move anidaria el directorio
    # dentro del "Logs" que ya habrian creado las bitacoras.
    for src, dst in sorted(moves, key=lambda m: not m[0].is_dir()):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
    for d in deletes:
        if d.exists():
            d.unlink()
    for area in NEW_AREAS:
        (VAULT / area).mkdir(parents=True, exist_ok=True)
    for old_area in AREA_RENAMES:
        leftover = VAULT / old_area
        if leftover.exists() and not any(leftover.rglob("*")):
            shutil.rmtree(leftover)

    changed = 0
    for md in sorted(VAULT.rglob("*.md")):
        original = md.read_text(encoding="utf-8")
        updated = rewrite_text(original, link_map)
        if updated != original:
            md.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"\nArchivos con enlaces reescritos: {changed}")

    print("\n--- verificacion ---")
    return 1 if verify() else 0


if __name__ == "__main__":
    sys.exit(main())
