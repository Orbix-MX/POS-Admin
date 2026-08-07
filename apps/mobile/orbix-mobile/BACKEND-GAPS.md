# Endpoints que el móvil necesita y la API aún no expone

Verificado contra `pos-admin/api/src` el 2026-08-06. Ningún endpoint de esta lista
existe. La app **no simula ninguno**: los repositorios lanzan `NotImplementedError`
con la ruta esperada, y la UI degrada de forma explícita.

Los tipos completos de request/response están en
[`src/dto/onboarding.dto.ts`](src/dto/onboarding.dto.ts). Los puntos de llamada ya
están cableados en [`src/repositories/onboarding-repository.ts`](src/repositories/onboarding-repository.ts):
implementar el backend consiste en borrar el `throw` y descomentar la línea `http.*`.

---

## 1. `POST /api/auth/google`

**Por qué falta:** no hay ningún proveedor OAuth registrado en NestJS
(`grep -i 'google\|oauth' api/src` no devuelve nada relevante).

**Estado en el móvil:** el flujo PKCE con `expo-auth-session` está implementado
completo (`src/features/auth/use-google-auth.ts`). Abre el navegador, obtiene el
`code` y el `code_verifier`, y los envía. Solo falta el intercambio en el servidor.

| | |
|---|---|
| Auth | Público, throttled igual que `/auth/login` (5/min) |
| Request | `GoogleSignInRequestDto` — `{ code, codeVerifier, redirectUri, platform }` |
| Response | **Idéntico a `AuthResponseDto`** de `/auth/login`, para reutilizar el manejo de sesión |

El servidor debe verificar el código contra los client IDs de Google, y
crear-o-vincular el `User`. Las credenciales del cliente salen de variables de
entorno (`EXPO_PUBLIC_GOOGLE_*`); el *client secret* nunca toca el móvil.

Si no hay ningún client ID configurado, el botón simplemente no se renderiza.

---

## 2. `POST /api/auth/phone/send-code` y `POST /api/auth/phone/verify-code`

**Por qué falta:** no hay proveedor SMS configurado.

**Estado en el móvil:** el campo OTP de 6 casillas, el auto-avance, el borrado
hacia atrás, el autofill del SO, el contador de reenvío de 60 s y los estados
*verificando* / *verificado* funcionan de verdad. Al no existir el endpoint, la
pantalla muestra un aviso claro y permite continuar con `phoneVerified: false`.

| | |
|---|---|
| Auth | Bearer |
| send-code | `{ phone: E.164 }` → `{ verificationId, resendAfterSeconds, maskedPhone }` |
| verify-code | `{ verificationId, code }` → `{ verified, verifiedAt? }` |

Limitar por usuario **y** por número: el cooldown del cliente no es confiable.

---

## 3. `POST /api/tenants/onboarding`

**Por qué falta:** `POST /api/tenants` sí existe, pero está protegido con
`@UseGuards(RolesGuard) @Roles('SUPER_ADMIN')`, así que un usuario recién
registrado no puede llamarlo. Además solo crea el `Tenant`: no crea la membresía
del dueño, ni la sucursal por defecto, ni los roles.

| | |
|---|---|
| Auth | Bearer, **cualquier usuario autenticado** |
| Request | `CreateTenantOnboardingRequestDto` |
| Response | `{ tenant, accessToken, branchId }` |

Debe hacer, en una sola transacción:

1. crear el `Tenant` (slug derivado de `name`, con unicidad),
2. crear el `TenantMembership` del dueño con `TenantRole.OWNER`,
3. fijar `Tenant.ownerUserId`,
4. crear la `Branch` por defecto,
5. sembrar los `Role` por defecto del vertical,
6. devolver un access token **ya scoped al tenant nuevo**, para ahorrar el
   `PATCH /auth/select-tenant/:slug`.

El wizard mapea la selección del usuario a `BusinessVertical` y `BusinessProfile`
(ver `src/constants/business-types.ts`), que es lo que el schema Prisma ya entiende.

---

## 4. `GET /api/catalogs/business-types`

**Por qué falta:** los enums `BusinessVertical` y `BusinessProfile` existen en
Prisma pero ningún controlador los expone.

**Estado en el móvil:** funciona hoy con el catálogo local de
`src/constants/business-types.ts` (los 10 tipos del prototipo). El repositorio
intenta la llamada remota, y ante un 404 cae al catálogo local sin ruido. En
cuanto el endpoint exista, la lista del servidor gana automáticamente y se
cachea — sin necesidad de publicar una versión nueva de la app.

| | |
|---|---|
| Auth | Público, cacheable |
| Response | `{ items: BusinessTypeDto[], version: string }` |

`label` debe venir ya localizado según el header `Accept-Language`, que el cliente
envía en cada request.

---

## 5. `GET /api/tenants/current/branding`

**Por qué falta:** `GET /tenants/current/info` ya devuelve logo y banner, pero no
la paleta.

**Estado en el móvil:** el sistema de temas es completamente dinámico
(`ThemeProvider` + variables CSS de NativeWind). Sin este endpoint, cada tenant
usa la paleta Orbix por defecto — que es el comportamiento correcto para quien
nunca personalizó nada.

| | |
|---|---|
| Auth | Bearer |
| Response | `TenantBrandingResponseDto`, debe coincidir con `TenantBranding` de `src/theme/types.ts` |

El cliente ignora las claves que no conoce, así que el backend puede añadir
tokens nuevos sin romper versiones viejas de la app.

---

## 6. Moneda del tenant (menor)

La moneda vive en `Tenant.settings` (JSON) pero no la devuelve ningún endpoint
alcanzable: ni `/auth/me` ni `/auth/select-tenant`, y `/tenants/current/settings`
exige el permiso `settings:manage`, que un usuario de POS no tiene.

Mientras tanto, la pantalla de inicio formatea los importes con `MXN`
(ver el TODO en `src/app/(app)/index.tsx`). Basta con añadir `currency` a
`SelectTenantResponseDto`.
