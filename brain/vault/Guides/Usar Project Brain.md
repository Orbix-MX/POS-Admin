---
title: Usar Project Brain
type: guide
owner: Requiere validación
updated: 2026-08-07
tags: [guia, herramientas, brain, mcp]
---

# Usar Project Brain

Project Brain es el motor que hace consultable este vault: lo indexa y lo expone a
personas (línea de comandos) y a agentes de IA (MCP). Vive en el mismo repositorio que
el vault, en `engine/` y `mcp/`.

## Cuándo usar esta guía

Cuando entres al equipo, cuando cambies de equipo de trabajo, o cuando quieras que
Claude Code responda preguntas leyendo este vault en vez de adivinar.

## Requisitos: solo `uv`

**No hace falta tener Python instalado.** `uv` es un binario independiente que descarga
el intérprete por su cuenta; el repositorio fija la versión, así que todos acaban con la
misma sin discutirlo. El comando para instalarlo es el paso 0 de la puesta en marcha.

> Si en tu máquina uv se instaló con `pip install --user uv`, el ejecutable no queda en
> el PATH: antepón `python -m` a cada comando.

## Puesta en marcha

Cuatro comandos, de arriba abajo, desde `brain/`:

```powershell
# 0. instalar uv  ·  WINDOWS
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```bash
# 0. instalar uv  ·  macOS / LINUX
curl -LsSf https://astral.sh/uv/install.sh | sh
```

```bash
# abre una terminal NUEVA tras instalar uv; comprueba con: uv --version
cd mcp && uv sync && cd ..              # 1. entorno (descarga Python si falta)
uv run --project engine brain index     # 2. construir el índice
uv run scripts/setup-workspace.py       # 3. conectar con la carpeta maestra
```

**El paso 2 no es opcional.** El índice no se versiona: es una proyección desechable del
vault y cada quien construye el suyo. Sin él, las búsquedas devuelven cero resultados y
parece que la herramienta está rota.

## Consultar desde la terminal

```bash
uv run --project engine brain search "punto de venta"    # ignora acentos y mayúsculas
uv run --project engine brain search --type business --area domain
uv run --project engine brain show "Orbix ERP API" --body
uv run --project engine brain related "Ventas y Punto de Venta (Orbix)"
uv run --project engine brain stats
```

## Consultar desde Claude Code

```bash
claude mcp add orbix-brain --scope user -- uv run --directory /ruta/a/orbix-admin/brain/mcp brain-mcp
```

Alternativa sin comandos: abrir Claude Code en `brain/` y aceptar el
`.mcp.json` versionado. Un `.mcp.json` de proyecto **solo aplica en la carpeta donde
está**; si trabajas en varias carpetas del monorepo, usa el ámbito `user`.

Quedan disponibles tres herramientas de **solo lectura**:

| Herramienta | Qué hace | Parámetros |
|---|---|---|
| `search_documents` | Busca por texto y/o filtros. Ignora acentos | `query`, `type`, `area`, `scope`, `tags`, `limit` |
| `read_document` | Devuelve un documento por ruta o por título | `ref`, `include_body` (por defecto `false`) |
| `related_documents` | Enlaces salientes y entrantes de un documento | `ref`, `direction` (`both`/`out`/`in`) |

Más el comando **`/refresh-knowledge`**, que reindexa sin salir de Claude Code.

En `related_documents`, cada enlace trae su estado: `resolved` (el destino existe),
`unresolved` (aún no existe: conocimiento pendiente, no un error) y `ambiguous` (el
nombre designa varios documentos: eso sí hay que arreglarlo).

La referencia completa, con los códigos de error y el resto de comandos, está en
`mcp/README.md` del repositorio.

## Después de editar el vault

Ejecuta `brain index`, o el comando **`/refresh-knowledge`** dentro de Claude Code, que
hace lo mismo y resume el resultado. Es incremental: solo procesa lo que cambió y tarda
décimas de segundo. **No hace falta reiniciar nada**: un servidor MCP en marcha ve el
índice nuevo en la siguiente consulta.

`/refresh-knowledge` es un comando de proyecto: aparece al abrir Claude Code en
`brain/`. Desde otra carpeta, usa el comando de terminal.

Mientras no reindexes, las respuestas serán las de antes de tu edición. Es la única
trampa real de la herramienta.

## Verificación

`brain stats` debe reportar un número de documentos parecido al de archivos del vault.
Si dice `documents 0`, falta el paso 2.

## Trampas conocidas

| Síntoma | Causa |
|---|---|
| Resultados vacíos o desactualizados | Falta `brain index` |
| `[ambiguous_reference]` | El título designa varios documentos: usa la ruta completa |
| `[vault_unavailable]` | El comando se ejecutó fuera del repositorio y no encontró `brain.toml` |
| `uv: command not found` | uv no está en el PATH: usa `python -m uv` |
| Claude Code no lista `orbix-brain` | El registro es de ámbito proyecto y abriste otra carpeta |
| `/refresh-knowledge` falla con "Project directory `engine` does not exist" o ruta no encontrada | El comando corre con cwd = la raíz del repo (`orbix-admin/`), no `brain/`. Debe usar `cd brain && uv run --project engine brain index`, nunca una ruta relativa `engine` suelta ni una ruta absoluta con backslashes (bash la rompe).|

## Si no funciona

`README.md` en la raíz del repositorio, `engine/API.md` para el contrato del motor y
`mcp/README.md` para el adaptador. La guía equivalente para levantar Orbix ERP
—que es otra cosa— es [[Levantar entorno]].
