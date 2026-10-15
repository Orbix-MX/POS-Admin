---
odd: bloqueo-por-intentos-de-pin
updated: 2026-10-14
status: done
via_max: completo
entrega: preguntar
lineas_previstas: 350
---

# Que adivinar un PIN tenga un tope de intentos

**Objetivo.** Quien prueba PIN tras PIN, desde un dispositivo o desde una sesión de usuario, se
bloquea con espera creciente. Hoy no hay tope: solo el límite por IP (10 por minuto en `pin-login`;
100 por minuto, el global, en varios handlers de caja).

**Por qué.** Hallazgo 3 de `docs/audits/AUDITORIA-AUTENTICACION-AUTORIZACION-2026-10-12.md`
(**por código, sin ejecutar**): el PIN son 4 a 6 dígitos y **identifica al empleado él solo**
(`findFirst({ tenantId, pinHash })`), único por empresa. Con 4 dígitos son 10⁴ combinaciones: unos
100 minutos a 100 por minuto. Un cajero puede acabar usando el PIN de un supervisor para autorizar un
cierre de caja o abrir una sesión de operador de 12 h con sus permisos.

**Alcance.** Las cuatro superficies que comparan un PIN: `pinLogin`, `operatorLogin` y `verifyPin`
(`staff.service.ts`) y `resolveCashAuthorizer` (`cash-sessions.service.ts`, 4 llamadores).

**Restricciones.** C-013 (migración aditiva: `expand`); C-021 (app arrancada); C-007 y C-005
(autorización → `completo`). La vía sube además por **migración** y **concurrencia** (el contador).

**Decisiones de diseño.**
- **El contador cuelga de quien intenta, no del empleado.** Como el PIN identifica al empleado, un
  intento fallido no tiene empleado al que contarle el fallo. Los contadores son por **dispositivo**
  (`pinLogin`) y por **sesión de usuario** (`operatorLogin`, `verifyPin`, cajas). El de usuario es
  **compartido entre superficies**: cambiar de endpoint no multiplica el presupuesto.
- **No se bloquea por empleado** (lo que sugería la auditoría). Exigiría que el cliente mande el
  empleado, y cualquiera podría bloquear a un supervisor a propósito con PINs erróneos.
- **Política** (misma forma que el bloqueo de contraseña, `AuthService.LOCKOUT_*`): 5 fallos seguidos
  bloquean 1 minuto; cada 5 fallos más duplican la espera, tope 60 min. Un último fallo de más de 24 h
  se olvida. **Acertar solo limpia el contador si el último fallo tiene más de 1 hora** (hallazgo R1-001: si
  limpiara siempre, un cajero con su PIN propio alternaría 4 intentos contra el de un supervisor y 1
  acierto con el suyo, y nunca llegaría al umbral). Sin bloquear se pueden probar ~4 PIN por hora y
  principal (~96 al día); con 4 dígitos y 5 empleados con PIN, del orden de **semanas** en vez de ~100 min.
- **Respuesta.** Bloqueado → 429 `PIN_LOCKED` con `retryAfterSeconds`. Solo lo ve quien intenta, y no
  revela nada de los empleados. PIN malo sigue siendo el mismo `PIN_INVALID`/`AUTHORIZATION_INVALID`.
- **Estado en la base**, no en memoria: el límite por IP actual es por instancia y no frena un ataque
  repartido; la tabla vale para varias réplicas.

---

## Tareas

### T-001 · Contador de intentos de PIN en la base

```
via:     completo
touches: prisma/schema.prisma + migración, common (pin-attempt.service.ts), common.module.ts
status:  done
ruta:    inline
```

Modelo `PinAttempt { scope DEVICE|USER, scopeKey, attempts, lockedUntil, lastFailedAt }` (sin `tenantId`: la clave es
polimórfica y el contador de un usuario se comparte entre sus empresas) con
`@@unique([scope, scopeKey])` y migración aditiva (`expand`). `PinAttemptService` (global):
`assertNotLocked`, `registerFailure` y `registerSuccess`. El incremento es **atómico en SQL**
(`INSERT … ON CONFLICT DO UPDATE … RETURNING`), no leer-sumar-escribir, para que dos fallos
simultáneos no cuenten uno.

