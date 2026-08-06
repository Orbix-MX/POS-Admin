import '../../../../business/models/money.dart';

/// Venta creada — espejo parcial de la respuesta de `POST /orders`
/// (`Order` en `api/prisma/schema.prisma:1175`, ver `OrdersService.create`).
class Sale {
  const Sale({
    required this.id,
    required this.orderNumber,
    required this.total,
    this.branchId,
  });

  factory Sale.fromJson(Map<String, dynamic> json) => Sale(
        id: json['id'] as String,
        orderNumber: json['orderNumber'] as String,
        total: Money.fromDouble(double.parse(json['total'].toString())),
        branchId: json['branchId'] as String?,
      );

  final String id;
  final String orderNumber;
  final Money total;
  final String? branchId;
}
