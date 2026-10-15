---
odd: credenciales-de-dispositivo
updated: 2026-10-14
status: review
via_max: completo
entrega: preguntar
lineas_previstas: 250
---

# Que el deviceToken no se entregue a quien solo lo pide

**Objetivo.** El `deviceToken` (credencial duradera del dispositivo, base del login por PIN) deja de
salir por `GET /devices` y deja de entregarse a quien solo presenta un `deviceId`. Solo lo conoce el
dispositivo que lo recibió al activarse.

**Por qué.** Hallazgo 2 de `docs/audits/AUDITORIA-AUTENTICACION-AUTORIZACION-2026-10-12.md`,
**verificado en ejecución**: activar un dispositivo → `GET /devices` (permiso de solo lectura
`settings:view`) lista su token → `POST /devices/validate` **sin autenticación** devuelve el mismo
token con solo el `deviceId`, y busca con `findFirst({ where: { deviceId } })`, sin acotar por empresa.

**Alcance.** API de dispositivos (T-001, T-002, T-004) y app de la comandera (T-003). Fuera: el
bloqueo del PIN por intentos (hallazgo 3) y la clave de licencia como credencial de `activate`.

**Restricciones.** C-019 (endpoint público publicado); C-021 (app arrancada); C-018 (el listado quita
un campo: el web no lo lee, `Device` no tiene `deviceToken`).

**Decisiones de diseño.**
- **Prueba de posesión, no de identificador.** La app ya guarda el token en SecureStore. `validate`
  recibe `deviceToken`, busca por él (`@unique`) y comprueba que `deviceId` coincida: queda acotado por
  empresa y la respuesta **nunca** incluye el token. Solo `activate` lo entrega.
- **Sin token no es un 400 sino `registered:false`.** Un 400 lo lee la app anterior como «sin red» y
  arranca desde su caché con `licenseStatus: null`, con lo que una licencia vencida dejaría de bloquear
  el PIN (hallazgo R4-001 de la revisión). `registered:false` la lleva a la pantalla de activación.
- **`deviceId` se queda en el listado:** el web lo muestra y, sin el token, deja de ser una credencial.
- **No hubo fase de compatibilidad.** T-004 se adelantó a petición del usuario y no existe camino
  heredado ni aviso en log. Una app anterior deja de poder validarse y hay que actualizarla.

---

## Tareas

### T-001 · El listado de dispositivos no trae credenciales

```
via:     completo
touches: core/devices (devices.service.ts: list)
status:  done (sin commit)
ruta:    inline
```

`list` usa un `select` explícito (`id, branchId, licenseId, deviceId, name, model, os, appVersion, type,
status, lastSeenAt, activatedAt`), sin `deviceToken`. **Done cuando:** `GET /devices` no contiene la
clave `deviceToken` y el web sigue listando y revocando.

**Evidencia.**
- **Test:** `devices.service.spec.ts`: el `select` pedido no incluye `deviceToken`.
- **Runtime (C-021):** `device-verify.cjs`: `GET /devices` → 200, 2 filas, ninguna con `deviceToken`.
- **Rollback:** revertir `list`. Sin migración. **Commit:**

### T-002 · `validate` exige prueba de posesión y no devuelve el token

```
via:     completo
touches: core/devices (devices.controller.ts, devices.service.ts, dto/validate-device.dto.ts)
status:  done (sin commit)
ruta:    inline
```

`ValidateDeviceDto` gana `deviceToken` (opcional en el DTO). Con él: `findUnique({ where: { deviceToken } })`,
exige `deviceId` coincidente y `ACTIVE`; responde sin el token. Un token ausente, vacío, falso, de otro
dispositivo o de uno revocado responde `{ registered: false }` (misma forma, no revela cuál falló).

**Evidencia.**
- **Test:** `devices.service.spec.ts` (token válido, de otro `deviceId`, revocado, inexistente, ausente y
  vacío sin consultar la base, forma idéntica de las negativas, DTO) y `devices.controller.spec.ts`
  (fija el orden `deviceId`, `deviceToken`, `appVersion`; R3-001).
- **Runtime (C-021):** `device-verify.cjs`, 12/12 OK: con su token → `registered:true` sin token; token
  falso, de otro dispositivo, `deviceId` desconocido, ausente o vacío → `registered:false`; tras revocar,
  `validate` → `registered:false` y `pin-login` → 401. El script vive en el scratchpad de la sesión (no
  está versionado): crea datos de prueba en la base real.
- **Rollback:** revertir DTO, `validate` y controlador. Sin migración. **Commit:**

### T-003 · La comandera envía su token y deja de leerlo de `validate`

```
via:     simple
touches: apps/mobile/orbix-app (services/device-service.ts, store/device-store.ts)
status:  done (código; sin prueba en dispositivo; sin commit)
ruta:    inline
```

