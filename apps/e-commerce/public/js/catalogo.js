/**
 * catalogo.js
 * Carga del catálogo desde la API de Orbix y construcción de las tarjetas de
 * producto.
 *
 * Las tarjetas son idénticas en el catálogo y en la tienda; lo único que cambia
 * es si se dibuja o no el control de cantidad. Así no existe markup duplicado.
 */
window.RG = window.RG || {};

RG.catalogo = (function () {
  'use strict';

  const TARJETAS_ESQUELETO = 8;

  const ETIQUETAS_CATEGORIA = {
    plantas: 'Planta acuática',
    raices: 'Raíz de manzanita',
    hardscape: 'Hardscape'
  };

  // El modelo Product de la API no tiene un campo "destacado": se decide aquí,
  // en el cliente, con la misma selección que tenía data/plantas.json en
  // Manzanitas. Coincide con el campo `slug` que devuelve /api/store/products.
  const DESTACADOS = new Set([
    'espada',
    'red-flame',
    'alternanthera-rosefolia',
    'lobelia-mini',
    'cryptocoryne',
    'cuba',
    'glossostigma',
    'monte-carlo',
    'hydrocotyle',
    'ruby',
    'helecho-de-sumatra',
    'bulbo-nymphaea-blushing'
  ]);

  let catalogo = [];
  let indice = new Map();
  let promesaCarga = null;

  /* --- Datos --------------------------------------------------------------- */

  const rutaProductos = () => {
    const config = window.RG_CONFIG || {};
    if (!config.apiUrl) return null;
    // Sin tenantId: la API resuelve el tenant por el Origin de esta página.
    return `${config.apiUrl}/api/store/products`;
  };

  /**
   * El `description` de la API guarda, en ese orden y separados por línea en
   * blanco, el nombre científico, la descripción comercial y una línea
   * "Dificultad: X · Luz: Y" — así lo escribe prisma/seed-manzanitas.ts. Este
   * parseo positional depende de ese formato exacto.
   */
  const parsearDescripcionApi = (descripcion) => {
    const partes = String(descripcion || '')
      .split('\n\n')
      .map((parte) => parte.trim())
      .filter(Boolean);

    const meta = partes[2] || '';
    const dificultad = meta.match(/Dificultad:\s*([^·]+)/i);
    const luz = meta.match(/Luz:\s*(.+)/i);

    return {
      cientifico: partes[0] || '',
      descripcion: partes[1] || '',
      dificultad: dificultad ? dificultad[1].trim() : '—',
      luz: luz ? luz[1].trim() : '—'
    };
  };

  /** Traduce la forma del producto de la API a la que espera el resto del módulo. */
  const mapearProductoApi = (producto) => {
    const { cientifico, descripcion, dificultad, luz } = parsearDescripcionApi(producto.description);
    const imagenes = Array.isArray(producto.images) ? producto.images : [];
    const imagenPrincipal = imagenes.find((imagen) => imagen.isPrimary) || imagenes[0];

    return {
      id: producto.slug || producto.id,
      nombre: producto.name,
      cientifico,
      categoria: (producto.category && producto.category.slug) || 'plantas',
      descripcion,
      dificultad,
      luz,
      precio: Number(producto.price) || 0,
      imagen: imagenPrincipal ? imagenPrincipal.url : '',
      destacado: DESTACADOS.has(producto.slug)
    };
  };

  /** Rellena valores faltantes para que el pintado nunca reciba `undefined`. */
  const normalizar = (producto, posicion) => ({
    id: String(producto.id || `producto-${posicion}`),
    nombre: String(producto.nombre || 'Producto sin nombre'),
    cientifico: String(producto.cientifico || ''),
    categoria: ETIQUETAS_CATEGORIA[producto.categoria] ? producto.categoria : 'plantas',
    descripcion: String(producto.descripcion || ''),
    dificultad: String(producto.dificultad || '—'),
    luz: String(producto.luz || '—'),
    precio: Number(producto.precio) || 0,
    imagen: String(producto.imagen || ''),
    destacado: Boolean(producto.destacado)
  });

  const indexar = (productos) => {
    catalogo = productos.map(normalizar);
    indice = new Map(catalogo.map((producto) => [producto.id, producto]));
    return catalogo;
  };

  /** Obtiene el catálogo desde la API pública de Orbix (GET /api/store/products). */
  const cargar = () => {
    if (promesaCarga) return promesaCarga;

    const ruta = rutaProductos();
    if (!ruta) {
      promesaCarga = Promise.reject(
        new Error('Falta configurar window.RG_CONFIG.apiUrl')
      );
      return promesaCarga;
    }

    promesaCarga = fetch(ruta, { cache: 'no-cache' })
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        return respuesta.json();
      })
      .then((datos) => {
        if (!Array.isArray(datos)) throw new Error('El catálogo tiene un formato inesperado.');
        return indexar(datos.map(mapearProductoApi));
      });

    return promesaCarga;
  };

  const obtener = () => catalogo;
  const porId = (id) => indice.get(String(id)) || null;

  /* --- Tarjetas ------------------------------------------------------------ */

  const crearImagen = (producto) => {
    const imagen = RG.utils.crear('img', {
      clase: 'tarjeta__img',
      alt: `${producto.nombre} — ${producto.cientifico}`,
      loading: 'lazy',
      decoding: 'async',
      width: '400',
      height: '300',
      src: producto.imagen || RG.utils.imagenPlaceholder(producto.categoria)
    });

    // Si la fotografía no existe todavía, se sustituye por el marcador de marca.
    imagen.addEventListener('error', function alFallar() {
      imagen.removeEventListener('error', alFallar);
      imagen.classList.add('tarjeta__img--placeholder');
      imagen.src = RG.utils.imagenPlaceholder(producto.categoria);
    });

    return imagen;
  };

  const crearContador = (producto) => {
    const { crear } = RG.utils;
    const cantidad = RG.carrito.cantidadDe(producto.id);

    return crear('div', { clase: 'contador', role: 'group', 'aria-label': `Cantidad de ${producto.nombre}` }, [
      crear('button', {
        type: 'button',
        clase: 'contador__boton',
        'data-accion': 'decrementar',
        'data-producto': producto.id,
        'aria-label': `Quitar una unidad de ${producto.nombre}`,
        disabled: cantidad === 0 ? 'disabled' : null,
        texto: '−'
      }),
      crear('span', {
        clase: 'contador__valor',
        'data-cantidad-de': producto.id,
        'aria-live': 'polite',
        texto: String(cantidad)
      }),
      crear('button', {
        type: 'button',
        clase: 'contador__boton',
        'data-accion': 'incrementar',
        'data-producto': producto.id,
        'aria-label': `Agregar una unidad de ${producto.nombre}`,
        texto: '+'
      })
    ]);
  };

  /**
   * @param {object} producto
   * @param {{conCantidad?: boolean}} [opciones]
   */
  const crearTarjeta = (producto, opciones = {}) => {
    const { crear, formatearPrecio } = RG.utils;
    const conCantidad = Boolean(opciones.conCantidad);
    const enPedido = conCantidad && RG.carrito.cantidadDe(producto.id) > 0;

    const media = crear('div', { clase: 'tarjeta__media' }, [
      crearImagen(producto),
      crear('span', { clase: 'tarjeta__etiqueta', texto: ETIQUETAS_CATEGORIA[producto.categoria] })
    ]);

    const cuerpo = crear('div', { clase: 'tarjeta__cuerpo' }, [
      crear('h3', { clase: 'tarjeta__nombre', texto: producto.nombre }),
      crear('p', { clase: 'tarjeta__cientifico', texto: producto.cientifico }),
      crear('p', { clase: 'tarjeta__descripcion', texto: producto.descripcion })
    ]);

    const pie = crear('div', { clase: 'tarjeta__pie' }, [
      crear('p', { clase: 'tarjeta__precio' }, [
        crear('span', { clase: 'tarjeta__moneda', texto: formatearPrecio(producto.precio) }),
        crear('span', { clase: 'tarjeta__moneda-nota', texto: 'MXN' })
      ]),
      conCantidad ? crearContador(producto) : null
    ]);

    return crear(
      'article',
      {
        clase: `tarjeta revelar${enPedido ? ' is-en-pedido' : ''}`,
        'data-tarjeta': producto.id,
        'data-categoria': producto.categoria
      },
      [media, cuerpo, pie]
    );
  };

  const crearEsqueleto = () =>
    RG.utils.crear('article', { clase: 'tarjeta tarjeta--esqueleto', 'aria-hidden': 'true' }, [
      RG.utils.crear('div', { clase: 'tarjeta__media esqueleto' }),
      RG.utils.crear('div', { clase: 'tarjeta__cuerpo' }, [
        RG.utils.crear('span', { clase: 'esqueleto esqueleto--titulo' }),
        RG.utils.crear('span', { clase: 'esqueleto esqueleto--linea' }),
        RG.utils.crear('span', { clase: 'esqueleto esqueleto--linea esqueleto--corta' })
      ])
    ]);

  /* --- Pintado ------------------------------------------------------------- */

  const pintarEsqueletos = (contenedor, cantidad = TARJETAS_ESQUELETO) => {
    contenedor.textContent = '';
    const fragmento = document.createDocumentFragment();
    for (let i = 0; i < cantidad; i += 1) fragmento.appendChild(crearEsqueleto());
    contenedor.appendChild(fragmento);
  };

  const renderizar = (contenedor, productos, opciones = {}) => {
    contenedor.textContent = '';
    const fragmento = document.createDocumentFragment();
    const nodos = productos.map((producto) => {
      const tarjeta = crearTarjeta(producto, opciones);
      fragmento.appendChild(tarjeta);
      return tarjeta;
    });
    contenedor.appendChild(fragmento);

    // Permite que app.js aplique la animación de entrada al contenido nuevo.
    document.dispatchEvent(new CustomEvent('rg:catalogo-renderizado', { detail: { nodos } }));
    return nodos;
  };

  /* --- Montaje ------------------------------------------------------------- */

  const textoResultados = (visibles, total, consulta) => {
    if (consulta) {
      const plural = visibles === 1 ? 'resultado' : 'resultados';
      return `${visibles} ${plural} para «${consulta}»`;
    }
    const plural = visibles === 1 ? 'producto' : 'productos';
    return visibles === total ? `${visibles} ${plural}` : `${visibles} de ${total} ${plural}`;
  };

  /**
   * Monta un catálogo completo: carga, filtros y pintado.
   * Se ignora silenciosamente si la página no tiene contenedor de catálogo.
   */
  const montar = (configuracion = {}) => {
    const opciones = Object.assign(
      {
        contenedor: '[data-catalogo]',
        campoBusqueda: '[data-buscador-campo]',
        limpiarBusqueda: '[data-buscador-limpiar]',
        filtros: '[data-buscador-filtros]',
        resultados: '[data-catalogo-resultados]',
        vacio: '[data-catalogo-vacio]',
        error: '[data-catalogo-error]',
        conCantidad: false,
        soloDestacados: false,
        limite: 0
      },
      configuracion
    );

    const contenedor = document.querySelector(opciones.contenedor);
    if (!contenedor) return Promise.resolve([]);

    const nodo = (selector) => (selector ? document.querySelector(selector) : null);
    const campo = nodo(opciones.campoBusqueda);
    const limpiar = nodo(opciones.limpiarBusqueda);
    const filtros = nodo(opciones.filtros);
    const resultados = nodo(opciones.resultados);
    const vacio = nodo(opciones.vacio);
    const error = nodo(opciones.error);

    /** Subconjunto visible en esta página (destacados y/o límite). */
    const fuente = () => {
      let productos = obtener();
      if (opciones.soloDestacados) productos = productos.filter((producto) => producto.destacado);
      if (opciones.limite > 0) productos = productos.slice(0, opciones.limite);
      return productos;
    };

    const pintar = (visibles, contexto = {}) => {
      renderizar(contenedor, visibles, { conCantidad: opciones.conCantidad });
      if (vacio) vacio.hidden = visibles.length > 0;
      if (resultados) {
        resultados.textContent = textoResultados(
          visibles.length,
          fuente().length,
          contexto.consulta || ''
        );
      }
    };

    /**
     * Deja visibles sólo los filtros que tienen productos, y esconde la barra
     * completa cuando el catálogo se reduce a una sola categoría. Evita botones
     * que llevarían a un resultado vacío.
     */
    const ajustarFiltros = (productos) => {
      if (!filtros) return new Set();
      const presentes = new Set(productos.map((producto) => producto.categoria));

      filtros.querySelectorAll('[data-categoria]').forEach((chip) => {
        const categoria = chip.dataset.categoria;
        chip.hidden = categoria !== RG.buscador.TODAS && !presentes.has(categoria);
      });
      filtros.hidden = presentes.size < 2;
      return presentes;
    };

    pintarEsqueletos(contenedor, opciones.limite || TARJETAS_ESQUELETO);

    return cargar()
      .then((productos) => {
        RG.carrito.sincronizarCon(productos);
        const presentes = ajustarFiltros(productos);

        if (campo || filtros) {
          const pedida = new URLSearchParams(window.location.search).get('categoria');
          const buscador = RG.buscador.crear({
            campo,
            chips: filtros,
            limpiar,
            fuente,
            alFiltrar: pintar,
            categoriaInicial: presentes.has(pedida) ? pedida : null
          });
          buscador.aplicar();
        } else {
          pintar(fuente());
        }
        return productos;
      })
      .catch((fallo) => {
        contenedor.textContent = '';
        if (vacio) vacio.hidden = true;
        if (resultados) resultados.textContent = '';
        if (error) error.hidden = false;
        console.error('[Tienda] Catálogo no disponible:', fallo);
        return [];
      });
  };

  return {
    ETIQUETAS_CATEGORIA,
    cargar,
    obtener,
    porId,
    crearTarjeta,
    renderizar,
    montar
  };
})();
