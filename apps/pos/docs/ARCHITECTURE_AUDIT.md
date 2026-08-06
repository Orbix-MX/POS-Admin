# Auditoría de Arquitectura Base — Orbix Mobile (Flutter)

Fecha: 2026-07-08 (revisión 2026-07-08 tras feedback arquitectónico)
Alcance: `apps/pos` (Flutter, tablet-first, multi-vertical ERP)
Estado del código auditado: scaffold inicial de `flutter create` + una pantalla maqueta ("Venta actual") con datos hardcodeados.

> **Nota de revisión**: este documento incorpora correcciones acordadas tras la primera versión de la auditoría. Los cambios de fondo respecto a la v1: (1) domain/data/presentation ya no es obligatorio para todos los módulos — es escalable por necesidad; (2) el Design System se extrae como paquete independiente (`packages/orbix_design_system`) desde el día 1; (3) se agrega capa `business/` para modelos transversales que no son ni core técnico ni feature; (4) se agregan `core/hardware/`, `core/platform/`, `core/analytics/`, `core/config/` explícitos desde el inicio, aunque vacíos.
>
> **Revisión 2**: se agrega (5) `core/events/` — event bus interno para desacoplar features entre sí (POS termina venta → publica evento → Inventario/Caja/Dashboard escuchan, sin conocerse); (6) permisos se sacan de `core/auth/` y suben a `core/security/` (guards/helpers reusados por router y widgets, no solo por sesión). Se congelan además las decisiones de librería base (Riverpod, Dio, go_router, ODS propio, feature-first) — no se reabren salvo cambio de requisito de negocio real, no preferencia de estilo.

---

## 0. Resumen ejecutivo

El proyecto **no tiene todavía arquitectura**: es el resultado de `flutter create` más una pantalla de UI construida directamente sobre `ChangeNotifier` y listas `const` en memoria. No hay routing, no hay networking, no hay autenticación, no hay manejo de errores, no hay persistencia, no hay separación de capas (domain/data/presentation), y no hay tests reales.

Esto **no es un defecto** en este punto del proyecto — es la señal de que la auditoría llega en el momento correcto, antes de que el acoplamiento se cristalice. Pero significa que el "diagnóstico" es corto y el foco real de este documento es la **arquitectura propuesta**.

Decisión de fondo que enmarca todo lo demás: Orbix es un ERP multi-vertical a 5-10 años. La base debe pagarse una vez — capa de red, autenticación, manejo de errores, navegación y convenciones — para que cada vertical (POS, Restaurante, Taller, Gimnasio, Servicios) se sume como *feature module* sin tocar el núcleo.

---

## 1. Diagnóstico

### Fortalezas
- Design tokens (`AppColors`, `AppText`) ya centralizados en `theme.dart` — buen punto de partida para un design system real.
- Separación visual en widgets pequeños y nombrados por responsabilidad (`CategoryRail`, `ProductGrid`, `TicketPanel`, `SideNav`, `TopHeader`, `StatsBar`) — buena intuición de composición, aunque viven todos en `shared/widgets/` sin ser realmente "shared" (son específicos del POS).
- Layout responsive ya considerado (breakpoints tablet/mobile) en `pos_sale_screen.dart` — encaja con el requisito tablet-first.
- `pubspec.yaml` limpio, sin dependencias basura acumuladas — lienzo en blanco real.

### Debilidades
1. **Sin capa de dominio/datos**: `Product`, `CartLine`, `StatCard` en `models.dart` mezclan modelo de UI y de dominio. No hay DTOs, no hay mapeo API↔modelo.
2. **Estado con `ChangeNotifier` manual instanciado en un `State`**: `PosController` vive dentro de `_PosSaleScreenState` (`pos_sale_screen.dart:23`). No es inyectable, no es testeable de forma aislada, no sobrevive a rebuilds de árbol superior, no se puede compartir entre pantallas (ej. Caja necesita saber si hay venta en curso).
3. **Datos hardcodeados como fuente de verdad** (`data.dart`): `kProducts`, `kCategories`, `kInitialCart` son `const`. No existe la noción de repositorio ni de origen de datos remoto/local.
4. **Sin routing**: una sola `MaterialApp.home`. `SideNav` y navegación inferior en móvil no navegan a nada — son maquetas. No hay login, splash, guards, deep links.
5. **Sin networking**: cero HTTP, cero JWT, cero manejo de tenant/sucursal. Backend NestJS ya existe (ver stack en memoria) pero el móvil no tiene ningún cliente.
6. **Sin manejo de errores**: no hay excepciones de dominio, no hay `Result`/`Either`, no hay boundary de UI para errores.
7. **Sin autenticación**: no hay sesión, no hay token, no hay `flutter_secure_storage`.
8. **Sin persistencia/offline**: no hay SQLite/Drift, no hay cola de sincronización.
9. **Sin tests reales**: solo el `widget_test.dart` default de `flutter create` (probablemente roto, referencia contador que ya no existe).
10. **Solo Android/iOS habilitados**: no hay carpetas `windows/`, `linux/`, `macos/` — Flutter Desktop (mencionado como requisito futuro) no está siquiera generado.
11. **`shared/widgets/` es un nombre engañoso**: todo ahí es específico de POS. Cuando se agregue Inventario/Restaurante/etc., "shared" va a mezclar widgets realmente reusables (botones, inputs) con widgets de una sola feature, produciendo acoplamiento cruzado.

### Riesgos si se construye sobre esta base tal cual
- **Acoplamiento por conveniencia**: sin módulos ni barreras de carpeta, cada nueva vertical va a importar directamente controllers/widgets de otras verticales (ej. Restaurante importando `PosController`), y en 2-3 features ya es imposible separarlas.
- **Estado no compartible entre pantallas**: sesión de caja, usuario autenticado, tenant/sucursal activos deben sobrevivir a navegación entre módulos. Un `ChangeNotifier` embebido en un `State` no lo permite.
- **Reescritura de red por feature**: sin cliente HTTP central con interceptores, cada dev va a escribir su propio `http.get` con su propio manejo de token, duplicando bugs de refresh/expiración.
- **Deuda de testing exponencial**: sin separación de capas, testear lógica de negocio requiere levantar widgets completos.
- **Bloqueo de escritorio futuro**: si el layout y el estado asumen `MediaQuery` de tablet en vez de un breakpoint system formal, portar a Desktop más adelante es reescritura, no extensión.

---

## 2. Arquitectura propuesta

