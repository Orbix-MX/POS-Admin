/**
 * Aplica en tiempo de ejecución el branding del tenant (nombre de negocio,
 * colores, logo y banner) obtenido de `GET /api/store/branding` — la API
 * resuelve el tenant por el Origin de esta página (ver Domain /
 * StoreDomainGuard en el backend), así que este script no necesita saber su
 * propio tenantId ni tener nada del negocio escrito en el código: todo el
 * HTML estático usa placeholders genéricos ("Tu Tienda", el emblema
 * ilustrado de assets/logo-mark.png) que este script reemplaza por lo real
 * que viene de la base de datos. Si la petición falla o el tenant no subió
 * logo/banner propios, la página se queda con esos placeholders en vez de
 * inventar algo.
 */
(function () {
  'use strict';

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

  const aplicarColores = (primario, secundario) => {
    if (!primario || !hexToRgb(primario)) return;
    const root = document.documentElement.style;
    root.setProperty('--verde-700', primario);
    root.setProperty('--verde-900', oscurecer(primario, 25));
    root.setProperty('--verde-500', secundario && hexToRgb(secundario) ? secundario : aclarar(primario, 20));
    root.setProperty('--verde-200', aclarar(primario, 58));
    root.setProperty('--verde-050', aclarar(primario, 75));
  };

  // Plantilla del <title>/og:title/twitter:title por página (body[data-pagina]
  // en Base.astro). El HTML estático no lleva el nombre del negocio — solo
  // esta plantilla lo combina, una vez que se sabe cuál es.
  const PLANTILLAS_TITULO = {
    inicio: (nombre) => `${nombre} · Naturaleza para tu acuario`,
    catalogo: (nombre) => `Catálogo · ${nombre}`,
    tienda: (nombre) => `Tienda · ${nombre}`,
    error: (nombre) => `Página no encontrada · ${nombre}`,
  };

  const aplicarTitulo = (nombre) => {
    const pagina = document.body && document.body.dataset.pagina;
    const plantilla = PLANTILLAS_TITULO[pagina];
    if (!plantilla) return;

    const titulo = plantilla(nombre);
    document.querySelectorAll('[data-marca-titulo]').forEach((el) => {
      // Astro serializa el booleano de Base.astro como el string "false" en
      // vez de omitir el atributo — hay que revisar el valor, no solo la
      // presencia. "false" = esta página ya resolvió su título server-side
      // con contenido real del tenant (ej. su HERO); no pisarlo.
      if (el.getAttribute('data-marca-titulo') === 'false') return;
      if (el.tagName === 'TITLE') el.textContent = titulo;
      else el.setAttribute('content', titulo);
    });
  };

  const aplicarNombre = (nombre) => {
    if (!nombre) return;

    // Guarda el nombre resuelto para que otros scripts (ej. whatsapp.js) lo
    // usen sin tener que volver a pedirlo.
    window.RG_CONFIG = window.RG_CONFIG || {};
    window.RG_CONFIG.tenantName = nombre;

    document.querySelectorAll('[data-marca-texto]').forEach((el) => {
      const prefijo = el.getAttribute('data-marca-prefijo') || '';
      const sufijo = el.getAttribute('data-marca-sufijo') || '';
      el.textContent = `${prefijo}${nombre}${sufijo}`;
    });

    document.querySelectorAll('[data-marca-attr]').forEach((el) => {
      const attr = el.getAttribute('data-marca-attr');
      const prefijo = el.getAttribute('data-marca-prefijo') || '';
      const sufijo = el.getAttribute('data-marca-sufijo') || '';
      el.setAttribute(attr, `${prefijo}${nombre}${sufijo}`);
    });

    aplicarTitulo(nombre);
  };

  // Logo/banner reales del tenant, subidos desde Configuración en el ERP
  // (tenants.current.logo / .banner). Si el tenant no subió los suyos, se
  // deja el emblema/imagen de fondo genérico del HTML.
  const aplicarLogo = (logoUrl) => {
    if (!logoUrl) return;
    document.querySelectorAll('[data-marca-logo]').forEach((el) => {
      el.src = logoUrl;
    });
  };

  const aplicarBanner = (bannerUrl) => {
    if (!bannerUrl) return;
    document.querySelectorAll('[data-marca-banner]').forEach((el) => {
      el.style.backgroundImage = `url("${bannerUrl}")`;
    });
  };

  const ocultarSplash = () => {
    const splash = document.querySelector('[data-splash]');
    if (splash) splash.classList.add('is-oculto');
  };

  // Tope de seguridad: si la API tarda o no responde, no se deja al visitante
  // viendo el splash indefinidamente — se revela la página con los
  // placeholders genéricos, igual que si el tenant no tuviera branding.
  const SPLASH_TIMEOUT_MS = 2500;

  async function cargarBranding() {
    const config = window.RG_CONFIG || {};
    const seguridad = setTimeout(ocultarSplash, SPLASH_TIMEOUT_MS);

    if (!config.apiUrl) {
      clearTimeout(seguridad);
      ocultarSplash();
      return;
    }

    try {
      const res = await fetch(`${config.apiUrl}/api/store/branding`);
      if (res.ok) {
        const data = await res.json();
        aplicarColores(data.primaryColor, data.secondaryColor);
        aplicarNombre(data.name);
        aplicarLogo(data.logoUrl);
        aplicarBanner(data.bannerUrl);
      }
    } catch {
      // Sin conexión o tenant sin branding configurado: se conservan los
      // placeholders genéricos del HTML en vez de asumir un nombre.
    } finally {
      clearTimeout(seguridad);
      ocultarSplash();
    }
  }

  cargarBranding();
})();
