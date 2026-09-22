# CLAUDE.md — Orbix ERP

@brain/CLAUDE.knowledge.md

POS/ERP multi-tenant y multi-vertical (retail, restaurante, gimnasio, servicios).
Comandos y convenciones por paquete: `api/CLAUDE.md`, `web/CLAUDE.md`,
`apps/pos-web/CLAUDE.md`.

## Comandos

pnpm workspaces + Turbo. Sin `docker-compose.yml` — la base de datos (Postgres/Neon) es
externa, configurada en `api/.env`.

```bash
pnpm install
pnpm dev               # API + Web juntos
pnpm dev:server        # solo @orbix/api
pnpm dev:mobile        # app Expo (@orbix/app)
node scripts/proxy.js  # proxy :3002 → :3001, necesario para la app móvil
pnpm dev:pos           # API + POS web (@orbix/pos-web)

# api/ (NestJS + Prisma, ver api/CLAUDE.md)
pnpm run start:dev
pnpm run test -- path/to/file.spec.ts       # un solo test
pnpm exec prisma migrate dev --name <name>  # driven by prisma.config.ts, no package.json

# web/ (React + Vite, ver web/CLAUDE.md)
npm run dev
npm run build
```

API en `http://localhost:3001/api`, Swagger en `/api/docs`. Web en
`http://localhost:5173`. El POS web (`apps/pos-web`) es una app Vite aparte del `web/`
de back-office.

**Las apps móviles se conectan al puerto 3002, no al 3001.** `scripts/proxy.js`
escucha en 3002 y reenvía a `localhost:3001/api`: añade
`Access-Control-Allow-Origin: *` —la API solo admite los orígenes de `CORS_ORIGIN`,
que son las apps web internas— y da al dispositivo una URL estable que no depende del
puerto que anuncie Metro. Desde un teléfono físico va la IP LAN de la máquina, nunca
`localhost`: `EXPO_PUBLIC_API_URL=http://192.168.x.x:3002/api`. Detalle en
`apps/mobile/orbix-mobile/README.md`.

## Arquitectura — lo que no está en un solo archivo

Detalle completo en el vault (`brain/vault/Architecture/`, `Systems/`, `Domain/`), pero
lo esencial para orientarse: **monolito modular por vertical de negocio, no por capa**:
`core/` (transversal), `retail/`, `restaurant/`, `platform/` (super-admin) en
`api/src/modules/`. El aislamiento multi-tenant es por columna `tenantId` +
`AsyncLocalStorage` (`TenantContextService`) — todo query tenant-owned debe leer el
tenant de ahí, nunca del body del request.

## Metodología — dos ejes

Se deciden por separado y no se confunden.

| Eje | Quién decide | Valores |
|---|---|---|
| **Workflow** | el usuario | **ODD** (default) · **SDD** (solo si lo pide) |
| **Vía** | coincidencia de patrón | `directo` · `simple` · `completo` |

**SDD nunca se activa solo.** Ni por tamaño, ni por incertidumbre, ni por riesgo. Si el
trabajo parece merecer spec, se dice en una línea y se sigue en ODD hasta que el usuario
decida.

**La vía no se negocia.** La asigna `.specify/force-completo.md` por coincidencia de ruta,
símbolo o dominio. Una tarea ODD que toque guards, dinero o migraciones sube a `completo`
—con diseño, contrato, tests, app arrancada, `/security-review` y absorción— **sin
convertirse en spec**. Así la constitución protege igual con cualquiera de los dos
workflows.

### ODD — el camino por defecto

```
/odd <objetivo>       → docs/odd/<slug>.md   (un documento: objetivo, tareas, evidencia)
/odd-close <slug>     → escalada, pasos de la vía, revisión, evidencia, commit
```

Un cambio entendido y reversible en un commit **no lleva documento**. Abrir uno "por si
acaso" es el desperdicio que ODD evita.

### SDD — solo cuando el usuario lo pide

```
/sdd-specify <idea>   → specs/<vertical>/<ID>-<slug>/spec.md   (draft)
/sdd-tasks <ID>       → tasks.md, cada tarea con su vía
/sdd-implement <ID>   → código, despachado por vía
/sdd-verify <ID>      → verify.md, trazabilidad + app arrancada
/sdd-absorb <ID>      → lo permanente pasa al vault
```

Un módulo **ya implementado** no lleva spec — eso se documenta en el vault
(`brain/vault/Systems/`). El vault documenta lo que hay; el spec plantea lo que viene.

### Revisión — en ambos

```
/rdd-review [slug | ID | rango]   → candidato congelado, profundidad según la vía
```

Se revisa un SHA congelado (`git stash create`), nunca el árbol vivo. **Lo que muta la fuente
corre antes del congelado**; después, solo comprobaciones de solo lectura. Profundidad derivada
de la vía, no del criterio del revisor: `directo` readback · `simple` una lente · `completo`
las 4R en paralelo más refutación. Los hallazgos viven en un ledger con `id` y estado; solo
BLOCKER/CRITICAL entran al bucle, y el bucle tiene dos rondas. **Aprobado no es entregado**:
C-024 sigue mandando.

### Archivos

| Archivo | Qué es | Cuándo se carga |
|---|---|---|
| `.specify/force-completo.md` | triggers de escalada de vía | en cada asignación y cierre |
| `.specify/odd.md` | protocolo ODD | al abrir o continuar trabajo |
| `.specify/rdd.md` | congelado y profundidad de revisión | al cerrar |
| `.specify/vias.md` | pasos de `directo`/`simple`/`completo` | cuando la vía lo exige |
| `.specify/constitution.md` | reglas no negociables (C-0XX) | por sección, citada por id |
| `.specify/agents.md` | qué agente hace qué, envelope de retorno y gatekeeper | al delegar y al recibir |
| `.specify/templates/` | odd, spec, tasks, verify | al crear el artefacto |
| `.specify/verify-traceability.mjs` | cierra la cadena FR → AC → `@spec` | `/sdd-verify` |

Las reglas de la constitución aplican **fuera de todo ciclo**: son del producto, no del
método. Se citan por id (C-001, C-005…) y se lee la sección cuando una aplica de verdad.

### Presupuesto de contexto

- **No releas lo que ya está en contexto.** `constitution.md` y `vias.md` se leen una vez
  por sesión, no una vez por comando.
- **No cargues la constitución entera** para comprobar una lista de rutas: eso es
  `force-completo.md`.
- **Regla de 4 archivos.** Si entender un flujo exige leer 4 o más archivos, delega la
  exploración en vez de cargarlos aquí.
- **Regla multi-archivo.** Tocar 2 o más archivos no triviales: un solo escritor, y
  revisión fresca antes de cerrar.
- **Pasa rutas, no resúmenes.** Un sub-agente recibe la ruta del prompt o del documento y
  lo lee él; un resumen generado degrada el contrato.
- **Regla de sesión larga.** Tras ~20 llamadas a herramienta, 5 lecturas exploratorias o 2
  ediciones no mecánicas con complejidad creciente: pausa y delega, replantea, o justifica
  por qué no.
- **Regla de incidente.** Tras cwd equivocado, accidente de git o worktree, recuperación de
  merge o workaround de entorno: auditoría fresca antes de continuar.

### Anotaciones

Toda función y todo test que implemente un requisito lo declara, o la trazabilidad se
rompe:

```ts
/** @spec INV-002 FR-001, BR-001 */   // SDD
/** @odd cobro-parcial T-003 */        // ODD, vías simple y completo
```
