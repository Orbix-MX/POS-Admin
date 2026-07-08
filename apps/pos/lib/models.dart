// Modelos de dominio del POS (subconjunto necesario para la pantalla de venta).

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.price,
    required this.stock,
    required this.category,
  });

  final String id;
  final String name;
  final double price;
  final int stock;
  final String category;
}

class CartLine {
  const CartLine({required this.product, required this.qty});

  final Product product;
  final int qty;

  double get lineTotal => product.price * qty;
}

/// Tarjeta de estadística inferior con su mini serie (sparkline).
class StatCard {
  const StatCard({
    required this.label,
    required this.value,
    required this.trend,
    required this.points,
  });

  final String label;
  final String value;
  final String trend;

  /// Puntos normalizados en el viewBox 70x30 del diseño.
  final List<(double, double)> points;
}
