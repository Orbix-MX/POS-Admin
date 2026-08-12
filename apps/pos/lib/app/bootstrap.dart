import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';
import 'package:talker_riverpod_logger/talker_riverpod_logger_observer.dart';

import '../core/auth/auth_session.dart';
import '../core/platform/platform_service.dart';

/// Inicialización que corre antes de `runApp`. Dispara la restauración de
/// sesión guardada y arma el `ProviderContainer` que se reutiliza como root
/// de `ProviderScope` (así no se pierde el trabajo ya hecho por
/// `restoreSession()`). El observer de Riverpod solo se agrega en debug —
/// en release no tiene sentido loggear cada rebuild de provider.
Future<ProviderContainer> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Móvil (tablet/teléfono, Android/iOS): status bar y navigation bar
  // ocultas por default — POS es tablet-first y esa chrome del SO solo
  // resta espacio útil. `immersiveSticky` las revela temporalmente
  // con un swipe desde el borde y se re-ocultan solas. No aplica a
  // desktop, que no tiene ese concepto de barras del sistema.
  if (const PlatformService().isMobile) {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }

  final container = ProviderContainer(
    observers: kDebugMode ? [TalkerRiverpodObserver(talker: Talker())] : const [],
  );

  await container.read(authSessionProvider.notifier).restoreSession();

  return container;
}
