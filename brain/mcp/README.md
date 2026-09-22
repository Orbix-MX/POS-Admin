# mcp/ — Adaptador MCP de Project Brain

Expone el vault de conocimiento a Claude Code. Traduce entre el protocolo MCP y la API
pública `brain`, y **nada más**: sin lógica de negocio, sin caché, sin servicios.

Un solo archivo con código (`server.py`, ~110 líneas) y tres herramientas de **solo lectura**.

---

## Requisitos

**Solo [uv](https://docs.astral.sh/uv/).** No hace falta tener Python instalado: uv es un
binario independiente que descarga el intérprete por su cuenta. `.python-version` fija
3.13, así que todos acaban con la misma versión. El comando para instalarlo es el paso 0
de la instalación, aquí abajo.

> Si uv se instaló con `pip install --user uv`, el ejecutable no queda en el PATH:
> antepón `python -m` a todos los comandos (`python -m uv sync`).

---

## Instalación

```powershell
# 0. instalar uv  ·  WINDOWS
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```bash
# 0. instalar uv  ·  macOS / LINUX
curl -LsSf https://astral.sh/uv/install.sh | sh
```

```bash
# abre una terminal NUEVA (el PATH cambió) y comprueba con: uv --version
git clone <repo> orbix-admin && cd orbix-admin/brain

cd mcp && uv sync && cd ..              # 1. entorno (descarga Python 3.13 si falta)
uv run --project engine brain index     # 2. construir el índice
uv run scripts/setup-workspace.py       # 3. conectar con la carpeta maestra
```

**El paso 2 no es opcional.** `.brain/index.db` está en `.gitignore` porque es una
proyección desechable del vault: cada quien construye el suyo. Sin él, todas las
búsquedas devuelven cero y parece que el servidor está roto.

### Registrar el servidor

Dos ámbitos, y la diferencia importa:

```bash
# A) ÁMBITO USUARIO — funciona desde cualquier carpeta que abras. Ruta absoluta.
claude mcp add orbix-brain --scope user -- uv run --directory /ruta/a/orbix-admin/brain/mcp brain-mcp

# B) ÁMBITO PROYECTO — sin comandos: abre Claude Code en brain/ y acepta
#    el .mcp.json versionado. Solo funciona en esa carpeta.
```

Usa **A** si abres Claude Code en varias carpetas (por ejemplo, subproyectos del
monorepo): un `.mcp.json` de proyecto solo aplica en la carpeta donde está.

Comprobar: `claude mcp list` debe mostrar `brain: … - ✔ Connected`, y `/mcp` debe
listar las tres herramientas.

### Por qué el comando lleva `--directory`

`Brain.open()` busca `brain.toml` **subiendo desde el directorio de trabajo del proceso**,
y Claude Code arranca el servidor en la carpeta que abriste, no donde vive el código.
`--directory` no dice "dónde está el código", dice **"trabaja aquí"**. Sin él:
`[vault_unavailable]`.

---

## Herramientas disponibles

### `search_documents`

Busca conocimiento por texto y/o por filtros. Ignora acentos y mayúsculas. Sin `query`
devuelve todo lo que cumpla los filtros.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `query` | string | — | Texto libre: busca en título, encabezados, etiquetas y cuerpo |
| `type` | string | — | `business` · `system` · `module` · `architecture` · `adr` · `guide` · `index` · `ai-context` · `ai-command` · `log` · `home` |
| `area` | string | — | `home` · `domain` · `systems` · `architecture` · `decisions` · `guides` · `logs` · `ai` · `templates` |
| `scope` | string | — | Sistema concreto dentro de `systems` (p. ej. `ERP API`) |
| `tags` | array\<string\> | — | Exige **todas** las indicadas |
| `limit` | integer | perfil (20) | Máximo de resultados |

Devuelve `SearchResponse`: `items[]` (ruta, título, tipo, área, ámbito, puntuación,
extracto), `count`, `limit`, `truncated`, y el eco de `query` y `filters`.

### `read_document`

Devuelve un documento por ruta o por título.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `ref` | string | **obligatorio** | `Domain/Pacientes (Noura).md` o `Pacientes (Noura)` |
| `include_body` | boolean | `false` | Si es `true`, incluye el contenido; se lee del vault, no del índice |

Devuelve `Document`: metadatos (título, tipo, área, ámbito, responsable, fecha,
etiquetas, nº de palabras, si el conocimiento está sin validar) y, opcionalmente, `body`.

Si el título designa varios documentos falla con `[ambiguous_reference]` y lista los
candidatos: **nunca adivina**.

### `related_documents`

Devuelve el grafo de relaciones de un documento.

| Parámetro | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `ref` | string | **obligatorio** | Ruta o título |
| `direction` | string | `both` | `both` · `out` (los que enlaza) · `in` (los que lo enlazan) |

Devuelve `RelationGraph`: el documento más `outbound[]` e `inbound[]`. Cada relación
trae su estado:

- `resolved` — el destino existe.
- `unresolved` — el destino **aún no existe**: conocimiento pendiente, no un error.
- `ambiguous` — el nombre designa varios documentos: defecto de nomenclatura.

### Errores

Todas devuelven el mismo formato: `[code] mensaje`. Los códigos son estables y están
pensados para tratarlos por código, no por texto: `document_not_found`,
`ambiguous_reference`, `invalid_reference`, `vault_unavailable`, `index_unavailable`,
`operation_failed`.

---

## Comandos disponibles

### En Claude Code

| Comando | Qué hace |
|---|---|
| `/refresh-knowledge` | Reindexa el vault y resume el resultado |
| `/mcp` | Estado de los servidores y sus herramientas |

**No suele hacer falta invocarlos**: `.claude/settings.json` incluye un hook `Stop` que
reindexa en silencio al terminar cada turno. `/refresh-knowledge` queda para cuando
quieras forzarlo y ver el resultado. El hook tolera que `uv` no esté en el PATH: cae a
`python -m uv`.

> Los hooks se cargan al arrancar. Si acabas de clonar el repositorio, abre `/hooks` una
> vez o reinicia Claude Code para que el hook empiece a ejecutarse.

`/refresh-knowledge` vive en `.claude/commands/` (ámbito proyecto: aparece al abrir
Claude Code en `brain/`). Para tenerlo en cualquier carpeta, copia ese archivo
a `~/.claude/commands/` y sustituye `uv run` por
`uv run --directory /ruta/a/orbix-admin/brain`.

### En la terminal

| Comando | Qué hace |
|---|---|
| `brain index` | Reindexa (incremental). `--full` fuerza todo; `brain index <ruta>` un solo documento |
| `brain search <texto>` | Busca. `--type --area --scope --tag --limit` |
| `brain show <ref>` | Muestra un documento. `--body` incluye el contenido |
| `brain related <ref>` | Relaciones salientes y entrantes. `--direction` |
| `brain stats` | Cifras del conocimiento indexado |
| `brain info` | Estado del motor: vault, índice, versión del contrato |

Todos aceptan `--json`. Se ejecutan como
`uv run --project engine brain <comando>` desde `brain/`.

---

## Mantenimiento

| Qué cambiaste | Qué hacer |
|---|---|
| Documentación del vault | `brain index` o `/refresh-knowledge` — el servidor lo ve sin reiniciarse |
| Código de `server.py` o del engine | Reiniciar el servidor (instalación editable) |
| Dependencias (`pyproject.toml`) | `uv sync` y reiniciar |
| El comando de arranque o su ruta | `claude mcp remove brain -s user` y volver a añadirlo |

---

## Lo que este adaptador NO hace

Sin caché · sin servicios · sin contexto automático · sin herramientas extra ·
sin DTOs propios · sin lógica de negocio.

**Es de solo lectura: no indexa.** Sirve lo que haya en el índice. Si el vault cambió y
nadie indexó, las respuestas serán viejas. Esa es su única trampa real.

## Decisiones que conviene conocer

- **Una instancia de `Brain`, perezosa y compartida**, cerrada con `atexit`. La API
  pública garantiza lecturas concurrentes.
- **No se convierten los DTOs a `dict`**: el SDK serializa el valor devuelto. Como
  consecuencia las herramientas no publican `output_schema` (el SDK no sabe derivarlo de
  estos dataclasses) y el cliente recibe el JSON como texto. Cambiarlo exigiría tocar la
  API pública, y no hace falta.
- **No se importan tipos de error del SDK**: se captura `BrainError` y se relanza con
  `[code] mensaje`.
- `include_body` es `False` por defecto, igual que en la API: pedir un documento no
  debería arrastrar su contenido completo al contexto sin quererlo.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `/mcp` no lista `orbix-brain` | Falta `uv sync` en `mcp/`, o el registro es de ámbito proyecto y abriste otra carpeta |
| `[vault_unavailable]` | Falta `--directory` en el comando, o la ruta cambió |
| Resultados vacíos | Falta construir el índice: `brain index` |
| Resultados desactualizados | El vault cambió y nadie reindexó |
| `[ambiguous_reference]` | El título designa varios documentos: usa la ruta completa |
| `uv: command not found` | uv no está en el PATH: usa `python -m uv` |
