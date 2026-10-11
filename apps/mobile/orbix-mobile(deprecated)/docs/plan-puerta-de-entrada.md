# Plan de implementación — Puerta de entrada

**Fecha:** 2026-09-13 · **Alcance:** `@orbix/mobile` + cambios acotados en la API
**Origen:** bloque 2 de [`faltantes-app-comercial.md`](faltantes-app-comercial.md)
**Contexto:** [`auditoria-comercial.md`](auditoria-comercial.md) §19 — los momentos de abandono

Que un usuario nuevo llegue **de la descarga a su primera venta** sin ayuda y sin teclear
cientos de fichas en un teléfono.

Contratos verificados contra `api/src/modules/retail/products`,
`api/src/modules/core/customers` y `api/prisma/schema.prisma` el 2026-09-13.

---

## 1. Hallazgos de la verificación previa

Tres cosas salieron distintas de lo que dice el documento de faltantes. Las tres cambian el plan.

### 1.1 La importación es `.xlsx`, no CSV

`faltantes-app-comercial.md` dice «Importación CSV de productos». **Es falso.** El endpoint
acepta **solo Excel**:

```ts
const XLSX_MIME = /^application\/(vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel|octet-stream)$/;
const MAX_IMPORT_SIZE = 10 * 1024 * 1024;  // 10 MB
```

Y `GET /products/import/template` devuelve un `.xlsx` generado con ExcelJS, con validaciones de
celda y las categorías reales del tenant en un desplegable.

Eso **rompe la premisa del flujo móvil**. Nadie llena una hoja de trece columnas en un teléfono.
Ver §2, decisión D1: el móvil no es donde se llena el archivo, es donde se pide y donde se sube.

### 1.2 La búsqueda de productos **no** cubre el código de barras

`ProductsService.findAll` filtra por:

```ts
where.OR = [
  { name: { contains: search, mode: 'insensitive' } },
  { sku:  { contains: search, mode: 'insensitive' } },
  { description: { contains: search, mode: 'insensitive' } },
];
```

**Sin `barcode`.** Un escáner que lee un código y lo mete en el buscador no encontraría nada, así
que el escáner **no funciona sin cambio de backend** — no es solo instalar `expo-camera`.

Peor: por ADR-0030 el código vive en la **variante**, que es la unidad vendible. El propio
esquema lo dice:

```prisma
/// Para resolver un escaneo, no para restringir: la unicidad es POR EMPRESA...
@@index([barcode])
```

El índice existe **exactamente para esto** y ningún endpoint lo usa. La resolución tiene que
mirar `product.sku`, `variant.sku` y `variant.barcode`, y devolver **qué variante** se escaneó,
no solo qué producto.

### 1.3 La importación de clientes no existe

No hay endpoint. `faltantes` decía «puede requerir endpoint nuevo»; confirmado: lo requiere
entero — plantilla, parseo y upsert.

### 1.4 Otros hallazgos

| Hallazgo | Impacto |
|---|---|
| `EMPTY_PRODUCT_FORM.status = DRAFT` y el POS filtra `ACTIVE` | El fallo del minuto cinco. Arreglo de una línea |
| `ListRow` ya acepta `onPress` y la pantalla de Inicio **no lo pasa** | Los tres «primeros pasos» son decorativos: se ven, no llevan a ningún lado |
| El estado vacío de Productos es solo texto | Sin acción, el usuario nuevo lee «Sin productos» y se queda ahí |
| `RequirePermissions('products:create|products:edit')` es un **OR** | El guard hace `split('|').some(...)`. Quien pueda crear *o* editar puede importar |
| `GET /products/import/template` responde binario con `Content-Disposition` | Axios necesita `responseType: 'arraybuffer'`; el archivo hay que escribirlo a disco antes de compartirlo |
| El catálogo remoto de tipos de negocio ya degrada solo | `business-type-repository` cae al catálogo local ante un 404. No es urgente |
| Ningún paquete de cámara, ficheros ni compartir está instalado | `expo-camera`, `expo-document-picker`, `expo-file-system`, `expo-sharing` entran con este plan |

---

## 2. Decisiones de diseño

