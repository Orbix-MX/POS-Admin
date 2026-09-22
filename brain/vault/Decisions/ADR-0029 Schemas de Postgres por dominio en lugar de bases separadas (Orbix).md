---
title: ADR-0029 Schemas de Postgres por dominio en lugar de bases separadas (Orbix)
type: adr
owner: Requiere validación
updated: 2026-08-17
tags: [adr, orbix-erp, datos, arquitectura]
---

# ADR-0029 — Schemas de Postgres por dominio en lugar de una base por vertical (Orbix ERP)

**Estado:** Propuesta
**Ámbito:** Orbix ERP · `api/prisma`, `api/src/database`, todos los módulos · **Fecha:** 2026-08-17

## Contexto

Mezclar los 80 modelos de todas las verticales en un único `schema.prisma` de 2 481 líneas, sin fronteras internas, se está volviendo difícil de mantener. Se planteó separar la base de datos por vertical de negocio (retail / POS / gym / restaurante), con microservicios o con un monolito de múltiples bases.

El análisis de [[Separacion de datos por vertical (Orbix)]] midió el acoplamiento real:
de las 76 relaciones que cruzan dominios, 62 (82 %) apuntan al núcleo transversal
(`Tenant`, `Branch`, `User`, `Customer`); solo 5 de los 80 modelos son exclusivos de una
vertical; y 91 `$transaction` atraviesan esas fronteras (una venta es atómica sobre venta +
pago + caja + inventario + cuenta por cobrar). La vertical `gym` aún no existe en código.

## Decisión

**No separar bases de datos por vertical ni extraer microservicios.** Mantener una base y un
monolito modular, y obtener el orden buscado mediante:

1. Aislamiento de tenant forzado por infraestructura (`$extends` de Prisma 7 y/o RLS), en lugar de filtrado manual por convención.
2. Fronteras de código entre módulos verificadas por un test de arquitectura: cada módulo escribe solo en las tablas de su dominio.
3. `schema.prisma` partido en varios archivos bajo `prisma/schema/`, uno por dominio.
4. **Schemas de PostgreSQL por dominio** (`core`, `catalog`, `sales`, `cash`, `purchasing`,
   `restaurant`, `services`, `platform`) vía `schemas` en el datasource + `@@schema` por
   modelo — GA en Prisma desde 6.13; el proyecto está en 7.8.

Los dominios se definen por **eje de datos**, no por vertical comercial: `users`, `roles`,
`permissions`, `employees` y `customers` son `core`; `products` y `supplies` son `catalog`;
`orders` y `quotes` son `sales` (un solo `Order`, ver
[[ADR-0023 Modelo unificado de Order para retail y restaurante (Orbix)]]).

Separación física reservada para lo que ya está desacoplado: `platform` (0 FK hacia el
resto), telemetría de IA y auditoría.

## Consecuencias

**Positivas**
- Modelo de datos navegable y con permisos de base diferenciables por schema, sin perder
  FK cruzadas, joins ni transacciones atómicas.
- No se duplica el flujo de venta por vertical; `Order` sigue siendo único.
- Migración mecánica y reversible (`ALTER TABLE ... SET SCHEMA`); no hay reescritura de
  servicios ni sagas.
- La frontera queda dibujada donde algún día se podría cortar de verdad.

**Negativas**
- El orden depende de disciplina de equipo y de un test de arquitectura, no de una barrera
  física: un módulo con acceso al `PrismaClient` sigue pudiendo escribir donde no le toca.
- Sigue habiendo un único punto de fallo y un único perfil de escalado para todas las
  verticales.
- El paso a schemas toca todas las migraciones futuras y exige coordinar un despliegue.

## Criterios de reevaluación

Reabrir esta decisión si aparece alguno: más de un equipo con ciclos de release
independientes; un contrato que exija aislamiento físico de datos por tenant o vertical;
un perfil de carga que no se resuelva con réplicas de lectura e índices.

## Relacionados

- [[Separacion de datos por vertical (Orbix)]] — análisis y evidencia
- [[ADR-0023 Modelo unificado de Order para retail y restaurante (Orbix)]]
- [[Administracion Multi-tenant (Orbix)]] · [[Arquitectura general]]
