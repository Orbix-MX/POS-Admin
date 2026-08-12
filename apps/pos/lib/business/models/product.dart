/// Producto del catálogo — subconjunto de campos que el POS necesita para
/// vender (precio, stock, nombre). Espejo parcial de `Product`
/// (`api/prisma/schema.prisma:583`) vía `GET /products`.
class Product {
  const Product({
    required this.id,
    required this.name,
    required this.price,
    required this.stock,
    this.categoryId,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String,
        price: double.parse(json['price'].toString()),
        stock: json['stock'] as int,
        categoryId: json['categoryId'] as String?,
      );

  final String id;
  final String name;
  final double price;
  final int stock;
  final String? categoryId;
}
