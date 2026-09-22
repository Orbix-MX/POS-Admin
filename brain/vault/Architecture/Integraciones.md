---
title: Integraciones
type: architecture
owner: Requiere validación
updated: 2026-08-23
tags: [arquitectura, integraciones, orbix-erp]
---

# Integraciones

Orbix ERP integra únicamente servicios externos genéricos.

| Integración | Para qué | Mecanismo |
|---|---|---|
| PostgreSQL (Neon) | Base de datos | Prisma 7 + `@prisma/adapter-pg` |
| Storage de imágenes de producto | Subida de imágenes | **Requiere validación** el proveedor exacto (R2 u otro) |
| Gmail API (OAuth2) | Envío de invitaciones de usuario | `GmailApiService`, scope `gmail.send` únicamente; reutiliza el cliente OAuth del login. Sin credenciales cae a SMTP/Ethereal. Ver [[ADR-0032 Envio de invitaciones por Gmail API en lugar de SMTP (Orbix)]] — pensado para desarrollo, no para producción (límites de envío, sin dominio propio) |
| Google OAuth | Login/registro alternativo | Mismo cliente (`GOOGLE_CLIENT_ID`/`SECRET`) que Gmail API arriba |

Todos los clientes ([[Orbix ERP Web]], [[Orbix Apps Moviles y Desktop]]) hablan
directamente con [[Orbix ERP API]] vía REST/JSON — tampoco hay gateway.
