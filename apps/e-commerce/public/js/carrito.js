/**
 * carrito.js
 * Estado del pedido y su interfaz (botón flotante + panel lateral).
 *
 * `RG.carrito` guarda y calcula; `RG.carritoUI` sólo pinta y escucha eventos.
 * Separarlos permite probar la lógica y reutilizar el estado desde cualquier
 * página sin arrastrar el DOM de la tienda.
 */
window.RG = window.RG || {};

/* ------------------------------------------------------------------------ */
/* Estado                                                                     */
/* ------------------------------------------------------------------------ */

RG.carrito = (function () {
  'use strict';

  const CLAVE = 'carrito';
  const CANTIDAD_MAXIMA = 99;

  let lineas = [];
  const suscriptores = new Set();

  /** Se queda sólo con los campos que el pedido necesita conocer. */
  const aLinea = (producto, cantidad) => ({
    id: String(producto.id),
    nombre: String(producto.nombre),
    cientifico: String(producto.cientifico || ''),
    categoria: String(producto.categoria || 'plantas'),
    precio: Number(producto.precio) || 0,
    cantidad
  });

  const esLineaValida = (linea) =>
    linea &&
    typeof linea === 'object' &&
    typeof linea.id === 'string' &&
    Number.isFinite(Number(linea.precio)) &&
    Number(linea.cantidad) > 0;

  const cargar = () => {
    const guardado = RG.storage.leer(CLAVE, []);
    lineas = Array.isArray(guardado)
      ? guardado.filter(esLineaValida).map((linea) => aLinea(linea, Math.min(CANTIDAD_MAXIMA, Math.floor(Number(linea.cantidad)))))
      : [];
  };

  const persistir = () => RG.storage.escribir(CLAVE, lineas);

  const notificar = () => {
    const instantanea = obtener();
    const resumen = totales();
    suscriptores.forEach((fn) => fn(instantanea, resumen));
  };

  const confirmarCambio = () => {
    persistir();
    notificar();
  };

  /** Copia defensiva: nadie fuera del módulo muta el estado directamente. */
  const obtener = () => lineas.map((linea) => Object.assign({}, linea));

  const cantidadDe = (id) => {
    const linea = lineas.find((item) => item.id === String(id));
    return linea ? linea.cantidad : 0;
  };

  /** Busca el producto en el pedido y, si no está, en el catálogo cargado. */
  const resolverProducto = (referencia) => {
    if (referencia && typeof referencia === 'object') return referencia;
    const id = String(referencia);
    return (
      lineas.find((linea) => linea.id === id) ||
      (RG.catalogo && RG.catalogo.porId ? RG.catalogo.porId(id) : null)
    );
  };

  /**
   * Fija la cantidad exacta de un producto.
   * Con cantidad 0 o menos, la línea desaparece del pedido.
   */
  const establecer = (referencia, cantidad) => {
    const producto = resolverProducto(referencia);
    if (!producto) return;

    const id = String(producto.id);
    const objetivo = RG.utils.limitar(Math.floor(Number(cantidad) || 0), 0, CANTIDAD_MAXIMA);
    const indice = lineas.findIndex((linea) => linea.id === id);

    if (objetivo === 0) {
      if (indice === -1) return;
      lineas.splice(indice, 1);
    } else if (indice === -1) {
      lineas.push(aLinea(producto, objetivo));
    } else {
      lineas[indice] = aLinea(producto, objetivo);
    }
    confirmarCambio();
  };

  const incrementar = (referencia, paso = 1) => {
    const producto = resolverProducto(referencia);
    if (!producto) return;
    establecer(producto, cantidadDe(producto.id) + paso);
  };

  const decrementar = (referencia, paso = 1) => {
    const producto = resolverProducto(referencia);
    if (!producto) return;
    establecer(producto, cantidadDe(producto.id) - paso);
  };

  const vaciar = () => {
    if (!lineas.length) return;
    lineas = [];
    confirmarCambio();
  };

  const totales = () =>
    lineas.reduce(
      (acumulado, linea) => ({
        articulos: acumulado.articulos + linea.cantidad,
        subtotal: acumulado.subtotal + linea.precio * linea.cantidad
      }),
      { articulos: 0, subtotal: 0 }
    );

  /**
   * Refresca nombres y precios contra el catálogo actual y descarta productos
   * que ya no existen. Evita que un pedido viejo en localStorage envíe precios
   * desactualizados por WhatsApp.
   */
  const sincronizarCon = (catalogo) => {
    if (!Array.isArray(catalogo) || !catalogo.length) return;
    const porId = new Map(catalogo.map((producto) => [String(producto.id), producto]));

    const anteriores = lineas.length;
    lineas = lineas
      .filter((linea) => porId.has(linea.id))
      .map((linea) => aLinea(porId.get(linea.id), linea.cantidad));

    if (anteriores !== lineas.length) persistir();
    notificar();
  };

  /** Registra un observador y devuelve la función para darse de baja. */
  const suscribir = (fn) => {
    if (typeof fn !== 'function') return () => {};
    suscriptores.add(fn);
    fn(obtener(), totales());
    return () => suscriptores.delete(fn);
  };

  cargar();

  return {
    CANTIDAD_MAXIMA,
    obtener,
    cantidadDe,
    establecer,
    incrementar,
    decrementar,
    vaciar,
    totales,
    sincronizarCon,
    suscribir
  };
})();

