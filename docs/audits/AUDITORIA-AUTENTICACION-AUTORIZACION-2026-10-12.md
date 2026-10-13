# Auditoría de autenticación, autorización, datos y sesiones

**Fecha:** 2026-10-12
**Alcance:** API de orbix-admin (`api/`), panel Platform, web de back-office (`web/`), tienda pública, y la app móvil nueva (`orbix-mobile`) en lo que toca a la sesión.
**Método:** lectura de código más **verificación en ejecución** con la API local (`:3001`) contra la base de `api/.env`, usando cuentas y empresas creadas para la prueba. **No se modificó código ni configuración.** Complementa `AUDITORIA-SEGURIDAD-ORBIX-2026-08-24.md`.

> Convenciones: **Verificado** = reproducido contra la API y la base reales. **Código** = el código lo permite, pero no ejecuté el ataque (por riesgo o por falta de credenciales). **No demostrado** = hipótesis que la prueba no pudo confirmar.

---

## 1. Resumen

| # | Gravedad | Hallazgo | Evidencia |
|---|---|---|---|
| 1 | **Alta** | Quien es desactivado o dado de baja conserva su acceso hasta 24 h | Verificado |
| 2 | **Alta** | Las credenciales de los dispositivos se entregan a quien no debería verlas | Verificado |
| 3 | **Alta** | El PIN de empleados y supervisores no tiene límite de intentos | Código |
| 4 | Media | Una empresa puede modificar cupones de otra (IDOR) | Verificado |
| 5 | Media | Platform: roles sin aplicar, sin MFA ni revocación de tokens | Código |
| 6 | Media | El bloqueo de cuenta se evade con peticiones simultáneas | Código |
| 7 | Media | Web: tokens en `localStorage` y sin CSP | Código |
| 8 | Baja | Plan y módulos del token pueden estar desactualizados hasta 24 h | Código |
| 9 | Baja | Pedidos públicos de la tienda sin topes y con precio del cliente | Código |
| 10 | Baja | Secretos sin validación en producción; fila de usuario completa en `req.user` | Código |
| 11 | Baja | Enumeración de correos | Parcial |

**Orden de remediación sugerido:** 1 → 2 → 4 → 3 → 6 → 5 → 7 → resto. Los hallazgos 1, 2 y 4 son cambios pequeños con prueba verificable.

---

## 2. Hallazgos

### 1 · Alta — Desactivar o dar de baja no corta el acceso (Verificado)

**Dónde:** `api/src/modules/core/users/users.service.ts` (`updateStatus`, ~L215-260; `remove`, ~L283-312), `api/src/common/services/effective-permissions.service.ts` (`compute`), `api/src/modules/core/auth/strategies/jwt.strategy.ts` (`validate`).

**Qué pasa.** Con un dueño y dos miembros a los que di el rol completo:

| Paso | Resultado |
|---|---|
| Miembro desactivado (`PATCH /users/:id/deactivate`), antes | `GET /products` → 200 |
| Mismo token, **después** de desactivar | `GET /products` → **200** |
| Miembro dado de baja (`DELETE /users/:id`), antes | 200 |
| Mismo token, **después** de la baja | **200** |
| Token obtenido **refrescando** tras desactivar | 403 |

**Causa.** `updateStatus` y `remove` terminan con `permissionCache.invalidateUser(...)` y un comentario que dice "Suspending someone must take their access away immediately". Pero invalidar la caché solo obliga a recalcular, y `compute()` obtiene los permisos de `userRoleAssignment` por (usuario, empresa) **sin mirar `TenantMembership.status`**. `JwtStrategy.validate` comprueba que el usuario y la empresa estén activos, pero no la membresía. El refresco sí la comprueba, por eso allí se corta.

**Impacto.** Un empleado despedido, incluso con rol de dueño, conserva todos sus permisos hasta que expire su token. `JWT_EXPIRES_IN=1d`: hasta **24 horas**.

**Arreglo.**
1. Comprobar `membership.status === 'ACTIVE'` para (usuario, empresa) en cada petición, dentro de la misma caché de permisos (se invalida ya en estos dos flujos).
2. Acortar el token de acceso a 15-30 minutos; el refresco ya está bien hecho.
3. Prueba automática: desactivar y dar de baja, y comprobar que el token anterior responde 401/403.

