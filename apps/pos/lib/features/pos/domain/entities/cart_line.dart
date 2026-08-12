import '../../../../business/models/money.dart';
import '../../../../business/models/product.dart';

/// Tasa de impuesto aplicada solo cuando la venta requiere factura —
/// fuente única compartida entre `PosSaleData` (preview) y
/// `PosRepositoryImpl` (request real a `/orders`), para que nunca se
/// desincronicen.
const kPosTaxRate = 0.16;

/// Línea del carrito de la venta actual — producto + cantidad. `lineTotal`
/// usa [Money] (centavos enteros), no `double`, para no arrastrar el error
/// de redondeo clásico de POS al sumar totales.
class CartLine {
  const CartLine({required this.product, required this.qty});

  final Product product;
  final int qty;

  Money get lineTotal => Money.fromDouble(product.price * qty);
}
