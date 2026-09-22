---
id: POS-005
name: Carrito que sobrevive
status: draft
version: 1.0
vertical: retail
module: orders
priority: medium
branch: feat/POS-005-carrito-que-sobrevive
parent: Domain/Ventas y Punto de Venta (Orbix)
depends_on: [POS-003, POS-004]
migration: none
reversible: true
---

# Carrito que sobrevive

## 1. Objetivo

Que una venta a medio capturar no se pierda. Hoy el carrito vive en la memoria de la pantalla:
si la app se cierra, el teléfono se queda sin batería o el sistema la mata por memoria, la
venta capturada desaparece y el cajero vuelve a empezar delante del cliente.

Añade además la atención de dos clientes a la vez —suspender una venta y retomarla— y el tope
de cantidad por existencia disponible, que es el otro modo en que el carrito miente hoy.

## 0. Alternativas descartadas

**Guardar la venta suspendida en el servidor, como una orden en borrador.** Parece más sólido
y es peor: una venta que no se ha cobrado no es un hecho del negocio. Crearla en el servidor
la mete en los listados, en los reportes y en la numeración de folios, obliga a decidir qué
pasa con la existencia mientras está suspendida, y deja basura al cerrar el turno. La terminal
web ya resolvió esto en el cliente por esta razón. Una venta suspendida es una nota del
mostrador, no una orden.

**Hacerlo antes de cliente, descuento y presentaciones.** El orden importa: un carrito
persistido que no sabe guardar el cliente, el descuento ni la presentación hay que volver a
escribirlo en cuanto esos specs entren, y peor todavía, hay que migrar lo ya guardado en los
dispositivos. De ahí el `depends_on`.

## 2. Alcance

### Dentro
- Persistencia del carrito en curso entre arranques de la app.
- Suspender la venta en curso y retomarla después.
- Tope de cantidad por existencia disponible al agregar y al subir cantidad.
- Descarte del carrito persistido cuando deja de ser válido.

### Fuera
- Venta offline. Persistir el carrito no es poder cobrar sin red.
- Cola de escrituras y sincronización diferida.
- Persistencia de lo capturado en el arqueo y el corte. Es el mismo problema y merece su
  propio trabajo, en el módulo de caja.
- Compartir una venta suspendida entre dispositivos.

## 3. Actores

- **Cajero** — pierde la venta hoy; suspende y retoma mañana.
- **Cajero de relevo** — encuentra en el dispositivo lo que dejó el anterior.

## 4. Requisitos funcionales

### FR-001
El sistema MUST conservar el carrito en curso —líneas, cantidades, presentaciones, cliente y
descuento— cuando la app se cierra, y MUST restaurarlo al volver a abrirla.

### FR-002
El sistema MUST permitir suspender la venta en curso con una etiqueta que la identifique, y
dejar el carrito vacío para empezar otra.

### FR-003
El sistema MUST permitir ver las ventas suspendidas, retomar una y descartar una.

### FR-004
Al retomar una venta suspendida con un carrito en curso, el sistema MUST advertirlo antes de
reemplazarlo.

### FR-005
El sistema MUST impedir subir la cantidad de un renglón por encima de la existencia
disponible de esa presentación, cuando el producto lleva control de inventario.

### FR-006
El sistema MUST descartar el carrito restaurado y las ventas suspendidas cuando dejan de
pertenecer al contexto activo — otro tenant, otra sucursal.

### FR-007
Cuando el almacenamiento falla o está lleno, el sistema MUST seguir permitiendo vender, y
MUST avisar de que la venta no quedó guardada.

## 5. Reglas de negocio

### BR-001
Una venta suspendida es estado del dispositivo, no del negocio. No existe en el servidor, no
consume folio, no reserva existencia y no aparece en ningún reporte. Se cobra o se descarta.

No es expresable en base (C-016): no hay entidad. Se cubre con test de la regla en el cliente
y con la ausencia de llamadas al servidor al suspender.

### BR-002
Suspender no reserva existencia. Dos ventas suspendidas pueden contener el último artículo:
se lo lleva la primera que cobre, y la segunda falla al cobrar. Es correcto — reservar sin
cobrar bloquearía inventario real por una nota del mostrador.

### BR-003
El tope por existencia es una ayuda, no el control. El servidor vuelve a validar al cobrar y
su respuesta manda. Un carrito restaurado horas después puede contener artículos que ya no
hay.

### BR-004
El carrito persistido pertenece al tenant y a la sucursal en los que se capturó, no a la
persona. Un relevo de turno encuentra lo que dejó el cajero anterior; un cambio de empresa o
de sucursal lo descarta.

## 6. Criterios de aceptación

### AC-001 · Covers: FR-001
Dado un carrito con tres líneas, un cliente asignado y un descuento aplicado
Cuando la app se cierra por completo y se vuelve a abrir
Entonces el carrito reaparece con las tres líneas, sus cantidades y presentaciones, el mismo
cliente y el mismo descuento.

### AC-002 · Covers: FR-002, BR-001
Dado un carrito con artículos
Cuando el cajero lo suspende con una etiqueta
Entonces el carrito queda vacío, la venta suspendida aparece en la lista, y no se registró
ninguna orden en el servidor.

### AC-003 · Covers: FR-003
Dada una venta suspendida
Cuando el cajero la retoma con el carrito vacío
Entonces sus líneas, cliente y descuento pasan al carrito, y deja de estar en la lista de
suspendidas.

### AC-004 · Covers: FR-004
Dada una venta suspendida y un carrito con artículos
Cuando el cajero intenta retomar la suspendida
Entonces se le advierte que perderá el carrito actual, y solo al confirmar se reemplaza.

