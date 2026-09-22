---
id: POS-001
name: Idempotencia de la venta
status: draft
version: 1.0
vertical: retail
module: orders
priority: high
branch: feat/POS-001-idempotencia-de-la-venta
parent: Domain/Ventas y Punto de Venta (Orbix)
depends_on: []
migration: expand
reversible: true
---

# Idempotencia de la venta

## 1. Objetivo

Que reintentar el registro de una venta no cree una segunda. Hoy el cobro no tiene ninguna
defensa contra el reintento: un tiempo de espera agotado seguido de un segundo intento
registra dos ventas, mueve la existencia dos veces y deja dos movimientos en la caja, y el
negocio solo lo descubre al cuadrar.

Es el cimiento de los specs de cobro que vienen detrás: cada uno añade campos a la misma
operación, y retroajustar la idempotencia después obliga a volver a probar todos los caminos
de pago.

## 0. Alternativas descartadas

**Deshabilitar el botón de cobro mientras la petición está en vuelo.** Es lo que parece
suficiente y no lo es: el caso que duplica no es el doble toque, es la respuesta que nunca
llega. El servidor ya registró la venta, movió la existencia y anotó la caja; el cliente ve
un error de red y ofrece reintentar. La única forma de que el segundo intento sea inocuo es
que el servidor reconozca que es el mismo. Cualquier defensa que viva solo en el cliente deja
el caso real sin cubrir, y además no protege de la cola de reintentos que traerá el trabajo
offline.

**Deduplicar por contenido, sin clave.** Dos ventas idénticas del mismo artículo al mismo
precio en el mismo minuto son un caso normal de mostrador. Sin una clave que el cliente
elija, el servidor no puede distinguir "la misma venta otra vez" de "otra venta igual".

## 2. Alcance

### Dentro
- Clave de idempotencia opcional al registrar una venta.
- Respuesta repetida idéntica ante la misma clave, sin efectos secundarios nuevos.
- Rechazo explícito cuando la misma clave llega con un contenido distinto.
- Resolución correcta de dos peticiones simultáneas con la misma clave.
- Generación y reenvío de la clave desde el punto de venta móvil.

### Fuera
- Cola de escrituras offline y reintento diferido. Depende de esto, no al revés.
- Idempotencia de cancelación, devolución y reembolso. Son operaciones distintas, con su
  propia semántica de repetición; van en un spec propio.
- Cobro posterior sobre una venta ya creada (abonos, saldo de apartado).
- Comanda de restaurante.
- Que los clientes web y de terminal web manden la clave. Se pueden sumar después sin cambiar
  el contrato, porque la clave es opcional.

## 3. Actores

- **Cajero** — reintenta un cobro que no dio respuesta.
- **Punto de venta móvil** — emite la clave y la conserva mientras el carrito no cambie.
- **Operación del negocio** — quien cuadra la caja y sufre la venta duplicada.

## 4. Requisitos funcionales

### FR-001
El sistema MUST aceptar una clave de idempotencia opcional al registrar una venta.

### FR-002
Recibida una clave ya usada en el mismo tenant con el mismo contenido, el sistema MUST
devolver la venta creada la primera vez, sin registrar otra, sin mover existencia y sin
generar movimiento de caja.

### FR-003
Recibida una clave ya usada en el mismo tenant con un contenido distinto, el sistema MUST
rechazar la petición y decir que la clave ya corresponde a otra venta. No debe devolver la
venta anterior ni crear una nueva.

### FR-004
Sin clave, el sistema MUST registrar la venta exactamente como hoy. Ningún cliente existente
cambia de comportamiento por esta entrega.

### FR-005
El punto de venta móvil MUST emitir una clave al iniciar un intento de cobro, reusarla en
cada reintento del mismo carrito, y descartarla al empezar una venta nueva o al modificar el
carrito.

### FR-006
Dos peticiones simultáneas con la misma clave MUST resolver en una sola venta: una la crea y
la otra recibe esa misma, o un rechazo que el cliente pueda reintentar sin duplicar.