| # | Decisión | Razón |
|---|---|---|
| D1 | **El móvil no es donde se llena la plantilla.** Descarga y comparte; el llenado ocurre donde haya teclado; la subida vuelve al móvil | Trece columnas en una pantalla de 6″ no es importación, es tortura. El valor está en pedir la plantilla y en subirla, no en editarla |
| D2 | **Aceptar CSV además de XLSX en el backend** | Un CSV se puede generar desde cualquier sitio y pesa nada. Es el formato que de verdad usa quien viene de una libreta o de Excel gratis |
| D3 | El escáner **resuelve**, no busca | Escanear devuelve un producto y su variante, o nada. Meter el código en el buscador de texto es un rodeo que ya falla hoy |
| D4 | Un **endpoint propio de resolución** (`GET /products/resolve?code=`), no ampliar `search` | `search` es difuso y paginado; resolver un escaneo es exacto y devuelve uno. Mezclarlos haría que teclear «750» trajera el producto cuyo código de barras acaba en 750 |
| D5 | El producto nuevo nace **`ACTIVE`** | Es el valor que quiere el 95% de los casos. Quien necesite borrador lo elige, en el primer paso |
| D6 | El checklist inicial vive en **Inicio**, no en una pantalla de bienvenida | Una pantalla que se ve una vez no acompaña. Un checklist que se descuelga solo cuando se completa, sí |
| D7 | El checklist se **deriva del estado real**, no de banderas | «¿Tiene productos?» se responde con el contador que Inicio ya trae. Guardar «ya hizo el paso 2» en MMKV miente en cuanto el usuario borra el producto |
| D8 | Los estados vacíos llevan **la acción**, no solo el texto | «Sin productos» + botón «Crear el primero» convierte un callejón en un camino |

---

## 3. Prerrequisitos

| | Prerrequisito | Bloquea | Notas |
|---|---|---|---|
| ☐ | `GET /products/resolve?code=` — resolución de escaneo por `barcode`/`sku`, incluida la variante | Fase 2 | **Backend.** Sin esto el escáner no sirve |
| ☐ | Aceptar `text/csv` en `POST /products/import` | Fase 3 (D2) | Backend, S. Recomendado, no bloqueante |
| ☐ | `GET /customers/import/template` + `POST /customers/import` | Fase 4 | Backend, M. No existe nada |
| ☐ | Permiso `CAMERA` en el manifest y `NSCameraUsageDescription` en español | Fase 2 | Lo aporta el plugin de `expo-camera` |

Las Fases 0 y 1 no dependen de nada.

---

## 4. Fases

### Fase 0 — El arreglo de una línea ✅

**Objetivo:** que el primer producto que crea un usuario se pueda vender.
**Tamaño:** XS · **Dependencias:** ninguna

- [x] `EMPTY_PRODUCT_FORM.status` pasa a `ACTIVE`.
- [x] El selector de estado sube del paso 5 al paso 1 del alta, con copy de negocio:
      **«A la venta»** / **«Borrador»**, no `ACTIVE`/`DRAFT`.
- [x] El detalle de un producto en borrador lo dice, con acción para publicarlo.
- [x] Prueba: `EMPTY_PRODUCT_FORM` produce un `CreateProductRequest` con `status: 'ACTIVE'`.

> Es el momento de abandono número uno de la auditoría (§19, «minuto 5»), y cuesta una línea.
> Va solo en su fase para que no quede atrapado detrás de nada.

---

### Fase 1 — Que la app diga qué hacer ✅

**Objetivo:** que nadie se quede mirando una pantalla vacía sin saber cuál es el siguiente paso.
**Tamaño:** S · **Dependencias:** Fase 0

- [x] **Checklist inicial en Inicio**, derivado del estado real (D7):

  | Paso | Se considera hecho cuando | Lleva a |
  |---|---|---|
  | Crea tu primer producto | `totalProducts > 0` | Alta de producto |
  | Abre tu caja | hay sesión viva | Caja |
  | Haz tu primera venta | `totalOrders > 0` | POS |
  | Registra un cliente | `totalCustomers > 0` | Alta de cliente |

- [x] El bloque entero **desaparece** cuando los cuatro están hechos. Un checklist completo que
      sigue ahí es ruido permanente.
