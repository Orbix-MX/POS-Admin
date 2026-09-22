---
description: Reindexa el vault de conocimiento (Project Brain)
allowed-tools: Bash(cd brain && uv run --project engine brain index:*)
---

Reindexación del vault de conocimiento. Es incremental: solo procesa lo que cambió.

!`cd brain && uv run --project engine brain index`

Resume el resultado en una línea: cuántos documentos nuevos, actualizados y borrados, y
si hay enlaces pendientes o ambiguos.

- **Pendientes** son enlaces a documentos que aún no existen: conocimiento por escribir,
  no un error.
- **Ambiguos** sí son un defecto: un mismo nombre designa varios documentos y hay que
  desambiguarlo renombrando o enlazando por ruta completa.

Las herramientas MCP `search_documents`, `read_document` y `related_documents` ven el
índice nuevo de inmediato, sin reiniciar nada.