### FR-007
El sistema MUST conservar la clave el tiempo suficiente para cubrir un reintento razonable, y
MUST poder liberar las caducadas sin intervención manual.

## 5. Reglas de negocio

### BR-001
Una clave identifica **un** intento de venta dentro de **un** tenant. Dos tenants pueden usar
la misma cadena sin interferir. Es expresable en base y va ahí: restricción de unicidad
compuesta por tenant y clave (C-004, C-016). Confiar el chequeo a la aplicación deja el caso
concurrente —que es justamente el caso— sin cubrir.

### BR-002
"Mismo contenido" se decide por una huella del cuerpo de la petición, no por comparación
campo a campo. Una clave reutilizada con otro contenido es un defecto del cliente y se trata
como error, no como venta nueva: devolver la venta anterior escondería el defecto y el
negocio cobraría de menos.

### BR-003
La venta y el registro de su clave se escriben en la misma transacción. Si la venta se
revierte, la clave no queda ocupada.

### BR-004
La clave no sustituye a ningún control existente: la sesión de caja abierta, los permisos y
la validación de existencia se siguen aplicando igual en el primer intento.

## 6. Criterios de aceptación

### AC-001 · Covers: FR-001, FR-004
Dado un carrito válido
Cuando se registra la venta sin clave de idempotencia
Entonces la venta se crea con el mismo resultado que hoy.

### AC-002 · Covers: FR-002
Dado que una venta se registró con una clave
Cuando se repite la misma petición con la misma clave
Entonces se devuelve la misma venta, el número de ventas del tenant no aumenta, la existencia
de los artículos no vuelve a bajar y la caja no registra un segundo movimiento.

### AC-003 · Covers: FR-003, BR-002
Dado que una venta se registró con una clave
Cuando llega otra petición con esa clave y un carrito distinto
Entonces se rechaza indicando el conflicto, y no se crea ninguna venta.

### AC-004 · Covers: FR-006, BR-001
Dado un carrito válido
Cuando dos peticiones con la misma clave llegan a la vez
Entonces queda exactamente una venta registrada.

### AC-005 · Covers: FR-005
Dado un cobro cuyo primer intento falla sin respuesta del servidor
Cuando el cajero reintenta desde la misma pantalla, sin tocar el carrito
Entonces el reintento viaja con la misma clave que el primero.

### AC-006 · Covers: FR-005
Dado un cobro completado
Cuando el cajero empieza una venta nueva
Entonces el siguiente cobro viaja con una clave distinta.

### AC-007 · Covers: BR-003
Dado un carrito cuya venta falla por una regla de negocio (sin caja abierta, sin existencia)
Cuando el cajero corrige la causa y reintenta con la misma clave
Entonces la venta se registra: un intento fallido no deja la clave quemada.

### AC-008 · Covers: BR-001
Dado que el tenant A registró una venta con una clave
Cuando el tenant B registra una venta con esa misma cadena
Entonces la venta de B se crea normalmente, y ninguno de los dos ve la venta del otro.

### AC-009 · Covers: FR-007
Dada una clave cuya ventana de retención ya venció
Cuando llega una petición con esa clave
Entonces se trata como una clave nueva.

## 7. Contrato

```
POST /api/orders
Idempotency-Key: <cadena opaca, 16-128 caracteres>
```

El cuerpo no cambia. La clave viaja en cabecera, no en el cuerpo: es metadato del transporte,
y meterla en el cuerpo la haría parte de su propia huella.

Respuestas:

| Caso | Código | Cuerpo |
|---|---|---|
| Venta nueva | `201` | la venta |
| Repetición con el mismo contenido | `200` | la misma venta, sin cambios |
| Repetición con contenido distinto | `409` | error con la causa |
| Clave de formato inválido | `400` | error de validación |

`tenantId` nunca viaja en el cuerpo ni en la cabecera: se resuelve desde
`TenantContextService` (C-001), y la unicidad de la clave se evalúa dentro de ese tenant.

La cabecera es **opcional**. Los clientes que no la manden siguen funcionando: no es un
cambio incompatible y no exige orden de despliegue (C-019).

