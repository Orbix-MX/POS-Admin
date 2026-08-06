/// Categoría de producto. Espejo parcial de `Category`
/// (`api/prisma/schema.prisma:534`) vía `GET /categories`.
class Category {
  const Category({required this.id, required this.name});

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: json['id'] as String,
        name: json['name'] as String,
      );

  final String id;
  final String name;
}
