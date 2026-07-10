import '../../../../business/models/category.dart';
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

  Future<Result<Sale>> createSale({
    required List<CartLine> lines,
    required String paymentMethod,
  });
}
