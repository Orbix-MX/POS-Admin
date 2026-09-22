---
title: Levantar entorno
type: guide
owner: Requiere validación
updated: 2026-08-06
tags: [guia, entorno]
---

# Levantar entorno

## Cuándo usar esta guía

Primera vez que trabajas en Orbix ERP, o después de un `git pull` grande que tocó
dependencias.

## Requisitos

- Node.js y pnpm instalados.
- Acceso al `.env` del proyecto — **nunca credenciales en este documento**.

## Pasos

### Orbix ERP (`orbix-admin`)

1. `pnpm install` en la raíz de `orbix-admin/`.
2. Configura `.env` de `api/` con la conexión a PostgreSQL (Neon o local) — no hay
   `docker-compose.yml` en este repo, la base de datos es externa.
3. `pnpm dev` — arranca `@orbix/api` y `@orbix/web` juntos (filtro en el script raíz).
   Alternativas: `pnpm dev:server` (solo API), `pnpm dev:web` (API + Web),
   `pnpm dev:mobile` (app Expo).
4. Verifica Swagger en `http://localhost:3001/api/docs`.

## Verificación

- `web` sirve en `http://localhost:5173` y puede hacer login contra la API local.

## Trampas conocidas

| Síntoma | Causa |
|---|---|
| Orbix ERP API no conecta a la BD | `.env` de `api/` apunta a una BD inexistente o inaccesible; no hay contenedor local por defecto |

## Si no funciona

`orbix-admin/README.md`, `orbix-admin/api/CLAUDE.md` y `orbix-admin/web/CLAUDE.md`.
