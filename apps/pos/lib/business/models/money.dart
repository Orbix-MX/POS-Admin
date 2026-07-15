import 'currency.dart';

/// Value object de dinero. Almacena centavos como entero para evitar el
/// error de redondeo de sumar/restar `double` directamente en totales de
/// venta — el bug clásico de POS que esto existe para prevenir.
class Money {
  const Money(this.cents, {this.currency = Currency.mxn});

  factory Money.fromDouble(double amount, {Currency currency = Currency.mxn}) =>
      Money((amount * 100).round(), currency: currency);

  final int cents;
  final Currency currency;

  double get amount => cents / 100;

  Money operator +(Money other) {
    assert(currency == other.currency, 'No se pueden sumar montos de monedas distintas');
    return Money(cents + other.cents, currency: currency);
  }

  Money operator -(Money other) {
    assert(currency == other.currency, 'No se pueden restar montos de monedas distintas');
    return Money(cents - other.cents, currency: currency);
  }

  Money operator *(num factor) => Money((cents * factor).round(), currency: currency);

  bool operator >(Money other) => cents > other.cents;

  bool operator <(Money other) => cents < other.cents;

  Money clamp(Money min, Money max) => Money(cents.clamp(min.cents, max.cents), currency: currency);

  String format() => '${currency.symbol}${amount.toStringAsFixed(2)}';

  /// Reparte [total] proporcionalmente entre [weights] (ej. el total de
  /// cada línea del carrito) sin perder centavos por redondeo — el
  /// remanente de la división entera se asigna a la línea de mayor peso.
  /// Usado para prorratear descuento/impuesto de la venta entre los items
  /// que manda `POST /orders` (el backend sólo entiende descuento/impuesto
  /// por línea, no a nivel de venta completa — ver `CreateOrderItemDto`).
  static List<Money> distribute(Money total, List<int> weights) {
    final totalWeight = weights.fold<int>(0, (a, w) => a + w);
    if (totalWeight <= 0 || total.cents == 0) {
      return List.filled(weights.length, Money(0, currency: total.currency));
    }
    final shares = <int>[];
    var assigned = 0;
    for (final w in weights) {
      final share = (total.cents * w) ~/ totalWeight;
      shares.add(share);
      assigned += share;
    }
    var remainder = total.cents - assigned;
    if (remainder != 0) {
      final maxIndex = weights.indexOf(weights.reduce((a, b) => a > b ? a : b));
      shares[maxIndex] += remainder;
      remainder = 0;
    }
    return shares.map((c) => Money(c, currency: total.currency)).toList();
  }

  @override
  String toString() => format();

  @override
  bool operator ==(Object other) =>
      other is Money && other.cents == cents && other.currency == currency;

  @override
  int get hashCode => Object.hash(cents, currency);
}