### 2.1 Principios rectores
1. **Feature-first, no layer-first en el top level**: cada vertical (pos, inventory, customers, cashbox, restaurant, workshop, gym, services, purchases, reports) es un módulo independiente bajo `lib/features/`.
2. **Complejidad interna por necesidad, no por plantilla**: un feature chico (`settings`, `auth`) empieza como `presentation/ + providers/ + services/`. Solo cuando el módulo crece lo suficiente (más de un origen de datos, lógica de mapeo no trivial, necesidad real de mockear un repositorio en tests) se le agregan `data/` y `domain/`. Forzar domain/data/presentation en un módulo de 2 pantallas es boilerplate sin beneficio — ver criterio de promoción en 2.4.
3. **Tres capas de compartición, no dos**: `core/` (técnico, sin conocimiento de negocio), `business/` (modelos y reglas transversales del dominio Orbix que no pertenecen a ninguna vertical), `features/` (lo específico de cada vertical). Ver sección 2.5.
4. **Design System como paquete independiente desde el día 1**: `packages/orbix_design_system` — no vive dentro de `core/`. Es reusable entre apps futuras (Orbix Admin, Orbix Inventario, Orbix Scanner) sin mover archivos ni crear dependencia inversa de una app hacia otra.
5. **Riverpod como única fuente de estado**, con convención estricta de qué provider usar para qué (sección 7).
6. **Un solo cliente HTTP (`dio`)** con interceptores centralizados para JWT/refresh/tenant/errores — cero llamadas HTTP crudas en features.
7. **Errores tipados de punta a punta**: excepción → `Failure` → estado de UI. Nunca un `try/catch` silencioso ni un `String` de error suelto.
8. **Hardware, plataforma, analytics y config son ciudadanos de primera clase desde hoy**: se crean sus carpetas en `core/` aunque empiecen vacías o con un solo stub, para que ningún feature termine escribiendo su propio `PrinterService` suelto en `shared/` dentro de seis meses.
9. **Diseñar para offline desde el día 1 en el contrato del repositorio**, aunque la implementación (Drift) se aplace a fase posterior.

### 2.2 Diagrama de capas (alto nivel)

```
┌───────────────────────────────────────────────────────────────────┐
│                          app/ (shell)                               │
│      MaterialApp.router · Theme (via ODS) · Locale · Bootstrap       │
└──────────────────────────────┬────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                                                ▼
┌────────────────────┐                          ┌─────────────────────┐
│   core/              │                          │   features/           │
│  - network (dio)      │◄────────consume─────────│  - auth                 │
│  - auth session        │                         │  - pos                   │
│  - security (permisos)   │                       │  - inventory              │
│  - events (event bus)      │                     │  - customers               │
│  - error/failures             │                  │  - cashbox                  │
│  - router (go_router)           │                │  - restaurant                 │
│  - storage (secure,               │              │  - workshop                    │
│    drift futuro)                     │           │  - gym                          │
│  - config (env, remote_config)          │        │  - services                       │
│  - analytics (eventos internos)           │      │  - purchases                       │
│  - hardware (printer, scanner...)           │    │  - reports                          │
│  - platform (abstracción OS)                  │  │  - settings                          │
└──────────────┬──────────────────────────────────┘└───────────────────────────────────────┘
               ▼                                   └───────────────────────────────────────┘
┌─────────────────────┐                                              ▲
│   business/           │◄─────────────────────────consume────────────┘
│  - models (tenant,      │        (modelos transversales, sin lógica de red ni de UI)
│    branch, company,       │
│    money, currency,         │
│    user, permission...)       │
│  - value_objects, enums, utils │
└───────────────────────────────────┘

Design System — paquete aparte, sin conocimiento de negocio:
packages/orbix_design_system/  (tokens, components, layout/breakpoints)
   ▲ consumido por app/ y por todos los features vía pubspec (path dependency)
```

### 2.3 Regla de dependencia
`features/*` → puede importar `core/*` y `business/*` y `packages/orbix_design_system`. `business/*` → puede importar `core/*` (nunca `features/*`). `core/*` no importa nada de `business/` ni `features/`. Un feature **nunca** importa de otro feature. `orbix_design_system` no importa nada de la app — es un paquete Dart/Flutter puro, sin conocimiento de negocio ni de red.

### 2.4 Criterio de promoción a domain/data (por módulo)
Un feature empieza simple:
```
features/settings/
  presentation/
    screens/
    widgets/
    providers/       # Notifiers/AsyncNotifiers Riverpod
  services/          # lógica que no es ni HTTP puro ni estado de UI (ej. validaciones locales)
```
Se promueve a la forma completa (`domain/` + `data/`) cuando aparece **cualquiera** de estas señales:
- Más de un origen de datos real para la misma entidad (remoto + caché local, o dos endpoints distintos que se combinan).
- Necesidad real de mockear el acceso a datos en tests unitarios (no hipotética).
- Mapeo DTO↔entidad no trivial (transformaciones, agregaciones, cálculos de negocio sobre la respuesta cruda).
- El módulo va a ser consumido por más de una pantalla/feature con reglas de negocio propias (no solo CRUD directo).

Hasta entonces, el provider llama directo a un `XxxService` que envuelve `dio` — sin capa de repositorio intermedia. Ejemplo esperado, chico y estable: `settings` (probablemente nunca crece). Ejemplo que sí promueve rápido: `pos`, `inventory`, `cashbox`, `restaurant` (múltiples fuentes, offline real, mapeos de negocio).

### 2.5 `business/` — qué va y qué no
`business/models/` contiene entidades que **ninguna feature es dueña**, porque son transversales a todas: `tenant.dart`, `branch.dart`, `company.dart`, `money.dart`, `currency.dart`, `pagination.dart`, `user.dart`, `permission.dart`. Regla simple: si un modelo se necesita en auth, en el router (guards) y en dos o más features, no pertenece a ningún feature — pertenece a `business/`. Si además tiene reglas de formateo/redondeo (ej. `Money`), esa lógica vive junto al modelo en `business/value_objects/`, no dispersa en cada feature que la usa.

---

## 3. Árbol de carpetas recomendado

