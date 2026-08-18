/**
 * utils.js
 * Utilidades compartidas por el template.
 */
window.RG = window.RG || {};

RG.utils = (function () {
  'use strict';

  const formateadorMoneda = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const formatearPrecio = (valor) => formateadorMoneda.format(Number(valor) || 0);

  const normalizarTexto = (texto) =>
    String(texto || '')
      .normalize('NFD')
      .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
      .toLowerCase()
      .trim();

  const escaparHtml = (texto) =>
    String(texto == null ? '' : texto).replace(/[&<>"']/g, (caracter) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[caracter]));

  const retrasar = (fn, espera = 180) => {
    let temporizador = null;
    return function (...args) {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => fn.apply(this, args), espera);
    };
  };

  const limitar = (valor, minimo, maximo) => Math.min(Math.max(valor, minimo), maximo);

  /** Crea un elemento con atributos y contenido en una sola expresión. */
  const crear = (etiqueta, atributos = {}, hijos = []) => {
    const nodo = document.createElement(etiqueta);
    Object.entries(atributos).forEach(([clave, valor]) => {
      if (valor === null || valor === undefined || valor === false) return;
      if (clave === 'clase') nodo.className = valor;
      else if (clave === 'texto') nodo.textContent = valor;
      else if (clave === 'html') nodo.innerHTML = valor;
      else if (clave.startsWith('on') && typeof valor === 'function') {
        nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
      } else nodo.setAttribute(clave, valor);
    });
    (Array.isArray(hijos) ? hijos : [hijos]).forEach((hijo) => {
      if (hijo) nodo.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
    });
    return nodo;
  };

  const prefiereMenosMovimiento = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const alturaHeader = () => {
    const header = document.querySelector('[data-header]');
    return header ? header.offsetHeight : 0;
  };

  const desplazarHacia = (destino) => {
    const nodo = typeof destino === 'string' ? document.querySelector(destino) : destino;
    if (!nodo) return;
    const y = nodo.getBoundingClientRect().top + window.pageYOffset - alturaHeader() - 12;
    window.scrollTo({
      top: Math.max(0, y),
      behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth'
    });
  };

  /** Placeholder genérico (sin nada del rubro de ningún tenant en particular). */
  const imagenPlaceholder = () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">' +
      '<rect width="400" height="300" fill="#eef1f5"/>' +
      '<circle cx="200" cy="140" r="46" fill="#d7dde6"/>' +
      '<rect x="130" y="196" width="140" height="14" rx="7" fill="#d7dde6"/>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  const alCargarDom = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else fn();
  };

  return {
    formatearPrecio,
    normalizarTexto,
    escaparHtml,
    retrasar,
    limitar,
    crear,
    prefiereMenosMovimiento,
    alturaHeader,
    desplazarHacia,
    imagenPlaceholder,
    alCargarDom
  };
})();
