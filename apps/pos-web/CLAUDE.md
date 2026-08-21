# CLAUDE.md — `@orbix/pos-web`

Punto de venta web de Orbix (React + Vite + TypeScript). Ver `README.md` para
comandos y estructura, y `BACKEND-GAPS.md` para lo que el diseño pide y el backend
todavía no expone.

## Reglas del paquete

**Este paquete es exclusivamente frontend.** No se modifica `api/`: ni endpoints,
ni controllers, ni services, ni entidades, ni migraciones, ni reglas de negocio.
Si algo del diseño no se puede resolver con las APIs actuales, se busca otro
endpoint existente; si no lo hay, se documenta en `BACKEND-GAPS.md` y se deja
pendiente.

**Nada de servicios propios.** Toda llamada al backend entra por
`src/services/orbix.ts`, que reexporta los servicios de `web/src/services/**` a
través del alias `@web`. Si falta una función, se añade el reexport. Nunca
`api.get(...)` directo en este paquete, ni un `PosXService` que envuelva lo que ya
existe.

**Nada de autenticación paralela.** El login, el token, la selección de tenant y
sucursal y los permisos son los de `useAuthStore` del Admin Web, reexportado desde
`src/stores/session-store.ts`.

**Nada de reglas de negocio en el frontend.** Impuestos, folios, afectación de
inventario y movimientos de caja los calcula el backend. `services/order-totals.ts`
replica la aritmética **solo para la vista previa del carrito**; los importes que
se muestran después de cobrar salen siempre de la orden que devolvió el servidor.

## Alias

| Alias    | Destino             |
|----------|---------------------|
| `~/*`    | `src/*`             |
| `@web/*` | `../../web/src/*`   |
| `@/*`    | `../../web/src/*`   |

`@` apunta al Admin Web, **no** a `src/`: los archivos de `web/src` se importan
entre sí con ese prefijo y romperlo rompe el reuso. El código propio usa `~`.

## Una sola copia de React

El monorepo tiene copias reales (no symlinks) de React con versiones distintas:
19.1.0 en `node_modules/` de la raíz —la que arrastran mobile y las libs
hoisteadas como `zustand` y `react-router-dom`— y 19.2.6 en `web/` y en este
paquete. Sin fijar una sola instancia, los archivos servidos desde `web/src` y
esas libs cargan otra copia y la página muere con *Invalid hook call*.

`vite.config.ts` lo resuelve con alias absolutos de `react` y `react-dom` a
`apps/pos-web/node_modules`, más `resolve.dedupe`. **No quitar esos alias**, y si
se añade una dependencia que dependa de React, comprobar que sigue habiendo una
sola instancia (`npx vite` + consola limpia en `/login`).

## Design System

Tokens en `src/styles/ds/` (copia literal del proyecto de diseño). Componentes de
`components/ui/` = ports TypeScript de los `.jsx` del design system.

No introducir colores, escalas de espaciado ni tipografías fuera de esos tokens.
No añadir Tailwind ni otra capa de utilidades.

## Dependencias

Antes de instalar algo nuevo: comprobar si `web/package.json` ya trae una solución
equivalente y usar esa versión. Prioridad: librería que ya usa Orbix → API nativa
del navegador → librería madura → dependencia nueva.

## Antes de dar por terminado un cambio

```bash
pnpm --filter=@orbix/pos-web lint
pnpm --filter=@orbix/pos-web build
```

Toda pantalla que consuma el API debe cubrir carga, error y vacío
(`components/shared/StateBlock.tsx`). No dejar datos mock donde ya exista API.