**Done cuando:** 5 fallos bloquean; la espera duplica cada 5 más hasta 60 min; un acierto justo después de
fallar NO borra los fallos y uno tras una hora de calma sí; 20 fallos concurrentes cuentan 20; la migración no
altera datos existentes; con la tabla ausente el login por PIN no cae.

**Evidencia.**
- **Test unitario:** `pin-attempt.service.spec.ts` (34 tests): umbral, escalado 1→2→4…→60 min, tope, bloqueo vencido, 429 `PIN_LOCKED` con `retryAfterSeconds`, aislamiento DEVICE/USER, forma del SQL, regla del acierto, aviso al bloquear, y degradación con la tabla ausente (otros errores de la base se propagan).
- **Test contra la base real (versionado):** `api/test/pin-attempt.e2e-spec.ts` (6 tests, `jest --config test/jest-e2e.json`): 20 fallos simultáneos → `attempts = 20` y bloqueo de ~8 min; 429 al estar bloqueado y scopes independientes; 4 fallos no bloquean y el 5º sí; **un acierto justo después de fallar no borra los fallos**; un acierto tras 2 h limpia; un fallo de hace 25 h reinicia a 1.
- **Migración (C-013):** `20261014000000_pin_attempts`, aditiva; el SQL es idéntico al que genera `prisma migrate diff`; aplicada con `migrate deploy`; `migrate diff` contra la base: sin diferencias.
- **Rollback:** revertir servicio y módulo; la tabla es aditiva y vacía de datos de negocio. **Commit:** `3a10141`

### T-002 · El login por PIN y la verificación lo usan

```
via:     completo
touches: core/staff (staff.service.ts, staff.controller.ts)
status:  done
ruta:    inline
```

`pinLogin` comprueba el bloqueo del **dispositivo** antes de buscar el PIN; `operatorLogin` y `verifyPin`
el de la **sesión de usuario**. PIN inválido → `registerFailure`; válido → `registerSuccess`. Un
bloqueo responde 429 `PIN_LOCKED`.

**Done cuando:** tras 5 PIN malos desde un dispositivo, el sexto (aun correcto) responde 429; otro
dispositivo de la misma empresa no se ve afectado; un PIN correcto antes del umbral reinicia el contador.

**Evidencia.**
- **Test:** `staff.pin-lockout.spec.ts` (nuevo): el fallo se cuenta al dispositivo o al usuario, el bloqueo se comprueba **antes** de evaluar el PIN (aun el correcto), acertar limpia, sin identidad no se evalúa ningún PIN. `staff.controller.wiring.spec.ts` fija el cableado del controlador (a qué posición va `userId` y que `@CurrentUser("id")` está declarado; comprobado por mutación: sin el decorador fallan 4 tests). Los dos specs de staff existentes se adaptaron.
- **Runtime (C-021):** `pin-lockout-verify.cjs`, 15/15 con la API arrancada: 5 PIN malos → 401, el 6º con el PIN correcto → 429 `PIN_LOCKED` (`retryAfterSeconds` 60); el otro dispositivo de la empresa sigue en 201; `pin-verify` y `operator-login` comparten contador y la base lo confirma (`attempts 5`, bloqueado).
- **Defecto encontrado en la verificación:** la primera versión leía el usuario de `AuditContextService` y rechazaba TODO PIN, incluso el correcto, porque `DatabaseModule` declara una segunda instancia de ese servicio y la inyectada no era la que llena el interceptor. Los tests unitarios no lo vieron (C-021). Ahora el controlador pasa `@CurrentUser('id')`.
- **Rollback:** revertir `staff.service.ts` y el controlador. **Commit:** `3a10141`

### T-003 · La autorización de supervisor en cajas lo usa

```
via:     completo
touches: core/cash-sessions (cash-sessions.service.ts: resolveCashAuthorizer, cash-sessions.controller.ts)
status:  done
ruta:    inline
```

`resolveCashAuthorizer` aplica el bloqueo del **usuario** (el mismo contador que T-002) antes de buscar
el PIN y registra fallo/acierto. Los handlers que aceptan `authorizerPin` y hoy solo tienen el límite
global (`close` entre ellos; inventario por `grep authorizerPin` en DTOs y controlador) reciben
`@Throttle` propio de 10 por minuto, como `verify-auth` y `close-authorized`.

