/**
 * utils.js
 * Utilidades compartidas por todas las páginas.
 *
 * Los archivos JS se cargan como scripts clásicos (no `type="module"`) porque
 * los navegadores bloquean los módulos ES bajo el protocolo file://, y el
 * requisito del proyecto es que index.html funcione con doble clic. La
 * modularidad se mantiene con un espacio de nombres único (`RG`) y un IIFE por
 * archivo, sin variables globales sueltas.
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

  /** Formatea un número como precio en pesos mexicanos: 44.5 → "$44.50". */
  const formatearPrecio = (valor) => formateadorMoneda.format(Number(valor) || 0);

  /** Quita acentos y pasa a minúsculas para comparar texto sin fallos. */
  const normalizarTexto = (texto) =>
    String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  /** Escapa caracteres que romperían el HTML al interpolar datos externos. */
  const escaparHtml = (texto) =>
    String(texto == null ? '' : texto).replace(/[&<>"']/g, (caracter) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[caracter]));

  /** Agrupa llamadas seguidas y ejecuta solo la última tras `espera` ms. */
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

  /** Altura real del header fijo, para no tapar el destino al hacer scroll. */
  const alturaHeader = () => {
    const header = document.querySelector('[data-header]');
    return header ? header.offsetHeight : 0;
  };

  /** Desplazamiento suave hacia un elemento, compensando el header fijo. */
  const desplazarHacia = (destino) => {
    const nodo = typeof destino === 'string' ? document.querySelector(destino) : destino;
    if (!nodo) return;
    const y = nodo.getBoundingClientRect().top + window.pageYOffset - alturaHeader() + 1;
    window.scrollTo({
      top: Math.max(0, y),
      behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth'
    });
  };

  const GLIFOS = {
    plantas:
      '<path d="M50 92C22 72 16 38 50 8c34 30 28 64 0 84Z" fill="currentColor" opacity=".22"/>' +
      '<path d="M50 90V20" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".4"/>' +
      '<path d="M50 44 30 30M50 60 28 50M50 44l20-14M50 60l22-10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".35" fill="none"/>',
    raices:
      '<g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" opacity=".38">' +
      '<path d="M50 94V56"/><path d="M50 56 28 30"/><path d="M50 56 74 28"/>' +
      '<path d="M28 30 16 14"/><path d="M28 30 34 12"/><path d="M74 28 86 13"/><path d="M74 28 68 11"/>' +
      '<path d="M50 70 34 60"/><path d="M50 70 68 62"/></g>',
    hardscape:
      '<path d="M10 82 30 38 54 26 74 44 90 82Z" fill="currentColor" opacity=".22"/>' +
      '<path d="M30 38 54 26 48 58Z" fill="currentColor" opacity=".16"/>' +
      '<path d="M10 82 30 38 54 26 74 44 90 82Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" opacity=".35"/>'
  };

  /**
   * Genera un marcador de posición SVG con la identidad de la marca.
   * Se usa cuando la fotografía del producto todavía no existe.
   */
  const imagenPlaceholder = (categoria = 'plantas') => {
    const glifo = GLIFOS[categoria] || GLIFOS.plantas;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#F1F8F2"/><stop offset="1" stop-color="#C9E7CC"/>' +
      '</linearGradient></defs>' +
      '<rect width="400" height="300" fill="url(#g)"/>' +
      '<circle cx="330" cy="58" r="86" fill="#A5D6A7" opacity=".28"/>' +
      '<circle cx="58" cy="252" r="70" fill="#66BB6A" opacity=".18"/>' +
      '<g transform="translate(110 60) scale(1.8)" color="#1B5E20">' + glifo + '</g>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  /** Ejecuta `fn` cuando el DOM está listo, sin importar cuándo se llame. */
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