- [x] ~~Los tres `ListRow` de «primeros pasos» reciben su `onPress`~~ — resuelto de otra
      forma: el bloque decorativo desapareció entero y lo sustituye el checklist, que ya
      navega. Las tres claves i18n que quedaron huérfanas (`home.addProducts`,
      `home.inviteTeam`, `home.setupPos`) se borraron.
- [x] **Estados vacíos con acción** en Productos, Clientes y Tickets: texto que explica + botón
      que resuelve, gateado por el permiso que corresponda.
- [x] El estado vacío del POS distingue «no tienes productos» de «no hay resultados para esta
      búsqueda»: hoy ambos llevan al mismo sitio, y el primero necesita un botón.

---

### Fase 2 — Escáner de código de barras ✅

**Objetivo:** vender a la velocidad de un mostrador.
**Tamaño:** M · **Dependencias:** Fase 0 · **Requiere:** el endpoint de resolución

#### 2a · Backend — resolver un escaneo

- [x] `GET /products/resolve?code=<código>` — `products:view`.
- [x] Busca en este orden y devuelve **el primero** que case, con su variante:
      `variant.barcode` → `variant.sku` → `product.sku`.
- [x] Responde `{ product, variantId, matchedBy, alternatives }` o **404**. No pagina, no
      aproxima: un escaneo acierta o no. `alternatives` es la respuesta a R2 — cuando dos
      artículos comparten código, se devuelve el más antiguo y los demás viajan ahí, para que
      la hoja pueda decirlo en vez de cobrar el equivocado en silencio.
- [x] Acota al tenant y resuelve el precio y la existencia de la **sucursal en contexto**, igual
      que hace el listado.
- [x] Pruebas: código de variante, código de producto, SKU, código inexistente, código de otro
      tenant (debe ser 404, no fuga).

#### 2b · Móvil — la cámara

- [x] `expo install expo-camera`; el plugin aporta el permiso `CAMERA` y los textos de iOS, que
      hay que fijar **en español** (hoy los de `expo-image-picker` están en inglés genérico).
- [x] `barcode-scanner-sheet.tsx`: `CameraView` con `barcodeScannerSettings` para los formatos que
      usa el comercio — EAN-13, EAN-8, UPC-A, UPC-E, Code128, Code39.
- [x] **Antipático de propósito:** un escaneo por vez. Tras leer, la hoja se bloquea hasta que
      resuelve — sin esto la cámara dispara el mismo código veinte veces por segundo.
- [x] Tres resultados, no dos:
      **encontrado** → al carrito y sigue escaneando ·
      **no encontrado** → ofrece crear el producto con ese código ya puesto ·
      **sin permiso de cámara** → explica y enlaza a los ajustes del sistema.
- [x] Botón de escanear en el POS, junto al buscador.
- [x] **No previsto, pero obligado:** el carrito del POS identificaba sus líneas por
      `productId` y nunca mandaba `variantId`, así que escanear la etiqueta de los 2 L habría
      cobrado el precio del de 600 ml y descontado la existencia equivocada. `CartLine` gana
      `variantId`, la identidad pasa a `cartLineKey(line)` y la venta manda la presentación.
      El DTO ya advertía del problema (ADR-0030); el escáner solo lo hizo visible.
- [x] Botón de escanear en el campo de código del alta de producto.
- [x] Eco háptico al leer: en un mostrador ruidoso, el pitido no se oye.

---

