---
id: XXX-000                  # prefijo de dominio + correlativo. INV, AUTH, POS, CAJA...
name:
status: draft                # draft → approved → implemented → superseded
version: 1.0
vertical:                    # core | retail | restaurant | platform
module:                      # carpeta bajo el vertical. p.ej. inventory, auth, orders
priority:                    # high | medium | low
branch:                      # feat/XXX-000-slug
parent:                      # ADR o documento del vault que lo origina. vacío si nace aquí
depends_on: []               # ids de specs que deben estar ESTABLES EN PRODUCCIÓN antes
migration: none              # none | expand | contract-destructive
reversible: true
---

# <Nombre>

<!--
Un spec = una unidad desplegable. Si el alcance tiene fases que se despliegan por
separado, son specs distintos enlazados por depends_on.

NO hay spec cuando no hay comportamiento nuevo observable, regla de negocio ni cambio
de contrato. Un lote de correcciones es un tasks.md colgando del ADR padre.
-->

## 1. Objetivo

<Qué habilita, en dos o tres líneas. Si implementa una regla de un ADR, cítala
(`ADR-0030 R2`) en lugar de reescribirla.>

## 0. Alternativas descartadas

<!-- Obligatoria si depends_on no está vacío, o si el camino obvio es el equivocado. -->

**<El enfoque que parece natural>.** <Por qué se rechazó, con la traza concreta de qué
rompe. Es el apartado que impide que alguien reordene el trabajo por tamaño aparente.>

## 2. Alcance

### Dentro
-

### Fuera
-

## 3. Actores

-

## 4. Requisitos funcionales

### FR-001
El sistema MUST <comportamiento observable>.

## 5. Reglas de negocio

<!--
Solo las que este spec ORIGINA. Una regla que ya vive en el vault se cita, no se copia:
dos fuentes de la misma regla se desincronizan (C-023).
-->

### BR-001
<Regla. Si es expresable en base como CHECK o índice único, dilo aquí; si no se puede,
di por qué y cómo se cubre — C-016.>

## 6. Criterios de aceptación

<!--
`Covers:` no es decorativo: es el eslabón que hace grepeable la cadena. Sin él, que
FR-003 y AC-003 compartan número es coincidencia, no trazabilidad.
-->

### AC-001 · Covers: FR-001
Dado <estado inicial>
Cuando <acción>
Entonces <resultado verificable>

### AC-00N · Covers: BR-00N
Dado un recurso de otro tenant
Cuando se intenta la operación
Entonces se rechaza.

<!-- El AC de aislamiento multi-tenant es obligatorio en todo spec que toque datos. -->

## 7. Contrato

```
MÉTODO /ruta
```

```ts
{
  // request
}
```

`tenantId` nunca viaja en el body. Se resuelve desde `TenantContextService` (C-001).

<Si no hay endpoint nuevo, di qué comportamiento existente cambia y en qué handler.>

## 8. Persistencia

Entidades afectadas:
-

Restricciones en base:
-

## 9. Tests

### Nuevos
| Archivo | Covers |
|---|---|
| `<archivo>.spec.ts` | AC-001, FR-001 |

### Cambian de significado
<!-- Un test existente que pasa a afirmar lo contrario es señal de riesgo, no rutina. -->
| Archivo | Por qué |
|---|---|
| `<archivo>.spec.ts:NN` | <qué afirmaba antes y por qué deja de ser cierto> |

### Se conservan como red de seguridad
-

## 10. Riesgos

-

## 11. Preguntas abiertas

<!-- `status: approved` exige que esto diga "Ninguna". -->

## 12. Aprobación

Aprobado por: · <YYYY-MM-DD>

## 13. Changelog

- 1.0 (<YYYY-MM-DD>) — versión inicial
