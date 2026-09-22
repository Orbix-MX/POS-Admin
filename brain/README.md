# Orbix Brain

Base de conocimiento de los productos de **Orbix** —**Noura** (SaaS de HealthTech para
nutriólogos) y **Orbix ERP** (POS/ERP multi-tenant)— y el motor que la hace consultable
por personas y por IA.

```
brain/
├── vault/      conocimiento en Markdown (se edita con Obsidian, o con cualquier editor)
├── engine/     Project Brain: motor de conocimiento (Python) — API pública `brain`
├── mcp/        adaptador MCP: expone el motor a Claude Code
├── scripts/    utilidades de un solo uso
└── brain.toml  taxonomía del vault y configuración del motor
```

El vault es el producto; el motor y el adaptador existen para servirlo. **Obsidian es solo
un editor de Markdown**: nada del motor depende de él.

---

## Requisitos: solo `uv`

**No hace falta tener Python instalado.** `uv` es un binario independiente que descarga
el intérprete por su cuenta; `.python-version` fija 3.13 para que todos usen la misma.

---

## Puesta en marcha

Clona este repositorio **dentro de tu carpeta maestra `Orbix`**, junto a los demás
proyectos. Cuatro comandos, de arriba abajo:

```powershell
# 0. instalar uv  ·  WINDOWS  (no requiere Python)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```bash
# 0. instalar uv  ·  macOS / LINUX
curl -LsSf https://astral.sh/uv/install.sh | sh
```

```bash
# 1-3. desde brain/  (abre una terminal NUEVA tras instalar uv)
cd mcp && uv sync && cd ..              # entorno (descarga Python 3.13 si falta)
uv run --project engine brain index     # construir el índice
uv run scripts/setup-workspace.py       # conectar con la carpeta maestra
```

Comprueba con `uv --version` antes del paso 1: el instalador añade uv al PATH, pero la
terminal que ya tenías abierta no se entera.

> Si en tu máquina uv se instaló con `pip install --user uv`, el ejecutable no queda en el
> PATH: antepón `python -m` a todos los comandos (`python -m uv sync`).

El paso 3 hace lo que un `git clone` no puede: **la carpeta maestra no es un
repositorio**, así que nada llega ahí por sí solo. El script, que es idempotente y
acepta `--dry-run`:

1. Añade `@brain/CLAUDE.knowledge.md` al `CLAUDE.md` de la maestra, de modo que
   las reglas del vault llegan por `git pull` en lugar de copiarse a mano —y aplican
   también al abrir Claude Code en los repos hermanos de la maestra, porque `CLAUDE.md`
   se carga subiendo por el árbol de carpetas.
2. Añade el hook `Stop` que reindexa en silencio al terminar cada turno, fusionándolo con
   la configuración que ya tengas.
3. Registra el servidor MCP `orbix-brain` en ámbito usuario, con la ruta de tu máquina, para que
   funcione desde cualquier carpeta.

Después, abre `/hooks` una vez o reinicia Claude Code: los hooks se cargan al arrancar.

El paso 2 no es opcional: `.brain/index.db` está en `.gitignore` porque es una
**proyección desechable** del vault. Borrarlo siempre es seguro; reconstruirlo cuesta
menos de un segundo. Sin él, las búsquedas devuelven cero resultados.

### Uso desde la línea de comandos

```bash
uv run --project engine brain search "punto de venta"  # --type --area --scope --tag --limit
uv run --project engine brain show "Noura API" --body
uv run --project engine brain related "Planes de Comida (Noura)"
uv run --project engine brain index                  # tras editar el vault
```

Todos aceptan `--json`, pensado para que un agente los consuma sin parsear tablas.

### Uso desde Claude Code

```bash
claude mcp add orbix-brain --scope user -- uv run --directory /ruta/a/orbix-admin/brain/mcp brain-mcp
```

Alternativa sin comandos: abrir Claude Code en esta carpeta y aceptar el `.mcp.json`
versionado. Ojo: un `.mcp.json` de proyecto **solo aplica en la carpeta donde está**; si
sueles trabajar en varias carpetas del monorepo, usa el ámbito `user` de arriba.

Herramientas expuestas: `search_documents`, `read_document`, `related_documents`.
Son de **solo lectura**: mantener el índice al día sigue siendo trabajo de `brain index`.

Para eso está el comando **`/refresh-knowledge`** (`.claude/commands/`), que reindexa y
resume el resultado. Como todo comando de proyecto, **solo aparece si abres Claude Code
en esta carpeta**; si trabajas desde el monorepo, copia ese archivo a
`~/.claude/commands/` —ahí funciona desde cualquier carpeta— cambiando `uv run` por
`uv run --directory /ruta/a/orbix-admin/brain`.

### Instalación asistida: pídeselo a Claude Code

Las rutas absolutas, si `uv` está o no en el PATH y el nombre del servidor cambian de una
máquina a otra. En lugar de adivinarlos, abre Claude Code **en esta carpeta** y pega el
prompt de abajo. Lo único que tienes que tocar es el nombre entre comillas de la primera
línea; el resto lo resuelve él inspeccionando la máquina.

```text
Instala este MCP localmente con el nombre "orbix-brain".