> **Nota de instalación.** `expo-camera` hace que pnpm cree una segunda copia de `expo` en el
> store (cada paquete recibe su propio conjunto de peers). `jest-expo` solo mockea la de la app,
> así que la segunda —la que acaba importando `expo-image`— ejecutaba su `Expo.fx` sin mockear y
> dos suites dejaron de arrancar con «Cannot read properties of null (reading 'match')» en
> `getDevServer`. Metro lo resuelve por su cuenta en el build real; Jest no, y por eso el
> `moduleNameMapper` de `jest.config.js` colapsa `^expo$` a una sola instancia. No instalar con
> `npx expo install` en este repo: usa npm y falla en un workspace pnpm.
>
> **Bug preexistente que salió al verificar en el emulador.** La app no montaba: «Invalid hook
> call … more than one copy of React», y el layout raíz moría con `Cannot read property
> 'useState' of null`. Se reprodujo con TODO el código de estas fases fuera (`git stash`), así
> que no lo trae el escáner. El monorepo tiene dos líneas de React y ninguna sobra: la móvil va
> clavada a `19.1.0` por el SDK 54, y `web/` y `apps/pos-web/` piden `^19.2.5`. Un paquete cuyo
> `react` es *peer* no lleva el symlink dentro de su directorio del store —pnpm cuenta con que
> se resuelva desde arriba—, así que `nativewind`, `@react-native-community/netinfo` y
> `@expo-google-fonts/dm-sans` acababan cogiendo el 19.2.6 de las apps web. Arreglado en
> `metro.config.js` anclando el `originModulePath` de `react` a la copia del proyecto; el
> envoltorio va **después** de `withNativeWind`, que instala su propio `resolveRequest` y si no
> lo pisa. Verificado contando las versiones de React dentro del bundle servido: dos antes, una
> después.

---

### Fase 3 — Importar productos ✅

**Objetivo:** que quien viene de Excel no teclee 400 fichas.
**Tamaño:** M · **Dependencias:** Fase 0

#### 3a · Backend (recomendado, no bloqueante)

- [x] Aceptar `text/csv` además de `.xlsx` en `POST /products/import` (D2), reusando el mismo
      mapeo de columnas.
- [x] `GET /products/import/template?format=csv`.

#### 3b · Móvil

- [x] `expo install expo-file-system expo-sharing expo-document-picker`.
- [x] **Descargar plantilla** — `GET /products/import/template` con
      `responseType: 'arraybuffer'`, escribir a `FileSystem.cacheDirectory` y abrir el share
      sheet. Ahí el usuario la manda a su computadora o a WhatsApp (D1).
- [x] **Subir archivo lleno** — `DocumentPicker` limitado a xlsx/csv, `FormData` con campo
      `file`, tope de 10 MB comprobado antes de subir.
- [x] **Resultado legible**: `{ totalRows, created, updated, errors[] }` se pinta como
      *«412 filas · 380 creados · 28 actualizados · 4 con error»*, con los errores listados por
      número de fila y SKU — que es como `ImportRowError` los devuelve.
- [x] Los errores se pueden **copiar al portapapeles**: corregirlos exige volver al archivo, y
      apuntarlos a mano de una pantalla es absurdo.
- [x] La importación invalida el listado de productos y la rejilla del POS.
- [x] Entrada desde el estado vacío de Productos y desde Configuración → Productos.

- [x] Los tres `expo install` se hacen con **pnpm**, no con `npx expo install` (usa npm y rompe el
      workspace). Y los tres son módulos **nativos**: exigen recompilar el APK, no basta con
      recargar Metro.
- [x] **Encontrado al probar de verdad:** `FileTypeValidator` de Nest 11 valida por *magic
      numbers*, y un CSV es texto plano sin firma — todo CSV se rechazaba con un 400 que además
      decía «current file type is text/csv», como si el tipo fuera el problema. Se arregla con
      `fallbackToMimetype: true`; el `.xlsx` sigue validándose por su firma real (es un zip).

---

### Fase 4 — Importar clientes ✅

**Objetivo:** el mismo alivio para la cartera de clientes.
**Tamaño:** M · **Dependencias:** Fase 3 · **Requiere:** endpoints nuevos

- [x] **Backend**: `GET /customers/import/template` y `POST /customers/import`, calcados de
      productos — mismo `ImportResult`, mismo tope, mismo criterio de upsert.
      Clave natural: el correo, que ya es `@@unique([tenantId, email])`.
- [x] **Móvil**: reusar entera la pantalla de importación de la Fase 3, parametrizada por
      entidad. Si hay que escribir dos pantallas, la Fase 3 quedó mal hecha.

---

### Fase 5 — Verificación de teléfono ✅

**Objetivo:** cerrar el hueco del wizard.
**Tamaño:** S en móvil, M en backend · **Dependencias:** ninguna

