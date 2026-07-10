import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../business/models/category.dart';
import '../../../../business/models/money.dart';
import '../../../../business/models/product.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/error/result.dart';
import '../../../../core/events/event_bus.dart';
import '../../../../core/events/events/app_event.dart';
import '../../data/repositories/pos_repository_impl.dart';
import '../../domain/entities/cart_line.dart';
import '../../domain/entities/sale.dart';

/// Descuento plano de la venta actual. Fase 2 solo reproduce el
/// comportamiento del mock original (`PosController.discount`); un
/// descuento real (por producto/cupón) es trabajo de un feature aparte.
const _flatDiscount = 15.0;
const _taxRate = 0.16;

/// Estado inmutable de la pantalla de venta: catálogo (cargado una vez al
/// entrar) + carrito (mutado localmente hasta el cobro).
class PosSaleData {
  const PosSaleData({
    required this.products,
    required this.categories,
    required this.cart,
    required this.activeCategory,
  });

  final List<Product> products;
  final List<Category> categories;
  final Map<String, int> cart;
  final String activeCategory;

  PosSaleData copyWith({Map<String, int>? cart, String? activeCategory}) => PosSaleData(
        products: products,
        categories: categories,
        cart: cart ?? this.cart,
        activeCategory: activeCategory ?? this.activeCategory,
      );

  int qtyOf(String productId) => cart[productId] ?? 0;

  List<CartLine> get cartLines => cart.entries.map((e) {
        final product = products.firstWhere((p) => p.id == e.key);
        return CartLine(product: product, qty: e.value);
      }).toList();

  Money get subtotal => cartLines.fold(
        const Money(0),
        (acc, l) => acc + l.lineTotal,
      );

  Money get discount => Money.fromDouble(_flatDiscount);

  Money get taxes => (subtotal - discount) * _taxRate;

  Money get total => subtotal - discount + taxes;
}

/// Reemplaza `PosController` (ChangeNotifier) — fuente única de la pantalla
/// de venta actual, ahora contra el backend real en vez de datos de muestra.
class PosSaleNotifier extends AsyncNotifier<PosSaleData> {
  @override
  Future<PosSaleData> build() async {
    final repository = ref.watch(posRepositoryProvider);

    final productsResult = await repository.getProducts();
    final products = productsResult.fold((p) => p, (failure) => throw failure);

    final categoriesResult = await repository.getCategories();
    final categories = categoriesResult.fold((c) => c, (failure) => throw failure);

    return PosSaleData(
      products: products,
      categories: categories,
      cart: const {},
      activeCategory: categories.isNotEmpty ? categories.first.name : '',
    );
  }

  void increment(String productId) => _mutate((d) {
        final cart = Map<String, int>.of(d.cart);
        cart[productId] = (cart[productId] ?? 0) + 1;
        return d.copyWith(cart: cart);
      });

  void decrement(String productId) => _mutate((d) {
        final cart = Map<String, int>.of(d.cart);
        final q = (cart[productId] ?? 0) - 1;
        if (q <= 0) {
          cart.remove(productId);
        } else {
          cart[productId] = q;
        }
        return d.copyWith(cart: cart);
      });

  void remove(String productId) => _mutate((d) {
        final cart = Map<String, int>.of(d.cart)..remove(productId);
        return d.copyWith(cart: cart);
      });

  void setCategory(String category) => _mutate((d) => d.copyWith(activeCategory: category));

  void _mutate(PosSaleData Function(PosSaleData current) update) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(update(current));
  }

  /// Cobra la venta actual. Publica `SaleCompletedEvent` y vacía el
  /// carrito solo si el backend confirma la venta.
  Future<Result<Sale>> checkout({required String paymentMethod}) async {
    final current = state.value;
    if (current == null || current.cartLines.isEmpty) {
      return const Result.err(Failure.validation('El carrito está vacío.'));
    }

    final repository = ref.read(posRepositoryProvider);
    final result = await repository.createSale(lines: current.cartLines, paymentMethod: paymentMethod);

    result.fold(
      (sale) {
        ref.read(eventBusProvider).publish(
              SaleCompletedEvent(saleId: sale.id, branchId: sale.branchId ?? '', totalCents: sale.total.cents),
            );
        _mutate((d) => d.copyWith(cart: const {}));
      },
      (_) {},
    );

    return result;
  }
}

final posSaleProvider = AsyncNotifierProvider<PosSaleNotifier, PosSaleData>(PosSaleNotifier.new);