```
orbix_pos/                              # raíz del repo/app (monorepo-ready)
├── packages/
│   └── orbix_design_system/            # PAQUETE independiente (pubspec propio)
│       ├── lib/
│       │   ├── tokens/                 # colores, spacing, radii, typography (mover theme.dart aquí)
│       │   ├── components/             # botones, inputs, chips, cards, empty/error states
│       │   └── layout/                 # breakpoints, adaptive scaffold
│       └── pubspec.yaml
│
└── apps/pos/  (esta app)
    lib/
    ├── main.dart                     # bootstrap: WidgetsFlutterBinding, DI overrides, runApp
    ├── app/
    │   ├── app.dart                  # MaterialApp.router, theme (desde ODS), locale
    │   └── bootstrap.dart            # inicialización: env, logger, crash reporting
    │
    ├── core/                         # técnico, SIN conocimiento de negocio
    │   ├── network/
    │   │   ├── dio_client.dart
    │   │   ├── interceptors/
    │   │   │   ├── auth_interceptor.dart
    │   │   │   ├── refresh_interceptor.dart
    │   │   │   ├── tenant_interceptor.dart
    │   │   │   ├── logging_interceptor.dart
    │   │   │   └── error_interceptor.dart
    │   │   ├── api_endpoints.dart
    │   │   └── network_info.dart
    │   │
    │   ├── error/
    │   │   ├── exceptions.dart
    │   │   ├── failures.dart
    │   │   └── result.dart
    │   │
    │   ├── auth/
    │   │   ├── auth_session.dart
    │   │   ├── auth_repository.dart
    │   │   ├── token_storage.dart
    │   │   └── auth_guard.dart        # redirect por "sin sesión" (autenticación, no autorización)
    │   │
    │   ├── security/                  # permisos — NO vive en auth/
    │   │   ├── permission.dart        # enum/value object (o reusa business/models/permission.dart)
    │   │   ├── permission_service.dart # hasPermission(), canView/canEdit/canDelete
    │   │   ├── permission_guard.dart   # redirect de go_router por permiso de ruta
    │   │   └── widgets/
    │   │       └── has_permission.dart # widget builder condicional (HasPermission)
    │   │
    │   ├── events/                    # event bus interno, desacopla features entre sí
    │   │   ├── event_bus.dart         # EventBus (stream-based)
    │   │   └── events/
    │   │       ├── sale_completed_event.dart
    │   │       ├── inventory_updated_event.dart
    │   │       ├── session_expired_event.dart
    │   │       ├── branch_changed_event.dart
    │   │       └── theme_changed_event.dart
    │   │
    │   ├── router/
    │   │   ├── app_router.dart
    │   │   └── route_paths.dart
    │   │
    │   ├── storage/
    │   │   ├── secure_storage.dart
    │   │   └── local_db/              # (fase 3) drift database + daos
    │   │
    │   ├── config/
    │   │   ├── environment.dart       # dev/staging/qa/demo/local/prod
    │   │   ├── app_config.dart
    │   │   └── remote_config.dart     # feature flags remotos
    │   │
    │   ├── analytics/
    │   │   ├── analytics_service.dart # interfaz + no-op/dev impl
    │   │   └── events/                # SaleStarted, SaleCompleted, PrintTicket, Login, Logout, InventoryAdjustment...
    │   │
    │   ├── hardware/                  # vacíos hoy, con la forma ya definida
    │   │   ├── printer/
    │   │   ├── barcode/
    │   │   ├── camera/
    │   │   ├── cash_drawer/
    │   │   ├── scale/
    │   │   └── nfc/
    │   │
    │   ├── platform/
    │   │   └── platform_service.dart  # abstrae Platform.isAndroid/isWindows/isIOS
    │   │
    │   └── utils/
    │       ├── logger.dart            # talker
    │       └── formatters.dart
    │
    ├── business/                      # modelos y reglas transversales de dominio Orbix
    │   ├── models/
    │   │   ├── tenant.dart
    │   │   ├── branch.dart
    │   │   ├── company.dart
    │   │   ├── money.dart
    │   │   ├── currency.dart
    │   │   ├── pagination.dart
    │   │   ├── user.dart
    │   │   └── permission.dart
    │   ├── value_objects/
    │   ├── enums/
    │   └── utils/
    │
    └── features/
        ├── auth/                     # simple: presentation/ + providers/ + services/
        ├── settings/                 # simple, probablemente nunca promueve
        ├── pos/                      # complejo desde el inicio (offline, múltiples fuentes)
        │   ├── presentation/
        │   │   ├── screens/pos_sale_screen.dart
        │   │   ├── widgets/ (category_rail, product_grid, ticket_panel, toolbar, stats_bar, top_header)
        │   │   └── providers/pos_sale_notifier.dart   # Riverpod, no ChangeNotifier suelto
        │   ├── domain/
        │   │   ├── entities/ (product.dart, cart_line.dart)
        │   │   └── repositories/pos_repository.dart
        │   └── data/
        │       ├── dto/product_dto.dart
        │       ├── datasources/ (pos_remote_datasource.dart, pos_local_datasource.dart)
        │       └── repositories/pos_repository_impl.dart
        │
        ├── inventory/     (forma completa, mismo criterio que pos)
        ├── customers/     (empieza simple, promueve si crece)
        ├── cashbox/        (forma completa — múltiples fuentes, offline crítico)
        ├── restaurant/
        ├── workshop/
        ├── gym/
        ├── services/
        ├── purchases/
        └── reports/
```

Sin carpeta `shared/` a nivel `lib/`: lo que hoy vive ahí es 100% específico de POS y se mueve a `features/pos/presentation/widgets/`. Lo genuinamente reusable entre verticales va al paquete `orbix_design_system`, no a una carpeta `shared/` de la app.

---

## 4. Flujo de navegación recomendado

**Librería: `go_router`.** Es el estándar de facto, integra bien con Riverpod (`riverpod` + `go_router` via `refreshListenable` o `ref.watch` en `redirect`), soporta deep links nativamente y `ShellRoute` para navegación anidada persistente (necesario para que Caja/Ventas/Inventario compartan un shell con sidebar sin reconstruirlo).

### Estructura de rutas
- **Rutas raíz sin shell**: `/splash`, `/onboarding`, `/login`.
- **`ShellRoute` autenticado** (envuelve `SideNav`/bottom nav + header): agrupa `/pos`, `/inventory`, `/customers`, `/cashbox`, `/restaurant`, `/reports`, `/settings`. El shell resuelve el layout responsive (con sidebar en tablet ancho, drawer en tablet angosto/móvil) — hoy esa lógica vive duplicada dentro de `PosSaleScreen`; debe subir un nivel al shell para que la reutilicen todas las verticales.
- **Rutas por módulo** (`feature routes`): cada feature expone su propio `GoRoute`/lista de rutas (`pos_routes.dart` dentro de `features/pos/`), y `app_router.dart` las agrega (`routes: [...posRoutes, ...inventoryRoutes]`). Esto evita un archivo de rutas gigante y permite lazy-loading conceptual (el feature "no existe" para el router hasta que se registra).
- **Guards**: `redirect` global en `GoRouter` que consulta `authSessionProvider`. Si no hay sesión → `/login`. Si hay sesión pero falta tenant/sucursal seleccionada → `/select-branch`. Si el feature flag de un módulo está apagado para ese tenant → redirect a `/not-available`.
- **Deep links**: reservar esquema `orbix://` y universal links para casos como abrir un ticket específico desde notificación push (relevante para Restaurante/Talleres con estados de orden).
- **Lazy loading real**: Flutter no tiene code-splitting como web, pero el equivalente es disciplina de import — cada feature no debe ser importado por `main.dart` directamente, solo por el router (`app_router.dart` es el único punto que conoce todos los features).

