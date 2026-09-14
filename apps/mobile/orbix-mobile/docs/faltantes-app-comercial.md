# Orbix Mobile — Faltantes para app comercial

Lista de lo que no existe hoy y hace falta para que la app sea un producto comercial.
Sin valoraciones ni comparativas: solo el pendiente.

**Fecha:** 2026-09-11 · **Actualizado:** 2026-09-12 · **Estado del proyecto:** pre-beta
**Análisis completo:** [`auditoria-comercial.md`](auditoria-comercial.md)

Convención de las tablas:

- ☐ pendiente · ◧ parcial · ☑ hecho
- **Existe en API** — si el endpoint ya está y solo falta cablearlo desde el móvil.
- **Complejidad** — baja / media / alta, solo del lado móvil salvo que se indique.

---

## 0. Qué se entregó (2026-09-12)

El **bloque 1, ciclo del día**, está implementado — ver
[`plan-ciclo-de-dia.md`](plan-ciclo-de-dia.md) para el detalle y la verificación por fase.

Un negocio ya puede **abrir caja, vender, registrar gastos y retiros, arquear, cortar el turno,
consultar y deshacer sus ventas, y ajustar existencias**. Inicio responde «cuánto vendí hoy» en
vez de mostrar acumulados históricos.

Cuatro commits en `orbix-admin@dev`: `a16231c` (docs), `a1533f2` (fix del arqueo con la caja
congelada), `951a30f` (filtros de fecha y sucursal en `GET /orders`), `07ec7f7` (el ciclo en el
móvil).

**Lo que sigue sin estar, y conviene no confundir con lo anterior:**

- El **importe** vendido por semana o mes. Solo el de hoy, porque sale del `summary` de la caja.
  Los de periodo necesitan `/reports`, que es de plan PRO — decisión pendiente, ver abajo.
- El **selector de caja física**. El dispositivo recuerda su caja y la manda al abrir, pero no
  hay pantalla para elegirla: los hooks existen y ninguna vista los usa.
- Todo el **bloque 3 (venta completa)**: cliente, descuento, variantes vendibles, crédito, pago
  mixto. Los DTO del móvil ya los declaran; falta la UI del POS.
- La **paginación de productos y clientes**. Tickets e historial de caja sí pagina de verdad;
  las dos listas del techo de 100 siguen igual.

### Decisiones que este trabajo dejó sobre la mesa

| | Decisión | Por qué importa |
|---|---|---|
| ☐ | **¿`REPORTES` debe ser gratuito?** Hoy es tier PRO y el wizard crea todo tenant en FREE | Sin esto, «cuánto vendí esta semana» no tiene respuesta para el usuario que la app da de alta. No es un límite técnico |
| ☐ | Variante ligera de `GET /orders` sin `items.product` | Hoy se compensa con páginas de 20; hará falta con volumen |
| ☐ | Exponer `settings.cashDifferenceThreshold` | Permitiría avisar del descuadre *antes* de cortar. Sin él se pide el motivo siempre que haya diferencia |
| ☐ | Idempotencia en `cancel` / `return` / `refund` | Las tres mueven dinero e inventario |

---

## 1. Ciclo del día

Sin esto un negocio no puede operar una jornada completa.

**Implementado 2026-09-12**, salvo lo marcado. Detalle en [`plan-ciclo-de-dia.md`](plan-ciclo-de-dia.md).

