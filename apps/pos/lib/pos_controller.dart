import 'package:flutter/foundation.dart';

import 'data.dart';
import 'models.dart';

/// Estado de la venta actual. Fuente única del carrito y los totales.
class PosController extends ChangeNotifier {
  final List<Product> products = List.of(kProducts);
  final List<String> categories = List.of(kCategories);

  final Map<String, int> _cart = Map.of(kInitialCart);
  String activeCategory = 'Bebidas';

  static const double discount = 15;
  static const double taxRate = 0.16;

  // ── Consultas ──────────────────────────────────────────────────────────────
  int qtyOf(String productId) => _cart[productId] ?? 0;

  int get lineCount => _cart.length;

  List<CartLine> get cartLines => _cart.entries.map((e) {
        final p = products.firstWhere((pr) => pr.id == e.key);
        return CartLine(product: p, qty: e.value);
      }).toList();

  double get subtotal =>
      cartLines.fold(0, (a, l) => a + l.lineTotal);

  double get taxes => (subtotal - discount) * taxRate;

  double get total => subtotal - discount + taxes;

  // ── Mutaciones ───────────────────────────────────────────────────────────
  void increment(String productId) {
    _cart[productId] = (_cart[productId] ?? 0) + 1;
    notifyListeners();
  }

  void decrement(String productId) {
    final q = (_cart[productId] ?? 0) - 1;
    if (q <= 0) {
      _cart.remove(productId);
    } else {
      _cart[productId] = q;
    }
    notifyListeners();
  }

  void remove(String productId) {
    _cart.remove(productId);
    notifyListeners();
  }

  void setCategory(String category) {
    if (activeCategory == category) return;
    activeCategory = category;
    notifyListeners();
  }
}

String money(double n) => '\$${n.toStringAsFixed(2)}';
