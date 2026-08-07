# RootGarden

> Naturaleza para tu acuario.

Sitio web estático para RootGarden: plantas acuáticas, raíz de manzanita y hardscape para
aquascaping. Construido únicamente con **HTML5, CSS3 y JavaScript ES6** — sin frameworks, sin
Bootstrap, sin Tailwind, sin React y sin dependencias de compilación.

---

## Cómo abrirlo

**Opción A — doble clic (sin instalar nada)**

Abre `index.html`. Funciona tal cual: el catálogo se carga desde el respaldo `data/plantas.js`
cuando el navegador bloquea `fetch` bajo `file://`.

**Opción B — servidor local (recomendado para desarrollo)**

Así el catálogo se lee directamente de `data/plantas.json` y no hace falta regenerar nada:

```powershell
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Luego abre <http://localhost:8080>.

---

## Estructura

```
RootGarden/
├── index.html            Portada, especialidades, selección destacada
├── catalogo.html         Catálogo completo con buscador y filtros
├── tienda.html           Catálogo + carrito y envío por WhatsApp
├── 404.html              Página de error
├── manifest.json         Aplicación instalable (PWA básica)
├── robots.txt
├── sitemap.xml
├── assets/
│   ├── logo.png              Logotipo completo con transparencia
│   ├── logo-mark.png         Sólo el emblema (header y carrito)
│   ├── hero.jpg              Imagen de la portada
│   ├── og-image.jpg          Imagen para redes sociales (1200×630)
│   ├── favicon.png           64×64
│   ├── apple-touch-icon.png  180×180
│   ├── icon-192.png          Icono del manifest
│   ├── icon-512.png          Icono del manifest
│   └── plantas/              Fotografías de producto (ver LEEME.txt)
├── css/
│   ├── styles.css        Tokens de marca, base y componentes compartidos
│   ├── catalogo.css      Encabezado de página, filtros y estados
│   ├── tienda.css        Botón flotante y panel del pedido
│   └── animations.css    Animaciones y movimiento reducido
├── js/
│   ├── utils.js          Formato de precio, texto, DOM, placeholders
│   ├── storage.js        localStorage con degradación a memoria
│   ├── whatsapp.js       Construcción del mensaje y del enlace wa.me
│   ├── carrito.js        Estado del pedido + interfaz del panel
│   ├── buscador.js       Filtrado por texto y categoría
│   ├── catalogo.js       Carga de datos y tarjetas de producto
│   └── app.js            Arranque, header, menú y animaciones
└── data/
    ├── plantas.json      Catálogo (fuente de verdad)
    └── plantas.js        Copia generada para el modo file://
