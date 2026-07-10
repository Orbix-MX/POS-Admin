import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Puente a feature flags remotos. Hoy sin implementación real — el
/// backend de Orbix ya expone capacidades por plan/tenant (`GET
/// /auth/me/capabilities`); cuando el guard de rutas o la activación de
/// verticales por plan lo necesiten, esta interfaz se implementa contra ese
/// endpoint sin que el resto de la app lo note.
abstract class RemoteConfig {
  bool isEnabled(String flagKey);
}

class NoopRemoteConfig implements RemoteConfig {
  const NoopRemoteConfig();

  @override
  bool isEnabled(String flagKey) => true;
}

final remoteConfigProvider = Provider<RemoteConfig>((ref) => const NoopRemoteConfig());