---

## 5. Flujo de autenticación

- **JWT + Refresh Token**, guardados en `flutter_secure_storage` (nunca `SharedPreferences` para tokens).
- `AuthSession` (Riverpod `Notifier` o `AsyncNotifier`) mantiene: `user`, `tenantId`, `sucursalId`, `accessToken` en memoria (no en storage plano), estado (`unauthenticated | authenticating | authenticated | sessionExpired`).
- **Interceptor de refresh** en `dio`: al recibir 401, pausa la cola de requests, dispara refresh una sola vez (evitar refresh en carrera con `synchronized`/lock), reintenta requests pendientes; si el refresh falla, fuerza logout y el router redirige a `/login`.
- **Cambio de empresa/sucursal/usuario**: no son "logout duro" — son cambios de contexto que actualizan headers (`X-Tenant-Id`, `X-Branch-Id`) vía el `tenant_interceptor` y probablemente invalidan providers cacheados (Riverpod `ref.invalidate` en cascada) sin perder el JWT si el backend lo permite.
- **Biometría / Remember Me**: biometría desbloquea el *acceso a la app* (local_auth) reusando el refresh token ya guardado — no reemplaza el JWT. "Remember me" controla si el refresh token persiste entre cierres de app o se limpia al cerrar sesión del dispositivo.
- **Logout**: limpia secure storage, invalida todos los providers de sesión/tenant, navega a `/login`. Debe ser una función única en `core/auth`, nunca reimplementada por feature.

---

## 6. Flujo de networking

- **Cliente único `dio`** construido en `core/network/dio_client.dart`, expuesto vía Riverpod provider (`dioProvider`) — nunca instanciado ad-hoc en un repositorio.
- **Interceptores en orden**: tenant/headers dinámicos → auth (adjunta token) → logging → error mapping → refresh-on-401 (como interceptor o como capa en el repositorio, según se prefiera manejar la re-ejecución).
- **Headers dinámicos** cubiertos: `Authorization`, `X-Tenant-Id`, `X-Branch-Id`, `X-Company-Id`, `Accept-Language`, `X-App-Version`, `X-Feature-Flags` (si el backend los consume) — todos resueltos leyendo providers de sesión en el interceptor, no hardcodeados.
- **Retry/timeout**: `dio` con `connectTimeout`/`receiveTimeout` configurados por `Env`, y una policy de retry (ej. `dio_retry_plus` o interceptor propio) limitada a errores de red transitorios (no a 4xx).
- **Multipart/uploads/descargas**: `dio` ya cubre `FormData` y `download()` nativamente — no requiere librería adicional.
- **Cancelación**: `CancelToken` de `dio` propagado desde el Notifier que dispara el request (importante en búsquedas de POS/inventario con debounce).
- **Response parsing**: DTOs con `freezed` + `json_serializable` en `data/dto/`, mapeados a entidades de dominio en el repositorio (`toDomain()`), nunca se expone un `Map<String, dynamic>` fuera de `data/`.
- **Errores centralizados**: el `error_interceptor` traduce `DioException` (tipo: timeout, badResponse con status code, cancel, connectionError) a un `Failure` tipado del `core/error/failures.dart`. El repositorio nunca captura `DioException` directamente — lo recibe ya traducido.
- **Offline-aware**: el repositorio consulta `NetworkInfo` (connectivity_plus) antes de decidir si intenta red o sirve de caché local; esto es el gancho para la fase de offline sin que el feature lo sepa.

---

## 7. Flujo de gestión de estado (Riverpod)

- **`Notifier`/`AsyncNotifier`** para todo estado con lógica de mutación (carrito de POS, sesión de auth, formularios complejos). Reemplaza el patrón actual de `ChangeNotifier` manual.
- **`FutureProvider`/`AsyncNotifier`** para datos remotos de solo lectura con estados de carga/error automáticos (listas de productos, reportes).
- **`StreamProvider`** reservado para datos reactivos reales (ej. estado de una orden de Restaurante en tiempo real si se agrega websockets/polling).
- **`.family`** para parametrizar por id (ej. `productDetailProvider(productId)`, `orderStatusProvider(orderId)`).
- **`.autoDispose`** por defecto en providers de pantalla (se liberan al salir); providers de sesión/tenant son `keepAlive` explícito.
- **Separación de responsabilidades**: el `Notifier` orquesta y expone estado de UI. En módulos simples llama directo a un `XxxService`; en módulos promovidos (2.4) llama al repositorio (interfaz de `domain/`), que a su vez decide red/caché. Nunca llama a `dio` directamente.
- **Convención de nombres**: `xxxProvider` para el provider, `XxxNotifier` para la clase. Ej.: `posSaleProvider` → `PosSaleNotifier`. Archivo: `pos_sale_notifier.dart` en `presentation/providers/` (ver árbol de carpetas, sección 3).
- **Caching**: Riverpod ya cachea por naturaleza (mismo provider = mismo resultado hasta invalidar). Reglas explícitas: invalidar providers de catálogo tras una venta si afecta stock, invalidar sesión tras cambio de sucursal.
- **Persistencia entre sesiones de app** (no confundir con offline de datos): usar `riverpod` + un wrapper simple sobre `shared_preferences`/secure storage solo para preferencias de UI (tema, último tenant usado), no para datos de negocio.

---

## 8. Manejo de errores — estrategia global

```
Exception (capa data: ServerException, CacheException, ValidationException)
        │  capturada en repositorio o interceptor
        ▼
Failure (capa domain, sealed/freezed union)
   ├─ NetworkFailure       (sin conexión, timeout)
   ├─ AuthFailure          (401 no resuelto por refresh, credenciales inválidas)
   ├─ ValidationFailure    (400 con detalle de campo)
   ├─ ServerFailure        (5xx, con código/mensaje del backend)
   ├─ NotFoundFailure      (404)
   └─ UnknownFailure       (catch-all, siempre loggeado con stacktrace)
        │
        ▼
Notifier expone AsyncValue.error(failure) / estado explícito
        │
        ▼
UI: mapea Failure → mensaje humano + acción (retry, reintentar login, contactar soporte)
```