```

---

## Editar el catálogo

Todo el catálogo vive en `data/plantas.json`. **No hay productos escritos en el HTML.**

Cada producto tiene esta forma:

```json
{
  "id": "monte-carlo",
  "nombre": "Monte Carlo",
  "cientifico": "Micranthemum tweediei",
  "categoria": "plantas",
  "descripcion": "La tapizante más agradecida del aquascaping moderno…",
  "dificultad": "Media",
  "luz": "Alta",
  "precio": 95,
  "imagen": "assets/plantas/monte-carlo.jpg",
  "destacado": true
}
```

| Campo         | Notas                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `id`          | Único y estable. Es la clave con la que se guarda el pedido.            |
| `categoria`   | `plantas`, `raices` o `hardscape`. Define el filtro y el emoji.         |
| `dificultad`  | `Fácil`, `Intermedia` o `Avanzada` (colorea la etiqueta).               |
| `luz`         | `Baja`, `Media`, `Alta` o `Indistinta`.                                 |
| `precio`      | Número en pesos mexicanos, sin símbolo ni comas.                       |
| `imagen`      | Ruta relativa. Si el archivo no existe se usa un placeholder de marca.  |
| `destacado`   | `true` para que aparezca en la portada.                                |

### Después de editar `plantas.json`

Si vas a usar el sitio con **doble clic**, regenera el respaldo. Desde la carpeta del proyecto:

```powershell
# Conserva las 14 líneas de cabecera y vuelve a pegar el JSON debajo.
$json = [IO.File]::ReadAllText("data\plantas.json", [Text.Encoding]::UTF8).TrimEnd()
$cab  = (Get-Content "data\plantas.js" -Encoding UTF8 -TotalCount 14) -join "`r`n"
[IO.File]::WriteAllText("data\plantas.js", "$cab`r`n$json;`r`n", (New-Object Text.UTF8Encoding($false)))
```

Si publicas el sitio en un servidor web, este paso es opcional: siempre gana `plantas.json`.

### Fotografías

Guarda cada foto en `assets/plantas/` con el nombre indicado en el campo `imagen`.
Consulta `assets/plantas/LEEME.txt` para medidas y peso recomendados.

---

## Cómo funciona el pedido

1. En `tienda.html`, cada tarjeta tiene un control `−  cantidad  +`. No hay botón «Agregar»:
   el `+` suma y el `−` resta. Al llegar a **cero** el producto desaparece del pedido.
2. El botón flotante `🛒 Mi pedido` muestra el total de artículos y abre el panel lateral.
3. El panel lista nombre, cantidad, precio unitario y subtotal por producto, más el total de
   artículos y el subtotal general.
4. **Enviar pedido por WhatsApp** abre `wa.me` con el mensaje ya redactado.
5. **Vaciar pedido** pide confirmación antes de borrar.

El pedido se guarda en `localStorage` bajo la clave `rootgarden:carrito` y sobrevive al cierre del
navegador. Al cargar el catálogo se revalidan nombres y precios contra `plantas.json`, de modo que
un pedido viejo nunca envía precios desactualizados.

### Mensaje generado

```
Hola, buen día. 😊

Me interesa realizar el siguiente pedido de RootGarden.

🌿 Espada Amazónica ×2
$44.50 c/u
Subtotal: $89.00

🌿 Monte Carlo ×1
$95.00
Subtotal: $95.00

────────────────

Artículos: 3
Subtotal: $184.00

Quedo atento(a) a su confirmación de disponibilidad.
Muchas gracias.
```

El texto se codifica con `encodeURIComponent` antes de adjuntarse al enlace.

---

## Configuración

| Qué                    | Dónde                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| Número de WhatsApp     | `js/whatsapp.js` → `const NUMERO = '526562016886'` y los enlaces del HTML |
| Colores y tipografía   | `css/styles.css` → bloque `:root`                                        |
| Dominio para SEO       | `<link rel="canonical">` y etiquetas `og:` de cada HTML                  |
| Dominio del sitemap    | `sitemap.xml` y `robots.txt`                                             |

> **Antes de publicar:** reemplaza `https://rootgarden.mx/` por el dominio real en los cuatro
> archivos HTML, en `sitemap.xml` y en `robots.txt`.

---

## Decisiones técnicas

**Scripts clásicos en lugar de módulos ES.** Los navegadores bloquean `type="module"` bajo
`file://`, y el requisito era que `index.html` funcione con doble clic. La modularidad se conserva
con un espacio de nombres único (`RG`) y un IIFE por archivo: cada módulo expone una API mínima y
no existen variables globales sueltas.

**Doble fuente de datos.** `plantas.json` es la fuente de verdad; `plantas.js` es una copia
generada que sólo se usa cuando `fetch` falla. `catalogo.js` intenta el JSON primero.

**Placeholders en lugar de imágenes rotas.** Si falta una fotografía, `utils.js` genera al vuelo un
SVG con los colores de la marca y el glifo de la categoría. No hay peticiones extra ni iconos
genéricos.

**Accesibilidad.** Navegación por teclado, `Escape` cierra el panel y el menú, foco visible,
etiquetas `aria` en los controles de cantidad y respeto por `prefers-reduced-motion`.

---

## Compatibilidad

Chrome, Edge, Firefox y Safari en sus versiones actuales, en escritorio y móvil. Se usan
`aspect-ratio`, `backdrop-filter`, `IntersectionObserver`, `100svh` y `100dvh`; en navegadores sin
`IntersectionObserver` el contenido aparece sin animación, sin degradar la funcionalidad.

---

© RootGarden · Naturaleza para tu acuario.
