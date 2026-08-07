/**
 * RootGarden · app.js
 * Arranque de la aplicación y comportamientos compartidos por todas las páginas:
 * header, menú móvil, buscador del header, scroll suave y animaciones de entrada.
 */
window.RG = window.RG || {};

RG.app = (function () {
  'use strict';

  const PAGINAS_CON_BUSQUEDA_VIVA = ['catalogo', 'tienda'];
  const DESPLAZAMIENTO_HEADER = 24;

  const paginaActual = () => document.body.dataset.pagina || '';

  /* --- Header -------------------------------------------------------------- */

  const iniciarHeader = () => {
    const header = document.querySelector('[data-header]');
    if (!header) return;

    const actualizar = () => {
      header.classList.toggle('is-desplazado', window.scrollY > DESPLAZAMIENTO_HEADER);
    };

    actualizar();
    window.addEventListener('scroll', actualizar, { passive: true });
  };

  const iniciarMenu = () => {
    const boton = document.querySelector('[data-menu-boton]');
    const panel = document.querySelector('[data-menu-panel]');
    if (!boton || !panel) return;

    const cerrar = () => {
      panel.classList.remove('is-abierto');
      boton.setAttribute('aria-expanded', 'false');
    };

    boton.addEventListener('click', () => {
      const abierto = panel.classList.toggle('is-abierto');
      boton.setAttribute('aria-expanded', String(abierto));
    });

    panel.querySelectorAll('a').forEach((enlace) => enlace.addEventListener('click', cerrar));

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') cerrar();
    });

    document.addEventListener('click', (evento) => {
      if (panel.contains(evento.target) || boton.contains(evento.target)) return;
      cerrar();
    });
  };

  /** Marca en el menú el enlace de la página que se está viendo. */
  const marcarEnlaceActivo = () => {
    const pagina = paginaActual();
    document.querySelectorAll('[data-nav-enlace]').forEach((enlace) => {
      const activo = enlace.dataset.navEnlace === pagina;
      enlace.classList.toggle('is-activo', activo);
      if (activo) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    });
  };

  /* --- Buscador del header ------------------------------------------------- */

  /**
   * En catálogo y tienda el campo filtra en vivo (lo conecta catalogo.js).
   * En el resto de las páginas, enviar el formulario lleva al catálogo completo.
   */
  const iniciarBusquedaGlobal = () => {
    const formulario = document.querySelector('[data-buscador-form]');
    const campo = document.querySelector('[data-buscador-campo]');
    if (!formulario || !campo) return;

    const busquedaViva = PAGINAS_CON_BUSQUEDA_VIVA.includes(paginaActual());
    const limpiar = document.querySelector('[data-buscador-limpiar]');

    const consultaInicial = new URLSearchParams(window.location.search).get('q');
    if (consultaInicial) campo.value = consultaInicial;

    // En páginas sin filtrado en vivo, buscador.js no está conectado: el botón
    // de limpiar se administra aquí para que el campo se comporte igual.
    if (!busquedaViva && limpiar) {
      limpiar.hidden = !campo.value;
      campo.addEventListener('input', () => {
        limpiar.hidden = !campo.value;
      });
      limpiar.addEventListener('click', () => {
        campo.value = '';
        limpiar.hidden = true;
        campo.focus();
      });
    }

    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      if (busquedaViva) {
        campo.blur();
        return;
      }
      const consulta = campo.value.trim();
      window.location.href = consulta
        ? `catalogo.html?q=${encodeURIComponent(consulta)}`
        : 'catalogo.html';
    });
  };

  /* --- Scroll suave -------------------------------------------------------- */

  const iniciarAnclas = () => {
    document.addEventListener('click', (evento) => {
      const enlace = evento.target.closest('a[href^="#"]');
      if (!enlace) return;

      const destino = enlace.getAttribute('href');
      if (!destino || destino === '#') return;

      const nodo = document.querySelector(destino);
      if (!nodo) return;

      evento.preventDefault();
      RG.utils.desplazarHacia(nodo);
      history.replaceState(null, '', destino);
    });
  };

  /* --- Animaciones de entrada ---------------------------------------------- */

  let observador = null;

  const crearObservador = () => {
    if (!('IntersectionObserver' in window)) return null;
    return new IntersectionObserver(
      (entradas, instancia) => {
        entradas.forEach((entrada) => {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add('is-visible');
          instancia.unobserve(entrada.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
    );
  };

  /** Registra elementos nuevos (por ejemplo, tarjetas recién pintadas). */
  const revelar = (nodos) => {
    const lista = Array.from(nodos || document.querySelectorAll('.revelar'));
    if (!lista.length) return;

    if (!observador || RG.utils.prefiereMenosMovimiento()) {
      lista.forEach((nodo) => nodo.classList.add('is-visible'));
      return;
    }
    lista.forEach((nodo, posicion) => {
      // Escalona la aparición dentro de cada tanda, sin retrasos perceptibles.
      nodo.style.setProperty('--retraso-revelado', `${Math.min(posicion, 11) * 45}ms`);
      observador.observe(nodo);
    });
  };

  const iniciarAnimaciones = () => {
    observador = crearObservador();
    revelar();
    document.addEventListener('rg:catalogo-renderizado', (evento) => revelar(evento.detail.nodos));
  };

  /* --- Varios -------------------------------------------------------------- */

  const escribirAnio = () => {
    document.querySelectorAll('[data-anio]').forEach((nodo) => {
      nodo.textContent = String(new Date().getFullYear());
    });
  };

  /* --- Arranque ------------------------------------------------------------ */

  const CONFIGURACION_CATALOGO = {
    // En la portada el campo del header no filtra: lleva al catálogo completo.
    inicio: { soloDestacados: true, conCantidad: false, campoBusqueda: null, filtros: null },
    catalogo: { conCantidad: false },
    tienda: { conCantidad: true }
  };

  const iniciar = () => {
    iniciarHeader();
    iniciarMenu();
    marcarEnlaceActivo();
    iniciarBusquedaGlobal();
    iniciarAnclas();
    iniciarAnimaciones();
    escribirAnio();
    RG.carritoUI.iniciar();

    const configuracion = CONFIGURACION_CATALOGO[paginaActual()];
    if (configuracion) RG.catalogo.montar(configuracion);
  };

  return { iniciar, revelar };
})();

RG.utils.alCargarDom(RG.app.iniciar);
