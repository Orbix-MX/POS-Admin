---
title: Mensajeria y Eventos
type: architecture
owner: Requiere validación
updated: 2026-08-06
tags: [arquitectura, eventos]
---

# Mensajería y eventos

No existe mensajería entre servicios: Orbix ERP es un único backend, sin arquitectura de
microservicios.

No se detectó ningún sistema de eventos de dominio ni mensajería — la lógica reactiva a
cambios (por ejemplo, generar una `AccountPayable` al recibir una compra) ocurre inline en
los servicios, no vía eventos publicados. **Requiere validación** si esto es exacto o si
existe algún mecanismo no cubierto en el análisis inicial.