- [x] **Backend**: proveedor de SMS + `POST /auth/phone/send-code` y `/verify-code`. El contrato
      está escrito desde hace meses en `src/dto/onboarding.dto.ts`.
- [x] **Móvil**: borrar el `throw new NotImplementedError` de `onboarding-repository.ts` y poner
      `phoneVerification: true` en `ONBOARDING_ENDPOINTS_AVAILABLE`. **La UI ya está construida**
      —OTP de seis casillas, autoavance, autofill del SO, contador de reenvío— y hoy solo muestra
      el aviso de que el endpoint no existe.

> Deliberadamente al final: el wizard ya deja continuar sin verificar, así que esto no bloquea a
> nadie. Es limpieza de deuda, no puerta de entrada.
>
> **Lo que falta para cerrarlo del todo: contratar un proveedor de SMS.** Los dos endpoints
> existen, están autenticados, limitados (5 intentos por código, 60 s entre envíos, 5 códigos por
> número y hora) y probados; lo que no existe es el proveedor que entregue el mensaje.
> `SmsSenderService` es la única pieza que hay que tocar: hoy escribe el código en el log del
> servidor fuera de producción y responde **503** en producción. No devuelve el código en la
> respuesta HTTP **en ningún entorno** —eso convertiría la verificación en un trámite que
> cualquiera se salta leyendo la respuesta— y el wizard degrada ante ese 503 dejando continuar
> sin verificar, igual que hacía antes de que los endpoints existieran.

---

## 5. Contratos verificados

### Importación de productos — existe

| Método | Ruta | Permiso | Detalle |
|---|---|---|---|
| GET | `/products/import/template` | `products:create` **o** `products:edit` | Devuelve `.xlsx` binario con `Content-Disposition`. Trae las categorías reales del tenant en un desplegable |
| POST | `/products/import` | `products:create` **o** `products:edit` | `multipart/form-data`, campo `file`. **Solo xlsx**, máx. 10 MB |

Columnas de la plantilla, en orden:
`SKU · Nombre · Descripción · Categoría · Precio · Precio Comparación · Costo · Estado · Stock ·
Rastrear Inventario · Stock Mínimo · Código Impuesto · Publicar en E-commerce`

`Estado` ∈ `DRAFT | ACTIVE | ARCHIVED` · `Código Impuesto` ∈ `IVA_16 | IVA_11 | IVA_8 | EXCENTO`

```ts
interface ImportResult  { totalRows: number; created: number; updated: number; errors: ImportRowError[] }
interface ImportRowError { row: number; sku?: string; message: string }
```

### Lo que hay que construir en el backend

| # | Cambio | Bloquea | Tamaño |
|---|---|---|---|
| C1 ✅ | `GET /products/resolve?code=` con búsqueda en `variant.barcode`, `variant.sku`, `product.sku` | Fase 2 | S |
| C2 ✅ | `text/csv` en `POST /products/import` + `?format=csv` en la plantilla | Fase 3 | S |
| C3 ✅ | `GET /customers/import/template` y `POST /customers/import` | Fase 4 | M |
| C4 ◧ | `POST /auth/phone/send-code` y `/verify-code` + proveedor SMS | Fase 5 | M |

---

## 6. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **El escáner dispara el mismo código en bucle.** `CameraView` emite por fotograma | Bloquear tras la primera lectura hasta resolver y confirmar; no reabrir el sensor entre escaneos |
| R2 | **Códigos duplicados entre productos.** La unicidad es por empresa y la impone el servicio, no un índice | `resolve` devuelve el primero de forma determinista y ordenada; si hay empate, decirlo en vez de elegir en silencio |
| R3 | **Llenar la plantilla en el teléfono.** Trece columnas no caben | D1: el móvil descarga y sube; el llenado ocurre fuera. Y C2 baja la barrera con CSV |
| R4 | **Importar 400 productos por red móvil.** 10 MB por una conexión de tienda | Comprobar tamaño antes de subir, avisar si no hay wifi, y no reintentar solo: una importación repetida duplica trabajo aunque el upsert la absorba |
| R5 | **Producto `ACTIVE` por defecto publica sin querer.** `isEcommerce` es otro campo | `isEcommerce` sigue en `false` por defecto: `ACTIVE` es «se puede vender en mostrador», no «está en internet». Verificarlo en la prueba |
| R6 | **Permiso de cámara denegado para siempre.** En iOS no se puede volver a pedir | Detectar el estado y enlazar a los ajustes del sistema, con el buscador de texto siempre disponible como salida |
| R7 | **El checklist no se va nunca** porque un paso no se puede completar (sin permiso) | Cada paso se oculta si el usuario no tiene el permiso que necesita, en vez de quedarse marcado en rojo |