`validateDevice(deviceId, deviceToken, appVersion?)` manda el token de SecureStore; `bootstrap` y el
refresco tras el PIN conservan el que ya tienen. Sin token guardado, `bootstrap` va a `unregistered`
(hay que activar de nuevo) sin llamar a `validate`.

**Evidencia.** `tsc --noEmit` limpio; `eslint` no está instalado en esta app. **Desviaciones:** no hay
runner de tests (solo `expo lint`) y la comandera no se probó en un dispositivo: el emulador solo tiene
`com.orbix.saas` y instalarla exige `expo run:android`. La forma de la petición es la que ejercita
`device-verify.cjs`. **Rollback:** revertir ambos archivos. **Commit:**

### T-004 · El token deja de poder obtenerse por `deviceId`

```
via:     completo
touches: core/devices (devices.service.ts: validate)
status:  done (sin commit; ver condición de despliegue)
ruta:    inline
```

Se elimina el camino heredado: ninguna ruta devuelve el token salvo `activate`. Se hizo junto con T-002
y a petición del usuario, sin esperar la medición de apps anteriores. **Done cuando:** `validate` nunca
devuelve el token ni busca por `deviceId` solo. Cubierto por la evidencia de T-002.

---

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | completo | done | inline | ~15 + tests | |
| T-002 | completo | done | inline | ~25 + tests | |
| T-003 | simple | done | inline | ~25 | |
| T-004 | completo | done | inline | ~15 | |

**Entrega:** ~250 previstas · dentro del umbral de ~400.

**Orden y condición de despliegue (C-019):** primero la app (T-003), después el servidor. **No subir el
servidor mientras haya comanderas en uso con la app anterior:** dejarán de validarse y mostrarán la
pantalla de activación. Lectura de la base (solo lectura, 2026-10-14): 4 dispositivos `ACTIVE` con la app
anterior (`appVersion 54.0.8`), vistos por última vez el 2026-08-06; el resto son pruebas de hoy.

**Siguiente paso:** commits (app y servidor por separado), `status: done`, y probar la comandera en un
dispositivo cuando se pueda.

---

## Escaladas

| Tarea | De | A | Trigger |
|---|---|---|---|
| T-001 | (asignada) | completo | Cruza módulos y las credenciales de dispositivo son el principal de `pin-login` |
| T-002 | (asignada) | completo | Cambio de contrato de un endpoint público publicado (C-019) |
| T-004 | (asignada) | completo | Contrato incompatible (C-019) |

## Hallazgos fuera de alcance

| Hallazgo | Dónde | Gravedad aparente |
|---|---|---|
| `POST /devices/activate` es público y se autoriza solo con la clave de licencia; re-activar devuelve el token existente | `devices.service.ts` | Media |
| El login por PIN no bloquea por intentos | hallazgo 3 de la auditoría | Alta |
| El token se guarda en claro en la base; el refresh token de usuario sí se guarda con hash | `schema.prisma` | Baja |
| Si SecureStore lanza al leer el token, `bootstrap` se queda en `booting` (ya pasaba con `getOrCreateDeviceId`) | `device-store.ts` | Baja |

## Revisión

**Candidato:** árbol sin commitear. Suite API: 107 suites / 858 tests en verde; `tsc` y lint de `devices`
limpios; runtime 12/12.

| id | lente | ubicación | severidad | estado | evidencia |
|---|---|---|---|---|---|
| R1 | riesgo | — | — | ledger vacío | sin hallazgos |
| R2-001 | legibilidad | `devices.service.ts` (JSDoc) | WARNING | fixed | dos comentarios decían que `validate` devuelve el token |
| R2-002 | legibilidad | este documento | WARNING | fixed | describía el estado anterior a T-004; reescrito |
| R3-001 | fiabilidad | `devices.controller.ts:28` | CRITICAL | fixed | el orden de dos strings seguidos no tenía test. Añadido `devices.controller.spec.ts` |
| R3-002 | fiabilidad | este documento | WARNING | fixed | evidencia de T-002 obsoleta; reescrita |
| R3-003 | fiabilidad | `device-store.ts` | WARNING | wont-fix | sin test ni prueba en dispositivo (desviación declarada en T-003) |
| R4-001 | resiliencia | `validate-device.dto.ts`, `device-store.ts:101-111` | CRITICAL | fixed | el 400 hacía que la app anterior arrancara «offline» sin validar la licencia. Ahora `registered:false` |
| R4-002 | resiliencia | este documento | WARNING | fixed | la medición con aviso en log ya no existe; retirada |
| R4-003 | resiliencia | `device-store.ts:76-80` | WARNING | wont-fix | preexistente en `getOrCreateDeviceId`; anotado arriba |
