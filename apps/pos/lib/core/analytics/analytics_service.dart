import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

import '../utils/logger.dart';
import 'events/app_analytics_event.dart';

/// Eventos internos de producto, no analítica de terceros (no es Google
/// Analytics). Implementación no-op en dev; en prod puede enviar al propio
/// backend NestJS o a un proveedor — el punto de cambio es uno solo.
abstract class AnalyticsService {
  void track(AnalyticsEvent event);
}

class NoopAnalyticsService implements AnalyticsService {
  const NoopAnalyticsService();

  @override
  void track(AnalyticsEvent event) {}
}

/// Impl de desarrollo: registra el evento en `talker` en vez de enviarlo a
/// ningún backend — útil para verificar que el evento correcto se disparó
/// sin depender de un proveedor real todavía.
class DevAnalyticsService implements AnalyticsService {
  DevAnalyticsService(this._talker);

  final Talker _talker;

  @override
  void track(AnalyticsEvent event) {
    _talker.info('[analytics] ${event.name} ${event.properties}');
  }
}

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return DevAnalyticsService(ref.watch(talkerProvider));
});
