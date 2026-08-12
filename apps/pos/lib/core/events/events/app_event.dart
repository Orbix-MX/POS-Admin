/// Marcador base de eventos publicados en `EventBus`. Notifican hechos ya
/// ocurridos entre features (desacoplo) — nunca se usan para pedir datos;
/// eso sube a `business/` (regla del proyecto #9).
abstract class AppEvent {
  const AppEvent();
}

class SaleCompletedEvent extends AppEvent {
  const SaleCompletedEvent({required this.saleId, required this.branchId, required this.totalCents});

  final String saleId;
  final String branchId;
  final int totalCents;
}

class InventoryUpdatedEvent extends AppEvent {
  const InventoryUpdatedEvent({required this.productId, required this.branchId});

  final String productId;
  final String branchId;
}

class SessionExpiredEvent extends AppEvent {
  const SessionExpiredEvent();
}

class BranchChangedEvent extends AppEvent {
  const BranchChangedEvent({required this.branchId});

  final String branchId;
}

class ThemeChangedEvent extends AppEvent {
  const ThemeChangedEvent({required this.isDark});

  final bool isDark;
}