| | Faltante | Existe en API | Complejidad |
|---|---|---|---|
| ☑ | **Cierre de caja / corte** | Sí — `PATCH /cash-sessions/:id/close` | Media |
| ☑ | **Arqueo** (conteo de efectivo, diferencias) | Sí — `PATCH /cash-sessions/:id/start-count`, `POST /cash-sessions/active/count` | Media |
| ☑ | **Autorización por PIN de supervisor** para corte y arqueo | Sí — `authorizerPin` en el DTO | Baja |
| ☑ | **Gastos** durante el turno | Sí — `POST /cash-sessions/active/movement` | Baja |
| ☑ | **Retiros de efectivo** | Sí — `POST /cash-sessions/active/withdraw` | Baja |
| ☑ | **Ingresos manuales** | Sí — `POST /cash-sessions/active/movement` | Baja |
| ◧ | **Binding de caja física al dispositivo** (no un selector al abrir) | Sí — `GET /cash-sessions/registers`, `/registers/capacity`, `POST /registers` | Media |
| ☑ | **Historial de ventas** | Sí — `GET /orders` | Media |
| ☑ | **Detalle del ticket** (líneas, pagos, cliente) | Sí — `GET /orders/:id` | Baja |
| ☑ | **Reenvío de comprobante** desde el historial | Sí — `POST /orders/:id/send-receipt` | Baja |
| ☑ | **Cancelación de venta** | Sí — `POST /orders/:id/cancel` | Baja |
| ☑ | **Devolución total y parcial** | Sí — `POST /orders/:id/return`, `/refund` | Media |
| ☑ | **Ajuste de existencias** con motivo | Sí — `PATCH /products/:id/stock` | Baja |
| ☑ | **Ajuste de existencias por variante** | Sí — `PATCH /products/:id/variants/:variantId/stock` | Baja |
| ◧ | **Ventas de hoy / semana / mes** en Inicio | Sí — `/reports` (PRO) | Media |
| ☐ | **Ganancia por periodo** | Sí — `GET /reports/profit/monthly` (PRO) | Baja |
| ◧ | **Gastos por periodo** | Sí — `GET /reports/expenses/monthly` (PRO) | Baja |
| ☐ | **Productos más vendidos** | Sí — `GET /reports/products/top` (PRO) | Baja |
| ☐ | **Alertas de stock bajo accionables** (hoy solo un contador) | Sí — `GET /products/low-stock` | Baja |

**Qué falta en lo marcado ◧:**

- **Caja física** — el dispositivo recuerda su `cashRegisterId` en MMKV y lo manda al abrir, pero
  no hay forma de fijarlo: se adquiere por carrera. Ver §1 bis.

  > **Corrección (2026-09-12):** una versión anterior de esta nota decía que el tenant FREE opera
  > una sola caja. Es falso — `PLAN_CASH_SESSION_LIMITS` da **FREE: 2**, y el comentario del
  > código explica por qué: *«un mostrador con dos terminales»* es el caso normal, no un extra de
  > pago. El dato de «FREE 1» viene del vault (`Domain/Caja y cortes (Orbix).md`), que está
  > desactualizado respecto al código. **La ambigüedad de dos cajas existe desde el plan gratis.**
- **Ventas y gastos por periodo** — los de **hoy** sí, desde el `summary` de la sesión de caja.
  Los de semana y mes solo muestran el **número** de ventas (`meta.total`), no el importe:
  sumarlo exigiría traer cientos de órdenes con sus productos embebidos, y el endpoint que lo
  calcula es de plan PRO. Es la decisión abierta de arriba.

---

## 1 bis. Custodia de la caja: qué dispositivo, qué persona ✅

Dos huecos que la primera revisión del ciclo del día dejó al descubierto. No son de
funcionalidad: son de **saber de quién es el dinero cuando no cuadra**.

**Implementado el 2026-09-12.** Queda pendiente solo lo marcado ◧ más abajo.

### 1 bis.1 · El dispositivo debe declarar su caja, no competir por ella

El modelo del dominio es correcto y hay que respetarlo: **la caja pertenece al puesto, no a la
persona**, y el dispositivo *es* el puesto. Con dos cajones hay dos dispositivos, y preguntar cuál
es en cada apertura sería fricción pura.

El problema es **cómo adquiere el dispositivo su identidad**. Hoy, sin `cashRegisterId`,
`resolveCashRegister` toma *la primera caja libre por orden alfabético*. De ahí tres fallos:

| | Fallo | Consecuencia |
|---|---|---|
| ☐ | El nombre se asigna por quién abre primero, no por dónde está el cajón | Lunes el mostrador es «Caja 1», martes lo es la farmacia. Los cortes quedan etiquetados al revés y los nombres dejan de significar nada |
| ☐ | Si el dispositivo pierde el binding, no alcanza su propia sesión | App reinstalada o **relevo de turno**: con 2 sesiones vivas, `GET /active` sin caja devuelve *«la que abrió este usuario»* → ninguna. El dispositivo dice «no hay caja abierta» con su cajón lleno, y al abrir una nueva agarra **la otra** |
| ☐ | Sin cajas libres, callejón sin salida | El servidor responde *«Todas las cajas están abiertas. Cierra una o da de alta otra»*, y no hay pantalla que liste cajas ni permita crear una |

