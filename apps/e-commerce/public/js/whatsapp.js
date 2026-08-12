/**
 * whatsapp.js
 * Construcción del pedido que se envía por WhatsApp.
 *
 * El mensaje se arma como texto plano y se codifica con encodeURIComponent
 * antes de adjuntarlo al enlace wa.me.
 */
window.RG = window.RG || {};

RG.whatsapp = (function () {
  'use strict';

  const NUMERO = '526562016886';
  const SEPARADOR = '────────────────';

  /** Icono por categoría para que el pedido se lea de un vistazo. */
  const EMOJIS = {
    plantas: '🌿',
    raices: '🪵',
    hardscape: '🪨'
  };

  const emojiDe = (categoria) => EMOJIS[categoria] || EMOJIS.plantas;

  /** Bloque de texto de una línea del pedido. */
  const bloqueDeLinea = (linea) => {
    const { formatearPrecio } = RG.utils;
    const unitario =
      linea.cantidad > 1
        ? `${formatearPrecio(linea.precio)} c/u`
        : formatearPrecio(linea.precio);

    return [
      `${emojiDe(linea.categoria)} ${linea.nombre} ×${linea.cantidad}`,
      unitario,
      `Subtotal: ${formatearPrecio(linea.precio * linea.cantidad)}`
    ].join('\n');
  };

  /**
   * Devuelve el mensaje completo, ya listo para enviarse.
   * @param {Array<{nombre:string,categoria:string,precio:number,cantidad:number}>} lineas
   * @param {{articulos:number, subtotal:number}} totales
   * @param {string|null} [folio] Folio del pedido ya registrado (ver store-orders.js)
   */
  const construirMensaje = (lineas, totales, folio) => {
    const { formatearPrecio } = RG.utils;
    // Nombre del negocio resuelto en runtime desde la base de datos (ver
    // branding.js) — si aún no cargó, se omite en vez de asumir una marca.
    const nombreNegocio = (window.RG_CONFIG && window.RG_CONFIG.tenantName) || '';

    return [
      'Hola, buen día. 😊',
      '',
      nombreNegocio
        ? `Me interesa realizar el siguiente pedido de ${nombreNegocio}.`
        : 'Me interesa realizar el siguiente pedido.',
      ...(folio ? [`Folio: ${folio}`] : []),
      '',
      lineas.map(bloqueDeLinea).join('\n\n'),
      '',
      SEPARADOR,
      '',
      `Artículos: ${totales.articulos}`,
      `Subtotal: ${formatearPrecio(totales.subtotal)}`,
      '',
      'Quedo atento(a) a su confirmación de disponibilidad.',
      'Muchas gracias.'
    ].join('\n');
  };

  const construirEnlace = (lineas, totales, folio) =>
    `https://wa.me/${NUMERO}?text=${encodeURIComponent(construirMensaje(lineas, totales, folio))}`;

  /**
   * Abre WhatsApp en una pestaña nueva con el pedido precargado.
   * @param {string|null} [folio] Folio del pedido, si ya se registró (ver store-orders.js)
   */
  const enviarPedido = (lineas, totales, folio) => {
    if (!lineas.length) return false;
    window.open(construirEnlace(lineas, totales, folio), '_blank', 'noopener,noreferrer');
    return true;
  };

  return { NUMERO, EMOJIS, emojiDe, construirMensaje, construirEnlace, enviarPedido };
})();
