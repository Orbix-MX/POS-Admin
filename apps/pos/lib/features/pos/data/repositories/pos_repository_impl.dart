import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../business/models/category.dart';
import '../../../../business/models/money.dart';
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
    required Money discount,
    required bool requiresInvoice,
  }) async {
    try {
      // `POST /orders` (`CreateOrderItemDto`) solo acepta descuento/impuesto
      // por línea, no a nivel de venta completa — se prorratea aquí por
      // peso de línea (`Money.distribute`) para que el total que cobra el
      // backend coincida exactamente con el que vio el cajero en el ticket.
      final weights = lines.map((l) => l.lineTotal.cents).toList();
      final discountPerLine = Money.distribute(discount, weights);
      final subtotalAfterDiscount = <Money>[
        for (var i = 0; i < lines.length; i++) lines[i].lineTotal - discountPerLine[i],
      ];
      final totalTax = requiresInvoice
          ? subtotalAfterDiscount.fold(const Money(0), (acc, s) => acc + s) * kPosTaxRate
          : const Money(0);
      final taxPerLine = requiresInvoice
          ? Money.distribute(totalTax, subtotalAfterDiscount.map((s) => s.cents).toList())
          : List.filled(lines.length, const Money(0));

      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.orders,
        data: {
          'items': [
            for (var i = 0; i < lines.length; i++)
              {
                'productId': lines[i].product.id,
                'quantity': lines[i].qty,
                'price': lines[i].product.price,
                'discount': discountPerLine[i].amount,
                // Sin factura: se fuerza 0 aunque el producto/tenant tengan
                // taxRate configurado (`taxExempt`, ver `create-order.dto.ts`).
                // Con factura: se manda el impuesto ya calculado en cliente
                // (16% plano) para que preview y cobro coincidan exacto —
                // el backend respeta un `tax` explícito > 0 sobre el
                // derivado del producto.
                'tax': taxPerLine[i].amount,
                if (!requiresInvoice) 'taxExempt': true,
              },
          ],
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
