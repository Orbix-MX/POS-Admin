import '../../business/models/money.dart';

/// Formatea un [Money] para UI. Reemplaza el helper `money(double)` suelto
/// que vivía en `pos_controller.dart` — la fuente de verdad ahora es
/// `Money.format()`; esto queda como atajo de compatibilidad para vistas
/// que todavía trabajan con `double` crudo (se elimina al migrar `pos/` a
/// `Money` en Fase 2).
String formatAmount(double amount) => Money.fromDouble(amount).format();
