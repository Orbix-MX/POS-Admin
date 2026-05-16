# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server con HMR en http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run preview   # Preview del build de producción
```

No hay test runner configurado.

## Variables de entorno

Crear `.env` en la raíz:
```
VITE_API_URL=http://localhost:3001/api
```

## Arquitectura general

React 19 + TypeScript + Vite + Tailwind CSS 4 + Zustand + Axios. SPA sin SSR.

**Alias de imports:** `@/` apunta a `src/`.

**Tailwind:** Se usa el plugin `@tailwindcss/vite` — no hay `tailwind.config.*`. El tema completo (variables CSS oklch, dark mode) está en `src/index.css` con `@theme inline`.

### Flujo de autenticación

`App.tsx` renderiza `AuthGate` (sin router) que decide qué mostrar:

1. `!isAuthenticated && !availableTenants` → `<Login />` — POST `/auth/login` devuelve `accessToken` temporal + `availableTenants`
2. `!isAuthenticated && availableTenants` → `<SelectTenant />` — PATCH `/auth/select-tenant/{slug}` devuelve el token final
3. `isAuthenticated` → `<BrowserRouter><AppLayout /></BrowserRouter>`

El token final se guarda en `localStorage` via `auth-service.ts` (`getAccessToken` / `setAccessToken` / `clearAccessToken`). El interceptor de request en `api-client.ts` lo adjunta como `Bearer`. Si la respuesta es 401, el interceptor de response llama `clearAccessToken()` y recarga la página.

**Nota:** `api-client.ts` importa de `auth-service.ts`, y `auth-service.ts` usa `api` — hay dependencia circular. Funciona por el orden de resolución de módulos en runtime pero es frágil; evitar agregar más dependencias cruzadas entre estos dos archivos.

### Estado global (Zustand)

- `src/store/auth-store.ts` — sesión: `isAuthenticated`, `user`, `tempToken`, `availableTenants`. Métodos: `login()`, `confirmTenant()`, `logout()`.
- `src/store/erp-store.ts` — UI global: `darkMode`, `posOpen`, datos de dashboard y empresa (actualmente como placeholders).

### Patrón por módulo: service → hook → page

Cada módulo sigue esta separación:

| Capa | Archivo | Responsabilidad |
|------|---------|----------------|
| Service | `src/services/*-service.ts` | Solo llamadas HTTP con `api` (axios). Retorna tipos tipados. |
| Hook | `src/hooks/use-*.ts` | Estado local, efectos, lógica CRUD, filtros, paginación, modal state. Exporta todo lo que la página necesita. |
| Page | `src/pages/*.tsx` | Solo renderizado. Destrutura el hook y compone columnas con `useMemo`. |

**Paginación:** Los hooks calculan `filtered` y `pageData` con `useMemo`. La paginación es client-side salvo que la API devuelva `ListResponse<T>` (ver abajo).

**Stats en hooks:** Usar un único `for...of` en lugar de múltiples `.filter()` — patrón `js-combine-iterations` ya establecido en el código.

**Handlers:** Siempre `useCallback`. Columnas de tabla: siempre `useMemo` con los handlers como dependencias.

### Respuestas paginadas del API

Cuando el endpoint devuelve paginación server-side, el tipo es:
```typescript
// src/interfaces/list-response.ts
interface ListResponse<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}
```
En ese caso el hook accede a `response.data` (ej: `fetchProducts()` devuelve `ListResponse<Product>` → `data?.data || []`).

### Componentes compartidos clave

- `DataTable<T>` (`src/components/shared/data-table.tsx`) — recibe `columns: Column<T>[]` y `rows: T[]`. Las columnas se definen con `render: (r: T) => ReactNode`.
- `FormModal` + `FormField` (`src/components/shared/form-modal.tsx`) — `FormField` con `options` renderiza un `<select>` pero **no soporta distinción value/label**. Para selects con valor ≠ etiqueta (ej: `ACTIVE`/`Activa`) usar un `<select>` nativo directamente.
- `Pagination` (`src/components/shared/data-table.tsx`) — props: `page`, `total`, `perPage`, `onChange`.

### Routing

Definido en `App.tsx` → `AppLayout`. Para agregar una ruta: (1) importar la página, (2) agregar `<Route>` en `AppLayout`, (3) agregar entrada en `PATH_TO_MODULE`, (4) agregar al nav en `src/components/shared/sidebar.tsx`.

### Módulo de Inventario

`src/pages/inventario.tsx` consume **dos hooks simultáneamente**: `useProducts()` y `useCategories()`. Tiene tab switcher interno (Productos / Categorías). El filtro de categorías en productos usa IDs (`category.id`), no nombres.

Los modales de formulario están extraídos en `src/components/inventario/`:
- `product-form-modal.tsx` — recibe `categories: Category[]` como prop (IDs reales del backend)
- `category-form-modal.tsx` — recibe `categories: Category[]` para el select de categoría padre

### Selects con value/label distintos

El patrón establecido para selects donde el value interno difiere de la etiqueta visible:
```tsx
<select
  value={form.status}
  onChange={e => setForm(p => ({ ...p, status: e.target.value as T }))}
  className="w-full px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
>
  {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
</select>
```
No usar `FormField` con `options` para este caso — el select nativo de `FormField` no puede tener value ≠ opción mostrada.
