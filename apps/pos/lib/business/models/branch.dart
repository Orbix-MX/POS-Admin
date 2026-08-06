/// Sucursal. Espejo parcial del modelo `Branch` de Prisma
/// (`api/prisma/schema.prisma:1274`) — solo los campos que la app consume hoy;
/// se amplía cuando exista un endpoint real de listado/detalle de sucursales.
class Branch {
  const Branch({
    required this.id,
    required this.name,
    required this.code,
    this.isMain = false,
  });

  factory Branch.fromJson(Map<String, dynamic> json) => Branch(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String,
        isMain: json['isMain'] as bool? ?? false,
      );

  final String id;
  final String name;
  final String code;
  final bool isMain;
}