- **Logging/Crash reporting**: `talker` (o `logger` + Sentry/Firebase Crashlytics) centralizado en `core/utils/logger.dart`. Todo `UnknownFailure` se loggea con stacktrace completo siempre; `Failure`s esperados (validación, red) se loggean en nivel info/warning, no error.
- **UX de errores**: componente único `ErrorView`/`ErrorSnackbar` en `design_system/components` que toma un `Failure` y decide icono/mensaje/acción — ningún feature debe escribir su propio `Text('Error: $e')`.

---

## 9. Offline — preparación de arquitectura (sin implementar aún)

- El contrato de cada `Repository` (interfaz en `domain/`) **ya debe estar libre de la palabra "remote"**: `getProducts()` no "getProductsFromApi()". Esto permite que la implementación decida internamente red vs. caché sin romper a quien lo consume.
- **Fase futura**: `Drift` (SQLite) en `core/storage/local_db/`, con tablas espejo de las entidades críticas para operar sin conexión (productos, clientes, ventas pendientes).
- **Cola de sincronización**: tabla `pending_operations` (venta creada offline, pago registrado offline) con estado `pending|synced|failed`, sincronizada por un worker cuando `NetworkInfo` detecta conexión.
- **Conflictos**: estrategia last-write-wins como default aceptable para catálogo; para ventas/caja, **nunca** perder una operación local — se reintenta o se marca para revisión manual, no se descarta.
- Esto es diseño, no construcción: la razón de mencionarlo ahora es que el contrato de `Repository` y el uso de DTOs/entidades separados es lo que hace que agregar Drift después sea aditivo, no una reescritura.

---

## 10. Design System (ODS) — paquete independiente

- **`packages/orbix_design_system`** como paquete Flutter propio (pubspec, `analysis_options.yaml` propio), no una carpeta dentro de `core/`. La app lo consume como `path` dependency (`orbix_design_system: {path: ../../packages/orbix_design_system}`); cuando exista Melos/multi-repo real, sigue funcionando igual.
- Justificación: el ODS no tiene conocimiento de negocio ni de red — es el candidato natural a reusarse en Orbix Admin, Orbix Inventario, Orbix Scanner sin mover un solo archivo, solo agregando la dependencia.
- Mover `theme.dart` actual a `orbix_design_system/lib/tokens/` tal cual (colores, tipografía) — ya está bien encapsulado, solo cambia de ubicación (y de paquete).
- Crear `orbix_design_system/lib/components/` con los átomos realmente reusables entre verticales: botón primario, chip de estado, input, card base, empty state, error state, loading skeleton. Los widgets actuales de POS (`ProductGrid`, `TicketPanel`) son *compuestos de feature*, no design system — se quedan en `features/pos/presentation/widgets/` de la app.
- **Responsive/layout**: `orbix_design_system/lib/layout/breakpoints.dart` con constantes únicas (hoy `_wide`/`_medium` están hardcodeadas dentro de `pos_sale_screen.dart:33-34`) para que todas las verticales y todas las apps futuras usen los mismos umbrales tablet/mobile/desktop.
- **Dark mode**: no implementado hoy. Si es requisito, se define ahora en los tokens del paquete (`ColorScheme` claro y oscuro) aunque el toggle de UI se construya después — más barato que retrofit.
- **Regla de dependencia del paquete**: `orbix_design_system` no importa `flutter_riverpod`, `dio`, ni nada de `core`/`business`/`features` de la app. Si un componente "de diseño" necesita estado o datos de negocio, no es un componente de ODS — es un widget de feature que usa componentes del ODS.

---

## 10bis. Hardware, plataforma, analytics y config

Cuatro piezas ausentes en la v1 de esta auditoría, agregadas ahora como carpetas de primera clase en `core/` desde el día 1 (aunque empiecen con un solo archivo stub). El costo de crearlas vacías hoy es cero; el costo de no crearlas es que en 6 meses alguien escribe `shared/printer_service.dart` y queda huérfano de arquitectura.

**`core/hardware/`** — Orbix opera con impresoras térmicas, escáneres de código de barras, básculas, cajones de dinero, lectores NFC y biometría (retail, restaurante, taller). Cada uno vive en su propia subcarpeta (`printer/`, `barcode/`, `camera/`, `cash_drawer/`, `scale/`, `nfc/`) con una interfaz abstracta (`PrinterService`, `BarcodeScannerService`...) y su implementación concreta por plugin. Los features consumen la interfaz vía Riverpod, nunca el plugin directamente — así cambiar de SDK de impresora no toca ningún feature.

**`core/platform/`** — `PlatformService` abstrae `Platform.isAndroid/isIOS/isWindows/isMacOS/isLinux` detrás de una interfaz (`isMobile`, `isDesktop`, `isTablet` combinando con `MediaQuery`). Ningún feature debe importar `dart:io` `Platform` directamente — cuando llegue Flutter Desktop (fase 4), el punto de cambio es uno solo.

**`core/analytics/`** — Eventos internos de producto, no analítica de terceros (no es Google Analytics). `AnalyticsService` con interfaz + implementación no-op para dev y una real (que puede enviar al backend NestJS propio o a un proveedor) para prod. Eventos tipados como clases, no strings sueltos: `SaleStarted`, `SaleCompleted`, `PrintTicket`, `Login`, `Logout`, `InventoryAdjustment`. Sirve de base para telemetría de producto y para debugging de soporte ("¿el usuario llegó a completar la venta?").

**`core/config/`** — `environment.dart` define el enum de entornos (`dev`, `qa`, `demo`, `local`, `prod`) y resuelve `baseUrl`/flags por entorno vía `--dart-define` o archivos `.env` por flavor. `app_config.dart` agrupa configuración estática de la app (timeouts, versión mínima soportada). `remote_config.dart` es el puente a feature flags remotos (si se integra un proveedor, o el propio backend de Orbix expone un endpoint de flags por tenant) — dato relevante porque el guard de rutas (sección 4) y la activación de verticales por plan (ver memoria de "User Limits & Plans" del backend) dependen de esto.

## 10ter. Event Bus — desacoplo entre features

Backend Orbix ya opera con eventos/colas (RabbitMQ, notificaciones — ver [[project_stack]]). El cliente Flutter necesita el equivalente *interno*, no para reemplazar HTTP ni para simular WebSockets todavía — solo para que un feature pueda anunciar algo sin conocer a quién le importa.

**`core/events/event_bus.dart`** — `EventBus` simple basado en `Stream`/`StreamController` (broadcast), expuesto vía Riverpod provider (`eventBusProvider`, `keepAlive`). Eventos como clases tipadas en `core/events/events/`, no strings ni `Map` sueltos: `SaleCompletedEvent`, `InventoryUpdatedEvent`, `SessionExpiredEvent`, `BranchChangedEvent`, `ThemeChangedEvent`.