---

## 7. Criterios de aceptación

Recorrido de un usuario que descarga la app hoy:

- [ ] Se registra, crea su empresa, y aterriza en Inicio con un **checklist de cuatro pasos**.
- [ ] Toca «Crea tu primer producto», lo crea con lo mínimo, y **aparece en el POS sin tocar nada
      más**.
- [ ] El paso del checklist se marca solo.
- [ ] Descarga la plantilla, la comparte a su computadora, la llena con 50 productos, vuelve y la
      sube. Ve **«50 filas · 50 creados · 0 con error»**.
- [ ] Mete una fila con SKU repetido y precio inválido: la importación **no se cae**, y le dice
      qué fila y qué SKU fallaron.
- [ ] Escanea un producto en el POS y entra al carrito. Escanea uno que no existe y la app le
      ofrece crearlo **con el código ya puesto**.
- [ ] Escanea en el alta de producto y el código se rellena.
- [ ] Con los cuatro pasos hechos, el checklist **desaparece**.
- [ ] Un usuario sin `products:create` no ve el paso de crear producto ni el botón del estado
      vacío.

---

## 8. Tests

Misma regla que en el ciclo del día: lógica pura, sin renderizado — el renderizador de React no
funciona con `react@19.1.0` (ver `plan-ciclo-de-dia.md` §3).

- [ ] `EMPTY_PRODUCT_FORM` → `toCreateRequest` produce `status: 'ACTIVE'` y `isEcommerce: false`.
- [ ] Derivación del checklist: cada paso, hecho y sin hacer; el bloque desaparece con los cuatro;
      un paso sin permiso no cuenta como pendiente.
- [ ] Mapeo de `ImportResult` → el resumen que se pinta, incluidos cero filas y solo errores.
- [ ] Validación del archivo antes de subir: extensión, tamaño y ausencia de archivo.
- [ ] **Backend**: `resolve` por código de variante, por SKU de producto, código inexistente y
      código de otro tenant.
- [ ] **Backend**: el importador tolera una fila mala sin abortar el lote.

---

## 9. Fuera de alcance

- **Importación desde la cámara** (foto de una lista). Suena bien, es un proyecto entero.
- **Datos de ejemplo precargados.** Un catálogo de mentira que hay que borrar después es peor que
  un catálogo vacío con un botón.
- **Tutorial paso a paso con superposiciones.** El checklist deriva del estado real y no
  interrumpe; un tour se salta y no vuelve.
- **Corrección de errores de importación dentro de la app.** Editar filas en el teléfono es el
  mismo problema que llenarlas. Se corrigen en el archivo y se vuelve a subir.
- **Escaneo por lotes para inventario.** Es conteo físico, otro bloque.

---

## 10. Resumen

| Fase | Qué desbloquea | Tamaño | Backend |
|---|---|---|---|
| 0 · Producto `ACTIVE` ✅ | El abandono del minuto 5 | XS | No |
| 1 · Checklist y estados vacíos ✅ | «No sé qué hacer ahora» | S | No |
| 2 · Escáner ✅ | Velocidad de mostrador | M | **Sí** (C1) ✅ |
| 3 · Importar productos ✅ | La barrera de entrada más alta | M | Recomendado (C2) ✅ |
| 4 · Importar clientes ✅ | Lo mismo para la cartera | M | **Sí** (C3) ✅ |
| 5 · OTP de teléfono ✅ | Deuda del wizard | S | **Sí** (C4) ◧ |

**Las fases 0 y 1 no tocan backend y se llevan los dos abandonos más tempranos.** Son el punto de
partida obvio.