**Forma correcta — no un selector al abrir:**

| | Tarea | Complejidad |
|---|---|---|
| ☑ | **Configuración → Caja: «Caja de este dispositivo»**. Se fija una vez y se olvida. La categoría `cash` de Configuración pasó de `soon` a viva | Baja |
| ☑ | Auto-asignación silenciosa cuando no hay ambigüedad — la opción «La que esté libre» conserva el comportamiento anterior | Hecho |
| ☑ | Alta de caja física desde la app (`POST /cash-sessions/registers`), para el callejón sin salida | Baja |
| ☑ | Capacidad del plan visible: «2 de 2 cajas abiertas en esta sucursal» | Baja |
| ◧ | El selector aparece **también** cuando la apertura falla por no quedar cajas libres | Baja |

> **Lo que falta (◧):** hoy la apertura sigue mostrando el error del servidor —*«Todas las cajas
> están abiertas»*— sin ofrecer el selector ahí mismo. Se resuelve yendo a Configuración → Caja,
> así que ya no es un callejón sin salida, pero el atajo desde el error queda pendiente.

### 1 bis.2 · Quién movió qué, y quién estuvo en la caja

**Lo que ya existe** (verificado en `OrdersService.create` y `CashSessionsService`): cada peso que
se mueve tiene nombre. `Order.createdById`, `Payment.createdById`, `CashMovement.createdById`,
`InventoryMovement.userId`, `CashCount.countedById`, y en la sesión `openedById`, `closedById`,
`authorizedById`, `authorizedByEmployeeId`.

**Lo que falta:** la sesión solo nombra a **dos** personas — quien abrió y quien cerró. En un turno
largo con relevos, el operador de en medio no aparece en ninguna parte del corte. Sus ventas sí lo
dicen, una por una, pero reconstruirlo movimiento a movimiento es justo lo que nadie hará al
cuadrar un faltante.

Se cierra con **las dos piezas, no una**:

#### A · Resumen por usuario, derivado (sin migración)

`buildSummary` ya recorre todos los movimientos de la sesión; falta agruparlos por
`createdById`. Responde *«¿de quién es este faltante?»*, que es la pregunta del corte.

| | Tarea | Dónde | Complejidad |
|---|---|---|---|
| ☑ | Incluir `createdBy` en los movimientos que alimentan el summary | `MOVEMENTS_WITH_AUTHOR`, compartido por `getActive` y `findOne` | Baja |
| ☑ | `summary.byUser[]`: ventas, CxC, ingresos, gastos, retiros y devoluciones **por persona**, más `netCash` | `buildUserBreakdown` | Baja |
| ☑ | Pintarlo en Caja, en el corte y en el detalle de la sesión | `user-breakdown-card.tsx` | Baja |

**Dos decisiones que quedaron en el código:**

- **`netCash` ignora tarjeta y USD.** Es la cifra que se compara contra un descuadre, y lo que se
  cuenta al arquear son billetes: un cobro con tarjeta no deja ninguno que pueda faltar, y el USD
  se cuenta y descuadra por separado.
- **Los movimientos sin autor tienen cubo propio.** La FK es `SetNull`: dar de baja a una persona
  no borra que su dinero pasó por la caja.

> **Su límite, explícito:** solo ve a quien **movió dinero**. Alguien que entró, consultó y no
> vendió es invisible aquí. Por eso hace falta B.

#### B · Bitácora de entradas y salidas a la caja (entidad nueva)

Registra **presencia**, no actividad: quién estuvo delante del cajón abierto.

| | Tarea | Complejidad |
|---|---|---|
| ☑ | Modelo `CashSessionHandover` + migración `20260912120000_cash_session_handover` | Media (backend) |
| ☑ | `POST /cash-sessions/active/handover`, idempotente: reabrir la app no duplica el tramo | Baja |
| ☑ | Cierre del tramo anterior al entrar otro usuario | Baja |
| ☑ | Bitácora en Caja, en el corte y en el detalle de la sesión | Baja (móvil) |
| ☑ | `useHandoverTracking` lo dispara al ver una sesión viva, y **falla en silencio**: no poder anotar la bitácora no debe impedir cobrar | Baja |
| ◧ | Cierre del último tramo al cerrar la sesión | Baja |