---

### 2 · Alta — Credenciales de dispositivo expuestas (Verificado)

**Dónde:** `api/src/modules/core/devices/devices.controller.ts` (`GET /devices`, L56-62), `devices.service.ts` (`list`, L249-254; `validate`, L~93-115).

**Qué pasa.**
- `GET /devices` exige solo `settings:view`, un permiso de **lectura**, y devuelve la fila completa: `id, tenantId, branchId, licenseId, deviceId, deviceToken, name, model, os, …`. Incluye el **`deviceToken`**, la credencial duradera del dispositivo.
- `POST /devices/validate` es **público**: con solo el `deviceId` devuelve `registered: true` y el mismo `deviceToken` que emitió la activación. Además busca con `findFirst({ where: { deviceId } })`, **sin filtrar por empresa** (el único es `(tenantId, deviceId)`).
- `POST /devices/activate` es público y se autoriza solo con la clave de licencia, que es un secreto de larga vida.

**Verificado:** activar un dispositivo (201, token de 64 caracteres) → el listado lo incluye → `validate` sin autenticación devuelve **el mismo** token. Un `deviceId` desconocido responde `registered: false`.

**Matiz.** El `deviceId` de la app es un UUID aleatorio (122 bits): no se adivina. El riesgo es que el listado lo entrega junto al token, y que un identificador funciona como credencial.

**Impacto.** Un usuario de solo lectura obtiene las credenciales de todos los dispositivos de su empresa. Con ellas puede intentar el login por PIN (hallazgo 3).

**Arreglo.**
- `select` explícito en el listado, sin `deviceToken` (ni siquiera `deviceId` si no hace falta).
- `validate` no debe devolver el token a quien solo presenta el identificador; que lo exija el dispositivo con una prueba que ya posea.
- Filtrar `validate` por empresa o, mejor, sustituir el identificador por un secreto del dispositivo.

---

### 3 · Alta — PIN sin bloqueo por intentos (Código)

**Dónde:** `api/src/modules/core/staff/staff.service.ts` (`hashPin` L40-43, `pinLogin` L46, `buildOperatorSession` L78-), `staff.controller.ts` (L19-26), `cash-sessions.controller.ts` (`PATCH :id/close`, ~L173), `cash-sessions.service.ts` (`resolveCashAuthorizer`, ~L745).

**Qué pasa.**
- El PIN son 4 a 6 dígitos (`^\d{4,6}$`) y **identifica al empleado él solo**: `findFirst({ tenantId, pinHash })`, sin identificador de usuario. El PIN debe ser único por empresa, así que con N empleados la probabilidad por intento sube.
- **No existe contador de fallos ni bloqueo.** `pin-login` tiene 10 intentos por minuto por IP; el cierre de caja con `authorizerPin` no tiene `@Throttle` propio y solo tiene el límite general de 100 por minuto.
- El PIN se guarda como `sha256(tenantId:pin:pepper)`: rápido por diseño.

**Ritmo de fuerza bruta (cálculo, no ejecutado).** Un PIN de 4 dígitos son 10⁴ combinaciones: ~100 minutos a 100 por minuto por IP en el cierre de caja, y menos si hay varios empleados con PIN. Con 6 dígitos, del orden de días.

**Requisitos del atacante.** Una sesión de usuario válida (cierre de caja) o un `deviceToken` (login por PIN; ver hallazgo 2).

**Impacto.** Un cajero puede acabar usando el PIN de un supervisor: autoriza un cierre de caja o abre una sesión de operador con sus permisos durante 12 h.

**Arreglo.**
- Contador de fallos con espera creciente por dispositivo y por empleado, y alerta.
- Exigir identificador de empleado más PIN, o al menos 6 dígitos.
- Límite propio y bajo en el cierre de caja.
- Hash lento (argon2 o scrypt) con sal por empleado.

---

### 4 · Media — Una empresa modifica cupones de otra (Verificado)

**Dónde:** `api/src/modules/retail/coupons/coupons.controller.ts` (L78-85), `coupons.service.ts` (`incrementUsage`, L195-200).