Ejemplo de flujo: POS termina una venta → publica `SaleCompletedEvent(saleId, branchId, total)` en el bus → no importa ni conoce a Inventario, Caja o Dashboard. Cada uno de esos features escucha el evento (vía un provider que se suscribe al stream filtrando por tipo) y reacciona a su manera — Inventario descuenta stock, Caja registra el movimiento, Dashboard invalida su cache de KPIs.

**Regla**: el event bus es para *notificar hechos ya ocurridos* entre features (desacoplo), no para pedir datos ni para reemplazar el flujo normal Notifier→Repositorio→API de quien originó la acción. Si un feature necesita *pedir* algo a otro, eso es una violación de la regla "features nunca se importan" y la solución correcta es subir el contrato a `business/`, no forzarlo por el bus.

**Diferencia con websockets futuro**: cuando llegue tiempo real desde el backend (ej. estado de orden de Restaurante), el `StreamProvider` que consuma el socket puede publicar en este mismo `EventBus` interno para que el resto de la app reaccione igual que a un evento local — el bus es el punto de unificación entre "pasó algo local" y "pasó algo remoto".

## 10quater. Permisos — `core/security/`, no `core/auth/`

Los permisos se sacan de `core/auth/` porque tienen consumidores distintos a la sesión: el **router** (qué rutas son visibles/accesibles) y **widgets** (qué botones/acciones se muestran). Meterlos dentro de `auth/` los ataría conceptualmente a "quién soy" cuando en realidad responden "qué puedo hacer" — la distinción importa porque un usuario autenticado válido puede no tener permiso para una acción específica, y esa lógica va a crecer mucho (por vertical, por rol, por plan — ver [[project_user_limits]] y [[project_rbac]] del backend).

**`core/security/`**:
- `permission_service.dart` — `PermissionService` con `hasPermission(Permission p)`, `canView`, `canEdit`, `canDelete` sobre el usuario/rol activo en `AuthSession`.
- `permission_guard.dart` — `redirect` de `go_router` específico por permiso de ruta (distinto del `auth_guard.dart` de `core/auth/`, que solo resuelve "hay sesión o no").
- `widgets/has_permission.dart` — `HasPermission` widget builder condicional, para ocultar/deshabilitar UI sin repetir `if (permissionService.can...)` en cada pantalla.

El modelo `Permission` en sí vive en `business/models/permission.dart` (sección 2.5) porque es un dato transversal, no lógica — `core/security/` es donde vive el *comportamiento* sobre ese modelo.

## 10quinquies. Decisiones congeladas

Estas decisiones ya se tomaron con la información disponible y **no se reabren** salvo que cambie un requisito de negocio real (no una preferencia de estilo del equipo): Riverpod (no Bloc), Dio (no Chopper), go_router (no AutoRoute), ODS propio (no Material puro sin capa propia), feature-first (no MVC por capas globales). Revisitar estas decisiones a mitad de proyecto es el tipo de costo que esta auditoría existe para evitar.

## 11. Modularidad — verificación contra verticales futuras

Con la estructura de la sección 3, agregar Inventario/Caja/Clientes/Compras/Producción/Restaurante/CRM/Reportes/Dashboard es: crear `features/<nombre>/` con la misma forma interna, registrar sus rutas en `app_router.dart`, y consumir solo `core/`. No hay acoplamiento estructural que lo impida — el riesgo real no es de estructura sino de disciplina (revisar en code review que nadie importe entre features).

---

## 12. Dependencias — recomendación y justificación

| Paquete | Acción | Justificación |
|---|---|---|
| `google_fonts` | Mantener | Ya en uso, correcto para Inter/JetBrains Mono. |
| `cupertino_icons` | Mantener | Default, sin costo. |
| `flutter_riverpod` | **Agregar** | Estándar para estado escalable, `family`/`autoDispose`/`AsyncNotifier` cubren todos los casos del documento. |
| `riverpod_annotation` + `riverpod_generator` | **Agregar** | Codegen reduce boilerplate de providers a mano. |
| `go_router` | **Agregar** | Routing declarativo, `ShellRoute`, deep links, redirects — todo lo pedido en sección 2. |
| `dio` | **Agregar** | Interceptores, multipart, cancelación, descargas — todo lo que `http` no da de forma nativa. |
| `freezed` + `freezed_annotation` | **Agregar** | Unions para `Failure`, DTOs inmutables, `copyWith` gratis. |
| `json_serializable` | **Agregar** | Serialización de DTOs sin boilerplate manual. |
| `build_runner` | **Agregar** (dev) | Requerido por freezed/json_serializable/riverpod_generator. |
| `flutter_secure_storage` | **Agregar** | Único lugar aceptable para JWT/refresh token. |
| `connectivity_plus` | **Agregar** | Base de `NetworkInfo` para offline-aware repos. |
| `internet_connection_checker_plus` | **Agregar** | Complementa `connectivity_plus` (detecta "conectado a wifi pero sin internet real"), relevante en POS de tienda física. |
| `logger` o `talker` | **Agregar `talker`** | Talker da UI de debug in-app + integración con Dio/Riverpod (`talker_dio_logger`, `talker_riverpod_logger`) — más valor que `logger` a solas para un equipo que crecerá. |
| `drift` | **Diferir a Fase 3** | Correcto elegirlo para offline, pero no instalar hasta que el contrato de repositorio esté listo — evita migraciones de esquema prematuras. |
| `device_info_plus` | **Agregar** | Necesario para diagnósticos/soporte y para headers de auditoría (qué dispositivo hizo qué venta). |
| `package_info_plus` | **Agregar** | Versión de app para header `X-App-Version` y pantalla de soporte/about. |
| `flutter_native_splash` | **Agregar** | Splash nativo consistente con el flujo de auth (splash → login/pos). |
| `flutter_launcher_icons` | **Agregar** | Íconos de app, trivial pero necesario antes de builds de distribución. |
| `flex_color_scheme` | **No agregar por ahora** | Los tokens de `theme.dart` ya están definidos a mano y con valores oklch traducidos con precisión; `flex_color_scheme` resolvería un problema (generación de `ColorScheme`) que ya está resuelto. Reevaluar solo si dark mode completo se vuelve urgente y se quiere generar variantes automáticamente. |
| `http` (si estuviera) | N/A, no está en pubspec | No agregar — `dio` cubre todo el superset. |
| `local_auth` | **Agregar** | Biometría para desbloqueo de sesión (sección 5) — no estaba en la lista original y es requisito explícito de auth. |
| `melos` | **Diferir, no bloqueante** | El paquete `orbix_design_system` funciona hoy con dependencia `path:` simple entre `apps/pos` y `packages/orbix_design_system` sin necesidad de Melos. Adoptar Melos cuando exista más de una app consumiendo el monorepo (Orbix Admin, Orbix Inventario) y el manejo de versiones/scripts cruzados lo justifique. |