> **Lo que falta (◧):** al cortar, el tramo abierto se queda sin `leftAt`. Se lee correctamente
> —«seguía dentro» hasta el final del turno— pero conviene cerrarlo con la hora del corte para que
> el tramo tenga duración.

> **Honestidad del diseño:** en un móvil la *salida* no es fiable — la app se mata, el teléfono se
> queda sin batería. Así que el tramo no se cierra «al salir»: se cierra **cuando entra otro** o
> **cuando se cierra la sesión**. Un tramo sin `leftAt` significa «seguía dentro», no «salió a las
> 19:03». Prometer una hora de salida exacta sería inventarla.

**Por qué las dos:** A responde *de quién es el faltante* (dinero). B responde *quién pudo tocar el
cajón* (custodia). Con solo A, el que entró y no vendió no existe; con solo B, hay presencia sin
importes.

> **El endpoint de bitácora va sin `@RequirePermissions`**, a propósito: exigir `cash:manage`
> dejaría fuera al cajero de relevo, que es justo a quien hay que registrar. Quien puede cobrar en
> la caja puede dejar constancia de que la tomó.

---

## 2. Puerta de entrada

Lo que impide que un usuario nuevo llegue a su primera venta.

> **Plan escrito:** [`plan-puerta-de-entrada.md`](plan-puerta-de-entrada.md) (2026-09-13), con los
> contratos verificados y seis fases. Dos correcciones que salieron de verificar:
>
> - **La importación es `.xlsx`, no CSV.** Este documento decía CSV. El endpoint valida contra
>   el MIME de Excel y la plantilla se genera con ExcelJS.
> - **El escáner no funciona solo con la cámara.** `ProductsService.findAll` busca en `name`,
>   `sku` y `description` — **no en `barcode`**, y el código vive en la variante por ADR-0030.
>   Hace falta `GET /products/resolve?code=`.

| | Faltante | Nota | Complejidad |
|---|---|---|---|
| ☑ | **Producto nuevo nace `ACTIVE`**, no `DRAFT` | Hecho (fase 0). El detalle avisa si quedó en borrador y ofrece publicarlo | Baja |
| ☑ | **Selector de estado en el paso 1** del wizard de alta, no en el 5 | Hecho (fase 0), con copy de negocio: «A la venta» / «Borrador — todavía no se vende» | Baja |
| ☑ | **Importación de productos** | Hecho (fase 3): pantalla de importación + CSV aceptado en el backend. Descarga la plantilla, se llena fuera del teléfono y vuelve por el selector de archivos | Media |
| ☑ | **Importación de clientes** | Hecho (fase 4): `GET/POST /customers/import*` nuevos, y la misma pantalla del móvil parametrizada por entidad. Clave natural: el correo | Backend + Media |
| ☑ | **Escáner de código de barras** en el POS | Hecho (fase 2): `GET /products/resolve?code=` + `expo-camera`. De paso, el carrito ganó `variantId` — sin él, escanear una presentación cobraba el precio de otra | Media + backend |
| ☑ | **Escáner en el alta de producto** | Hecho (fase 2): captura el código al campo, sin consultar el catálogo. Un código que el POS no encontró llega al alta ya puesto | Baja |
| ☑ | **Checklist inicial tras el wizard** | Hecho (fase 1): cuatro pasos derivados del estado real, filtrados por permiso, y el bloque desaparece al terminarlos | Media |
| ☑ | **Estados vacíos con acción** en Inicio, Productos y Clientes | Hecho (fase 1), más POS y Tickets. Distinguen «no hay nada todavía» de «la búsqueda no encontró» | Baja |
| ◧ | **Verificación de teléfono por OTP** | Endpoints hechos y probados (fase 5), con límites por intento, por usuario y por número. **Falta contratar el proveedor de SMS**: sin él el servidor responde 503 y el wizard deja continuar sin verificar | Backend |
| ☐ | **Catálogo remoto de tipos de negocio** | No existe en API: `GET /catalogs/business-types`. Hoy usa catálogo local | Backend |

---

## 3. Venta completa

El POS solo cubre el caso más simple.