**Done cuando:** 5 PIN de supervisor erróneos en el cierre bloquean los siguientes intentos de
**cualquier** superficie de PIN de ese usuario; un usuario con el permiso propio no se ve afectado.

**Evidencia.**
- **Test:** `cash-sessions.pin-lockout.spec.ts` (8 tests): PIN que no corresponde a nadie y PIN de un empleado sin el permiso cuentan fallo; el supervisor correcto limpia; en espera → 429 sin evaluar el PIN; con permiso propio o `SUPER_ADMIN` no se toca el contador; sin identidad no se evalúa. `cash-sessions.controller.throttle.spec.ts` fija el `@Throttle` de 10/min en los 4 handlers y que no repiten `@UseGuards`. Las 12 construcciones de los 9 specs de cajas se adaptaron.
- **Runtime (C-021):** mismo script: cajero sin permiso de arqueo, 5 PIN malos → 403 `AUTHORIZATION_INVALID`; la base tiene su contador (`attempts 5`, bloqueado); el 6º con el PIN **correcto** del supervisor → 429 `PIN_LOCKED`. El límite propio de `active/count` corta en la petición 11 por IP; el dueño no se ve afectado.
- **Corregido durante la verificación:** mis `@UseGuards(ThrottlerGuard)` nuevos duplicaban el guard global y reducían el límite a la mitad; basta `@Throttle`.
- **Rollback:** revertir ambos archivos. **Commit:** `3a10141`

### T-004 · Los clientes muestran la espera

```
via:     simple
touches: apps/mobile/orbix-app (pantalla de PIN), web (diálogos de PIN de caja y comandera)
status:  todo
ruta:    —
```

Ante `PIN_LOCKED` muestran «Demasiados intentos. Espera N min.» en lugar del error genérico.

**Opcional para la corrección:** sin esto, el 429 se ve como error con el mensaje del servidor. Se hace
después y no bloquea el despliegue. **Evidencia prevista:** prueba manual en la pantalla; `tsc` y lint.
**Commit:**

---

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | completo | done    | inline | ~120 + tests | 3a10141 |
| T-002 | completo | done    | inline | ~50 + tests | 3a10141 |
| T-003 | completo | done    | inline | ~40 + tests | 3a10141 |
| T-004 | simple | todo | | ~40 | |

**Entrega:** ~350 previstas · umbral ~400 → dentro. T-001, T-002 y T-003 salen juntas (servidor); T-004
aparte.

**Orden de despliegue (C-019):** `prisma migrate deploy` ANTES que el código que usa la tabla (el arranque, `start:prod`, no aplica migraciones). Si el código llegara antes, el login por PIN no cae: el servicio degrada, deja pasar y registra un error por intento («tope DESACTIVADO»), pero el tope no protege hasta aplicar la migración. Los clientes no
necesitan cambiar para que el servidor sea correcto: el 429 se muestra con su mensaje.

**Siguiente paso:** T-004 (opcional) y el despliegue con la migración aplicada primero. La política de abajo se aplicó con el valor por defecto.

**Decisión pendiente del usuario:** ¿exigir 6 dígitos para los **PIN nuevos** (`assignPin`)? El bloqueo
hace aceptables los de 4; subir el mínimo cambia el teclado de la comandera y el alta de PIN en el web.
Por defecto **no se cambia** y así quedó.

---

## Escaladas

| Tarea | De | A | Trigger |
|---|---|---|---|
| T-001 | (asignada) | completo | Migración de `schema.prisma` y concurrencia |
| T-002 | (asignada) | completo | Autenticación (`pin-login` emite el JWT de operador) |
| T-003 | (asignada) | completo | Autorización de operaciones de caja con permiso de supervisor |

## Hallazgos fuera de alcance

