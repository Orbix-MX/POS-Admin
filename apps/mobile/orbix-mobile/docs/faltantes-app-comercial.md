# Orbix Mobile — Faltantes para app comercial

Lista de lo que no existe hoy y hace falta para que la app sea un producto comercial.
Sin valoraciones ni comparativas: solo el pendiente.

**Fecha:** 2026-09-11 · **Estado del proyecto:** pre-beta
**Análisis completo:** [`auditoria-comercial.md`](auditoria-comercial.md)

Convención de las tablas:

- **Existe en API** — si el endpoint ya está y solo falta cablearlo desde el móvil.
- **Complejidad** — baja / media / alta, solo del lado móvil salvo que se indique.

---

## 1. Ciclo del día

Sin esto un negocio no puede operar una jornada completa.

| | Faltante | Existe en API | Complejidad |
|---|---|---|---|
| ☐ | **Cierre de caja / corte** | Sí — `PATCH /cash-sessions/:id/close` | Media |
| ☐ | **Arqueo** (conteo de efectivo, diferencias) | Sí — `PATCH /cash-sessions/:id/start-count`, `POST /cash-sessions/active/count` | Media |
| ☐ | **Autorización por PIN de supervisor** para corte y arqueo | Sí — `authorizerPin` en el DTO, `POST /cash-sessions/verify-auth` | Baja |
| ☐ | **Gastos** durante el turno | Sí — `POST /cash-sessions/active/movement` | Baja |
| ☐ | **Retiros de efectivo** | Sí — `POST /cash-sessions/active/withdraw` | Baja |
| ☐ | **Ingresos manuales** | Sí — `POST /cash-sessions/active/movement` | Baja |
| ☐ | **Selección de caja física** (`CashRegister`) al abrir | Sí — `GET /cash-sessions/registers`, `/registers/capacity` | Media |
| ☐ | **Historial de ventas** | Sí — `GET /orders` | Media |
| ☐ | **Detalle del ticket** (líneas, pagos, cliente) | Sí — `GET /orders/:id` | Baja |
| ☐ | **Reenvío de comprobante** desde el historial | Sí — `POST /orders/:id/send-receipt` | Baja |
| ☐ | **Cancelación de venta** | Sí — `POST /orders/:id/cancel` | Baja |
| ☐ | **Devolución total y parcial** | Sí — `POST /orders/:id/return`, `/refund` | Media |
| ☐ | **Ajuste de existencias** con motivo | Sí — `PATCH /products/:id/stock` | Baja |
| ☐ | **Ajuste de existencias por variante** | Sí — `PATCH /products/:id/variants/:variantId/stock` | Baja |
| ☐ | **Ventas de hoy / semana / mes** en Inicio | Sí — `GET /reports/sales/daily`, `/sales/monthly` | Media |
| ☐ | **Ganancia por periodo** | Sí — `GET /reports/profit/monthly` | Baja |
| ☐ | **Gastos por periodo** | Sí — `GET /reports/expenses/monthly` | Baja |
| ☐ | **Productos más vendidos** | Sí — `GET /reports/products/top` | Baja |
| ☐ | **Alertas de stock bajo accionables** (hoy solo un contador) | Sí — `GET /products/low-stock` | Baja |

---

## 2. Puerta de entrada

Lo que impide que un usuario nuevo llegue a su primera venta.

| | Faltante | Nota | Complejidad |
|---|---|---|---|
| ☐ | **Producto nuevo nace `ACTIVE`**, no `DRAFT` | `EMPTY_PRODUCT_FORM.status` en `product-schemas.ts`; el POS filtra `ACTIVE` | Baja |
| ☐ | **Selector de estado en el paso 1** del wizard de alta, no en el 5 | `product-form.tsx` | Baja |
| ☐ | **Importación CSV de productos** | Existe: `GET /products/import/template`, `POST /products/import` | Media |
| ☐ | **Importación CSV de clientes** | Puede requerir endpoint nuevo | Media |
| ☐ | **Escáner de código de barras** en el POS | Requiere `expo-camera` + permiso `CAMERA` | Media |
| ☐ | **Escáner en el alta de producto** | Idem | Baja |
| ☐ | **Checklist inicial tras el wizard** | Hoy se aterriza en Inicio con seis KPIs en cero | Media |
| ☐ | **Estados vacíos con acción** en Inicio, Productos y Clientes | — | Baja |
| ☐ | **Verificación de teléfono por OTP** | No existe en API: `POST /auth/phone/send-code`, `/verify-code`. UI ya construida | Backend |
| ☐ | **Catálogo remoto de tipos de negocio** | No existe en API: `GET /catalogs/business-types`. Hoy usa catálogo local | Backend |

