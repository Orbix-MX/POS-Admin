/**
 * store-orders.js
 * Registra en el backend el pedido que se envía por WhatsApp (sin pago en
 * línea todavía) — ver StoreOrdersService. Si el registro falla (sin
 * conexión, etc.) no bloquea al cliente: el pedido se sigue enviando por
 * WhatsApp, solo sin folio de referencia.
 */
window.RG = window.RG || {};

RG.storeOrders = (function () {
  'use strict';

  const TELEFONO_REGEX = /^\d{10,15}$/;

  // El cliente puede escribir el teléfono con espacios, guiones, paréntesis o
  // el "+52" del país — se valida y se envía solo con los dígitos.
  const limpiarTelefono = (telefono) => String(telefono || '').replace(/\D/g, '');

  const esTelefonoValido = (telefono) => TELEFONO_REGEX.test(limpiarTelefono(telefono));

  /**
   * @param {string} telefono
   * @param {Array<{id:string,nombre:string,precio:number,cantidad:number}>} lineas
   * @returns {Promise<string|null>} folio del pedido, o null si no se pudo registrar
   */
  const registrarPedido = async (telefono, lineas) => {
    const config = window.RG_CONFIG || {};
    if (!config.apiUrl) return null;

    try {
      const res = await fetch(`${config.apiUrl}/api/store/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: limpiarTelefono(telefono),
          items: lineas.map((linea) => ({
            productId: linea.id,
            name: linea.nombre,
            price: linea.precio,
            quantity: linea.cantidad,
          })),
        }),
      });
      if (!res.ok) {
        console.warn('No se pudo registrar el pedido:', res.status, await res.text().catch(() => ''));
        return null;
      }
      const data = await res.json();
      return data.orderNumber || null;
    } catch (err) {
      console.warn('No se pudo registrar el pedido:', err);
      return null;
    }
  };

  return { limpiarTelefono, esTelefonoValido, registrarPedido };
})();