| Hallazgo | Dónde | Gravedad aparente |
|---|---|---|
| El PIN se guarda con `sha256(tenantId:pin:pepper)`, rápido y determinista. Un hash lento obligaría a pedir el empleado junto al PIN (hoy el PIN lo identifica) | `staff.service.ts` `hashPin` | Media (solo si se filtra la base y el pepper) |
| `hashPin` está duplicado en `cash-sessions.service.ts` y `staff.service.ts` | ambos | Baja: deben cambiar a la vez |
| El pepper cae a `jwt.secret` y luego a la cadena fija `'orbix'` si faltan las variables | `staff.service.ts` | Media |
| Los PIN existentes de 4 dígitos siguen válidos | — | Baja |
| `DatabaseModule` declara y exporta una segunda instancia de `AuditContextService`: según el módulo, un servicio recibe la que el interceptor nunca llena y `getUserId()` devuelve `undefined` (me falló en `StaffService`). Habría que revisar qué módulos la reciben | `database/database.module.ts` | Media (atribución de auditoría silenciosamente vacía) |
| El `ThrottlerGuard` global y los `@UseGuards(ThrottlerGuard)` por ruta cuentan cada petición dos veces: el `@Throttle` de 10/min se comporta como 5/min en las rutas que repiten el guard (login, pin-login, verify-auth…) | `app.module.ts` + controladores | Baja |

## Revisión

**Candidato:** commit `3a10141` (revisado sobre el árbol sin commitear, idéntico).

**Ledger 4R** (suite final: 112 suites / 923 tests; e2e contra la base 6/6; runtime HTTP 15/15)

| id | lente | ubicación | severidad | estado | evidencia |
|---|---|---|---|---|---|
| R1-001 | riesgo | `registerSuccess` | CRITICAL | fixed | un acierto limpiaba siempre: 4 PIN malos + el propio PIN lo evadía. Ahora solo limpia tras 1 h de calma; probado contra la base |
| R4-001 | resiliencia | `assertNotLocked` y demás | CRITICAL | fixed | código antes que la migración tumbaba todo PIN (el arranque no migra). Ahora degrada con error en el log; el orden queda documentado |
| R3-001 | fiabilidad | `staff.controller.ts` | CRITICAL | fixed | el cableado de `userId` no tenía test. `staff.controller.wiring.spec.ts`, validado por mutación |
| R3-002 | fiabilidad | `pin-attempt.service` | CRITICAL | fixed | concurrencia y ventana solo se probaban con un script fuera del repo. `api/test/pin-attempt.e2e-spec.ts` |
| R3-003 | fiabilidad | `cash-sessions.controller.ts` | WARNING | fixed | `@Throttle` sin test. `cash-sessions.controller.throttle.spec.ts` |
| R2-001 | legibilidad | `cash-sessions.controller.ts` | WARNING | info | convive `@Throttle` solo (nuevo) con `@UseGuards` + `@Throttle` (previo); el comentario lo explica y el doble conteo está anotado abajo |
| R2-002 | legibilidad | este documento | WARNING | fixed | `tenantId` inexistente, «13 constructores» y «5 llamadores» corregidos |
| R4-002 | resiliencia | `registerFailure` | WARNING | wont-fix | un error transitorio de la base da 500 en vez de 401 en un PIN que ya era malo |
| R4-003 | resiliencia | terminal compartida | WARNING | wont-fix | 5 PIN malos seguidos de cualquiera bloquean el terminal 1 min para todos: decisión de diseño documentada; T-004 mostrará la espera |
| R4-004 | resiliencia | `registerSuccess` | WARNING | wont-fix | una consulta extra por acierto, por índice único; acotada por el límite por IP |
| R4-005 | resiliencia | `registerFailure` | WARNING | wont-fix | `assertNotLocked` y `registerFailure` no son atómicos entre sí: una ráfaga paralela puede pasar el chequeo antes del 5º fallo; lo acota el límite por IP |
| R4-006 | resiliencia | `pin_attempts` | WARNING | wont-fix | sin limpieza de filas huérfanas: una fila por principal, volumen despreciable |
| R4-007 | resiliencia | `registerFailure` | WARNING | fixed | sin rastro al bloquear. Ahora `logger.warn` con prefijo del identificador |

**Cerrado** con el commit `3a10141`. Pendiente: T-004 (clientes muestran la espera; opcional, no bloquea el despliegue) y, antes de desplegar, `prisma migrate deploy` (ya aplicado en la base compartida).