> El ciclo del día dejó `CreateOrderRequest` con `customerId`, `variantId`, `discount`,
> `couponCode` y `notes` ya declarados, y el detalle del ticket ya los pinta cuando vienen.
> **Lo que falta es la UI del cobro**, no el contrato.

| | Faltante | Existe en API | Complejidad |
|---|---|---|---|
| ☐ | **Cliente en la venta** | Sí — `customerId`, ya declarado en el DTO del móvil | Baja |
| ☐ | **Descuento por línea** | Sí — `discount`, ya declarado en el DTO del móvil | Baja |
| ☐ | **Cupón** | Sí — `couponCode`, ya declarado en el DTO del móvil | Media |
| ☐ | **Variantes vendibles** (selector de presentación) | Sí — `variantId`, ya declarado en el DTO del móvil | Media |
| ☐ | **Venta a crédito** (método CRÉDITO) | Sí | Media |
| ☐ | **Pago mixto** (varios métodos en una venta) | Sí — `payments[]` acepta varios | Media |
| ☐ | **Cobro en USD** coherente con el tipo de cambio de la sesión | Sí — `currency` en el split de pago | Media |
| ☐ | **Notas en la venta** | NO VERIFICADO | Baja |
| ☐ | **Venta suspendida** y recuperación | NO VERIFICADO en API | Media |
| ☐ | **Carrito persistido** entre arranques | Hoy `useState` puro: cerrar la app pierde la venta | Baja |
| ☐ | **Cantidad limitada por stock disponible** | Hoy solo se bloquea agregar cuando ya está en cero | Baja |
| ☐ | **IVA por defecto del tenant en el preview** | Backend: exponer `tenant.settings.defaultTaxRate` | Backend |
| ☐ | **Comprobante por WhatsApp** | Share sheet del SO. El reenvío por correo ya existe, también desde el ticket | Baja |
| ☐ | **Comprobante en PDF** | — | Media |
| ☐ | **Impresión Bluetooth de ticket** | Parcial — `modules/core/printer-configs` | Alta |

---

## 4. Clientes y cobranza

| | Faltante | Existe en API | Complejidad |
|---|---|---|---|
| ☐ | **Saldo del cliente** | Sí — `modules/core/receivables` | Baja |
| ☐ | **Historial de compras del cliente** | Sí — `GET /orders?customerId=` | Baja |
| ☐ | **Abonos a cuenta** | Sí — `POST /receivables/:id/payments` | Media |
| ☐ | **Listado de cuentas por cobrar** | Sí — `GET /receivables`, `/receivables/stats` | Media |
| ☐ | **Aviso de vencimiento** de crédito | Sí — `creditDays` ya se configura | Baja |
| ☐ | **Liquidación de deuda** | Sí | Baja |

---

## 5. Contexto y escala

Lo que rompe cuando el negocio es real.

| | Faltante | Nota | Complejidad |
|---|---|---|---|
| ☐ | **Selector de sucursal** | `useBranches()` está definido y nadie lo llama. Con >1 sucursal el POS queda en skeleton indefinidamente | Baja |
| ☑ | **`branchId` en las claves de caché** | Hecho al centralizar `query-keys.ts` | Baja |
| ☐ | **Paginación en productos** | Hoy `limit: 100` sin paginar. Tickets e historial de caja ya usan `useInfiniteQuery`: el patrón está | Media |
| ☐ | **Paginación en clientes** | Idem | Media |
| ☐ | **Paginación / scroll infinito en el POS** | Idem | Media |
| ☐ | **Filtro de categoría en servidor** | Hoy filtra en cliente sobre la página cargada; los contadores de los chips son falsos | Baja |
| ☐ | **`FlashList` en las listas grandes** | Instalado, solo se usa en la lista de empresas | Baja |
| ☐ | **Gestión de usuarios / invitaciones** | Existe: `modules/core/users`, `invitations`, `employees`, `roles` | Media |
| ☐ | **Asignación de roles desde la app** | Existe: `modules/core/roles` | Media |
| ◧ | **PIN de empleado** (supervisor / login de terminal) | El PIN **se consume** ya para autorizar arqueo y corte; falta darlo de alta desde la app y el login por PIN en terminal | Media |
| ☐ | **Estado del plan y límites en la UX** | `maxUsers`/`overUserLimit` llegan en `/auth/me/capabilities` y el modelo los descarta | Media |
| ☐ | **Ruta de upgrade** al topar un límite | — | Media |
| ☐ | **Moneda del tenant sin depender de `tenant:view`** | Backend: añadir `currency` a `SelectTenantResponseDto`. Hoy un usuario POS ve MXN siempre | Backend |
| ☐ | **Moneda editable** en Configuración | — | Baja |
| ☐ | **Configuración de impuestos** | Categoría `taxes` marcada `soon` | Media |
| ☐ | **Datos fiscales del negocio** | — | Media |

