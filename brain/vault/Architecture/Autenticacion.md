---
title: Autenticacion
type: architecture
owner: Requiere validación
updated: 2026-10-12
tags: [arquitectura, autenticacion, orbix-erp]
---

# Autenticación

## Orbix ERP

- **Flujo en dos pasos**, distinto de un login tradicional de un solo JWT:
  1. `POST /auth/login` → JWT preliminar (sin `tenantId`) + lista de `availableTenants`.
  2. `PATCH /auth/select-tenant/:slug` → JWT con `tenantId` + `tenantRole` + `posOnly`.
  3. `PATCH /auth/select-branch/:branchId` → JWT con `branchId`.
- **Panel Platform**: JWT y guard completamente separados (`platform-jwt`,
  `PlatformJwtGuard`) del flujo de tenant normal — un `PlatformUser` nunca es válido contra
  los endpoints de un tenant.
- **Sesión**: `RefreshToken` y `RevokedToken` existen como modelos en el esquema —
  **requiere validación** el detalle exacto de rotación/expiración, no confirmado a fondo
  en el análisis inicial.
- **Baja de acceso inmediata** (2026-10-12): el token de acceso (hasta 1 día) ya no sobrevive a la
  baja de quien lo tiene. En cada petición con empresa, la estrategia JWT exige que la
  `TenantMembership` del usuario siga `ACTIVE`: si se desactivó, se dio de baja o se removió, responde
  **403 `MEMBERSHIP_INACTIVE`** (no 401: un 401 haría que el cliente refresque y reciba un token sin
  empresa). La fuente es la base, no la caché de permisos de 60 s, así que aplica a todas las
  instancias. Los **tokens de operador** (PIN, 12 h) comprueban además que el empleado y la empresa
  sigan activos y responden **401 `OPERATOR_INACTIVE`**; ese veredicto se cachea 30 s por empleado y
  se invalida al editar o dar de baja, así que otra réplica puede tardar hasta 30 s en notarlo.
  Los clientes web y POS web cierran la sesión ante `MEMBERSHIP_INACTIVE`. Origen:
  hallazgo 1 de la auditoría 2026-10-12 (`orbix-admin/docs/audits/`); plan en
  `orbix-admin/docs/odd/acceso-residual-tras-baja.md`. **Requiere validación:** la app móvil nueva
  aún no reconoce el código (su 403 no cierra sesión).
- **OAuth (Google)**: un solo flujo, de *redirect* (authorization code).
  `GET /auth/google` → consentimiento → `GET /auth/google/callback` →
  redirect al frontend con un **ticket de un solo uso** (`OAuthTicket`, SHA-256 en base, TTL
  120 s) → `POST /auth/oauth/exchange` devuelve exactamente el mismo `AuthResponseDto` que
  `/auth/login`. El JWT nunca viaja en la URL. El destino del redirect viaja en el `state` y
  se valida contra `OAUTH_ALLOWED_REDIRECTS` — sin esa allowlist el callback sería un open
  redirect con sesión válida adjunta.
  - Orbix **sí auto-vincula por email** cuando Google reporta `email_verified`
    (decisión de producto, 2026-08-20); sin verificar, se rechaza.
  - Un correo desconocido da de alta el `User` sin contraseña (`User.password` es nullable) y
    **sin tenant**: cae en el wizard existente `POST /tenants/onboarding`, igual que un
    registro normal. Google no crea empresas por su cuenta.
  - Sin `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` el API arranca igual: la estrategia no se
    registra y los endpoints responden 503.

Detalle: [[Administracion Multi-tenant (Orbix)]], `orbix-admin/api/CLAUDE.md`.
