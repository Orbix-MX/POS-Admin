---
odd: acceso-residual-tras-baja
updated: 2026-10-12
status: done
via_max: completo
entrega: preguntar
lineas_previstas: 350
---

# Cortar el acceso de quien se desactiva o se da de baja

**Objetivo.** Un miembro desactivado, dado de baja o removido de una empresa, y un empleado de PIN
dado de baja, pierden el acceso **en su siguiente petición**, no cuando expire su token (hasta 24 h
el de usuario, 12 h el de operador).

**Por qué.** Hallazgo 1 de `docs/audits/AUDITORIA-AUTENTICACION-AUTORIZACION-2026-10-12.md`,
**verificado en ejecución**: tras `PATCH /users/:id/deactivate` y `DELETE /users/:id` el token anterior
seguía dando `GET /products` → 200; el refrescado sí daba 403. `updateStatus` y `remove` invalidan la
caché de permisos y prometen "acceso fuera de inmediato", pero `EffectivePermissionsService.compute`
y `JwtStrategy.validate` ignoran `TenantMembership.status`.

**Alcance.** Estrategia JWT de usuario (T-001), tokens de operador (T-002) y la reacción del web
(T-003). Fuera: acortar la vida del token y los claims viejos; la app móvil, que lleva su propio ODD
en `orbix-mobile` (ver Orden de despliegue).

**Restricciones.** C-005/C-007 (autorización → `completo`); C-009 (la caché de permisos es de 60 s
**por instancia**, por eso la comprobación va contra la base); C-019 (contrato nuevo: clientes
primero); C-021 (verificar con la app arrancada).

**Decisiones de diseño.**
- **Sin consultas nuevas por petición:** la estrategia ya hace `user` y `tenant` en cada petición; la
  comprobación de membresía **sustituye** la de `tenant` por una sola consulta `tenantMembership` con
  su `tenant`.
- **403 con `code`, no 401, para usuarios:** un 401 hace que los clientes refresquen y reciban un
  token **sin tenant** (`buildAccessTokenForUser`), con errores en cascada. Sigue el patrón de
  `TENANT_SUSPENDED`. Para operadores sí es 401: el web ya expira solo la sesión de operador ante 401
  (`web/src/lib/api-client.ts` l.40-47, verificado).

---

## Tareas

### T-001 · La estrategia JWT exige membresía ACTIVE en cada petición

```
via:     completo
touches: core/auth (jwt.strategy.ts), core/tenants (removeMember)
status:  done
ruta:    inline
```

Con `tenantId` en el token, `validate` consulta `tenantMembership.findUnique({ where: { tenantId_userId
}, select: { status, tenant: { select: { status } } } })`. Sin fila o `status ≠ ACTIVE` → **403**
`{ code: 'MEMBERSHIP_INACTIVE' }`; empresa no ACTIVE/TRIAL → `TENANT_SUSPENDED` como hoy. La fuente es
la base: efecto inmediato en todas las instancias, y cubre los handlers `@NoPermissionsRequired` (las
rutas de caja), que la caché de permisos nunca protegió. `TenantsService.removeMember`, que hoy no
invalida nada, invalida la caché del usuario.

**Done cuando:** el token anterior de un miembro desactivado, dado de baja o removido responde 403
`MEMBERSHIP_INACTIVE`; el de uno activo sigue en 200; y la petición hace las mismas consultas que antes.

**Evidencia.**
- **Test:** `jwt.strategy.spec.ts`: ACTIVE y TRIAL pasan; INACTIVE, SUSPENDED, INVITED y sin fila → 403 `MEMBERSHIP_INACTIVE`; empresa suspendida → `TENANT_SUSPENDED`; sin `tenantId` no consulta; `tenant.findUnique` ya no se llama. Suite completa: **103 suites / 838 tests en verde** (línea base 102/816).
- **Runtime (C-021):** API arrancada con el código nuevo. `member-revoke.cjs` (escenario de la auditoría): desactivar y dar de baja → antes 200, **después 403**, y el token refrescado sigue en 403 (resultado `OK`). `revoke-verify.cjs` (`removeMember`): 200 → **403 `MEMBERSHIP_INACTIVE`**, y el dueño conserva 200.
- **Desviación:** el e2e de Jest `membership-revocation.e2e-spec.ts` previsto **no se escribió**; la evidencia de cableado son los dos scripts de ejecución. Pendiente decidir si se versiona alguno como e2e.
- **Rollback:** revertir `jwt.strategy.ts`, la invalidación de `removeMember` y los specs. Sin migración.
- **Commit:** `dd31ee9`

