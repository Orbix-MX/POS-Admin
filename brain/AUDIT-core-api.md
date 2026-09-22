# Informe de arquitectura — ¿el Core es consumible por interfaces externas?

**Fecha:** 2026-08-05 · **Alcance:** `engine/src/brain` (capas domain, application, infrastructure, interfaces, wiring)
**Motivo:** verificación previa al diseño del adaptador MCP.
**Veredicto: NO. El Core no constituye todavía una API pública estable.**

Método: no se auditó por lectura. Se simuló un **adaptador externo** que consume solo la capa
de aplicación (`scratchpad/adapter_probe.py`) y se instrumentó el Core en ejecución. Todos los
hallazgos marcados como *probado* tienen salida reproducible.

---

## Resumen

| Severidad | Hallazgos | Efecto sobre un adaptador MCP |
|---|---|---|
| **Bloqueante** | 5 | El adaptador quedaría acoplado a SQLite/Markdown o fallaría en tiempo de ejecución |
| **Grave** | 5 | El contrato es inestable, no serializable con garantías y filtra tipos internos |
| **Menor** | 3 | Ruido en la superficie pública |
| **Deuda observada** | 2 | No es acoplamiento, pero afecta a un servidor de larga vida |

**El detalle más importante:** la prueba `test_architecture.py` pasa en verde con todos estos
hallazgos presentes, porque **verifica imports, no acoplamiento por atributo, ni tipos de retorno,
ni excepciones**. La barrera existe donde se mira; no donde no se mira.

---

## Bloqueantes

### B1 — La única puerta de entrada al Core está tipada contra Infrastructure

`wiring.py:29-31`

```
config: BrainConfig            (infrastructure.config)
source: MarkdownVaultSource    (infrastructure.filesystem)
index:  SqliteKnowledgeIndex   (infrastructure.sqlite)
```

`build()` devuelve `Brain`, y `Brain` es lo que cualquier adaptador usará. Sus tres atributos
públicos son clases de infraestructura. No hay forma de obtener casos de uso cableados sin
recibir, en la misma estructura, el objeto SQLite y el lector de Markdown.

**Consecuencia:** el adaptador MCP no puede ignorar que el almacenamiento es SQLite ni que la
fuente es Markdown. La promesa "debe ser fácil agregar nuevos formatos de almacenamiento" no se
cumple en el borde del sistema, solo dentro de él.

### B2 — Excepciones de infraestructura cruzan la frontera pública *(probado)*

Un adaptador que invoca un caso de uso sin haber preparado el índice recibe:

```
EXCEPCION sqlite3.OperationalError: no such table: documents
```

El caso de uso `SearchDocuments` no traduce nada. Un servidor MCP tendría que capturar
excepciones de SQLite para producir un error de protocolo, es decir: **conocer el motor de
almacenamiento para manejar errores**.

### B3 — El ciclo de vida del índice no forma parte de la API

`ensure_schema()` es una **precondición implícita** de casi todos los casos de uso, y ningún caso
de uso la garantiza. Hoy la cumple la CLI, a mano, **4 veces**:

```
app.py:  brain.index.ensure_schema(brain.fingerprint)   × 4
```

Es decir: la capa de interfaz alcanza el puerto del índice y ejecuta orquestación de aplicación.
El adaptador MCP tendría que replicar ese conocimiento —y cualquier adaptador futuro también—
o fallar como en B2. Un requisito que solo vive en la cabeza de quien escribió la CLI no es API.

### B4 — Vocabulario de persistencia y transacciones en el contrato de aplicación

El puerto `KnowledgeIndex` (`ports.py:44-77`) expone `ensure_schema`, `commit`, `upsert_document`,
`indexed_revisions`; los casos de uso invocan `commit()` **6 veces** y deciden dónde empiezan y
acaban las transacciones (`use_cases.py`).

La capa de aplicación no orquesta *conocimiento*: orquesta *almacenamiento*. Un puerto que exige
"esquema" y "commit" presupone una base de datos, y "huella de taxonomía" (`taxonomy_fingerprint`)
es una precondición de invalidación de caché elevada a firma pública.

### B5 — El contrato del puerto está incompleto: se usa un método que no declara *(probado)*

```
usados por casos de uso : [..., 'mark_indexed', ...]
declarados en ports.py  : [... sin 'mark_indexed' ...]
>>> USADOS PERO NO DECLARADOS EN EL PUERTO: ['mark_indexed']
```

`IndexVault` llama a `self.index.mark_indexed()`, que **solo existe en la implementación SQLite**.
Como `Protocol` es tipado estructural sin verificación en ejecución, ni las pruebas ni el
intérprete lo detectan: una segunda implementación del puerto compilaría, pasaría las pruebas de
sus propios contratos y **reventaría en la primera indexación**.

---

## Graves

### G1 — Tipos del dominio cruzan hacia la interfaz a través de excepciones *(probado)*

```
tipo de los candidatos que cruzan a la interfaz:
    brain.domain.values.VaultPath = A/Nota.md
    brain.domain.values.VaultPath = B/Nota.md
```

