/// Eventos internos de producto (no Google Analytics). Tipados como clases,
/// no strings sueltos — sirven de base para telemetría y debugging de
/// soporte ("¿el usuario llegó a completar la venta?").
abstract class AnalyticsEvent {
  const AnalyticsEvent();

  String get name;

  Map<String, Object?> get properties => const {};
}

// Nombrados con sufijo `Analytics*` (no `SaleCompletedEvent` a secas) porque
// `core/events/events/app_event.dart` ya define un `SaleCompletedEvent` para
// el EventBus — son conceptos distintos (telemetría vs. desacoplo entre
// features) que sí se importan juntos cuando POS cobra una venta.
class AnalyticsSaleStartedEvent extends AnalyticsEvent {
  const AnalyticsSaleStartedEvent();

  @override
  String get name => 'sale_started';
}

class AnalyticsSaleCompletedEvent extends AnalyticsEvent {
  const AnalyticsSaleCompletedEvent({required this.totalCents, required this.paymentMethod});

  final int totalCents;
  final String paymentMethod;

  @override
  String get name => 'sale_completed';

  @override
  Map<String, Object?> get properties => {'totalCents': totalCents, 'paymentMethod': paymentMethod};
}

class AnalyticsPrintTicketEvent extends AnalyticsEvent {
  const AnalyticsPrintTicketEvent();

  @override
  String get name => 'print_ticket';
}

class AnalyticsLoginEvent extends AnalyticsEvent {
  const AnalyticsLoginEvent();

  @override
  String get name => 'login';
}

class AnalyticsLogoutEvent extends AnalyticsEvent {
  const AnalyticsLogoutEvent();

  @override
  String get name => 'logout';
}

class AnalyticsInventoryAdjustmentEvent extends AnalyticsEvent {
  const AnalyticsInventoryAdjustmentEvent({required this.productId, required this.delta});

  final String productId;
  final int delta;

  @override
  String get name => 'inventory_adjustment';

  @override
  Map<String, Object?> get properties => {'productId': productId, 'delta': delta};
}
