---
title: Patron de pantalla de configuracion (Orbix Mobile)
type: guide
owner: Requiere validación
updated: 2026-08-22
tags: [guia, orbix-mobile, ods, configuracion]
---

# Patrón de pantalla de configuración (`@orbix/mobile`)

## Cuándo usar esta guía

Al construir cualquier pantalla nueva de "Configuración → categoría → detalle" en
`@orbix/mobile` — la propia lista de Configuración ya tiene ocho categorías reales pero sin
panel (Productos, Caja y ventas, Métodos de pago, Impuestos, Impresión, **Usuarios y
permisos**, Integraciones, Acerca de). Construir cualquiera de esas —incluida la
configuración de usuario— es aplicar este mismo patrón, no inventar uno nuevo.

Ver [[Orbix Apps Moviles y Desktop]] para dónde encaja esto en el sistema completo.

## Requisitos

- Componentes del ODS: `SettingsRow`, `SettingsSection`, `SettingsOptionRow`, `OrbixSwitch`
  (todos en `src/components/settings/` y `src/components/ui/`, exportados desde
  `src/components/index.ts` — nunca se importan por ruta directa).
- `useIsTablet()` (`src/hooks/use-responsive.ts`) si la categoría participa del
  maestro-detalle de `settings/index.tsx`.
- Conocer si el dato es **por tenant** (compartido por todo el equipo) o **por
  dispositivo** (preferencia personal) — determina dónde persiste, ver "Pasos".

## Pasos

1. **Decide dónde vive el dato antes de escribir una sola línea de UI.**
   - Por tenant, ya con endpoint tipado propio → repositorio + hook en
     `src/features/tenant/` (ej. `use-tenant-settings.ts`, `TenantInfo` vía
     `PATCH /tenants/current/info`).
   - Por tenant, sin endpoint propio → `Tenant.settings`, el JSON merge-patch genérico
     (`GET/PATCH /tenants/current/settings`, permisos `settings:view`/`settings:manage`).
     Tipa solo la clave que usas en `TenantSettingsDto` — es un índice abierto
     (`[key: string]: unknown`), así que un `PATCH` con un solo campo nunca pisa lo que
     otra pantalla ya guardó ahí.
   - Por dispositivo (preferencia personal, no de negocio: pantalla de inicio, orden de
     una lista) → `kvStorage` (MMKV), agregando la clave a `StorageKeys` primero — nunca
     una string suelta. Ver `src/features/settings/use-settings-prefs.ts`.
   - **Si no existe ninguna de las tres vías**, la fila se construye igual pero
     `disabled`, con `badge={t('drawer.comingSoon')}` y una descripción que diga *por qué*
     ("Disponible cuando Orbix tenga X") — nunca simular que guarda algo.
2. **Un `GeneralPanel`/`StorePanel`-style: un componente de contenido puro**, sin
   `OrbixScaffold` ni back button — así lo monta tanto la pantalla empujada del teléfono
   (`settings/<categoria>.tsx`) como el panel de detalle del maestro-detalle en tablet.
3. **Agrupa en `SettingsSection`** (título + `OrbixCard` bordeada), una por tema, no una
   sola sección gigante. `tone="danger"` solo para acciones destructivas reales.
4. **Cada fila es `SettingsRow`**: `icon` + `title` + `value` (el estado actual, siempre
   visible, nunca "entra para ver qué hay") + `onPress` que abre un `OrbixBottomSheet`
   propio (con `ref` + `expand()`/`close()`) para elegir. Un control que se basta a sí
   mismo (un switch) va en `trailing`, no en `onPress` — evita doble-toggle.
5. **Registra la categoría en `src/features/settings/categories.ts`**: agrega la entrada
   con su `Icon`, `tintBg`/`tintFg` (tokens de `ThemeColors` ya existentes — no inventes
   colores nuevos) y, si tiene panel real, su `route`.
6. **Si el dato afecta a otra pantalla ya existente** (ej. moneda/decimales afectan
   precios en Home, Productos y POS), no repitas el fetch en cada pantalla: sincronízalo
   una vez en un store síncrono compartido (`src/services/currency/currency-format-store.ts`
   es la referencia) y suscribe cada pantalla consumidora con
   `useSyncExternalStore` — ver "Trampas conocidas" antes de copiar esto a medias.

## Verificación

- Corre en emulador contra la API real (no solo type-check): `npx expo start --clear` +
  `adb` para capturas — un cambio de `.env` (`EXPO_PUBLIC_API_URL`) no se refleja con Fast
  Refresh, exige reinicio de Metro.
- Cambia el valor, navega a otra pantalla que lo consuma **sin recargar la app**, confirma
  que se actualizó solo. Si no se actualiza, es el bug de "Trampas conocidas" #2.
- `npx tsc --noEmit` y `npx eslint src` limpios antes de dar por terminado.

## Trampas conocidas

1. **`Pressable` con `style` como función no aplica el estilo en este proyecto.**
   `style={({ pressed }) => ({ flexDirection: 'row', ... })}` se renderiza como si el
   objeto nunca se hubiera aplicado — el texto ocupa todo el ancho de fila y cualquier
   ícono trailing cae en una línea aparte, como si el contenedor fuera columna en vez de
   fila. Confirmado con `uiautomator dump` (el nodo de texto medía el ancho completo de
   pantalla) y reproducido también en `BackButton` (componente preexistente, no de este
   módulo) — es sistémico, no un typo puntual. **Usa siempre estilo estático** (`style={{...}}`)
   + el componente `Ripple`/`useRipple` (`src/components/animations/ripple.tsx`) para el
   feedback de presión, como ya hacen `SettingsRow` y `SettingsOptionRow`. Antes de portar
   este patrón a otro módulo, revisa si usa `Pressable` con función-estilo en algún lado.
2. **Un store síncrono fuera de React (`let x = ...` + getter) no dispara re-render.**
   `currencyFormatStore.set(...)` actualiza el valor al instante, pero una pantalla que ya
   se había pintado con el valor viejo se queda así hasta que algo *más* la haga
   re-renderizar — se reprodujo cambiando "Casas decimales" en Configuración y volviendo a
   Home sin recargar: el KPI se quedó con el formato anterior. Arreglado agregando
   pub-sub al store (`subscribe`/`getVersion`) y un hook `useCurrencyFormatVersion()`
   (`useSyncExternalStore`) montado **una vez por pantalla que consume el dato** (Home,
   Productos, POS) — no en cada fila hija, que ya se re-renderiza gratis al re-renderizar
   la pantalla. Cualquier store nuevo de este tipo necesita el mismo mecanismo desde el
   día uno.
3. **`EXPO_PUBLIC_*` se inlinea al build, no se lee en caliente.** Si una sección entera
   parece "no conectar con el backend" pese a que la API está arriba, antes de sospechar
   de permisos o del código: `curl` directo al puerto que dice `.env` — un mismatch de
   puerto (visto en producción: `.env` decía `:3002`, la API corría en `:3001`) da
   exactamente el mismo síntoma que un problema de permisos o CORS, pero no lo es.
4. **`Tenant.settings` es JSON abierto** — no hay typing del backend que te avise si
   pisaste una clave de otra feature. Manda siempre un `PATCH` con solo el campo que estás
   cambiando (merge-patch), nunca el objeto completo que leíste.

## Si no funciona

Compara contra `src/features/settings/panels/general-panel.tsx` y
`src/features/settings/panels/store-panel.tsx` — son la implementación de referencia con
los tres orígenes de dato (endpoint tipado, `Tenant.settings` genérico, preferencia local)
todos presentes. Lo que no se pueda verificar contra ellos: **Requiere validación**.
