# Project Brain — plan de fases

Estado al 2026-08-05. Cada fase se cerró funcionando y probada antes de empezar la siguiente.

## MVP (completado)

| Fase | Entregable | Estado |
|---|---|---|
| **0** | Migración del vault a `vault/` con la taxonomía acordada; `brain.toml`; eliminación de los 38 `README.md` y 9 `SYSTEM.md` duplicados; 334 wikilinks reescritos y verificados | ✅ |
| **1** | Proyecto `uv`; dominio puro (`values`, `models`, `taxonomy`, `link_resolver`); prueba de reglas de import | ✅ |
| **2** | `DocumentSource` sobre Markdown: frontmatter, wikilinks, encabezados, coerción; vault de prueba con casos límite | ✅ |
| **3** | Esquema SQLite, escritura, `IndexVault` incremental, `wiring`, `brain index` / `brain stats` | ✅ |
| **4** | Fase de resolución global, tabla `links`, `GetRelatedDocuments`, `brain related` | ✅ |
| **5** | FTS5 con `remove_diacritics`, `SearchDocuments`, `ReadDocument`, `brain search` / `brain show`, `--json` | ✅ |
| **6** | Incremental afinado, `brain index <ruta>`, pruebas de CLI de punta a punta, README | ✅ |

**161 pruebas.** Vault real: 109 documentos, 318 relaciones, 98 etiquetas.
Índice completo 0,20 s · incremental 0,10 s · búsqueda 1–2 ms.

### Defectos reales que encontraron las pruebas durante el MVP

1. `VaultPath.parse` convertía una ruta absoluta en relativa en lugar de rechazarla.
2. Los wikilinks se extraían de dentro de los bloques de código.
3. El marcador *"Requiere validación"* se disparaba con `owner:` del frontmatter (102/109 documentos marcados; ahora 42 significativos).
4. `[[Domain/Compras]]` y `[[Compras]]` generaban dos aristas al mismo documento.
5. Enlaces con pipe escapado dentro de tablas Markdown (`[[ruta\|Etiqueta]]`) no se resolvían.
6. Las pruebas de CLI podían indexar el vault real por buscar `brain.toml` hacia arriba.

## Fases pendientes

| Fase | Entregable | Costura ya preparada en el MVP |
|---|---|---|
| **7 — Watcher** | Puerto `ChangeStream`, adaptador watchdog, debounce por ruta, `brain watch` | `ReindexDocument` ya existe y ya hace resolución localizada |
| **7 — Movimientos** | Reconciliación renombrado = mismo documento | `content_hash` ya se guarda por documento |
| **8 — `verify` / `doctor`** | Informes de salud del conocimiento y del motor | Ya se persisten `status` de enlace, `candidate_count`, `has_frontmatter`, `needs_validation` |
| **8 — Migraciones** | Migrador versionado | `meta.schema_version` ya existe; hoy la política es reconstruir |
| **9 — Alias, encabezados, secciones** | Dos tablas y dos extractores | El extractor ya guarda `anchor`; los encabezados ya se indexan en FTS |
| **9 — Adaptadores** | MCP, REST, VSCode | Consumen los mismos casos de uso; ver `mcp/README.md` |

Nada de lo pendiente exige modificar el dominio ni los casos de uso existentes: todo es
implementación de un puerto nuevo o lectura de datos que ya se guardan.