**Nota sobre desktop**: agregar plataformas con `flutter create --platforms=windows,linux,macos .` cuando se decida iniciar esa fase — hoy no está ni generado.

---

## 13. Convenciones

| Elemento | Convención | Ejemplo |
|---|---|---|
| Carpeta de feature | `features/<nombre_plural_o_dominio>/` | `features/inventory/` |
| Feature simple (2.4) | `presentation/ + providers/ + services/`, sin `domain/`/`data/` hasta promover | `features/settings/presentation/`, `features/settings/services/` |
| Feature promovido (2.4) | `presentation/ + domain/ + data/` | `features/pos/domain/`, `features/pos/data/` |
| Screens | `<nombre>_screen.dart`, clase `XxxScreen` | `pos_sale_screen.dart` → `PosSaleScreen` |
| Widgets de feature | `<nombre>.dart`, clase en PascalCase descriptivo | `ticket_panel.dart` → `TicketPanel` |
| Componentes ODS | `<nombre>.dart` en `orbix_design_system/lib/components/`, clase `OrbixXxx` (prefijo evita choque de nombres con Material) | `orbix_button.dart` → `OrbixButton` |
| Dialogs | `<nombre>_dialog.dart`, función `showXxxDialog(context)` | `confirm_discard_dialog.dart` |
| BottomSheets | `<nombre>_sheet.dart`, función `showXxxSheet(context)` | `payment_method_sheet.dart` |
| Providers (Riverpod) | `<nombre>Provider`, archivo `<nombre>_provider.dart` o junto al notifier | `posSaleProvider` |
| Notifiers/Controllers | `XxxNotifier` (Riverpod) — evitar el término "Controller" salvo para orquestadores que no son providers (ej. `ScrollController` nativo) | `PosSaleNotifier` |
| Services (feature simple) | `features/<f>/services/xxx_service.dart`, `XxxService` — envuelve `dio`/lógica directa sin repositorio intermedio | `settings_service.dart` |
| Repositorios (interfaz) | `domain/repositories/xxx_repository.dart`, clase abstracta `XxxRepository` (solo en features promovidos) | `PosRepository` |
| Repositorios (impl) | `data/repositories/xxx_repository_impl.dart`, `XxxRepositoryImpl` | `PosRepositoryImpl` |
| DTOs | `data/dto/xxx_dto.dart`, `XxxDto` (freezed + json_serializable) | `ProductDto` |
| Entidades de dominio (feature) | `domain/entities/xxx.dart`, `Xxx` (sin sufijo) | `Product` |
| Modelos transversales | `business/models/xxx.dart`, `Xxx` (sin sufijo) — solo si es dueño de 2+ features/auth/router | `business/models/tenant.dart` → `Tenant` |
| Servicios de `core/` | `core/.../xxx_service.dart`, `XxxService` (interfaz + impl, ej. `PrinterService`, `AnalyticsService`) | `printer_service.dart` |
| Managers | Reservar el término para coordinadores de recursos externos/hardware (impresora, lector de código de barras), no para estado de UI | `printer_manager.dart` |

---

## 14. Calidad — evaluación

| Criterio | Estado actual | Con arquitectura propuesta |
|---|---|---|
| Escalabilidad | Baja — todo en un archivo/pantalla | Alta — feature modules aislados |
| Mantenibilidad | Baja — estado y UI mezclados | Alta — capas separadas, contratos claros |
| Legibilidad | Buena a nivel widget individual | Se mantiene, mejora con convenciones de nombres |
| Testabilidad | Casi nula — `PosController` no inyectable | Alta — Notifiers y repositorios testeables con mocks vía interfaces |
| Acoplamiento | N/A (una sola feature) — riesgo late si no se corrige ahora | Bajo, forzado por regla de dependencia core↔features |
| Complejidad | Baja (esperado en scaffold) | Complejidad inicial mayor (boilerplate de capas), se amortiza a partir del 2º-3º feature |
| Boilerplate | Mínimo hoy | Codegen (freezed/riverpod_generator) mantiene el boilerplate manual bajo pese a más capas |

---

## 15. Roadmap

**Fase 1 — Núcleo (bloqueante para todo lo demás)**
- Crear `packages/orbix_design_system` y migrar `theme.dart` ahí (tokens + layout/breakpoints).
- Configurar `dio_client` + interceptores (auth, tenant, logging, error) contra el backend NestJS real.
- Definir `Failure`/`Exception` (freezed) en `core/error/`.
- Implementar `AuthSession` (Riverpod) + `TokenStorage` (secure storage) + login real contra `/auth/login` y refresh.
- Configurar `go_router` con `ShellRoute` autenticado + rutas de `/login`, `/splash`.
- Crear `business/models/` con `Tenant`, `Branch`, `Company`, `Money`, `Currency`, `User`, `Permission`.
- Crear stubs de `core/platform/`, `core/config/`, `core/analytics/`, `core/hardware/` (interfaces + implementación no-op donde aplique) para que la forma exista antes de que la necesidad presione.
- Redactar y publicar el documento de "reglas del proyecto" (ver sección 17) antes de escribir el primer feature.
- Crear stubs de `core/events/` (EventBus + eventos base) y `core/security/` (PermissionService + guard + `HasPermission`).
- **Cierre de fase — Auditoría Fase 1 (Foundation)**: validar arquitectura real vs. este documento, dependencias instaladas, rutas y guards, auth end-to-end (login + refresh + logout), antes de tocar el primer feature funcional.

**Fase 2 — Primer feature vertical de punta a punta (POS)**
- Mover pantalla actual a `features/pos/` con la forma completa (data/domain/presentation) — POS promueve desde el inicio por sus múltiples fuentes y necesidad de offline.
- Reemplazar `data.dart` hardcodeado por `PosRepository` real contra el backend.
- Reemplazar `PosController` por `PosSaleNotifier` (Riverpod).
- Registrar rutas de POS en el router central.
- Implementar `features/settings/` como feature simple (`presentation/ + providers/ + services/`) en paralelo, para validar también el molde liviano, no solo el pesado.
- Conectar `core/hardware/printer/` real (impresión de ticket) — primer caso de uso de hardware, valida la interfaz antes de replicarla a scanner/cash_drawer.
- POS publica `SaleCompletedEvent` al event bus tras cobrar — primer caso de uso real del bus, aunque todavía no haya un segundo listener consumiéndolo.
- **Cierre de fase — Auditoría Fase 2 (POS)**: revisar separación de capas del feature promovido, uso correcto de Riverpod (autoDispose/family/keepAlive donde corresponde), cumplimiento de las 11 reglas del proyecto (sección 17), y que el feature simple (`settings`) no haya promovido sin necesidad real.