---

## 6. Requisitos de publicación

Condición para poder subir a las tiendas, no mejora.

### Ambas plataformas

| | Faltante | Complejidad |
|---|---|---|
| ☐ | **Eliminación de cuenta desde la app** | Baja (móvil) + backend |
| ☐ | **Política de privacidad** accesible desde la app | Baja + redacción legal |
| ☐ | **Términos y condiciones** + aceptación en el alta | Baja + redacción legal |
| ☐ | **Contacto de soporte** visible | Baja |
| ☐ | **Versión de la app visible** (categoría «Acerca de», hoy `soon`) | Baja |
| ☐ | **Declaración de recopilación de datos** (App Privacy / Data Safety) | Baja |
| ☐ | **Capturas de pantalla, descripción, categoría** | Baja |
| ☐ | **Cuenta de demostración para el revisor** (la app exige registro + empresa) | Baja |
| ☐ | **Crash reporting** antes de publicar | Baja |
| ☐ | Quitar **`usesCleartextTraffic: true`** de `app.json` (dejarlo solo en el perfil de desarrollo) | Baja |
| ☐ | Reset de contraseña **completo dentro de la app** (hoy termina en la web) | Media |

### iOS

| | Faltante | Complejidad |
|---|---|---|
| ☐ | **Proyecto iOS generado** (`expo prebuild -p ios`) — nunca se ha compilado | Media |
| ☐ | **Cuenta de Apple Developer** + App Store Connect | — |
| ☐ | **Certificados y provisioning profiles** | Baja (EAS) |
| ☐ | **Textos de permiso en español** (hoy los aporta el plugin de `expo-image-picker` en inglés genérico) | Baja |
| ☐ | **Privacy manifest** (`PrivacyInfo.xcprivacy`) — `REQUIERE VALIDACIÓN CONTRA POLÍTICAS DE STORE` | Media |
| ☐ | **Layout de tablet real** — `supportsTablet: true` está declarado y solo Configuración lo aprovecha | Media |
| ☐ | Validar **launch screen** en simulador | Baja |

### Android

| | Faltante | Complejidad |
|---|---|---|
| ☐ | **Keystore de producción** — el `release` está firmado con `debug.keystore` | Baja |
| ☐ | **Cuenta de Play Console** | — |
| ☐ | Quitar permisos no usados: **`RECORD_AUDIO`**, **`SYSTEM_ALERT_WINDOW`**, almacenamiento externo | Baja |
| ☑ | Añadir **`CAMERA`** (para el escáner) | Hecho: lo aporta el plugin de `expo-camera`, con el texto de iOS en español | Baja |
| ☐ | Añadir **`POST_NOTIFICATIONS`** si se activan push (Android 13+) | Baja |
| ☐ | **App Links verificados por dominio** (necesarios para el reset de contraseña por email) | Media |
| ☐ | Verificar **ProGuard** con MMKV, Nitro Modules y Hermes en un release real (hoy solo cubre Reanimated) | Media |
| ☐ | Mover los **ajustes nativos manuales** a config plugins (la guía de build avisa que se pierden en cada prebuild) | Media |

---

## 7. Red de seguridad de ingeniería