### T-002 · Los tokens de operador mueren con el empleado

```
via:     completo
touches: core/auth (jwt.strategy.ts), core/staff, core/employees
status:  done
ruta:    inline
```

Hoy el operador sale del payload sin tocar la base: `EmployeesService.remove` solo pone `INACTIVE` y el
token (12 h, sin `jti`, permisos incrustados) sigue operando; tampoco se mira si la empresa se
suspendió. `validate` comprobará empleado (`id = sub`, `tenantId`, ACTIVE) y empresa, con **caché de
30 s** por empleado —el POS dispara una petición por venta— que `EmployeesService.remove` y el cambio de
estado invalidan. Falla con **401** `OPERATOR_INACTIVE`. Techo en otras instancias: 30 s, límite
aceptado.

**Done cuando:** tras dar de baja a un empleado su token responde 401 `OPERATOR_INACTIVE` (misma
instancia: inmediato; otras: ≤ 30 s); uno activo sigue operando; una venta no añade más de una consulta
por empleado cada 30 s.

**Evidencia.**
- **Test:** `pnpm run test -- jwt.strategy operator-session` → `49 passed` (4 suites, con employees y tenants). Estrategia: operador activo/inactivo/sin `tenantId`; servicio: estados y empresa suspendida, caché dentro del TTL, `invalidate` inmediato y vencimiento a los 30 s.
- **Runtime (C-021):** API arrancada, `scratchpad/revoke-verify.cjs`: operador activo `GET /products` → 200; `DELETE /employees/:id` → 200; **mismo token → 401 `OPERATOR_INACTIVE`**.
- **Rollback:** revertir la rama de operador de `validate`, `operator-session.service.ts` (+spec), su registro en `CommonModule` y las dos invalidaciones en `EmployeesService`.
- **Commit:** `dd31ee9`

### T-003 · El web y el POS web cierran la sesión ante `MEMBERSHIP_INACTIVE`

```
via:     simple
touches: web/src/lib/api-client.ts, store/auth-store.ts, App.tsx, pos-web AppProviders
status:  done
ruta:    —
```

Hoy el web solo reconoce `TENANT_SUSPENDED` en un 403; el resto pasa como error genérico. Con
`MEMBERSHIP_INACTIVE` borra los tokens y vuelve al inicio de sesión con el aviso "Tu acceso a esta
empresa fue desactivado". **Done cuando:** ese 403 cierra la sesión una vez, sin bucle.

**Evidencia.**
- **Test:** `npx playwright test e2e/membership-revoked.spec.ts` → `1 passed`. Cubre: aviso visible, botón de login, tokens borrados y cero peticiones tras cerrar (sin bucle).
- **Tipos:** `tsc -b` limpio en `web` y `apps/pos-web`. eslint: 0 errores nuevos (los 13 de `App.tsx` son preexistentes, idénticos sin mis cambios).
- **Rollback:** revertir `api-client.ts`, `auth-store.ts` (`endSession`/`anonymousState`), `App.tsx`, `AppProviders.tsx` y el e2e.
- **Commit:** `7868d6b`

---

## Progreso

| Tarea | Vía | Estado | Ruta | Líneas | Commit |
|---|---|---|---|---|---|
| T-001 | completo | done | inline | ~25 + tests | dd31ee9 |
| T-002 | completo | done | inline | ~85 + tests | dd31ee9 |
| T-003 | simple | done | inline | ~45 + e2e | 7868d6b |

**Entrega:** ~350 previstas · 0 acumuladas · umbral ~400 → **dentro, riesgo medio**: si T-002 crece, se
entrega aparte de T-001.

**Orden de despliegue (C-019):** clientes **primero** (reconocer un código que aún no llega es inocuo):
T-003 aquí y un ODD aparte en `orbix-mobile` (`ApiError` no expone el `code` del 403 ni cierra sesión).
Después T-001 y T-002. Si el servidor sale antes, los clientes viejos ven un 403 genérico: no se rompe
nada, pero la sesión no se cierra sola.