**Fase 3 — Expansión de verticales + offline**
- Agregar Inventario, Clientes, Caja siguiendo el criterio de promoción (2.4) caso por caso, no automáticamente la forma completa.
- Introducir `Drift` y cola de sincronización, primero en el módulo con mayor necesidad offline (POS o Caja en tienda física).
- Crash reporting conectado (Crashlytics/Sentry) en producción; conectar `AnalyticsService` real (no-op → real).
- Evaluar si `remote_config.dart` necesita proveedor externo o basta con endpoint propio de flags por tenant.
- Inventario/Caja empiezan a escuchar `SaleCompletedEvent`/`InventoryUpdatedEvent` — segundo y tercer listener real del event bus, valida el desacoplo en la práctica.
- **Cierre de fase — Auditoría Fase 3 (Offline)**: verificar estrategia de sincronización, manejo de conflictos, resiliencia ante pérdida de conexión a mitad de una venta, y que el event bus no se haya usado para pedir datos entre features (solo para notificar).

**Fase 4 — Verticales especializadas + escritorio**
- Restaurante, Taller, Gimnasio, Servicios sobre el molde ya probado (simple o promovido según 2.4).
- Habilitar target Flutter Desktop, validar breakpoints/layout en ventanas grandes vía `orbix_design_system` (sin tocar features).
- CRM, Reportes/Dashboard como features de solo-lectura intensivas en `FutureProvider`/gráficas.
- Evaluar adopción de Melos si para entonces existe una segunda app (Orbix Admin/Inventario) consumiendo `orbix_design_system`.
- **Cierre de fase — Auditoría Fase 4 (Nuevas verticales)**: confirmar que no aparecieron imports entre features, que `business/` no se infló con modelos que en realidad eran de un solo feature, y que hardware/permisos/eventos se reusaron en vez de reimplementarse por vertical.

**Disciplina de ciclo**: cada fase cierra con su auditoría antes de abrir la siguiente — implementar → auditar → corregir → continuar. Mismo patrón que ya funciona en el backend de Orbix (ver auditorías de RBAC, inventario, purchases en memoria del proyecto); aplicarlo aquí evita que la arquitectura definida en este documento se erosione feature a feature sin que nadie lo note hasta que sea costoso de corregir.

---

## 16. Checklist — antes de construir el primer módulo funcional

- [ ] `flutter_riverpod`, `go_router`, `dio`, `freezed`, `json_serializable`, `build_runner`, `flutter_secure_storage`, `connectivity_plus`, `talker`, `local_auth` agregados a `pubspec.yaml`.
- [ ] `packages/orbix_design_system` creado como paquete `path:` con tokens/layout migrados desde `theme.dart`.
- [ ] `business/models/` con al menos `Tenant`, `Branch`, `Money`, `User` definidos.
- [ ] `core/network/dio_client.dart` con los 5 interceptores (tenant, auth, logging, error, refresh) apuntando al backend NestJS real (no mock).
- [ ] `core/error/failures.dart` y `exceptions.dart` definidos y usados por al menos un caso real (login).
- [ ] `AuthSession` funcionando: login real, token guardado en secure storage, refresh automático probado con un 401 real.
- [ ] `app_router.dart` con `ShellRoute` autenticado + redirect basado en `AuthSession` + rutas de splash/login/onboarding.
- [ ] Breakpoints centralizados en `orbix_design_system/lib/layout/breakpoints.dart`, consumidos por el shell (no por cada pantalla).
- [ ] Stubs creados (aunque vacíos/no-op) para `core/platform/`, `core/analytics/`, `core/config/`, `core/hardware/*`, `core/events/` (EventBus + eventos base), `core/security/` (PermissionService + guard + `HasPermission`).
- [ ] Convenciones de nombres (sección 13) y reglas del proyecto (sección 17) documentadas en `CONTRIBUTING.md` o README.
- [ ] Al menos un feature promovido (`pos`, con data/domain/presentation) y un feature simple (`settings`, con providers/services) migrados como prueba de forma en ambos extremos.
- [ ] Regla de "no imports entre features" verificada manualmente (o con `import_lint`/`custom_lint` si se quiere automatizar).
- [ ] Estrategia de logging/crash reporting decidida y conectada (aunque sea a nivel dev/console primero).
- [ ] `flutter_native_splash` y `flutter_launcher_icons` configurados (bajo esfuerzo, alto valor de percepción antes de demos).

---

## 17. Reglas del proyecto (documento vivo, corto, no negociable)

Reglas mínimas que deben poder citarse de memoria por cualquier dev del equipo. Viven también en `CONTRIBUTING.md` del repo, no solo aquí:

1. Ningún feature importa otro feature. Lo compartido sube a `business/` o al paquete `orbix_design_system`.
2. Todo acceso HTTP pasa por `dio_client` — cero `http.get`/sockets crudos en features.
3. Todo estado compartido entre pantallas vive en Riverpod — cero `ChangeNotifier` instanciado a mano dentro de un `State`.
4. Ningún widget conoce la API directamente — siempre a través de un provider/service/repositorio.
5. Ningún token se guarda fuera de `flutter_secure_storage`.
6. Todo componente visual reutilizable pertenece a `orbix_design_system`, nunca a una carpeta `shared/` de la app.
7. Un feature empieza simple (`presentation/ + providers/ + services/`); solo promueve a `domain/ + data/` cuando cumple el criterio de la sección 2.4 — no por plantilla, no "por si acaso".
8. Acceso a hardware (impresora, scanner, báscula, NFC, cajón) siempre a través de la interfaz en `core/hardware/`, nunca el plugin del SDK directo en un feature.
9. Comunicación entre features solo por `core/events/EventBus` (notificar hechos) o subiendo el contrato a `business/` (compartir datos) — nunca importando un feature desde otro.
10. Permisos se consultan vía `core/security/PermissionService` — nunca un `if (user.role == 'admin')` disperso en un feature o widget.
11. Riverpod, Dio, go_router, ODS propio y feature-first son decisiones congeladas (10quinquies) — no se reabren por preferencia de estilo.

---

## Cierre

Este documento es la referencia oficial de arquitectura para Orbix Mobile. Cambios futuros a esta base (agregar librerías al núcleo, cambiar convenciones, alterar la regla de dependencia core↔business↔features, mover algo dentro o fuera de `orbix_design_system`) deberían actualizarse aquí antes de aplicarse al código, para que siga siendo la fuente de verdad a 5-10 años.
