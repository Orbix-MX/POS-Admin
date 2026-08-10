/**
 * Manzanitas · buscador.js
 * Filtrado instantáneo por nombre comercial, nombre científico y categoría.
 */
window.RG = window.RG || {};

RG.buscador = (function () {
  'use strict';

  const TODAS = 'todas';

  /** Coincide si cada palabra escrita aparece en el nombre o en el científico. */
  const coincideTexto = (producto, terminos) => {
    if (!terminos.length) return true;
    const objetivo = RG.utils.normalizarTexto(`${producto.nombre} ${producto.cientifico}`);
    return terminos.every((termino) => objetivo.includes(termino));
  };

  const coincideCategoria = (producto, categoria) =>
    categoria === TODAS || producto.categoria === categoria;

  const filtrar = (productos, consulta, categoria) => {
    const terminos = RG.utils.normalizarTexto(consulta).split(/\s+/).filter(Boolean);
    return productos.filter(
      (producto) => coincideCategoria(producto, categoria) && coincideTexto(producto, terminos)
    );
  };

  /**
   * Conecta un campo de búsqueda y un grupo de filtros a un catálogo.
   *
   * @param {object} opciones
   * @param {HTMLInputElement} opciones.campo   Campo de texto.
   * @param {HTMLElement} [opciones.chips]      Contenedor de botones de categoría.
   * @param {HTMLElement} [opciones.limpiar]    Botón para vaciar la búsqueda.
   * @param {Function} opciones.fuente          Devuelve el catálogo completo.
   * @param {Function} opciones.alFiltrar       Recibe (resultados, contexto).
   * @param {string} [opciones.categoriaInicial] Categoría preseleccionada.
   */
  const crear = ({ campo, chips, limpiar, fuente, alFiltrar, categoriaInicial }) => {
    let categoriaActiva = TODAS;

    const aplicar = () => {
      const consulta = campo ? campo.value : '';
      const productos = fuente() || [];
      const resultados = filtrar(productos, consulta, categoriaActiva);

      if (limpiar) limpiar.hidden = !consulta;
      alFiltrar(resultados, { consulta, categoria: categoriaActiva, total: productos.length });
    };

    const activarChip = (boton) => {
      if (!chips) return;
      chips.querySelectorAll('[data-categoria]').forEach((otro) => {
        const activo = otro === boton;
        otro.classList.toggle('is-activo', activo);
        otro.setAttribute('aria-pressed', String(activo));
      });
    };

    if (campo) {
      campo.addEventListener('input', RG.utils.retrasar(aplicar, 120));
      campo.addEventListener('search', aplicar);
      campo.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Escape' || !campo.value) return;
        campo.value = '';
        aplicar();
      });
    }

    if (limpiar) {
      limpiar.addEventListener('click', () => {
        if (!campo) return;
        campo.value = '';
        campo.focus();
        aplicar();
      });
    }

    if (chips) {
      chips.addEventListener('click', (evento) => {
        const boton = evento.target.closest('[data-categoria]');
        if (!boton) return;
        categoriaActiva = boton.dataset.categoria;
        activarChip(boton);
        aplicar();
      });

      // Categoría preseleccionada (por ejemplo, catalogo.html?categoria=raices).
      const inicial = chips.querySelector(`[data-categoria="${categoriaInicial || ''}"]`);
      if (inicial) {
        categoriaActiva = inicial.dataset.categoria;
        activarChip(inicial);
      }
    }

    return { aplicar };
  };

  return { TODAS, filtrar, crear };
})();
