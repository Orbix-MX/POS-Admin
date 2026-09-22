# Project Brain — engine

Motor de conocimiento. Lee un vault de Markdown, lo proyecta en un índice SQLite y lo
expone a través de casos de uso reutilizables por cualquier adaptador (hoy la CLI;
mañana MCP, REST o VSCode).

**El engine no depende de Obsidian.** Obsidian es un editor de Markdown, nada más.

## Uso

> Si `uv` no está en tu PATH (por ejemplo, si se instaló con `pip install --user uv`),
> antepón `python -m` a cada comando: `python -m uv sync`, `python -m uv run brain index`…

```bash
uv sync                       # instalar
uv run brain index            # indexar el vault (incremental)
uv run brain index --full     # forzar reindexación completa
uv run brain index <ruta>     # reindexar un solo documento
uv run brain search <texto>   # buscar (--type --area --scope --tag --limit)
uv run brain show <doc>       # metadatos (--body para el contenido)
uv run brain related <doc>    # enlaces salientes y entrantes
uv run brain stats            # estado del índice
uv run pytest                 # pruebas
```

Todos los comandos aceptan `--json`: la salida está pensada para que un agente la
consuma sin parsear tablas.

`<doc>` acepta ruta (`Domain/Planes de Comida (Noura).md`) o título (`Planes de Comida (Noura)`). Si el título es
ambiguo, el comando lo dice y lista los candidatos en vez de adivinar.

## Uso como librería

El motor es un producto con **contrato público**: ver [`API.md`](API.md).

```python
from brain import Brain

with Brain.open() as brain:
    brain.index()
    brain.search("punto de venta", type="business")
```

## Arquitectura

```
domain/          conocimiento puro — sin dependencias externas, sin E/S
  values         VaultPath · Slug · Tag · fold()
  models         KnowledgeDocument · DocumentMetadata · KnowledgeRelation · SearchResult
  taxonomy       ruta -> área/alcance, según reglas recibidas
  link_resolver  wikilink -> documento, con ambigüedad y pendientes

application/     casos de uso y puertos  (INTERNO)
  ports          DocumentSource · KnowledgeStore (los dos únicos)
  errors         errores del Core; las implementaciones traducen los suyos aquí
  use_cases      IndexVault · ReindexDocument · SearchDocuments · ReadDocument
                 GetRelatedDocuments · DescribeIndex
  views          DTOs internos

infrastructure/  detalles reemplazables  (INTERNO)
  filesystem     descubrimiento y lectura de archivos
  markdown       frontmatter, wikilinks, encabezados, coerción de tipos
  sqlite         esquema, escritura, consultas y FTS5
  config         brain.toml (todo con valor por defecto)

api/             ← LA SUPERFICIE PÚBLICA
  facade         Brain: ciclo de vida, cerrojo de escritura, traducción, mapeo
  dto            DTOs públicos (frozen, solo primitivos)
  errors         jerarquía BrainError con códigos estables
  contract       versión, métodos publicados y reservados, vocabularios
  _composition   raíz de composición: el único módulo de api/ que ve infraestructura

interfaces/cli/  Typer. Un consumidor más: solo importa `brain`
```

`tests/test_architecture.py` verifica la dirección de dependencias en cada ejecución
de la suite. Si falla, la arquitectura se está erosionando.

## Decisiones que hay que conocer antes de tocar el código

| Decisión | Por qué |
|---|---|
| **La identidad es la ruta** (+ hash de contenido) | No se inyectan UUID en los Markdown: el vault es del humano. |
| **El índice es desechable** | No hay migraciones. Si cambia el esquema o la huella de la taxonomía, se reconstruye. Borrar `.brain/index.db` siempre es seguro. |
| **El cuerpo se lee del disco** | El índice guarda texto para *buscar*. Nunca es fuente de verdad del contenido. |
| **Un enlace pendiente no es un error** | Apuntar a un documento que no existe es conocimiento pendiente. El defecto real es el enlace **ambiguo**. |
| **Una arista por documento destino** | `[[Domain/Pacientes (Noura)]]` y `[[Pacientes (Noura)]]` son la misma relación con dos ocurrencias. |
| **`remove_diacritics 2` en FTS5** | El vault está en español; buscar "ordenes" tiene que encontrar "Órdenes". |
| **Comparación con *case-folding*** | El vault vive en Windows: `path_fold` y `fold()` evitan duplicados fantasma. |
| **La taxonomía es configuración** | El dominio no conoce los nombres de las carpetas. Cambiarlos no es un cambio de código. |

## Rendimiento medido (sobre un vault real de 109 documentos y 318 relaciones)

| Operación | Tiempo |
|---|---|
| Índice completo | ~0,20 s |
| Índice incremental sin cambios | ~0,10 s |
| Búsqueda con FTS5 | 1–2 ms |

## Lo que NO está implementado (por diseño del MVP)

Watcher · `verify` · `doctor` · migraciones versionadas · alias · encabezados como
tabla · detección de movimientos por hash · MCP · HTTP · embeddings.

Cada pieza tiene su costura preparada. Ver el plan de fases en la raíz del repositorio.
