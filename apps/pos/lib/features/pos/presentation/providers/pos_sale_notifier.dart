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

/// Estado inmutable de la pantalla de venta: catálogo (cargado una vez al
/// entrar) + carrito (mutado localmente hasta el cobro).
class PosSaleData {
  const PosSaleData({
    required this.products,
    required this.categories,
    required this.cart,
    required this.activeCategory,
    this.discount = const Money(0),
    this.requiresInvoice = false,
  });

  final List<Product> products;
  final List<Category> categories;
  final Map<String, int> cart;

  /// Categoría del filtro activo (id de `Category`), o `''` para "Todos"
  /// (sin filtro — el grid muestra todas las categorías agrupadas).
  final String activeCategory;

  /// Descuento manual de la venta — en cero salvo que el cajero lo agregue
  /// explícitamente (ver `_DiscountButton` en `ticket_panel.dart`).
  final Money discount;

  /// Si el cliente requiere factura. Controla si se cobra/muestra impuesto
  /// — no hay concepto de facturación (CFDI) en este backend todavía, es
  /// puramente la regla de "sin factura, sin impuesto visible".
  final bool requiresInvoice;

  PosSaleData copyWith({
    Map<String, int>? cart,
    String? activeCategory,
    Money? discount,
    bool? requiresInvoice,
  }) =>
      PosSaleData(
        products: products,
        categories: categories,
        cart: cart ?? this.cart,
        activeCategory: activeCategory ?? this.activeCategory,
        discount: discount ?? this.discount,
        requiresInvoice: requiresInvoice ?? this.requiresInvoice,
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

  /// Descuento efectivo — nunca más que el subtotal (evita total negativo
  /// si el cajero teclea un monto mayor al carrito).
  Money get effectiveDiscount => discount.clamp(const Money(0), subtotal);

  Money get taxes => requiresInvoice ? (subtotal - effectiveDiscount) * kPosTaxRate : const Money(0);

  Money get total => subtotal - effectiveDiscount + taxes;
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
      // Sin filtro por defecto: el grid muestra todas las categorías
      // agrupadas (ver `ProductGrid`).
      activeCategory: '',
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

  /// Descuento manual de la venta actual — cero hasta que el cajero lo
  /// agregue explícitamente. Se clampa contra el subtotal al leerse
  /// (`PosSaleData.effectiveDiscount`), aquí se guarda el valor tal cual se
  /// tecleó para no perder lo escrito si el carrito cambia después.
  void setDiscount(Money amount) => _mutate((d) => d.copyWith(discount: amount));

  void setRequiresInvoice(bool value) => _mutate((d) => d.copyWith(requiresInvoice: value));

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
    final result = await repository.createSale(
      lines: current.cartLines,
      paymentMethod: paymentMethod,
      discount: current.effectiveDiscount,
      requiresInvoice: current.requiresInvoice,
    );

    result.fold(
      (sale) {
        ref.read(eventBusProvider).publish(
              SaleCompletedEvent(saleId: sale.id, branchId: sale.branchId ?? '', totalCents: sale.total.cents),
            );
        _mutate((d) => d.copyWith(cart: const {}, discount: const Money(0), requiresInvoice: false));
      },
      (_) {},
    );

    return result;
  }
}

final posSaleProvider = AsyncNotifierProvider<PosSaleNotifier, PosSaleData>(PosSaleNotifier.new);