`POST /coupons/:id/increment-usage` hace `coupon.update({ where: { id } })` **sin `tenantId`**, y solo exige `coupons:view` (lectura).

**Verificado con dos empresas reales:** la empresa B **no puede leer** el cupón de A (404, el aislamiento de lectura funciona), pero ejecutó 3 llamadas con **204** y el contador de usos del cupón de A (límite 3) quedó en **3**: B agotó el cupón de A.

**Matiz.** Hace falta conocer el UUID del cupón. Dentro de la misma empresa, un usuario de solo lectura puede quemar usos.

**Arreglo.** Filtrar por `tenantId` en la consulta y exigir un permiso de escritura.

**Cobertura del escaneo.** Busqué consultas `findUnique/findFirst/update/delete` por `id` sin `tenantId` en los 45 modelos que tienen esa columna: 125 coincidencias, de las cuales solo 9 carecían de comprobación previa en la misma función, y de esas solo ésta era real. **No cubre** modelos hijos sin `tenantId`, ni `updateMany`/`deleteMany`, ni condiciones `id: { in: [...] }`.

---

### 5 · Media — Platform (Código; el límite de login sí verificado)

**Dónde:** `api/src/modules/platform/**`.

- **Roles sin aplicar.** `PlatformUserRole` tiene `SUPER_ADMIN` y `SUPPORT`, pero solo `resetPassword` los distingue. Cualquier usuario activo, incluido `SUPPORT`, puede aprovisionar empresas con su administrador, cambiar plan/módulos/límites, suspender licencias, administrar dominios y sucursales.
- **Sin MFA ni bloqueo por cuenta** en el login de la cuenta que ve todas las empresas. Solo hay un límite de **5 intentos por minuto por IP** (verificado: 25 intentos dieron 2 × 401 y 23 × 429), insuficiente contra un ataque repartido entre IPs.
- **Token de 1 día, sin revocación.** El token lleva `jti`, pero `PlatformJwtStrategy` no lo comprueba contra ninguna lista. Cambiar o resetear la contraseña no invalida los tokens ya emitidos.
- Todos los controladores de Platform llevan `@Public()` más `@UseGuards(PlatformJwtAuthGuard)`: **verificado** que ninguno carece del guard.

**Arreglo.** Aplicar roles por ruta; MFA obligatorio; contador de fallos por cuenta; comprobar el `jti` o `tokensValidFrom` también en Platform; vida de token corta con refresco.

---

### 6 · Media — Bloqueo de cuenta evadible (Código)

**Dónde:** `api/src/modules/core/auth/auth.service.ts` (`login`, L94-140; `registerFailedLogin`, L205-230), `services/mfa.service.ts` (`verifyChallenge`).

- `registerFailedLogin(userId, previousAttempts)` calcula `attempts = previousAttempts + 1` con un valor leído **antes** de comparar la contraseña. Con peticiones simultáneas a la misma cuenta todas leen el mismo valor y escriben el mismo, así que el contador **no avanza** y no llega al umbral de 5. Solo lo frena el límite por IP.
- Un fallo de **MFA** no cuenta para el bloqueo de cuenta; el desafío se consume en el primer intento, pero con la contraseña conocida cada intento solo exige repetir el login.
- Un código **TOTP ya usado** puede reutilizarse mientras dure su ventana (no se guarda el último paso de tiempo usado).

**Arreglo.** `failedLoginAttempts: { increment: 1 }` atómico; contar también los fallos de MFA; registrar el último paso TOTP aceptado.

---

### 7 · Media — Web de back-office (Código)

**Dónde:** `web/src/lib/platform-api-client.ts`, `web/src/services/core/auth-service.ts`.

