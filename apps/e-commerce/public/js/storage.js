/**
 * Manzanitas · storage.js
 * Capa de persistencia sobre localStorage.
 *
 * Aísla al resto de la aplicación de dos problemas: el prefijo de claves y los
 * navegadores que lanzan excepción al escribir (modo privado, cuota llena o
 * cookies bloqueadas). Si localStorage no está disponible se degrada a memoria,
 * de modo que la tienda sigue funcionando durante la sesión.
 */
window.RG = window.RG || {};

RG.storage = (function () {
  'use strict';

  const PREFIJO = 'rootgarden:';
  const respaldoEnMemoria = new Map();

  const almacenDisponible = (() => {
    try {
      const prueba = PREFIJO + '__test__';
      window.localStorage.setItem(prueba, '1');
      window.localStorage.removeItem(prueba);
      return true;
    } catch (error) {
      return false;
    }
  })();

  const clave = (nombre) => PREFIJO + nombre;

  /** Lee y deserializa un valor. Devuelve `valorPorDefecto` si no existe o está corrupto. */
  const leer = (nombre, valorPorDefecto = null) => {
    try {
      const bruto = almacenDisponible
        ? window.localStorage.getItem(clave(nombre))
        : respaldoEnMemoria.get(clave(nombre));
      if (bruto === null || bruto === undefined) return valorPorDefecto;
      return JSON.parse(bruto);
    } catch (error) {
      return valorPorDefecto;
    }
  };

  /** Serializa y guarda un valor. Devuelve `true` si se persistió correctamente. */
  const escribir = (nombre, valor) => {
    const bruto = JSON.stringify(valor);
    try {
      if (almacenDisponible) window.localStorage.setItem(clave(nombre), bruto);
      else respaldoEnMemoria.set(clave(nombre), bruto);
      return true;
    } catch (error) {
      respaldoEnMemoria.set(clave(nombre), bruto);
      return false;
    }
  };

  const eliminar = (nombre) => {
    try {
      if (almacenDisponible) window.localStorage.removeItem(clave(nombre));
    } catch (error) {
      /* sin acción: el respaldo en memoria se limpia igualmente */
    }
    respaldoEnMemoria.delete(clave(nombre));
  };

  return { leer, escribir, eliminar, persistente: almacenDisponible };
})();
