import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'events/app_event.dart';

/// Bus de eventos interno — desacopla features entre sí. Ej.: POS termina
/// una venta y publica `SaleCompletedEvent`; Inventario/Caja/Dashboard
/// escuchan sin conocer a POS. No reemplaza HTTP ni simula websockets: solo
/// notifica hechos ya ocurridos localmente (o ya confirmados por el
/// backend). Cuando llegue tiempo real remoto, el `StreamProvider` que
/// consuma el socket puede publicar aquí para unificar ambos orígenes.
class EventBus {
  final _controller = StreamController<AppEvent>.broadcast();

  void publish(AppEvent event) => _controller.add(event);

  Stream<T> on<T extends AppEvent>() => _controller.stream.where((e) => e is T).cast<T>();

  void dispose() => _controller.close();
}

final eventBusProvider = Provider<EventBus>((ref) {
  final bus = EventBus();
  ref.onDispose(bus.dispose);
  return bus;
});
