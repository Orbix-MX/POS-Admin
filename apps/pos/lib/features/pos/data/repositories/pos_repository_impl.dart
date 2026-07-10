import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../business/models/category.dart';
import '../../../../business/models/pagination.dart';
import '../../../../business/models/product.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/error/result.dart';
import '../../../../core/network/api_endpoints.dart';
import '../../../../core/network/dio_client.dart';
import '../../domain/entities/cart_line.dart';
import '../../domain/entities/sale.dart';
import '../../domain/repositories/pos_repository.dart';

class PosRepositoryImpl implements PosRepository {
  PosRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<Result<List<Product>>> getProducts() async {
    try {
      // `limit: 500` — el POS todavía no pagina el grid (ver `ProductGrid`),
      // trae el catálogo completo hasta el tope de `PaginationDto`.
      final response = await _dio.get<Map<String, dynamic>>(
        ApiEndpoints.products,
        queryParameters: {'limit': 500},
      );
      final paginated = Paginated.fromJson(response.data!, Product.fromJson);
      return Result.ok(paginated.items);
    } on DioException catch (e) {
      return Result.err(
        e.error is Failure ? e.error as Failure : const Failure.unknown('Error al cargar productos.'),
      );
    }
  }

  @override
  Future<Result<List<Category>>> getCategories() async {
    try {
      final response = await _dio.get<List<dynamic>>(ApiEndpoints.categories);
      final categories = response.data!.map((c) => Category.fromJson(c as Map<String, dynamic>)).toList();
      return Result.ok(categories);
    } on DioException catch (e) {
      return Result.err(
        e.error is Failure ? e.error as Failure : const Failure.unknown('Error al cargar categorías.'),
      );
    }
  }

  @override
  Future<Result<Sale>> createSale({
    required List<CartLine> lines,
    required String paymentMethod,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.orders,
        data: {
          'items': lines
              .map((l) => {
                    'productId': l.product.id,
                    'quantity': l.qty,
                    'price': l.product.price,
                  })
              .toList(),
          'paymentMethod': paymentMethod,
        },
      );
      return Result.ok(Sale.fromJson(response.data!));
    } on DioException catch (e) {
      return Result.err(
        e.error is Failure ? e.error as Failure : const Failure.unknown('Error al registrar la venta.'),
      );
    }
  }
}

final posRepositoryProvider = Provider<PosRepository>((ref) {
  return PosRepositoryImpl(ref.watch(dioProvider));
});
