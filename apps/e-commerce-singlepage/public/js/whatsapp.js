/**
 * whatsapp.js
 * Construcción del pedido que se envía por WhatsApp.
 *
 * El número de destino NUNCA está hardcodeado — lo trae la sección
 * CONTACT_FOOTER del tenant (ver tienda.js) y se pasa como parámetro.
 */
window.RG = window.RG || {};

RG.whatsapp = (function () {
  'use strict';

  const SEPARADOR = '────────────────';

  const bloqueDeLinea = (linea) => {
    const { formatearPrecio } = RG.utils;
    const unitario =
      linea.cantidad > 1
        ? `${formatearPrecio(linea.precio)} c/u`
        : formatearPrecio(linea.precio);

    return [
      `${linea.nombre} ×${linea.cantidad}`,
      unitario,
      `Subtotal: ${formatearPrecio(linea.precio * linea.cantidad)}`
    ].join('\n');
  };

  /**
   * @param {Array<{nombre:string,precio:number,cantidad:number}>} lineas
   * @param {{articulos:number, subtotal:number}} totales
   * @param {string|null} [folio] Folio del pedido ya registrado (ver store-orders.js)
   */
  const construirMensaje = (lineas, totales, folio) => {
    const { formatearPrecio } = RG.utils;
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

  const construirEnlace = (numero, lineas, totales, folio) =>
    `https://wa.me/${numero}?text=${encodeURIComponent(construirMensaje(lineas, totales, folio))}`;

  /**
   * Abre WhatsApp en una pestaña nueva con el pedido precargado.
   * @param {string} numero Número de WhatsApp del tenant (sin +, con lada)
   */
  const enviarPedido = (numero, lineas, totales, folio) => {
    if (!lineas.length || !numero) return false;
    window.open(construirEnlace(numero, lineas, totales, folio), '_blank', 'noopener,noreferrer');
    return true;
  };

  return { construirMensaje, construirEnlace, enviarPedido };
})();
