---
title: Caja y cortes (Orbix)
type: business
owner: Requiere validación
updated: 2026-09-12
tags: [dominio, caja, pos, orbix-erp]
---

# Caja y cortes (Orbix)

## La sesión cuelga de una caja física, no de la sucursal

`CashSession` se abre siempre sobre un `CashRegister` —la caja física— y el índice único
garantiza **una sesión viva por caja**, no por sucursal. Una sucursal con tres cajas puede
tener tres cajeros cobrando a la vez, cada uno en la suya.

Decidido el 2026-08-20, corrigiendo el comportamiento anterior: la resolución implícita de
caja tomaba *la primera activa* de la sucursal, así que todos los cajeros caían en la misma
y el segundo en abrir chocaba con el índice. En la práctica la sucursal operaba con una sola
caja por mucho que tuviera varias dadas de alta.

- Sin `cashRegisterId` explícito se toma la primera caja **libre**. Si no hay ninguna libre
  se pide cerrar una o dar de alta otra; solo la sucursal sin cajas recibe una `Caja 1`
  creada al vuelo, para no exigir un alta manual antes de la primera venta.
- **La caja pertenece al puesto, no a la persona.** Un relevo de turno entra en la misma
  terminal y continúa la sesión abierta por el turno anterior, sin cerrar ni volver a abrir.
  Quién entrega y quién recibe queda en `openedBy` / `closedBy`, que pueden ser distintos.
- `GET /cash-sessions/active` resuelve por `cashRegisterId` —que cada terminal recuerda: el
  POS web en `localStorage`, la app móvil en MMKV—. Sin caja indicada: si hay una sola sesión viva en la sucursal
  la devuelve (instalación de caja única); si hay varias, devuelve la que abrió el propio
  usuario y, si no abrió ninguna, ninguna. Antes devolvía cualquier sesión viva de la
  sucursal, y con varias abiertas los cobros del segundo cajero entraban en el cajón del
  primero.

## Cuántas cajas pueden operar a la vez

El tope es de **sesiones simultáneas por sucursal**, no de cajas dadas de alta: una sucursal
puede tener seis cajas registradas y operar solo dos. Dar de alta una caja de reserva no
consume nada hasta que alguien la abre.

Sale del plan (`PLAN_CASH_SESSION_LIMITS` en `@orbix/types`: **FREE 2**, STARTER 2, PRO 5,
PLUS 15, ENTERPRISE sin tope) y admite override absoluto por tenant en
`Tenant.cashSessionLimitOverride`, editable desde el panel platform. A diferencia de
`extraBranchLimit`, el override **no** se suma al plan: lo sustituye.

**Dos ya en el plan gratis, a propósito.** El tope de FREE fue 1 en su día y se subió a 2: un
mostrador con dos terminales es el caso normal de una tienda, no un extra vendible, y dejarlo en
uno convertía el límite en un muro para el uso corriente en vez de en una palanca comercial.

> Corregido el 2026-09-12: este documento decía «FREE 1» y el código dice 2 desde antes. El dato
> viejo se propagó a una auditoría del móvil antes de detectarse. Contrastar contra
> `packages/types/src/index.ts` antes de citar cifras de plan.

Endpoints: `GET /cash-sessions/registers` (cajas con su sesión viva),
`GET /cash-sessions/registers/capacity`, `POST /cash-sessions/registers`,
`PATCH /cash-sessions/registers/:id`. Una caja con sesión abierta no se puede desactivar.

## Con la caja congelada se cuenta, no se mueve dinero

`EN_ARQUEO` existe para que el efectivo no cambie mientras alguien lo cuenta. De ahí que las
operaciones se partan en dos grupos:

- **Arquear** (`POST /cash-sessions/active/count`) acepta `ABIERTA` **y** `EN_ARQUEO`. Los dos son
  legítimos: el arqueo de control se hace sin parar la venta, y el formal con la caja congelada.
- **Mover dinero** —venta, ingreso, gasto, retiro— exige `ABIERTA`. Un movimiento durante el
  recuento invalidaría el propio recuento.

Cerrar también admite `EN_ARQUEO`: el corte es la salida natural de un arqueo final.

> Esta separación no existía hasta el 2026-09-12. Contar resolvía la sesión con
> `requireOpenSession`, que exige `ABIERTA`, así que **congelar la caja bloqueaba el conteo para el
> que se había congelado**: el cajero tecleaba lo contado y leía «no hay sesión de caja activa».
> Hoy lo resuelve `requireCountableSession`.

## Autorización por PIN de supervisor

Arqueo (`pos.cash:count`) y corte (`pos.cash:close`) son operaciones respaldadas: si el
usuario de la sesión **ya tiene el permiso**, la operación va a su nombre y no se pide nada.
Si no lo tiene, la terminal pide el **PIN de un empleado cuyo rol sí lo tenga** — el
supervisor se acerca a la caja y teclea su PIN, sin que el cajero conozca contraseña alguna
ni tenga que cerrar sesión en la terminal. Decidido el 2026-08-20.

- El autorizador es un **`Employee`, no un `User`**: un supervisor de piso con PIN no
  necesita cuenta del sistema. Sus permisos salen de `Employee.roleId` contra la misma
  tabla RBAC que usan los usuarios.
- El PIN se compara por **hash determinista** (`sha256(tenantId:pin:pepper)`,
  `STAFF_PIN_PEPPER`) — el mismo esquema que el login por PIN de la comandera, así que
  nunca viaja ni se guarda en claro. Determinista y no bcrypt porque hace falta buscar
  por hash y garantizar unicidad: `@@unique([tenantId, pinHash])`.
- **PIN inexistente y PIN sin permiso devuelven el mismo error** (`AUTHORIZATION_INVALID`).
  Distinguirlos permitiría sondear qué PINes existen probando en la terminal. Sin PIN y sin
  permiso propio: `AUTHORIZATION_REQUIRED`.
- Solo cuentan empleados `ACTIVE`. `SUPER_ADMIN` se salta el RBAC aquí igual que en el
  resto del API.

Quién autorizó queda en `CashSession.authorizedByEmployeeId`, separado de `authorizedById`
(el `User` que autoriza con contraseña desde el Admin Web). **Autorizar el corte no exime
de la revisión por descuadre**: `pos.cash:close` deja cerrar, pero firmar una diferencia
sigue exigiendo `pos.cash:authorize` — son dos permisos distintos y el PIN de corte no
sustituye al segundo.

El cuerpo de estas transiciones lleva `authorizerPin` opcional (`AuthorizePinDto`, 4-12
caracteres); desde el Admin Web viaja vacío.

Relacionado: [[Ventas y Punto de Venta (Orbix)]], [[Cuentas por Cobrar y Pagar (Orbix)]],
[[Glosario]].
