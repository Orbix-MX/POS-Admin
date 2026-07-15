import 'package:flutter_test/flutter_test.dart';

import 'package:orbix_pos/business/models/category.dart';
import 'package:orbix_pos/business/models/money.dart';
import 'package:orbix_pos/business/models/product.dart';
import 'package:orbix_pos/features/pos/presentation/providers/pos_sale_notifier.dart';

const _products = [
  Product(id: 'coca', name: 'Coca Cola 600 ml', price: 18, stock: 24),
  Product(id: 'hamburguesa', name: 'Hamburguesa Clásica', price: 89, stock: 8),
  Product(id: 'papas', name: 'Papas a la Francesa', price: 45, stock: 20),
  Product(id: 'cheesecake', name: 'Cheesecake', price: 55, stock: 10),
];

const _categories = [Category(id: 'bebidas', name: 'Bebidas')];

PosSaleData _dataWithCart(Map<String, int> cart) => PosSaleData(
      products: _products,
      categories: _categories,
      cart: cart,
      activeCategory: 'Bebidas',
    );

void main() {
  test('sin descuento ni factura: total = subtotal, sin impuestos', () {
    // hamburguesa x1 (89) + coca x2 (36) + papas x1 (45) + cheesecake x1 (55) = 225.
    final data = _dataWithCart({'hamburguesa': 1, 'coca': 2, 'papas': 1, 'cheesecake': 1});

    expect(data.subtotal.amount, 225);
    expect(data.effectiveDiscount.amount, 0);
    expect(data.taxes.amount, 0);
    expect(data.total.amount, 225);
  });

  test('descuento manual reduce el total; sin factura sigue sin impuestos', () {
    final data = _dataWithCart({'coca': 2}).copyWith(discount: Money.fromDouble(10));

    expect(data.subtotal.amount, 36);
    expect(data.effectiveDiscount.amount, 10);
    expect(data.taxes.amount, 0);
    expect(data.total.amount, 26);
  });

  test('descuento clampado al subtotal (no permite total negativo)', () {
    final data = _dataWithCart({'coca': 2}).copyWith(discount: Money.fromDouble(999));

    expect(data.effectiveDiscount.amount, 36); // clampado al subtotal
    expect(data.total.amount, 0);
  });

  test('requiere factura: impuestos = 16% sobre (subtotal - descuento)', () {
    final data = _dataWithCart({'hamburguesa': 1, 'coca': 2, 'papas': 1, 'cheesecake': 1}).copyWith(
      discount: Money.fromDouble(15),
      requiresInvoice: true,
    );

    // Impuestos = (225 - 15) * 16% = 33.6
    expect(data.taxes.amount, closeTo(33.6, 0.0001));
    // Total = 225 - 15 + 33.6 = 243.6
    expect(data.total.amount, closeTo(243.6, 0.0001));
  });

  test('copyWith muta el carrito sin tocar catálogo ni categoría activa', () {
    final data = _dataWithCart({'coca': 2});
    expect(data.qtyOf('coca'), 2);

    final incremented = data.copyWith(cart: {'coca': 3});
    expect(incremented.qtyOf('coca'), 3);
    expect(incremented.products, data.products);
    expect(incremented.activeCategory, data.activeCategory);

    final removed = data.copyWith(cart: const {});
    expect(removed.qtyOf('coca'), 0);
  });

  test('Money.distribute reparte sin perder centavos por redondeo', () {
    final shares = Money.distribute(Money.fromDouble(10), [1, 1, 1]);
    expect(shares.fold(0, (a, m) => a + m.cents), 1000); // $10.00 exactos
    expect(shares.every((m) => m.cents > 0), true);
  });

  test('Money.distribute con total 0 devuelve ceros', () {
    final shares = Money.distribute(const Money(0), [1, 2, 3]);
    expect(shares.every((m) => m.cents == 0), true);
  });
}