---

## 3. Venta completa

El POS solo cubre el caso más simple.

| | Faltante | Existe en API | Complejidad |
|---|---|---|---|
| ☐ | **Cliente en la venta** | Sí — `customerId` en `CreateOrderDto` | Baja |
| ☐ | **Descuento por línea** | Sí — `discount` en el DTO | Baja |
| ☐ | **Cupón** | Sí — `couponCode` en el DTO + `modules/retail/coupons` | Media |
| ☐ | **Variantes vendibles** (selector de presentación) | Sí — `variantId` se persiste en `OrderItem` | Media |
| ☐ | **Venta a crédito** (método CRÉDITO) | Sí | Media |
| ☐ | **Pago mixto** (varios métodos en una venta) | Sí — `payments[]` acepta varios | Media |
| ☐ | **Cobro en USD** coherente con el tipo de cambio de la sesión | Sí — `currency` en el split de pago | Media |
| ☐ | **Notas en la venta** | NO VERIFICADO | Baja |
| ☐ | **Venta suspendida** y recuperación | NO VERIFICADO en API | Media |
| ☐ | **Carrito persistido** entre arranques | Hoy `useState` puro: cerrar la app pierde la venta | Baja |
| ☐ | **Cantidad limitada por stock disponible** | Hoy solo se bloquea agregar cuando ya está en cero | Baja |
| ☐ | **IVA por defecto del tenant en el preview** | Backend: exponer `tenant.settings.defaultTaxRate` | Backend |
| ☐ | **Comprobante por WhatsApp** | Share sheet del SO | Baja |
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
| ☐ | **`branchId` en las claves de caché** | Precio y existencia son por sucursal | Baja |
| ☐ | **Paginación en productos** | Hoy `limit: 100` sin paginar | Media |
| ☐ | **Paginación en clientes** | Idem | Media |
| ☐ | **Paginación / scroll infinito en el POS** | Idem | Media |
| ☐ | **Filtro de categoría en servidor** | Hoy filtra en cliente sobre la página cargada; los contadores de los chips son falsos | Baja |
| ☐ | **`FlashList` en las listas grandes** | Instalado, solo se usa en la lista de empresas | Baja |
| ☐ | **Gestión de usuarios / invitaciones** | Existe: `modules/core/users`, `invitations`, `employees`, `roles` | Media |
| ☐ | **Asignación de roles desde la app** | Existe: `modules/core/roles` | Media |
| ☐ | **PIN de empleado** (supervisor / login de terminal) | Existe en backend | Media |
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
| ☐ | Añadir **`CAMERA`** (para el escáner) | Baja |
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
| ☐ | **Tests de lo que calcula dinero** | Cero tests hoy. Empezar por `pos-totals`, `toCreateRequest`/`toUpdateRequest`, `parsePhone`, `toApiError`, mapeos `toDomain` | Baja |
| ☐ | **Analytics de embudo** | Imposible saber dónde abandona un usuario nuevo | Baja |
| ☐ | **OTA updates** | `expo.modules.updates.ENABLED = false`; hoy cada fix exige revisión de tienda | Media |
| ☐ | **Comprobación de versión mínima** contra la API | — | Baja |
| ☐ | **Claves de query centralizadas** | `query-keys.ts` solo cubre auth, catalogs y tenant; el resto declara arrays inline | Baja |
| ☐ | **Cifrado de MMKV** (`encryptionKey`) | La caché persistida guarda email, teléfono y ciudad de clientes en claro | Baja |
| ☐ | **Biometría / re-autenticación** para acciones sensibles (corte, cancelación) | — | Media |
| ☐ | **Verificación de dominio en deep links** | Los esquemas `orbix://` los puede reclamar otra app | Media |

---

## 8. Offline

| | Faltante | Nota | Complejidad |
|---|---|---|---|
| ☐ | **Banner global de sin conexión** | Hoy solo avisa un panel de Configuración | Baja |
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
| **Solo cableado móvil** (el endpoint ya existe) | La mayoría de los bloques 1, 3, 4 y 5 |
| **Móvil + backend** | Idempotencia, moneda en `SelectTenantResponseDto`, IVA por defecto, eliminación de cuenta |
| **Solo backend** | OTP de teléfono, catálogo de tipos de negocio, branding del tenant, conteos, transferencias |
| **Infraestructura / cuentas** | Apple Developer, Play Console, keystore, Sentry |
| **Contenido no técnico** | Política de privacidad, términos, capturas, descripción de tienda |