**Decisión:** T-002 entró con T-001 (acordado). **Siguiente paso:** desplegar web y POS web, luego el servidor; abrir el ODD de `orbix-mobile`.

---

## Escaladas

| Tarea | De         | A        | Trigger                                                    |
| ----- | ---------- | -------- | ---------------------------------------------------------- |
| T-001 | (asignada) | completo | Ruta `api/src/modules/core/auth/**`; símbolo `JwtStrategy` |
| T-002 | (asignada) | completo | Ruta `api/src/modules/core/auth/**`; símbolo `JwtStrategy` |

## Hallazgos fuera de alcance

| Hallazgo | Dónde | Gravedad aparente |
|---|---|---|
| Token de acceso de 1 día y claims `plan`/`enabledModules` viejos: T-001 deja de depender de ello, pero siguen afectando a los guards de módulo y plan | `jwt.config.ts`, `require-module.guard.ts` | Baja |
| `removeMember` deja huérfanas las asignaciones de rol; si se vuelve a añadir (`addMember`, que tampoco invalida) recupera los roles de antes | `tenants.service.ts` l.382, l.400 | Media |
| La caché de permisos es por instancia: un cambio de rol tarda hasta 60 s en otras réplicas (C-009) | `permission-cache.store.ts` | Baja |
| `apps/mobile/orbix-app` y `orbix-mobile(deprecated)` no se revisaron | `apps/mobile/*` | Por determinar |

## Revisión

**Candidato:** árbol sin commitear (los archivos nuevos son untracked, así que `git stash create` no los
captura); al commitear, el candidato pasa a ser el rango del commit.

| Comprobación | Resultado |
|---|---|
| Escalada contra `force-completo.md` | Sin cambio: T-001 y T-002 ya eran `completo` (ruta `core/auth/**`, `JwtStrategy`) |
| Tipos (`tsc`) api, web, pos-web | Limpios |
| Lint de lo tocado | 0 errores nuevos. Preexistentes: 13 en `App.tsx`, 1 warning `MAX_BRANDING_SIZE` en `tenants.service.ts` |
| Suite API completa | 105 suites / 843 tests en verde (base 102/816) |
| Tabla con la app arrancada (C-021) | 7/7 en `revoke-verify.cjs` y `member-revoke.cjs` en OK (ver T-001/T-002) |
| `/security-review` | Ledger vacío: sin hallazgos (revisión inline, sin subagentes) |
| 4R en paralelo (candidato: árbol vivo) | Corrida; ledger abajo. Refutación no necesaria: el único CRITICAL se verificó con `grep` y se corrigió |
| Absorción al vault | `Architecture/Autenticacion.md`: regla de baja inmediata y códigos nuevos; marcado "Requiere validación" para la app móvil |

**Ledger 4R**

| id | lente | ubicación | severidad | estado | evidencia |
|---|---|---|---|---|---|
| R1 | riesgo | — | — | ledger vacío | sin hallazgos |
| R4 | resiliencia | — | — | ledger vacío | sin hallazgos |
| R2-001 | legibilidad | `operator-session.service.ts:4` | WARNING | info | cuarta copia de `ALLOWED_TENANT_STATUSES` (también en `auth.service.ts` ×2 y `jwt.strategy.ts`); deuda previa, no divergente |
| R3-001 | fiabilidad | `employees.service.ts` (`update`/`remove`) | CRITICAL | **verified** | ningún test afirmaba la invalidación (grep). Corregido: `employees.operator-session.spec.ts` (3 tests) |
| R3-002 | fiabilidad | `tenants.service.ts` (`removeMember`) | WARNING | **fixed** | sin test de la invalidación. Corregido: `tenants.service.remove-member.spec.ts` (2 tests) |
| R3-003 | fiabilidad | `membership-revoked.spec.ts` | WARNING | wont-fix | el e2e solo ejercita el listener del web, no el de pos-web (mismo patrón que `tenant:suspended`); la ausencia de bucle usa espera fija |

**Cerrado** con commits `7868d6b` (web) y `dd31ee9` (servidor). Pendiente fuera de este ODD: despliegue en ese orden. Dependencia externa: ODD de `orbix-mobile`. Fuera de este ODD: unificar `ALLOWED_TENANT_STATUSES` (R2-001).
