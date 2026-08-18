/**
 * tienda.js
 * Arranque de este template: pide branding, categorías reales, secciones del
 * tenant (HERO / FEATURED_CATEGORIES / FEATURED_PRODUCTS / CONTACT_FOOTER) y
 * el catálogo, y pinta la página completa — todo del lado del cliente, sin
 * SSR, para que este template se pueda desplegar en cualquier hosting
 * estático. Nada del código de abajo asume un tenant en particular: todo
 * placeholder ("Tu Tienda") se reemplaza solo si la API trae algo real.
 */
window.RG = window.RG || {};

RG.tienda = (function () {
  'use strict';

  const { crear, formatearPrecio, normalizarTexto, retrasar, imagenPlaceholder } = RG.utils;

  let productos = [];
  let indiceProductos = new Map();
  let filtroCategoria = null;
  let filtroTexto = '';
  let carouselAutoplayId = null;

  const productoPorId = (id) => indiceProductos.get(String(id)) || null;

  /* --- Fetch helpers --------------------------------------------------------- */

  const apiUrl = () => (window.RG_CONFIG || {}).apiUrl;

  const obtenerJson = async (ruta) => {
    const base = apiUrl();
    if (!base) return null;
    try {
      const res = await fetch(`${base}${ruta}`, { cache: 'no-cache' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  /* --- Branding --------------------------------------------------------------- */

  const hexToRgb = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  };
  const rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mezclar = (hex, hacia, pct) => {
    const a = hexToRgb(hex);
    const b = hexToRgb(hacia);
    if (!a || !b) return hex;
    const t = pct / 100;
    return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  };
  const aclarar = (hex, pct) => mezclar(hex, '#ffffff', pct);
  const oscurecer = (hex, pct) => mezclar(hex, '#000000', pct);

  const aplicarBranding = (data) => {
    if (!data) return;
    window.RG_CONFIG = window.RG_CONFIG || {};
    window.RG_CONFIG.tenantName = data.name || '';

    if (data.primaryColor && hexToRgb(data.primaryColor)) {
      const root = document.documentElement.style;
      root.setProperty('--marca-700', data.primaryColor);
      root.setProperty('--marca-900', oscurecer(data.primaryColor, 25));
      root.setProperty('--marca-500', data.secondaryColor && hexToRgb(data.secondaryColor) ? data.secondaryColor : aclarar(data.primaryColor, 20));
      root.setProperty('--marca-200', aclarar(data.primaryColor, 58));
      root.setProperty('--marca-050', aclarar(data.primaryColor, 75));
    }

    if (data.name) {
      document.title = data.name;
      document.querySelectorAll('[data-marca-texto]').forEach((el) => { el.textContent = data.name; });
      const emblema = document.querySelector('[data-marca-emblema]');
      if (emblema && !data.logoUrl) emblema.textContent = data.name.trim().charAt(0).toUpperCase() || 'T';
    }

    if (data.logoUrl) {
      document.querySelectorAll('[data-marca-emblema]').forEach((el) => {
        el.outerHTML = `<img class="marca__emblema marca__emblema--foto" style="object-fit:cover" src="${data.logoUrl}" alt="" data-marca-emblema />`;
      });
    }
  };

  /* --- Franja de categorías (reales, no editables) ----------------------------- */

  const aplicarCategorias = (categorias) => {
    const nav = document.querySelector('[data-nav-categorias]');
    const lista = document.querySelector('[data-nav-categorias-lista]');
    if (!nav || !lista || !Array.isArray(categorias) || !categorias.length) return;

    lista.textContent = '';
    const todas = crear('li', {}, [
      crear('a', { clase: 'nav-categorias__enlace', href: '#destacados', 'data-categoria-filtro': '', texto: 'Todo' }),
    ]);
    lista.appendChild(todas);

    categorias.forEach((cat) => {
      lista.appendChild(
        crear('li', {}, [
          crear('a', {
            clase: 'nav-categorias__enlace',
            href: '#destacados',
            'data-categoria-filtro': cat.slug,
            texto: cat.name,
          }),
        ])
      );
    });

    lista.addEventListener('click', (evento) => {
      const enlace = evento.target.closest('[data-categoria-filtro]');
      if (!enlace) return;
      filtroCategoria = enlace.dataset.categoriaFiltro || null;
      pintarProductos();
    });

    nav.hidden = false;
  };

  /* --- Secciones del tenant ----------------------------------------------------- */

  /**
   * @param {object} content Contenido de la sección HERO
   * @param {string} [bannerUrlTenant] Banner subido en Configuración del tenant —
   *   se usa como fondo si la sección HERO no tiene su propia imagen.
   */
  const aplicarHero = (content, bannerUrlTenant) => {
    const seccion = document.querySelector('[data-hero]');
    if (!seccion || !content || !content.title) return;

    const titulo = document.querySelector('[data-hero-titulo]');
    const subtitulo = document.querySelector('[data-hero-subtitulo]');
    const fondo = document.querySelector('[data-hero-fondo]');
    if (titulo) titulo.textContent = content.title;
    if (subtitulo) subtitulo.textContent = content.subtitle || '';

    const imagenFondo = content.backgroundImageUrl || bannerUrlTenant;
    if (fondo && imagenFondo) {
      fondo.style.backgroundImage = `url("${imagenFondo}")`;
      seccion.classList.add('hero--con-foto');
    }
    seccion.hidden = false;
  };

  /** Tarjeta del carrusel — foto real de la categoría (Category.imageUrl). */
  const crearTarjetaCarouselCategoria = (categoria) => {
    const conFoto = Boolean(categoria.imageUrl);
    return crear('article', { clase: `tarjeta-categoria carousel-categorias__tarjeta${conFoto ? '' : ' tarjeta-categoria--sin-foto'}` }, [
      conFoto ? crear('img', { clase: 'tarjeta-categoria__img', src: categoria.imageUrl, alt: categoria.name, loading: 'lazy' }) : null,
      conFoto ? crear('div', { clase: 'tarjeta-categoria__velo' }) : null,
      !conFoto ? crear('span', { clase: 'tarjeta-categoria__icono', texto: '🛍️' }) : null,
      crear('div', { clase: 'tarjeta-categoria__texto' }, [
        crear('p', { clase: 'tarjeta-categoria__titulo', texto: categoria.name }),
        categoria.description ? crear('p', { clase: 'tarjeta-categoria__desc', texto: categoria.description }) : null,
      ]),
    ]);
  };

  const AUTOPLAY_INTERVALO = 4500;

  const detenerAutoplayCarousel = () => {
    if (carouselAutoplayId) {
      clearInterval(carouselAutoplayId);
      carouselAutoplayId = null;
    }
  };

  /** Avanza sola cada AUTOPLAY_INTERVALO ms y regresa al inicio al llegar al final. */
  const iniciarAutoplayCarousel = (pista) => {
    detenerAutoplayCarousel();
    const tarjetas = pista.querySelectorAll('.carousel-categorias__tarjeta');
    if (tarjetas.length < 2 || RG.utils.prefiereMenosMovimiento()) return;

    carouselAutoplayId = setInterval(() => {
      const alFinal = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 4;
      if (alFinal) {
        pista.scrollTo({ left: 0, behavior: 'smooth' });
        return;
      }
      const tarjeta = pista.querySelector('.carousel-categorias__tarjeta');
      const paso = tarjeta ? tarjeta.getBoundingClientRect().width + 14 : 260;
      pista.scrollBy({ left: paso, behavior: 'smooth' });
    }, AUTOPLAY_INTERVALO);
  };

  const conectarCarousel = () => {
    const pista = document.querySelector('[data-carousel-categorias]');
    const prev = document.querySelector('[data-carousel-prev]');
    const next = document.querySelector('[data-carousel-next]');
    if (!pista) return;

    const desplazar = (signo) => {
      const tarjeta = pista.querySelector('.carousel-categorias__tarjeta');
      const paso = tarjeta ? tarjeta.getBoundingClientRect().width + 14 : 260;
      pista.scrollBy({ left: signo * paso, behavior: RG.utils.prefiereMenosMovimiento() ? 'auto' : 'smooth' });
    };

    if (prev) prev.addEventListener('click', () => { desplazar(-1); iniciarAutoplayCarousel(pista); });
    if (next) next.addEventListener('click', () => { desplazar(1); iniciarAutoplayCarousel(pista); });

    // Pausa mientras el usuario interactúa; retoma al soltar.
    pista.addEventListener('mouseenter', detenerAutoplayCarousel);
    pista.addEventListener('mouseleave', () => iniciarAutoplayCarousel(pista));
    pista.addEventListener('touchstart', detenerAutoplayCarousel, { passive: true });
    pista.addEventListener('touchend', () => iniciarAutoplayCarousel(pista), { passive: true });

    iniciarAutoplayCarousel(pista);
  };

  /** Carrusel de categorías reales (no contenido curado): foto + nombre + descripción. */
  const aplicarCarouselCategorias = (categorias) => {
    const seccion = document.querySelector('[data-seccion-categorias]');
    const pista = document.querySelector('[data-carousel-categorias]');
    if (!seccion || !pista || !Array.isArray(categorias) || !categorias.length) return;

    pista.textContent = '';
    categorias.forEach((cat) => pista.appendChild(crearTarjetaCarouselCategoria(cat)));
    seccion.hidden = false;
    conectarCarousel();
  };

  const aplicarProductosEncabezado = (content) => {
    const titulo = document.querySelector('[data-productos-titulo]');
    const subtitulo = document.querySelector('[data-productos-subtitulo]');
    if (titulo && content && content.title) titulo.textContent = content.title;
    if (subtitulo && content && content.subtitle) {
      subtitulo.textContent = content.subtitle;
      subtitulo.hidden = false;
    }
  };

  const aplicarFooter = (content) => {
    const pie = document.querySelector('[data-footer]');
    if (!pie) return;

    const titulo = document.querySelector('[data-footer-titulo]');
    const subtitulo = document.querySelector('[data-footer-subtitulo]');
    const whatsapp = document.querySelector('[data-footer-whatsapp]');
    const anio = document.querySelector('[data-anio]');

    if (titulo) titulo.textContent = (content && content.title) || '¿Tienes dudas?';
    if (subtitulo && content && content.subtitle) subtitulo.textContent = content.subtitle;
    if (anio) anio.textContent = String(new Date().getFullYear());

    const numero = (content && content.whatsappNumber) || '';
    window.RG_CONFIG = window.RG_CONFIG || {};
    window.RG_CONFIG.whatsappNumber = numero;

    if (whatsapp) {
      if (numero) whatsapp.href = `https://wa.me/${numero}`;
      else whatsapp.hidden = true;
    }

    pie.hidden = false;
  };

  /* --- Catálogo ----------------------------------------------------------------- */

  const mapearProducto = (producto) => {
    const imagenes = Array.isArray(producto.images) ? producto.images : [];
    const imagenPrincipal = imagenes.find((img) => img.isPrimary) || imagenes[0];
    return {
      id: String(producto.id),
      nombre: String(producto.name || 'Producto'),
      precio: Number(producto.price) || 0,
      imagen: imagenPrincipal ? imagenPrincipal.url : '',
      categoriaSlug: (producto.category && producto.category.slug) || '',
      features: Array.isArray(producto.features) ? producto.features : [],
    };
  };

  const crearTarjetaProducto = (producto) => {
    const img = crear('img', {
      clase: 'tarjeta-producto__img',
      alt: producto.nombre,
      loading: 'lazy',
      src: producto.imagen || imagenPlaceholder(),
    });
    img.addEventListener('error', function alFallar() {
      img.removeEventListener('error', alFallar);
      img.src = imagenPlaceholder();
    });

    const specs = producto.features.slice(0, 3).map((f) =>
      crear('span', { clase: 'spec-tag', texto: `${f.feature}: ${f.value}` })
    );

    return crear('article', { clase: 'tarjeta-producto', 'data-tarjeta': producto.id }, [
      crear('div', { clase: 'tarjeta-producto__img-wrap' }, [img]),
      crear('div', { clase: 'tarjeta-producto__cuerpo' }, [
        crear('h3', { clase: 'tarjeta-producto__nombre', texto: producto.nombre }),
        specs.length ? crear('div', { clase: 'tarjeta-producto__specs' }, specs) : null,
        crear('div', { clase: 'tarjeta-producto__pie' }, [
          crear('span', { clase: 'tarjeta-producto__precio', texto: formatearPrecio(producto.precio) }),
          crear('button', {
            type: 'button',
            clase: 'tarjeta-producto__agregar',
            'data-accion': 'incrementar',
            'data-producto': producto.id,
            texto: 'Añadir',
          }),
        ]),
      ]),
    ]);
  };

  const pintarProductos = () => {
    const grid = document.querySelector('[data-grid-productos]');
    const vacio = document.querySelector('[data-productos-vacio]');
    if (!grid) return;

    const q = normalizarTexto(filtroTexto);
    const visibles = productos.filter((p) => {
      const coincideTexto = !q || normalizarTexto(p.nombre).includes(q);
      const coincideCategoria = !filtroCategoria || p.categoriaSlug === filtroCategoria;
      return coincideTexto && coincideCategoria;
    });

    grid.textContent = '';
    const fragmento = document.createDocumentFragment();
    visibles.forEach((p) => fragmento.appendChild(crearTarjetaProducto(p)));
    grid.appendChild(fragmento);
    if (vacio) vacio.hidden = visibles.length > 0;
  };

  const conectarBuscador = () => {
    const campo = document.querySelector('[data-buscador-campo]');
    if (!campo) return;
    campo.addEventListener('input', retrasar(() => {
      filtroTexto = campo.value;
      pintarProductos();
    }, 200));
  };

  /* --- Arranque ------------------------------------------------------------------ */

  const ocultarSplash = () => {
    const splash = document.querySelector('[data-splash]');
    if (splash) splash.classList.add('is-oculto');
  };

  const SPLASH_TIMEOUT_MS = 3000;

  const iniciar = async () => {
    const seguridad = setTimeout(ocultarSplash, SPLASH_TIMEOUT_MS);

    const [branding, categorias, site, productosApi] = await Promise.all([
      obtenerJson('/api/store/branding'),
      obtenerJson('/api/store/categories'),
      obtenerJson('/api/store/site'),
      obtenerJson('/api/store/products'),
    ]);

    aplicarBranding(branding);
    aplicarCategorias(categorias);
    aplicarCarouselCategorias(categorias);

    const secciones = (site && site.sections) || [];
    const porTipo = new Map(secciones.map((s) => [s.type, s.content]));
    aplicarHero(porTipo.get('HERO'), branding && branding.bannerUrl);
    aplicarProductosEncabezado(porTipo.get('FEATURED_PRODUCTS'));
    aplicarFooter(porTipo.get('CONTACT_FOOTER'));

    productos = Array.isArray(productosApi) ? productosApi.map(mapearProducto) : [];
    indiceProductos = new Map(productos.map((p) => [p.id, p]));
    RG.carrito.sincronizarCon(productos.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio })));
    pintarProductos();
    conectarBuscador();

    clearTimeout(seguridad);
    ocultarSplash();
  };

  return { productoPorId, iniciar };
})();

RG.utils.alCargarDom(() => {
  RG.carritoUI.iniciar();
  RG.tienda.iniciar();
});
