---
title: ADR-0032 Envio de invitaciones por Gmail API en lugar de SMTP (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-23
tags: [adr, orbix-erp, integraciones]
---

# ADR-0032 — Envío de invitaciones por Gmail API (OAuth2) en lugar de SMTP con contraseña de aplicación (Orbix ERP)

**Estado:** Aceptada
**Ámbito:** Orbix ERP · módulo `core/email` · **Fecha:** 2026-08-23

## Contexto

El envío de invitaciones ([[ADR-0031 Alta de usuario solo por invitacion aceptada (Orbix)]])
necesitaba un remitente de correo real. `EmailService` ya soportaba SMTP genérico
(`nodemailer`) con fallback a Ethereal (bandeja de prueba) cuando `SMTP_HOST`/`SMTP_USER` no
estaban configurados en `.env` — usado hoy para recibos de venta. La opción más rápida era
completar ese mismo camino con una App Password de Gmail.

Orbix ya tenía un proyecto de Google Cloud con `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
para el login OAuth de usuarios ([[Integraciones]]).

## Decisión

Se optó por Gmail API con OAuth2 en vez de SMTP + App Password, reutilizando el cliente
OAuth existente en vez de crear credenciales nuevas. El scope solicitado es únicamente
`gmail.send` — deliberadamente no `https://mail.google.com/`, que habría dado además lectura
y borrado de todo el buzón de la cuenta remitente sin necesidad.

`GmailApiService` canjea un refresh token de larga vida por access tokens de ~1h (cacheados
en memoria), y arma el mensaje MIME a mano en base64url para `users.me.messages.send`. El
refresh token se obtiene una vez, fuera de la aplicación, con
`api/scripts/get-gmail-refresh-token.ts` — quien lo corre ve el token en su propia terminal;
no pasa por ningún log ni se pide a través del chat.

`EmailService.sendTenantInvitation` usa Gmail cuando `GmailApiService.isConfigured()` es
verdadero (existen `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` y
`GMAIL_SENDER`); si no, cae al transporte SMTP/Ethereal existente, así que el flujo se puede
desarrollar y probar sin ninguna credencial de Gmail.

## Evidencia

`api/src/modules/core/email/gmail-api.service.ts`, `email.service.ts` (rama
`isConfigured()`), `api/scripts/get-gmail-refresh-token.ts`, `api/.env`
(`GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER`, `GMAIL_SENDER_NAME`, junto al bloque
`GOOGLE_CLIENT_ID`/`SECRET` ya existente).

## Consecuencias

**Positivas**
- Sin contraseña permanente de la cuenta de Gmail en texto plano en `.env` — el refresh
  token se puede revocar desde la propia cuenta de Google
  (`myaccount.google.com/permissions`) sin cambiar la contraseña de esa cuenta.
- Mínimo privilegio real: con solo `gmail.send`, el API no puede leer ni borrar nada del
  buzón aunque el refresh token se filtrara.
- Reutiliza credenciales y flujo de consentimiento ya existentes del login OAuth.

**Negativas**
- El mismo mínimo privilegio impide verificar la entrega desde el propio backend: no hay
  forma de confirmar por API si un correo cayó en spam o fue rechazado silenciosamente sin
  ampliar el scope a algo como `gmail.readonly` — ampliación que es una decisión de producto,
  no algo a hacer solo para depurar. Un envío se da por exitoso cuando Gmail devuelve un id
  de mensaje; eso es todo lo que se puede confirmar sin ese scope adicional.
- Mientras el proyecto de OAuth de Google Cloud esté en modo "Prueba" (Testing), los
  refresh tokens caducan a los 7 días y solo autorizan cuentas agregadas explícitamente
  como "usuarios de prueba" — para producción hace falta publicar la app
  (pasar a estado "Producción" en la pantalla de consentimiento).
- Gmail impone límites de envío de cuenta personal (500/día) muy por debajo de lo que
  necesitaría una plataforma con muchos tenants activos, y el remitente visible es la cuenta
  de Gmail configurada, no un dominio propio de Orbix — aceptable para desarrollo, no para
  producción.

## Notas

Para producción se recomienda migrar a un proveedor transaccional (Resend, Postmark,
SendGrid) con dominio propio verificado (SPF/DKIM), no escalar esta integración de Gmail.
**Requiere validación** si esa migración ya tiene fecha o dueño asignado.
