# force_completo — triggers de escalada

Si el diff de una tarea toca cualquiera de estos, la tarea **es** `completo`. No es un
criterio a interpretar: es una coincidencia de patrón que se comprueba con
`git diff --name-only` y `grep` antes de cerrar.

Una tarea marcada `simple` o `directo` que toque esta lista **se detiene y se reclasifica**.
No se termina en la vía baja.

Aplica igual en ODD y en SDD. Escala la **vía**, no el workflow: una tarea ODD que toque
esta lista sube a `completo` dentro de ODD; no se convierte en spec.

Este archivo existe aparte de `constitution.md` porque se consulta en caliente, en cada
asignación y en cada cierre de tarea. Cargar las 170 líneas de la constitución para
comprobar una lista de rutas es desperdicio.

---

## Rutas

```
api/prisma/migrations/**
api/prisma/schema.prisma
api/src/common/guards/**
api/src/common/decorators/**
api/src/common/context/**
api/src/modules/core/auth/**
api/src/modules/core/permissions/**
api/src/modules/core/roles/**
api/src/modules/core/employees/**
api/src/modules/core/cash-sessions/**
api/src/modules/core/payables/**
api/src/modules/core/receivables/**
api/src/modules/platform/**
api/src/main.ts
```

## Símbolos

```
requireTenantId        TenantContextService     AuditContextService
@UseGuards             @RequirePermissions      @Public
@NoPermissionsRequired @Roles                   ALL_PERMISSIONS
isPosOnlyUser          SUPER_ADMIN
JwtStrategy            PermissionsGuard         JwtAuthGuard
```

## Dominios

Cualquier tarea cuyo efecto recaiga sobre **dinero, existencias, impuestos o cantidades**
—aunque el archivo no esté en la lista de rutas— es `completo`. Incluye precio, costo,
stock, descuento, propina, corte de caja y cuenta por cobrar o pagar.

## Concurrencia

Cualquier tarea con escritura concurrente sobre la misma fila, o que dependa de una
transacción para ser correcta, es `completo`.

---

## Comprobación

```bash
git diff --name-only     # contra Rutas
git diff                 # contra Símbolos
```

Una coincidencia:

1. **Detén la tarea.** No la termines.
2. Cambia su `via` a `completo` y su `status` a `escalated`.
3. Regístrala en la tabla de Escaladas de su `tasks.md` o de su documento ODD, con el
   trigger que coincidió.
4. Repórtalo y espera.

Esto no es un juicio sobre si el cambio "realmente" es riesgoso. Es una coincidencia de
patrón, y no se confía al criterio del agente: el que lleva veinte minutos dentro de una
tarea tiene todo el incentivo de declararla acotada para cerrarla.

Constitución completa en `.specify/constitution.md`. Vías y sus pasos en `.specify/vias.md`.
