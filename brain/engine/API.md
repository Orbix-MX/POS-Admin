# Project Brain — contrato público

**Versión de la API: 0.1.0.** Mientras sea `0.x` el contrato puede cambiar con aviso;
al llegar a `1.0` la política pasa a ser aditiva dentro de la misma mayor.

```python
from brain import Brain

with Brain.open() as brain:
    brain.index()
    respuesta = brain.search("punto de venta", type="business")
```

Lo exportado por `brain/__init__.py` es el contrato. Todo lo demás —`brain.domain`,
`brain.application`, `brain.infrastructure`, `brain.api._composition`— es interior y
puede cambiar sin aviso.

---

## Operaciones

| Método | Devuelve | Errores previstos |
|---|---|---|
| `Brain.open(config=None, *, root=None)` | `Brain` | `ConfigurationError` · `VaultUnavailable` · `IndexUnavailable` |
| `close()` | — | — (idempotente) |
| `info()` | `BrainInfo` | `IndexUnavailable` |
| `index(target=None, *, full=False)` | `IndexResult` | `InvalidReference` · `DocumentNotFound` · `VaultUnavailable` · `IndexUnavailable` |
| `search(query=None, *, type, area, scope, tags, limit)` | `SearchResponse` | `IndexUnavailable` |
| `get(ref, *, include_body=False)` | `Document` | `InvalidReference` · `DocumentNotFound` · `AmbiguousReference` |
| `related(ref, *, direction="both")` | `RelationGraph` | igual que `get` |
| `stats()` | `VaultStats` | `IndexUnavailable` |

**Reservados** (el nombre forma parte del contrato desde 0.1.0; lanzan
`NotImplementedYet` hasta que se implementen): `capabilities()` · `health()`.

### Detalles que un consumidor debe conocer

- **`ref` es texto**: ruta (`Domain/Pacientes (Noura).md`) o título (`Pacientes (Noura)`). Si designa varios
  documentos se lanza `AmbiguousReference` con los candidatos; **nunca se adivina**.
- **`limit=None`** significa el valor por defecto del perfil, nunca "sin límite".
  `SearchResponse.truncated` avisa si hubo corte.
- **`index()` es la única operación que escribe** y se serializa dentro de la instancia.
- **`get(include_body=True)` lee del vault**, no del índice: el índice sirve para buscar,
  no es fuente de verdad del contenido.
- **No hay que preparar nada**: `open()` deja el índice listo y las consultas se
  auto-reparan si hiciera falta.

---

## Errores

Todos heredan de `BrainError` y llevan `code` estable (para mapear sin parsear mensajes),
`message` y `details`.

| Clase | `code` | Cuándo |
|---|---|---|
| `ConfigurationError` | `configuration_invalid` | `brain.toml` ilegible o incoherente |
| `VaultUnavailable` | `vault_unavailable` | el vault no existe o no se puede leer |
| `IndexUnavailable` | `index_unavailable` | el índice no se puede preparar/leer/escribir, o el motor está cerrado |
| `InvalidReference` | `invalid_reference` | la referencia no puede designar un documento |
| `DocumentNotFound` | `document_not_found` | no existe |
| `AmbiguousReference` | `ambiguous_reference` | designa varios (`.candidates: tuple[str, ...]`) |
| `NotImplementedYet` | `not_implemented` | nombre reservado aún sin implementar |
| `OperationFailed` | `operation_failed` | fallo no previsto, ya traducido |

**Garantía verificada por prueba:** ninguna excepción ajena a `BrainError` cruza la
frontera. Un `sqlite3.OperationalError`, un `OSError` o un error del dominio se
traducen; el tipo interno **no** viaja en `details`.

---

## DTOs

Inmutables y compuestos solo por primitivos, tuplas de primitivos o de otros DTOs
públicos, y `dict[str, primitivo]`. `as_dict(valor)` los convierte a JSON.

`BrainInfo` · `IndexResult` · `IndexFailure` · `SearchResponse` · `DocumentSummary` ·
`Document` · `Relation` · `RelationGraph` · `VaultStats`

Vocabularios cerrados publicados como constantes: `RELATION_STATUSES`
(`resolved`/`unresolved`/`ambiguous`), `LINK_KINDS`, `DIRECTIONS`, `FAILURE_CODES`.

---

## Concurrencia

- Lecturas concurrentes: **sí** (una conexión por hilo, WAL).
- Escrituras: **serializadas** dentro de la instancia mediante cerrojo.
- Una instancia **no se comparte entre procesos**: cada proceso abre la suya.

---

## Límite conocido y honesto

`brain.infrastructure` sigue siendo alcanzable como cualquier submódulo de Python:
importar el paquete deja el atributo accesible. El contrato lo definen `__all__`, esta
documentación y las pruebas del borde —no la imposibilidad técnica de escribir
`brain.infrastructure`. Un consumidor que lo haga está fuera del contrato y se romperá
sin aviso.

---

## Cómo se verifica el borde

`tests/test_public_api.py` y `tests/test_port_conformance.py`:

1. solo `api/_composition.py` importa infraestructura; `facade.py` no importa dominio;
2. los DTOs públicos solo contienen primitivos y todo lo devuelto es serializable;
3. ninguna excepción ajena a `BrainError` cruza la frontera (se prueba inyectando
   `sqlite3.Error`, `StorageError`, errores de dominio y una excepción arbitraria);
4. la CLI no importa `domain`, `application` ni `infrastructure`;
5. cada implementación cumple su puerto, método a método y firma a firma —la prueba que
   habría cazado el bloqueante B5.
