---
title: Deploy
type: guide
owner: Requiere validación
updated: 2026-08-06
tags: [guia, deploy]
---

# Deploy

## Cuándo usar esta guía

Vas a desplegar un cambio de Orbix ERP a un ambiente compartido.

## Requisitos

- CI en verde.
- **Requiere validación** el pipeline exacto de despliegue de Orbix ERP — no se encontró
  documentación de CI/CD para `orbix-admin` en el análisis inicial.

## Pasos

### Orbix ERP

- **Requiere validación** por completo: no se encontró Dockerfile, pipeline de CI ni
  documentación de despliegue para `orbix-admin` en la exploración inicial del repositorio.
  Antes de asumir un proceso, confirmar con quien mantiene el ambiente de producción.

## Verificación

- **Requiere validación** el criterio de verificación post-deploy.

## Trampas conocidas

- Un package nuevo mal declarado en el grafo de dependencias de Turbo puede quedar fuera
  del build silenciosamente.

## Si no funciona

Este documento no tiene todavía una fuente que consultar — **requiere validación**
completarlo cuando se confirme el proceso real de despliegue.