El token de acceso, el de **refresco** (30 días) y el de Platform se guardan en `localStorage`. El SPA no define política CSP (ni `<meta>` ni cabeceras de hosting en el repositorio). No encontré `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni `document.write`, así que **hoy no hay un vector concreto**; si algún día entrara un XSS, se llevaría la sesión completa.

**Arreglo.** CSP estricta en el hosting del SPA; valorar cookies `HttpOnly` para el refresco.

---

### 8 · Baja — Claims desactualizados en el token (Código)

`api/src/common/guards/require-module.guard.ts` (L26-28) y `require-plan.guard.ts` (L27) toman `plan` y `enabledModules` **del token**, que puede tener hasta 24 h. Tras bajar de plan o terminar una prueba (S-A), el negocio conserva los módulos de pago ese tiempo. `tenantRole` del token **no** se usa para decidir permisos (bien).

**Arreglo.** Releer plan y módulos de la base (ya hay caché) o acortar el token (hallazgo 1).

### 9 · Baja — Pedidos públicos de la tienda (Código)

`POST /store/orders` es público; la empresa se resuelve por el encabezado `Origin` (`StoreDomainGuard`), que un cliente que no sea un navegador puede poner a voluntad. `CreateStoreOrderDto` toma el `price` **del cliente** (`subtotal = Σ item.price × item.quantity`) y no tiene tope de tamaño (`ArrayMaxSize`, `MaxLength`, `Max`). Es un registro de carrito de WhatsApp sin pago en línea, así que el impacto es de integridad de datos y abuso, no de dinero.

**Arreglo.** Precio calculado en el servidor desde `productId`; topes de tamaño; límite propio y, si hace falta, captcha.

### 10 · Baja — Secretos sin validación y exceso de datos (Código)

- `api/src/config/mfa.config.ts`: la clave de cifrado del MFA usa `MFA_ENCRYPTION_KEY`, **si falta usa `JWT_SECRET`** y, si falta, la cadena fija `'orbix-mfa-dev-key'`. `staff.service.ts` L41 hace lo mismo con `STAFF_PIN_PEPPER`. En este entorno `MFA_ENCRYPTION_KEY` **no está definido**. Rotar un secreto rota el otro sin querer.
- `JwtStrategy.validate` pone en `req.user` la **fila completa** del usuario, incluidos el hash de contraseña y el secreto MFA cifrado. **Ningún endpoint la devuelve hoy** (revisado), pero cualquier `return user` o registro futuro la filtraría.

**Arreglo.** Exigir las variables en producción (fallar al arrancar); `select` de los campos necesarios en la estrategia.

### 11 · Baja — Enumeración de cuentas (Parcial)

- `POST /auth/register` responde 409 explícito si el correo existe (verificado en pruebas del alta). Es una decisión de experiencia de usuario; el límite de 5 por minuto la acota.
- `login` responde de inmediato, sin comparar hash, cuando el correo no existe, la cuenta es solo de Google o está bloqueada. **No demostrado:** medí 4 intentos y la latencia de la base (~400 ms) tapa cualquier diferencia.

### Menores

- `RefreshTokenService.rotate` lee y luego actualiza sin condición: dos refrescos simultáneos del mismo token válido pasan los dos.
- Cada petición con un `jti` no revocado hace una consulta a `revoked_tokens`: la caché solo guarda los revocados. Rendimiento, no seguridad.
- La caché de permisos es por instancia (60 s): con varias instancias, una revocación tarda hasta un minuto en las demás.
- Android: `allowBackup="true"`; las reglas de `expo-secure-store` excluyen los tokens, pero el MMKV (borrador del alta con teléfono, resumen de empresa) puede respaldarse.

---

## 3. Lo que está bien

- Los permisos **fallan cerrado** (`PermissionsGuard`) y hay un test de cobertura de autorización (`authorization-coverage.spec.ts`).
- Refresco opaco, hasheado, **con rotación y detección de reutilización** que quema la familia.
- Contraseña restablecida: token hasheado, un solo uso, 60 minutos, y revoca sesiones (`tokensValidFrom`). Cambiarla invalida los tokens de acceso.
- Secretos de usuarios y de Platform **separados** (longitud de `JWT_SECRET`: 47).
- Lista de tokens revocados respaldada en base de datos y consultada entre instancias.
- `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`; el campo `role` se quitó de los DTOs de usuario (no hay asignación masiva de `SUPER_ADMIN`).
- Escalada de privilegios acotada: `assertActorCanGrant` y protección del último administrador.
- Google: audiencia del `idToken` y `email_verified` comprobados; autovinculación solo con correo verificado.
- MFA con secreto cifrado (AES-256-GCM) y desafío de un solo intento.
- Swagger solo fuera de producción; helmet; filtro de excepciones que no filtra trazas; CORS con lista y verificación de dominios.
- Sin secretos en el historial de git: los `.env` que entraron alguna vez (`.env.development`, `.env.production` de la app móvil anterior) solo traen `EXPO_PUBLIC_*`, públicas por diseño.
- App móvil: HTTPS obligatorio fuera de desarrollo, tokens solo en SecureStore, sin `console.log`, cierre de sesión que revoca en el servidor.

---

## 4. Plan de remediación

| Orden | Hallazgo | Esfuerzo | Prueba que lo cierra |
|---|---|---|---|
| 1 | Acceso residual tras baja o desactivación | S | Token anterior responde 401/403 tras desactivar y tras dar de baja |
| 2 | `deviceToken` en listado y en `validate` | S | El listado no trae token; `validate` sin prueba de posesión no lo devuelve |
| 3 | Cupón por `id` sin `tenantId` | S | La empresa B recibe 404 al incrementar el cupón de A |
| 4 | PIN sin bloqueo | M | N intentos fallidos bloquean al dispositivo y al empleado; el cierre de caja tiene límite propio |
| 5 | Contador de fallos no atómico | S | 50 intentos simultáneos bloquean la cuenta al quinto |
| 6 | Roles de Platform y MFA | M | `SUPPORT` recibe 403 en provisión, plan, licencias y dominios |
| 7 | Tokens en `localStorage` y CSP | M | Cabecera CSP presente; refresco fuera de `localStorage` |
| 8 | Claims del token, tienda pública, secretos | S-M | Plan leído de la base; precio calculado en el servidor; el arranque falla sin las variables |

---

## 5. Verificación en ejecución: qué se hizo y con qué datos

Todas las pruebas usaron la API local contra la base de `api/.env` (`neondb`). Los scripts viven en el directorio temporal de la sesión y no se versionan.

- **Miembros desactivados y dados de baja:** 1 dueño y 2 miembros. Las primeras ejecuciones fueron inválidas por mis propios errores (el login chocó con su límite de 5 por minuto y un script cantó "OK" sin tokens); se corrigió para abortar si la preparación falla y solo cuento la ejecución válida.
- **Cupón entre empresas:** 2 empresas y 1 cupón. Una ejecución falló por mi cuerpo de petición (`firstName` de un carácter y `startDate` ausente).
- **Dispositivos:** 1 empresa y 1 dispositivo activado.
- **Límite de login de Platform:** 25 intentos con correos inexistentes.
- **Rectificación:** antes afirmé que el login de Platform no tenía límite propio. Es falso: tiene 5 por minuto; mi búsqueda se había cortado antes de llegar a esa línea.

### Datos de prueba que quedaron en la base

No se borraron: eliminar filas de una base compartida requiere aprobación.

- **Usuarios** con correo `*@orbix.test` y prefijos `audit-`, `race-`, `trials-`, `sa-trial-` y `app-trial-`.
- **Empresas** con nombres que empiezan por `Auditoria`, `Cupon A`/`Cupon B`, `Dispositivos`, `Carrera`, `Trial`, `Vida` y `Prueba S-A`, más `Cafe Prueba Emulador`.
- Un **cupón** en la empresa `Cupon A …`, un **dispositivo** en `Dispositivos …`, una solicitud de mejora de plan y las licencias, sucursales y roles que crea cada alta.

Se pueden localizar por el dominio `@orbix.test` y borrar en cascada desde los usuarios dueños.

---

## 6. Límites de esta auditoría

- No probé el login de Platform con una cuenta real ni la pantalla `/platform/solicitudes`: no hay credenciales de prueba.
- El análisis de aislamiento entre empresas es estático y parcial (ver hallazgo 4).
- No revisé las páginas del web de back-office, el POS web ni la app móvil anterior (`apps/mobile/orbix-mobile(deprecated)`), ni la tienda Astro.
- No ejecuté ninguna fuerza bruta contra PIN ni contraseñas: el hallazgo 3 es un cálculo a partir del código.
- No audité dependencias (`pnpm audit`) ni la infraestructura (proxy, TLS, cabeceras del hosting).
