---
title: Decisiones (ADR)
type: index
owner: Requiere validación
updated: 2026-10-10
tags: [decisiones, adr, indice]
---

# Decisiones arquitectónicas

Un ADR registra **una decisión, su contexto y sus consecuencias**. Aquí solo hay ADR con
evidencia en el código, la configuración o los documentos de diseño del repositorio. Cuando
la decisión existe pero su *motivo* no está registrado en ninguna parte, el ADR lo dice
explícitamente. La numeración arranca en 0020 —los anteriores pertenecen a otro producto,
con su propio vault—. Los de aquí están inferidos del código y los `CLAUDE.md` del repo:
Orbix ERP no tenía ADR formales propios antes de este vault.

| # | Decisión | Estado |
|---|---|---|
| [[ADR-0020 Multi-tenancy por columna tenantId y ALS (Orbix)\|0020]] | Multi-tenancy por columna `tenantId` + AsyncLocalStorage | Aceptada |
| [[ADR-0021 Autenticacion en dos pasos (Orbix)\|0021]] | Autenticación en dos pasos: login → tenant → sucursal | Aceptada |
| [[ADR-0022 Zustand en lugar de Redux (Orbix)\|0022]] | Zustand como estado global del Web, no Redux | Aceptada |
| [[ADR-0023 Modelo unificado de Order para retail y restaurante (Orbix)\|0023]] | `Order` unificado para retail y restaurante | Aceptada |
| [[ADR-0031 Alta de usuario solo por invitacion aceptada (Orbix)\|0031]] | Alta de usuario solo por invitación aceptada, nunca por contraseña fijada por un tercero | Aceptada |
| [[ADR-0032 Envio de invitaciones por Gmail API en lugar de SMTP (Orbix)\|0032]] | Envío de invitaciones por Gmail API (OAuth2, scope `gmail.send`) en lugar de SMTP con contraseña de aplicación | Aceptada |
| [[ADR-0033 Fin de prueba del alta en la validacion de licencia (Orbix)\|0033]] | La prueba PRO del alta self-service termina en la validación de la licencia (baja a FREE), sin job | Aceptada |

## Orbix ERP — Plataforma de IA (Fase 0)

A diferencia del resto del índice, estos ADR **preceden a la implementación**: no hay
evidencia en el código todavía. Su fuente es el documento de arquitectura *Orbix AI Platform*
(revisión 2, alcance reducido a AI Core + llama.cpp + Product Assistant), y su estado sigue en
**Propuesta** hasta que se firme el checklist de la Fase 0. Los identificadores `D-xx` que
citan son los del documento y se mantienen estables entre revisiones.

| # | Decisión | Estado |
|---|---|---|
| [[ADR-0024 Runtime de inferencia local llama.cpp (Orbix)\|0024]] | `llama-server` en producción, Ollama en desarrollo (D-05) | Propuesta |
| [[ADR-0025 Puerto AIProvider con un unico proveedor (Orbix)\|0025]] | Puerto `AIProvider` aunque la v1 tenga un solo proveedor (D-16) | Propuesta |
| [[ADR-0026 Binding de feature a modelo sin tabla de routing (Orbix)\|0026]] | Binding `feature → modelo` en configuración, sin routing (D-17, D-07) | Propuesta · temporal |
| [[ADR-0027 Sin fallback entre proveedores en la v1 (Orbix)\|0027]] | Sin fallback: error tipado y observable (D-18) | Propuesta · temporal |
| [[ADR-0028 Kill switch de gasto y segundo-tercer proveedor (Orbix)\|0028]] | Anthropic + Gemini (núcleo) y kill switch de gasto, en la misma entrega (D-19, D-20, D-21) | Aceptada — implementada |
| [[ADR-0029 Schemas de Postgres por dominio en lugar de bases separadas (Orbix)\|0029]] | Schemas de Postgres por dominio, no una base ni un microservicio por vertical | Propuesta |
| [[ADR-0030 Variante por defecto obligatoria como unidad vendible (Orbix)\|0030]] | `ProductVariant` obligatoria: unidad vendible y de stock, default promovible | Propuesta |

Las decisiones **diferidas** del mismo documento (routing multiproveedor, fallback, créditos
comerciales, BYOK, GPU, streaming, embeddings, Redis, Device AI) no tienen ADR: no están
decididas, están esperando el dato que las active. El segundo/tercer proveedor y el kill
switch de gasto dejaron de estar diferidos con ADR-0028.

## Decisiones que faltan por documentar

Existen en el sistema, pero **no se encontró evidencia del razonamiento original**. No se
inventan aquí:

- Motivo original de la multi-tenancy por columna vs esquema/BD por tenant (Orbix ERP) —
  ver notas de ADR-0020.
- Motivo original de elegir Zustand sobre Redux (Orbix ERP) — ver notas de ADR-0022.
- Estrategia de `apps/desktop` (Orbix): wrapper del Web vs. app nativa — sin código fuente
  visible en el repo para inferirla.
- Proveedor de storage para imágenes de producto en Orbix ERP.

## Plantilla

Usar `Templates/ADR (plantilla).md`.