Descubre tú lo que dependa de esta máquina, no lo asumas:

1. La ruta absoluta de este repositorio (la que contiene `brain.toml`, `engine/` y `mcp/`)
   y úsala en todos los comandos.
2. Si `uv` responde en el PATH. Si no, antepón `python -m` a cada invocación
   (`python -m uv ...`) — es lo que pasa cuando uv se instaló con `pip install --user uv`.
3. Si ya hay un servidor MCP registrado apuntando a este mismo repositorio con otro
   nombre. Si lo hay, dímelo y no dupliques: renómbralo en lugar de añadir un segundo.

Después:

- `uv sync` en `mcp/`, y construye el índice con `brain index` sobre `--project engine`.
- Registra el servidor con `claude mcp add <nombre> --scope user -- <uv> run --directory
  <ruta>/mcp brain-mcp`. Ámbito `user` para que funcione desde cualquier carpeta; usa
  `--scope local` si solo lo quieres en este workspace.
- Si el nombre que elegí no es `orbix-brain`, reemplázalo también en `.mcp.json`, en
  `MCPServer(...)` de `mcp/src/brain_mcp/server.py` y en las menciones al servidor de
  `README.md`, `CLAUDE.knowledge.md`, `mcp/README.md`,
  `vault/Guides/Usar Project Brain.md` y `scripts/setup-workspace.py`.
- Crea `~/.claude/commands/refresh-<nombre>.md` a imagen del `/refresh-knowledge` de
  `.claude/commands/`, pero con la ruta absoluta, para reindexar desde cualquier carpeta.

Verifica con `claude mcp list` que aparece como *Connected* y dime qué ruta y qué forma de
invocar uv acabaste usando.
```

Al terminar, reinicia Claude Code o abre `/mcp`: los servidores se cargan al arrancar.

---

## Por dónde seguir

| Documento | Qué contiene |
|---|---|
| `vault/Home/Inicio.md` | Puerta de entrada al conocimiento del negocio |
| `vault/Guides/Usar Project Brain.md` | Esta misma puesta en marcha, dentro del vault |
| `engine/API.md` | Contrato público del motor (`Brain`, DTOs, errores) |
| `engine/README.md` | Arquitectura del motor y decisiones de diseño |
| `mcp/README.md` | El adaptador MCP y su mantenimiento |
| `PHASES.md` | Plan de fases y estado |
| `AUDIT-core-api.md` | Auditoría que motivó la API pública |

## Mantenimiento

| Qué cambiaste | Qué hacer |
|---|---|
| Documentación del vault | `brain index` — el servidor MCP lo ve sin reiniciarse |
| Código del motor o del adaptador | Reiniciar el servidor MCP (instalación editable) |
| Dependencias | `uv sync` y reiniciar |
| Taxonomía en `brain.toml` | `brain index` reconstruye el índice automáticamente |