### AC-005 · Covers: FR-005
Dado un renglón de una presentación con dos unidades disponibles
Cuando el cajero intenta subir la cantidad a tres
Entonces la cantidad se queda en dos y se le indica el motivo.

### AC-006 · Covers: BR-003
Dado un carrito restaurado cuyos artículos ya no tienen existencia
Cuando el cajero cobra
Entonces el servidor rechaza la venta y el carrito se conserva para poder corregirlo.

### AC-007 · Covers: FR-006, BR-004
Dado un carrito persistido en el tenant A
Cuando el usuario cambia al tenant B
Entonces el punto de venta de B arranca con el carrito vacío y sin ninguna venta suspendida
de A.

### AC-008 · Covers: BR-004
Dado un carrito persistido por un cajero
Cuando otro usuario inicia sesión en el mismo dispositivo, mismo tenant y misma sucursal
Entonces encuentra el carrito tal como quedó.

### AC-009 · Covers: FR-007
Dado un dispositivo cuyo almacenamiento rechaza la escritura
Cuando el cajero captura una venta
Entonces puede cobrarla normalmente, y se le avisa de que no quedará guardada si cierra la
app.

### AC-010 · Covers: BR-002
Dadas dos ventas suspendidas que contienen la última unidad del mismo artículo
Cuando se cobra la primera
Entonces la segunda no se modifica, y al cobrarla el servidor la rechaza por falta de
existencia.

## 7. Contrato

Sin endpoints nuevos y sin cambios de contrato. Nada de este spec llega al servidor: el
carrito y las ventas suspendidas viven en el dispositivo.

Lo único que cambia frente al servidor es **cuándo** se envía la venta, no su forma.

## 8. Persistencia

Entidades afectadas: ninguna en base.

En el dispositivo: el carrito en curso y la lista de ventas suspendidas, en el almacenamiento
local que ya usan el vínculo de la caja y las preferencias, particionados por tenant y
sucursal (BR-004).

Restricciones en base: ninguna. Migración: **none**.

Nota de seguridad: el almacenamiento local del móvil hoy **no está cifrado**, y el carrito
persistido incluirá el cliente asignado —nombre, y potencialmente correo y teléfono, según lo
que se guarde. Es el mismo hueco que ya tiene la caché de clientes, y este spec lo agranda.
Ver §11.

## 9. Tests

### Nuevos
| Archivo | Covers |
|---|---|
| `apps/mobile/orbix-mobile/src/features/pos/cart-persistence.spec.ts` | AC-001, AC-007, AC-008, AC-009 |
| `apps/mobile/orbix-mobile/src/features/pos/suspended-sales.spec.ts` | AC-002, AC-003, AC-004, AC-010 |
| `apps/mobile/orbix-mobile/src/features/pos/stock-cap.spec.ts` | AC-005 |

AC-006 cruza cliente y servidor: se verifica con la app arrancada y queda anotado en
`verify.md` (C-021).

### Cambian de significado
| Archivo | Por qué |
|---|---|
| Los casos que asumen que el punto de venta arranca con el carrito vacío | Deja de ser cierto: arranca con lo que hubiera guardado |

### Se conservan como red de seguridad
- Las pruebas de identidad del renglón por presentación: lo que se guarda y se restaura debe
  conservar esa identidad, no colapsarla.
- Las pruebas de reparto de descuento: el descuento restaurado debe repartirse igual.

## 10. Riesgos

- **Restaurar un carrito viejo sin avisar.** Un carrito de hace tres días que reaparece como
  si fuera la venta en curso es peor que perderlo: el cajero cobra lo que no capturó. Hace
  falta decidir una caducidad — ver §11.
- **Datos personales en claro.** El carrito persistido con cliente asignado guarda datos del
  comprador en un almacenamiento sin cifrar, en un teléfono que se pierde.
- **Crecimiento sin límite de las suspendidas.** Sin tope ni caducidad, la lista se vuelve un
  cajón de sastre y el almacenamiento se llena.
- **Divergencia entre el precio guardado y el vigente.** El carrito guarda el precio con el
  que se capturó. Si el precio cambió, el cajero cobra el viejo. El servidor recalcula, así
  que el riesgo es de expectativa, no de dinero — pero hay que decidir si se avisa.
- La tarea toca el dominio del dinero y de las existencias: vía `completo`.

## 11. Preguntas abiertas

1. **Caducidad del carrito restaurado.** ¿Se restaura siempre, o solo si es de hoy / del turno
   en curso? Inclinación: acotarlo al turno de caja abierto, que es la unidad natural del
   mostrador, y descartarlo al cortar.
2. **Caducidad y tope de las ventas suspendidas.** ¿Cuántas a la vez? ¿Se descartan al cerrar
   el turno? La terminal web no pone tope hoy; hay que confirmar si eso ha sido suficiente.
3. **Cifrado del almacenamiento local.** ¿Se cierra en este spec, o es trabajo aparte que este
   spec declara como dependencia? El hueco ya existe; este trabajo lo empeora. Inclinación:
   spec propio, y este lo declara como riesgo aceptado mientras tanto.
4. **Aviso de precio cambiado al restaurar.** ¿Se revalida el carrito restaurado contra el
   catálogo y se avisa de lo que cambió, o se restaura tal cual?
5. **Etiqueta de la venta suspendida.** ¿La escribe el cajero, o se genera (hora, primer
   artículo)? Escribirla en un teléfono, delante del cliente, es fricción.

## 12. Aprobación

Aprobado por: · <pendiente>

## 13. Changelog

- 1.0 (2026-09-15) — versión inicial
