import 'package:flutter_test/flutter_test.dart';

import 'package:orbix_pos/pos_controller.dart';

void main() {
  test('carrito inicial: totales derivados correctos', () {
    final c = PosController();

    // Carrito inicial del diseño: hamburguesa x1 (89) + coca x2 (36) +
    // papas x1 (45) + cheesecake x1 (55) = 225.
    expect(c.subtotal, 225);

    // Impuestos = (subtotal - descuento) * 16% = (225 - 15) * 0.16 = 33.6
    expect(c.taxes, closeTo(33.6, 0.0001));

    // Total = subtotal - descuento + impuestos = 225 - 15 + 33.6 = 243.6
    expect(c.total, closeTo(243.6, 0.0001));
  });

  test('increment / decrement / remove mutan el carrito', () {
    final c = PosController();
    expect(c.qtyOf('coca'), 2);

    c.increment('coca');
    expect(c.qtyOf('coca'), 3);

    c.decrement('coca');
    c.decrement('coca');
    c.decrement('coca');
    expect(c.qtyOf('coca'), 0); // removido al llegar a 0

    c.remove('hamburguesa');
    expect(c.qtyOf('hamburguesa'), 0);
  });
}
