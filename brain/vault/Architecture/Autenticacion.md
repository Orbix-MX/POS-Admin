---
title: Autenticacion
type: architecture
owner: Requiere validación
updated: 2026-08-20
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