| | Faltante | Nota | Complejidad |
|---|---|---|---|
| ☐ | **Crash reporting** (Sentry o equivalente) con source maps de Hermes | Sin visibilidad de fallos en producción | Baja |
| ☐ | **`ErrorBoundary` raíz** con pantalla de recuperación | Hoy un fallo de render deja pantalla en blanco | Baja |
| ☐ | **Clave de idempotencia** en `POST /orders` | Timeout de 15 s + reintento = venta duplicada con inventario y caja movidos dos veces | Media + backend |
| ◧ | **Tests de lo que calcula dinero** | Suite creada (Jest + jest-expo, 112 casos): mapeos `toDomain`, `toApiError`, importes de caja, prorrateo de devoluciones, husos horarios, regla del PIN y paridad de locales. **Siguen sin cubrir** `pos-totals`, `toCreateRequest`/`toUpdateRequest` y `parsePhone` | Baja |
| ☐ | **Analytics de embudo** | Imposible saber dónde abandona un usuario nuevo | Baja |
| ☐ | **OTA updates** | `expo.modules.updates.ENABLED = false`; hoy cada fix exige revisión de tienda | Media |
| ☐ | **Comprobación de versión mínima** contra la API | — | Baja |
| ☑ | **Claves de query centralizadas** | Hecho: cubre auth, catalogs, tenant, branches, dashboard, products, categories, customers, orders y cash, con `tenantId` y `branchId`. No queda ninguna clave inline | Baja |
| ☐ | **Cifrado de MMKV** (`encryptionKey`) | La caché persistida guarda email, teléfono y ciudad de clientes en claro | Baja |
| ☐ | **Biometría / re-autenticación** para acciones sensibles (corte, cancelación) | El corte ya exige PIN de supervisor cuando falta el permiso; esto es la capa de encima | Media |
| ☐ | **Pruebas de componente** | `@testing-library/react-native` no monta nada con `react@19.1.0` (la versión que fija Expo SDK 54). La lógica con riesgo se extrajo a módulos puros; falta cuando Expo y React se alineen | Bloqueado |
| ☐ | **Verificación de dominio en deep links** | Los esquemas `orbix://` los puede reclamar otra app | Media |

---

## 8. Offline

| | Faltante | Nota | Complejidad |
|---|---|---|---|
| ☐ | **Banner global de sin conexión** | Hoy solo avisa un panel de Configuración | Baja |
| ☐ | **Carrito y conteo a medio capturar, persistidos** | El arqueo y el corte pierden lo tecleado si la app se cierra | Baja |
| ☐ | **Cola de escrituras offline** | Sin cola, sin reintento diferido, sin resolución de conflictos | Alta |
| ☐ | **Venta offline** con reintento idempotente | Depende de la clave de idempotencia | Alta |
| ☐ | **Resolución de conflictos de stock** al sincronizar | — | Alta |
| ☐ | **Capa de sincronización** en la arquitectura (entre `features` y `repositories`) | Definirla ahora aunque se implemente después | Media |

---

## 9. Notificaciones

Hoy el plugin `expo-notifications` está declarado en `app.json` y no hay una sola línea de código que lo use.

| | Faltante | Fase |
|---|---|---|
| ☐ | Registro de token de push + backend de envío | MVP+ |
| ☐ | Aviso de **stock bajo** | MVP+ |
| ☐ | Aviso de **caja abierta** al cierre del día | MVP+ |
| ☐ | Aviso de **cobro vencido** (CxC) | Post-MVP |
| ☐ | Aviso de **venta registrada** (para el dueño ausente) | Post-MVP |
| ☐ | Invitaciones de equipo | Post-MVP |
| ☐ | Estado de suscripción | Post-MVP |

---

## 10. UX y accesibilidad

| | Faltante | Nota |
|---|---|---|
| ☐ | **Modo inmersivo acotado** al POS | Hoy `withImmersiveMode.js` oculta reloj, batería y notificaciones en toda la app |
| ☐ | **Layout de tablet en el POS** | Hoy 2 columnas fijas también en pantalla de 10" |
| ☐ | **Landscape en Android** | Bloqueado a portrait en el manifest |
| ☐ | **Deshacer** en acciones destructivas | Hay confirmación, no reversión |
| ☐ | **Auditoría de contraste WCAG AA** de `theme/tokens.ts` | Sospechosos: `mutedForeground`, `onDarkMuted: rgba(255,255,255,.55)` sobre gradientes |
| ☐ | **Barrido de 44 dp** fuera del design system | Chips del POS, iconos de acción en filas, dots del stepper |
| ☐ | **Labels de lector de pantalla** en iconos sin texto y badges de estado |
| ☐ | **Orden de foco** verificado con TalkBack y VoiceOver reales |
| ☐ | **Escala de fuente propia** + modo de alto contraste | Plan completo en [`accessibility-plan.md`](accessibility-plan.md) |
| ☐ | **Regla de lint** que exija `accessibilityLabel` en `Pressable` sin texto |

