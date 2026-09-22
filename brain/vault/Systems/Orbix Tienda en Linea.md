---
title: Orbix Tienda en Linea
type: system
owner: Requiere validación
updated: 2026-08-21
tags: [sistema, orbix-erp, frontend, ecommerce, astro]
---

# Orbix Tienda en Línea

## Responsabilidad

Los **storefronts** públicos de Orbix: el sitio que ve el cliente final de un tenant,
con catálogo y carrito que termina en un pedido por WhatsApp. Reglas de negocio en
[[Tienda en Linea (Orbix)]]; aquí solo la presentación y el despliegue.

No es un cliente autenticado del ERP: consume los endpoints `@Public()` de
`core/store` en [[Orbix ERP API]]. La única excepción es su panel `/admin`.

## Tecnologías

| Área | Elección |
|---|---|
| Plataforma | Astro 5 |
| Render | SSR (`@astrojs/node`, modo standalone) solo en `@orbix/e-commerce` |
| Estilos | CSS propio del template, sin framework de utilidades |

## Repositorio

Tres piezas bajo `orbix-admin/apps/`, todas dentro del workspace pnpm (`apps/*`):

| Carpeta | Paquete | Qué es |
|---|---|---|
| `e-commerce/` | `@orbix/e-commerce` | Storefront completo: home dinámica, catálogo, tienda, panel `/admin` |
| `e-commerce-singlepage/` | `@orbix/e-commerce-singlepage` | Variante de una sola página (`index.astro`), sin adapter SSR |
| `root-garden/` | *(sin `package.json`)* | Sitio estático de **un cliente concreto** (RootGarden, plantas de acuario): HTML5 + CSS3 + JS ES6, sin build ni dependencias |

## Estructura (`@orbix/e-commerce`)

```
src/
  pages/       index.astro (SSR) · catalogo · tienda · 404 · admin/{index,login}
  components/  Header, Footer + sections/ (Hero, ValueProps, FeaturedCategories,
               Testimonials, ContactFooter)
  layouts/     Base.astro · AdminLayout.astro
  lib/         admin-session.ts
```

Cada `sections/*.astro` corresponde a un `SiteSectionType` de `TenantSiteSection`: el
tenant elige cuáles activa y en qué orden desde el back-office, y la home las arma con el
`content Json` de cada una.

## Resolución del tenant

**Por el `Origin` real de la petición.** Ese es el motivo de que `output: 'server'`: la home
necesita saber a qué tenant sirve antes de renderizar. El resto de páginas siguen estáticas
con `export const prerender = true` una por una.

`PUBLIC_SITE_URL` (leída del `.env` por el propio `astro.config.mjs`, porque el CLI evalúa
la config antes de que Vite inyecte `import.meta.env`) es **por despliegue**: la base de las
URLs canónicas y de `og:`. Nunca se codifica un dominio de cliente concreto.

## El panel `/admin`

Captura de productos desde el propio storefront. Autentica contra el mismo ERP
(`POST /auth/login` → `PATCH /auth/select-tenant/:slug`) y **solo deja entrar a usuarios con
membresía en el tenant que este storefront tiene configurado** (`PUBLIC_TENANT_SLUG`): una
cuenta que pertenezca además a otros tenants los ve ignorados aquí. Guarda el token en
`localStorage` bajo `orbix_admin_token`.

## Dependencias

- [[Orbix ERP API]] — `GET /store/branding`, `/store/site`, `/store/categories`,
  `/store/products`, `POST /store/orders`; y `/auth/*` para el panel `/admin`.

## Riesgos y deuda

- **`root-garden/` es trabajo de cliente dentro del repo del producto.** No tiene
  `package.json` pero el glob `apps/**` del workspace lo alcanza igualmente. **Requiere
  validación** si debe seguir aquí o salir a su propio repositorio: hoy mezcla el ciclo de
  vida de un sitio de cliente con el del ERP.
- **Requiere validación** la relación entre `e-commerce` y `e-commerce-singlepage`: si la
  segunda es una plantilla alternativa seleccionable por `TenantSite.templateId` o un
  experimento suelto. No comparten componentes.
- El panel `/admin` implementa su propia capa de sesión (`admin-session.ts`) en vez de
  reutilizar la del Admin Web — segunda implementación del mismo flujo de login.

Relacionado: [[Tienda en Linea (Orbix)]], [[Orbix ERP API]], [[Orbix ERP Web]].
