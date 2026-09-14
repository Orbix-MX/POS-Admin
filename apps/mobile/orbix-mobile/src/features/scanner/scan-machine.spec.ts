import {
  initialScanState,
  isSensorClosed,
  scanReducer,
  type ScanEvent,
  type ScanState,
} from './scan-machine';

/**
 * La puerta del escáner.
 *
 * `CameraView` emite por fotograma: sin estas reglas, apuntar dos segundos a
 * una etiqueta mete treinta unidades al carrito. Es el fallo que hace inusable
 * un escáner, y no se ve en una prueba manual rápida porque a mano se aparta la
 * cámara enseguida.
 */
describe('máquina del escáner', () => {
  type R = { id: string };

  const run = (events: ScanEvent<R>[], from = initialScanState<R>()): ScanState<R> =>
    events.reduce(scanReducer<R>, from);

  it('arranca con el sensor abierto', () => {
    const state = initialScanState<R>();
    expect(state.phase).toBe('scanning');
    expect(isSensorClosed(state)).toBe(false);
  });

  it('cierra el sensor en cuanto lee', () => {
    const state = run([{ type: 'read', code: '7501' }]);
    expect(state.phase).toBe('resolving');
    expect(state.code).toBe('7501');
    expect(isSensorClosed(state)).toBe(true);
  });

  it('ignora los fotogramas que siguen llegando de la misma etiqueta', () => {
    const state = run([
      { type: 'read', code: '7501' },
      { type: 'read', code: '7501' },
      { type: 'read', code: '7501' },
    ]);
    // Una sola lectura en vuelo: las otras dos no cambiaron nada.
    expect(state.phase).toBe('resolving');
    expect(state.count).toBe(0);
  });

  it('no cuela una segunda etiqueta mientras la primera resuelve', () => {
    const state = run([
      { type: 'read', code: '7501' },
      { type: 'read', code: '7502' },
    ]);
    expect(state.code).toBe('7501');
  });

  it('cuenta el acierto y se queda enseñando lo que entró', () => {
    const state = run([
      { type: 'read', code: '7501' },
      { type: 'resolved', result: { id: 'p1' } },
    ]);
    expect(state.phase).toBe('hit');
    expect(state.result).toEqual({ id: 'p1' });
    expect(state.count).toBe(1);
    // Sigue cerrado: reabrir aquí dispararía con la etiqueta todavía delante.
    expect(isSensorClosed(state)).toBe(true);
  });

  it('reabre el sensor solo cuando alguien lo pide', () => {
    const state = run([
      { type: 'read', code: '7501' },
      { type: 'resolved', result: { id: 'p1' } },
      { type: 'rearm' },
    ]);
    expect(state.phase).toBe('scanning');
    expect(state.code).toBeNull();
    expect(state.result).toBeNull();
  });

  it('permite cobrar dos veces el mismo artículo', () => {
    // Dos latas iguales son dos ventas. Lo que corta el bucle es la fase, no
    // el valor del código: filtrar duplicados cobraría una sola.
    const state = run([
      { type: 'read', code: '7501' },
      { type: 'resolved', result: { id: 'p1' } },
      { type: 'rearm' },
      { type: 'read', code: '7501' },
      { type: 'resolved', result: { id: 'p1' } },
    ]);
    expect(state.count).toBe(2);
  });

  it('el contador sobrevive al rearme: es de la sesión, no de la lectura', () => {
    const state = run([
      { type: 'read', code: 'a' },
      { type: 'resolved', result: { id: '1' } },
      { type: 'rearm' },
      { type: 'read', code: 'b' },
      { type: 'notFound' },
      { type: 'rearm' },
    ]);
    expect(state.count).toBe(1);
    expect(state.phase).toBe('scanning');
  });

  it('un código desconocido para en seco, sin borrar lo leído', () => {
    const state = run([{ type: 'read', code: '404' }, { type: 'notFound' }]);
    expect(state.phase).toBe('miss');
    // El código se conserva: es lo que se precarga al ofrecer darlo de alta.
    expect(state.code).toBe('404');
  });

  it('un fallo de red conserva el error para poder explicarlo', () => {
    const boom = new Error('network');
    const state = run([{ type: 'read', code: '7501' }, { type: 'failed', error: boom }]);
    expect(state.phase).toBe('error');
    expect(state.error).toBe(boom);
  });

  it('descarta una respuesta que llega después de reiniciar', () => {
    // El usuario descartó el error y volvió a apuntar; la petición anterior
    // contesta tarde. Añadirla metería al carrito algo que ya no se pidió.
    const state = run([
      { type: 'read', code: '7501' },
      { type: 'rearm' },
      { type: 'resolved', result: { id: 'fantasma' } },
    ]);
    expect(state.phase).toBe('scanning');
    expect(state.result).toBeNull();
    expect(state.count).toBe(0);
  });

  it('ignora una lectura vacía', () => {
    const state = run([{ type: 'read', code: '   ' }]);
    expect(state.phase).toBe('scanning');
  });

  it('recorta el código leído', () => {
    const state = run([{ type: 'read', code: ' 7501 ' }]);
    expect(state.code).toBe('7501');
  });

  it('el rearme desde un fallo limpia el error', () => {
    const state = run([
      { type: 'read', code: 'x' },
      { type: 'failed', error: new Error('boom') },
      { type: 'rearm' },
    ]);
    expect(state.error).toBeNull();
    expect(state.phase).toBe('scanning');
  });
});