/* ------------------------------------------------------------------------ */
/* Interfaz                                                                   */
/* ------------------------------------------------------------------------ */

RG.carritoUI = (function () {
  'use strict';

  const SELECTORES = {
    boton: '[data-carrito-boton]',
    panel: '[data-carrito-panel]',
    velo: '[data-carrito-velo]',
    lista: '[data-carrito-lista]',
    vacio: '[data-carrito-vacio]',
    resumen: '[data-carrito-resumen]',
    contador: '[data-carrito-contador]',
    articulos: '[data-carrito-articulos]',
    subtotal: '[data-carrito-subtotal]',
    enviar: '[data-carrito-enviar]',
    limpiar: '[data-carrito-limpiar]',
    cerrar: '[data-carrito-cerrar]',
    telefono: '[data-carrito-telefono]',
    telefonoError: '[data-carrito-telefono-error]'
  };

  let nodos = {};
  let iniciado = false;
  let ultimoFoco = null;

  const consultar = () =>
    Object.entries(SELECTORES).reduce((acumulado, [nombre, selector]) => {
      acumulado[nombre] = document.querySelector(selector);
      return acumulado;
    }, {});

  /* --- Panel --------------------------------------------------------------- */

  const estaAbierto = () => Boolean(nodos.panel && nodos.panel.classList.contains('is-abierto'));

  const abrir = () => {
    if (!nodos.panel || estaAbierto()) return;
    ultimoFoco = document.activeElement;
    nodos.panel.classList.add('is-abierto');
    nodos.panel.setAttribute('aria-hidden', 'false');
    if (nodos.velo) nodos.velo.classList.add('is-visible');
    if (nodos.boton) nodos.boton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('sin-scroll');
    if (nodos.cerrar) nodos.cerrar.focus();
  };

  const cerrar = () => {
    if (!nodos.panel || !estaAbierto()) return;
    nodos.panel.classList.remove('is-abierto');
    nodos.panel.setAttribute('aria-hidden', 'true');
    if (nodos.velo) nodos.velo.classList.remove('is-visible');
    if (nodos.boton) nodos.boton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sin-scroll');
    if (ultimoFoco && typeof ultimoFoco.focus === 'function') ultimoFoco.focus();
  };

  const alternar = () => (estaAbierto() ? cerrar() : abrir());

  /* --- Pintado ------------------------------------------------------------- */

  const crearControlCantidad = (linea) => {
    const { crear } = RG.utils;
    return crear('div', { clase: 'contador', role: 'group', 'aria-label': `Cantidad de ${linea.nombre}` }, [
      crear('button', {
        type: 'button',
        clase: 'contador__boton',
        'data-accion': 'decrementar',
        'data-producto': linea.id,
        'aria-label': `Quitar una unidad de ${linea.nombre}`,
        texto: '−'
      }),
      crear('span', {
        clase: 'contador__valor',
        'data-cantidad-de': linea.id,
        'aria-live': 'polite',
        texto: String(linea.cantidad)
      }),
      crear('button', {
        type: 'button',
        clase: 'contador__boton',
        'data-accion': 'incrementar',
        'data-producto': linea.id,
        'aria-label': `Agregar una unidad de ${linea.nombre}`,
        texto: '+'
      })
    ]);
  };

  const crearFila = (linea) => {
    const { crear, formatearPrecio } = RG.utils;
    const subtotal = linea.precio * linea.cantidad;

    return crear('li', { clase: 'pedido-item', 'data-linea': linea.id }, [
      crear('div', { clase: 'pedido-item__info' }, [
        crear('p', { clase: 'pedido-item__nombre' }, [
          crear('span', { clase: 'pedido-item__emoji', 'aria-hidden': 'true', texto: RG.whatsapp.emojiDe(linea.categoria) }),
          linea.nombre
        ]),
        crear('p', { clase: 'pedido-item__unitario', texto: `${formatearPrecio(linea.precio)} c/u` })
      ]),
      crear('div', { clase: 'pedido-item__acciones' }, [
        crearControlCantidad(linea),
        crear('p', { clase: 'pedido-item__subtotal', texto: formatearPrecio(subtotal) })
      ])
    ]);
  };

  const pintarLista = (lineas) => {
    if (!nodos.lista) return;
    nodos.lista.textContent = '';
    const fragmento = document.createDocumentFragment();
    lineas.forEach((linea) => fragmento.appendChild(crearFila(linea)));
    nodos.lista.appendChild(fragmento);
  };

  const pintarTotales = (lineas, resumen) => {
    const { formatearPrecio } = RG.utils;
    const hayProductos = lineas.length > 0;

    if (nodos.contador) nodos.contador.textContent = String(resumen.articulos);
    if (nodos.articulos) nodos.articulos.textContent = String(resumen.articulos);
    if (nodos.subtotal) nodos.subtotal.textContent = formatearPrecio(resumen.subtotal);

    if (nodos.vacio) nodos.vacio.hidden = hayProductos;
    if (nodos.lista) nodos.lista.hidden = !hayProductos;
    if (nodos.resumen) nodos.resumen.hidden = !hayProductos;
    if (nodos.enviar) nodos.enviar.disabled = !hayProductos;
    if (nodos.limpiar) nodos.limpiar.disabled = !hayProductos;

    if (nodos.boton) {
      nodos.boton.classList.toggle('is-activo', hayProductos);
      nodos.boton.setAttribute(
        'aria-label',
        hayProductos
          ? `Mi pedido, ${resumen.articulos} ${resumen.articulos === 1 ? 'artículo' : 'artículos'}`
          : 'Mi pedido, vacío'
      );
    }
  };

  /** Mantiene sincronizados los contadores de las tarjetas del catálogo. */
  const pintarTarjetas = (lineas) => {
    const cantidades = new Map(lineas.map((linea) => [linea.id, linea.cantidad]));

    document.querySelectorAll('[data-cantidad-de]').forEach((nodo) => {
      const cantidad = cantidades.get(nodo.dataset.cantidadDe) || 0;
      nodo.textContent = String(cantidad);
    });

    document.querySelectorAll('[data-tarjeta]').forEach((tarjeta) => {
      const cantidad = cantidades.get(tarjeta.dataset.tarjeta) || 0;
      tarjeta.classList.toggle('is-en-pedido', cantidad > 0);
      const boton = tarjeta.querySelector('[data-accion="decrementar"]');
      if (boton) boton.disabled = cantidad === 0;
    });
  };

  const animarBoton = () => {
    if (!nodos.boton || RG.utils.prefiereMenosMovimiento()) return;
    nodos.boton.classList.remove('is-pulso');
    void nodos.boton.offsetWidth; // reinicia la animación
    nodos.boton.classList.add('is-pulso');
  };

  let articulosPrevios = null;

  const actualizar = (lineas, resumen) => {
    pintarLista(lineas);
    pintarTotales(lineas, resumen);
    pintarTarjetas(lineas);

    if (articulosPrevios !== null && resumen.articulos !== articulosPrevios) animarBoton();
    articulosPrevios = resumen.articulos;
  };

  /* --- Eventos ------------------------------------------------------------- */

  const manejarClicGlobal = (evento) => {
    const disparador = evento.target.closest('[data-accion]');
    if (!disparador) return;

    const { accion, producto } = disparador.dataset;
    if (accion === 'incrementar' && producto) {
      RG.carrito.incrementar(producto);
    } else if (accion === 'decrementar' && producto) {
      RG.carrito.decrementar(producto);
    }
  };

  const mostrarErrorTelefono = (mostrar) => {
    if (nodos.telefonoError) nodos.telefonoError.hidden = !mostrar;
    if (nodos.telefono) nodos.telefono.classList.toggle('is-invalido', mostrar);
  };

  const manejarEnvio = async () => {
    const lineas = RG.carrito.obtener();
    if (!lineas.length) return;

    const telefono = RG.storeOrders.limpiarTelefono(nodos.telefono ? nodos.telefono.value : '');
    if (!RG.storeOrders.esTelefonoValido(telefono)) {
      mostrarErrorTelefono(true);
      if (nodos.telefono) nodos.telefono.focus();
      return;
    }
    mostrarErrorTelefono(false);

    if (nodos.enviar) nodos.enviar.disabled = true;
    try {
      // Si el registro falla (sin conexión, etc.) igual se abre WhatsApp,
      // solo sin folio de referencia — no se bloquea al cliente por esto.
      const folio = await RG.storeOrders.registrarPedido(telefono, lineas);
      RG.whatsapp.enviarPedido(lineas, RG.carrito.totales(), folio);
    } finally {
      if (nodos.enviar) nodos.enviar.disabled = false;
    }
  };

  const manejarLimpieza = () => {
    if (!RG.carrito.obtener().length) return;
    const confirmado = window.confirm(
      '¿Seguro que deseas vaciar tu pedido? Se eliminarán todos los productos.'
    );
    if (confirmado) RG.carrito.vaciar();
  };

  const conectarEventos = () => {
    document.addEventListener('click', manejarClicGlobal);

    if (nodos.boton) nodos.boton.addEventListener('click', alternar);
    if (nodos.cerrar) nodos.cerrar.addEventListener('click', cerrar);
    if (nodos.velo) nodos.velo.addEventListener('click', cerrar);
    if (nodos.enviar) nodos.enviar.addEventListener('click', manejarEnvio);
    if (nodos.limpiar) nodos.limpiar.addEventListener('click', manejarLimpieza);

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') cerrar();
    });
  };

  /**
   * Arranca la interfaz del carrito. Es seguro llamarla en páginas sin panel:
   * en ese caso sólo se sincronizan los contadores visibles.
   */
  const iniciar = () => {
    if (iniciado) return;
    iniciado = true;
    nodos = consultar();
    conectarEventos();
    RG.carrito.suscribir(actualizar);
  };

  return { iniciar, abrir, cerrar, alternar, estaAbierto };
})();
