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

  String format() => '${currency.symbol}${amount.toStringAsFixed(2)}';

  @override
  String toString() => format();

  @override
  bool operator ==(Object other) =>
      other is Money && other.cents == cents && other.currency == currency;

  @override
  int get hashCode => Object.hash(cents, currency);
}
