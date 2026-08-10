/**
 * Aplica en tiempo de ejecución el branding del tenant (nombre y colores)
 * obtenido de `GET /api/store/branding` — la API resuelve el tenant por el
 * Origin de esta página (ver Domain / StoreDomainGuard en el backend), así
 * que este script no necesita saber su propio tenantId. Si la petición falla
 * o el tenant no configuró nada, la página conserva el branding estático por
 * defecto (Manzanitas / verde) definido en styles.css.
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

  const aplicarNombre = (nombre) => {
    if (!nombre) return;
    document.querySelectorAll('[data-marca-texto]').forEach((el) => {
      el.textContent = nombre;
    });
    document.querySelectorAll('[data-marca-aria]').forEach((el) => {
      el.setAttribute('aria-label', `${nombre}, inicio`);
    });
    if (document.title.includes('Manzanitas')) {
      document.title = document.title.replace(/Manzanitas/g, nombre);
    }
  };

  async function cargarBranding() {
    const config = window.RG_CONFIG || {};
    if (!config.apiUrl) return;

    try {
      const res = await fetch(`${config.apiUrl}/api/store/branding`);
      if (!res.ok) return;
      const data = await res.json();
      aplicarColores(data.primaryColor, data.secondaryColor);
      aplicarNombre(data.name);
    } catch {
      // Sin conexión o tenant sin branding configurado: se conserva el default.
    }
  }

  cargarBranding();
})();