`AmbiguousDocument.candidates` transporta objetos de dominio, y la CLI los consume
(`app.py`, comandos `show` y `related`). Contradice la regla escrita por el propio proyecto en
`views.py:1`: *"DTOs de salida. Ninguna entidad del dominio cruza hacia las interfaces."*

Para MCP significa serializar un value object del dominio, o conocerlo para convertirlo.

### G2 — Errores de dominio sin traducir, con código de salida incorrecto *(probado)*

```
$ brain index "notas.txt"
InvalidValue: se esperaba un documento .md: 'notas.txt'
   codigo de salida: 0
```

Dos defectos en uno: `VaultPath.parse` lanza un error de dominio que nadie traduce en la capa de
aplicación (`ReindexDocument.execute` lo invoca sin protección), y el fallo se reporta como
**éxito**. Un cliente automatizado —humano en un script o agente MCP— interpretaría que la
operación funcionó.

### G3 — No existe superficie pública curada ni versionada

`brain/__init__.py` está **vacío** (0 bytes). Lo que un consumidor ve es:

```
exportado por brain/__init__.py: ['application', 'domain', 'infrastructure']
```

Es decir, los paquetes internos. No hay un punto de importación estable, ni lista explícita de
lo que es contrato y lo que es detalle, ni versión del contrato. Cualquier renombrado interno es
un cambio incompatible sin que nada lo señale.

### G4 — DTOs inadecuados para un consumidor máquina

- `IndexReport.failed: tuple[tuple[str, str], ...]` serializa como `[["Domain/X.md", "OSError: disco"]]`:
  estructura **posicional y sin nombres**, justo lo que un cliente no debe interpretar por orden.
- El texto del error incluye el nombre de la clase de excepción de infraestructura
  (`OSError`, y potencialmente `sqlite3.*`), filtrando internals en un campo de datos.
- `IndexStats.values: dict[str, int]` es una bolsa sin contrato: las claves son las que devuelva
  la implementación SQLite (`stats()`), no un DTO definido por la aplicación.

### G5 — Una operación de lectura exige el lector de Markdown

`ReadDocument.__init__(source, index)`: para devolver el cuerpo de un documento, el caso de uso
depende de `DocumentSource`. La decisión de fondo (el cuerpo se lee del disco, no del índice) es
correcta y deliberada, pero **su expresión actual obliga a todo adaptador de solo lectura a
instanciar el lector de Markdown**.

---

## Menores

- **M1** — `SearchFilters` (`ports.py:35`) es un `Protocol` declarado y **nunca usado**: contrato muerto en la superficie pública.
- **M2** — `use_cases.py` importa `dataclasses.replace` sin usarlo y lo **reexporta en `__all__`**: la API pública ofrece una función de la librería estándar.
- **M3** — `ports.py` mezcla los dos puertos en un archivo; los cuatro primeros métodos del listado pertenecen a `DocumentSource` y se leen como si fueran del índice. No es un fallo, es una confusión de lectura del contrato.

---

## Deuda observada (no es acoplamiento, pero condiciona al adaptador)

- **D1 — Doble parseo por indexación** *(probado)*: `documentos: 109 · llamadas a source.load: 218`.
  La fase de resolución vuelve a cargar del disco cada documento que la fase anterior ya parseó.
  Irrelevante en una CLI efímera de 0,2 s; relevante en un servidor que reindexe bajo demanda.
- **D2 — Supuesto de proceso efímero**: no hay control de escritor único, ni de sesiones
  concurrentes, ni política de reconexión. La CLI abre, trabaja y muere. Un servidor MCP es de
  larga vida y atiende peticiones solapadas; ese supuesto dejaría de cumplirse. Sin evidencia de
  fallo todavía porque nada lo ha ejercitado.

---

## Lo que sí está bien

No todo el Core falla la auditoría, y conviene delimitarlo:

- **El dominio está limpio.** Cero dependencias de terceros, cero E/S, verificado por prueba.
  `values`, `models`, `taxonomy` y `link_resolver` son consumibles tal cual.
- **La dirección de dependencias por imports se respeta**: ninguna capa importa hacia abajo lo
  que no debe. Los hallazgos son de *forma del contrato*, no de inversión de capas.
- **Los casos de uso no contienen SQL ni Markdown**: verificado por prueba
  (`test_index_vault.py::TestPuertos`). El acoplamiento no está en su cuerpo, sino en sus
  **firmas, sus tipos de error y su cableado**.
- **La lógica de conocimiento es reutilizable**: la resolución de enlaces, la taxonomía y la
  búsqueda no habría que reescribirlas para MCP.

El problema no es que el Core esté mal construido por dentro. Es que **su borde todavía no está
definido**: hoy el único cliente es una CLI que vive en el mismo repositorio, comparte proceso y
puede permitirse saber cómo funciona el motor por dentro. MCP no puede.

---

## Conclusión

De los cinco bloqueantes, cuatro (B1, B2, B3, B5) se manifestarían el primer día de trabajo del
adaptador MCP, y dos de ellos (B2, B5) como fallo en ejecución, no como error de compilación.

**No se procede al diseño del adaptador MCP.** El siguiente paso es decidir qué se hace con estos
hallazgos, no diseñar sobre ellos.
