/// Moneda soportada. Orbix opera hoy en MXN; se deja como enum (no `String`
/// suelto) para que agregar una segunda moneda sea un solo punto de cambio.
enum Currency {
  mxn('MXN', '\$'),
  usd('USD', 'US\$');

  const Currency(this.code, this.symbol);

  final String code;
  final String symbol;
}
