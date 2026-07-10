import 'package:flutter_test/flutter_test.dart';

import 'package:orbix_pos/business/models/category.dart';
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
  test('totales derivados: subtotal, descuento plano, impuestos', () {
    // hamburguesa x1 (89) + coca x2 (36) + papas x1 (45) + cheesecake x1 (55) = 225.
    final data = _dataWithCart({'hamburguesa': 1, 'coca': 2, 'papas': 1, 'cheesecake': 1});

    expect(data.subtotal.amount, 225);
    // Impuestos = (subtotal - descuento) * 16% = (225 - 15) * 0.16 = 33.6
    expect(data.taxes.amount, closeTo(33.6, 0.0001));
    // Total = subtotal - descuento + impuestos = 225 - 15 + 33.6 = 243.6
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
}
