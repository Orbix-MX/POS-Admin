import '../../../../business/models/category.dart';
import '../../../../business/models/money.dart';
import '../../../../business/models/product.dart';
import '../../../../core/error/result.dart';
import '../entities/cart_line.dart';
import '../entities/sale.dart';

/// Puerta única de datos del feature POS. La presentación nunca llama a
/// `dio` directamente (regla del proyecto #4) — solo consume esto vía
/// `posRepositoryProvider`.
abstract class PosRepository {
  Future<Result<List<Product>>> getProducts();

  Future<Result<List<Category>>> getCategories();

  /// [discount] es el descuento total de la venta (ya clampado al
  /// subtotal) — el backend solo acepta descuento por línea
  /// (`CreateOrderItemDto.discount`), así que el repositorio lo prorratea
  /// entre `lines` por peso de línea (`Money.distribute`). [requiresInvoice]
  /// controla si se cobra impuesto (16%) o se fuerza a 0 por línea
  /// (`taxExempt`) — ver `PosSaleData` para la regla de negocio completa.
  Future<Result<Sale>> createSale({
    required List<CartLine> lines,
    required String paymentMethod,
    required Money discount,
    required bool requiresInvoice,
  });
}