## 8. Persistencia

Entidades afectadas:
- **Nueva**: registro de clave de idempotencia con el tenant, la clave, la huella del
  contenido, la venta resultante y el instante de creación.
- `Order` — sin cambios de forma; se referencia desde el registro nuevo.

Restricciones en base:
- Unicidad compuesta por `(tenantId, clave)` — es lo que hace correcto el caso concurrente
  (BR-001).
- Referencia a la venta con borrado restringido: una clave no puede apuntar a una venta que
  ya no existe.
- Índice por instante de creación, para poder purgar las caducadas.

Migración **expand**: solo añade. Nada existente cambia de forma ni de significado, así que
es revertible con un solo despliegue (C-013 no aplica; no hay fase *contract*).

## 9. Tests

### Nuevos
| Archivo | Covers |
|---|---|
| `api/src/modules/retail/orders/orders.idempotency.spec.ts` | AC-001, AC-002, AC-003, AC-007, AC-009 |
| `api/test/orders-idempotency.e2e-spec.ts` | AC-004, AC-008 |
| `apps/mobile/orbix-mobile/src/features/pos/idempotency-key.spec.ts` | AC-005, AC-006 |

El caso concurrente (AC-004) no se puede probar con mocks: exige base real y dos peticiones
en vuelo. Va a e2e a propósito.

### Cambian de significado
Ninguno previsto. Si algún test existente de `orders` asume que dos creaciones idénticas
producen dos ventas, deja de ser cierto **solo** cuando hay clave; sin clave el
comportamiento es el de hoy.

### Se conservan como red de seguridad
- Las suites de `orders` que cubren precio, pago y existencia: esta entrega no debe moverlas.
- `authorization-coverage.spec.ts` — el handler no cambia de forma de autorizarse.

## 10. Riesgos

- **La huella del contenido**. Si incluye algo que el cliente varía entre reintentos —un
  instante, un identificador de dispositivo— todo reintento legítimo se convierte en `409`.
  La huella debe calcularse sobre el cuerpo ya validado, no sobre el texto crudo.
- **Retención corta de más**. Un reintento tras un corte largo de red caería fuera de la
  ventana y volvería a duplicar. Retención corta de menos hace crecer la tabla sin límite.
- **Clave demasiado estable en el cliente**. Si la clave sobrevive al cambio del carrito, dos
  ventas distintas comparten clave y la segunda se rechaza con `409` — el cajero ve un error
  en una venta legítima. Es el error opuesto y es peor, porque bloquea la caja.
- **Verificación del cableado**: la cabecera la lee un interceptor o el controlador, y eso no
  lo prueba la suite unitaria. Cierra con la app arrancada (C-021).
- El trabajo toca `retail/orders`, el dominio del dinero y de las existencias, una migración y
  escritura concurrente: es vía `completo` por cuatro triggers distintos de `force_completo`.

## 11. Preguntas abiertas

1. **Ventana de retención.** Propuesta: 24 h. ¿Suficiente para el peor corte de red que se
   espera en un mostrador, o hace falta más?
2. **Código de la repetición.** Propuesta: `200` frente al `201` del original, para que el
   cliente pueda distinguir "se creó" de "ya estaba". ¿O `201` siempre, para que el cliente no
   tenga que ramificar?
3. **Purga.** ¿Tarea programada, o borrado oportunista al insertar? No hay hoy en la API un
   programador de tareas que se pueda reusar — hay que confirmarlo antes de decidir.
4. **Alcance de clientes.** ¿La terminal web y el back-office mandan la clave en esta misma
   entrega, o se quedan para después? La respuesta no cambia el contrato, sí el tamaño.
5. **`POST /orders/:id/payments`.** También mueve dinero y también se reintenta. ¿Entra aquí o
   es el spec hermano? Inclinación: spec hermano, porque su noción de repetición no es la
   misma.

## 12. Aprobación

Aprobado por: · <pendiente>

## 13. Changelog

- 1.0 (2026-09-15) — versión inicial