---

## 11. Configuración

8 de 11 categorías están marcadas `soon` en `features/settings/categories.ts`.

| | Categoría | Contenido esperado |
|---|---|---|
| ☐ | **Productos** | Categorías, unidades de medida, valores por defecto del alta |
| ☐ | **Caja** | Cajas físicas, fondo por defecto, permisos de corte |
| ☐ | **Pagos** | Métodos habilitados, divisas, tipo de cambio |
| ☐ | **Impuestos** | Tasa por defecto, códigos fiscales |
| ☐ | **Impresión** | Impresoras, formato de ticket |
| ☐ | **Usuarios** | Equipo, roles, invitaciones, PINs |
| ☐ | **Integraciones** | — |
| ☐ | **Acerca de** | Versión, soporte, términos, privacidad, eliminar cuenta |

---

## 12. Módulos completos ausentes

El backend los tiene; el móvil no los toca. **Ver `auditoria-comercial.md` §20 antes de empezar
cualquiera de estos** — varios no deberían construirse todavía.

| | Módulo | Existe en API |
|---|---|---|
| ☐ | Compras y órdenes de compra | `modules/retail/purchases` |
| ☐ | Proveedores | `modules/retail/suppliers` |
| ☐ | Cuentas por pagar | `modules/core/payables` |
| ☐ | Cotizaciones y órdenes de trabajo | `modules/retail/service-quotes`, `work-orders` |
| ☐ | Catálogo público / tienda en línea | `modules/core/store`, `store-orders` |
| ☐ | Recetas e insumos | `PUT /products/:id/recipe`, `/combo-items` |
| ☐ | Combos | `PUT /products/:id/combo-items` |
| ☐ | Comanda (restaurante) | `modules/restaurant/dining-orders`, `tables` |
| ☐ | Cocina / KDS | `modules/restaurant/kitchen.controller.ts` |
| ☐ | Cupones y promociones | `modules/retail/coupons` |
| ☐ | Reportes exportables (PDF/CSV) | Parcial — hay endpoints de datos, no de exportación |
| ☐ | Conteos físicos | No — TODO «Fase 2» en `inventory.engine.ts` |
| ☐ | Transferencias entre sucursales | No — TODO «Fase 2» |
| ☐ | Kardex / movimientos de inventario | Parcial — el motor existe |

---

## Resumen por origen del trabajo

| Origen | Cantidad aproximada |
|---|---|
| **Hecho** (2026-09-12) | Bloque 1 casi entero, más las claves de query y la suite de pruebas |
| **Solo cableado móvil** (el endpoint ya existe) | La mayoría de los bloques 3, 4 y 5 |
| **Móvil + backend** | Idempotencia, moneda en `SelectTenantResponseDto`, IVA por defecto, eliminación de cuenta |
| **Solo backend** | OTP de teléfono, catálogo de tipos de negocio, branding del tenant, conteos, transferencias |
| **Decisión de producto** | Si `REPORTES` sigue siendo de pago — decide si hay importe por periodo en FREE |
| ~~**Auditoría de caja** (§1 bis)~~ | **Hecha** el 2026-09-12: A (resumen por usuario) y B (bitácora de relevos), más el binding de caja al dispositivo |
| **Infraestructura / cuentas** | Apple Developer, Play Console, keystore, Sentry |
| **Contenido no técnico** | Política de privacidad, términos, capturas, descripción de tienda |

---

## Qué sigue

Con el ciclo del día cerrado, lo que más mueve la aguja por orden:

1. **Bloque 2, puerta de entrada** — el producto que nace `DRAFT` es un arreglo de una línea y
   quita el abandono del minuto cinco. Después, importación CSV y escáner.
2. **Bloque 3, venta completa** — cliente y descuento son UI sobre un contrato que ya existe.
3. **Bloque 6, requisitos de publicación** — nada de esto se puede saltar, y el proyecto iOS no
   se ha compilado nunca.
4. **Paginación de productos y clientes** — el patrón ya está escrito en tickets; es copiarlo.
