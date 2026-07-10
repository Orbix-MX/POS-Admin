import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';
import 'package:talker_riverpod_logger/talker_riverpod_logger_observer.dart';

import '../core/auth/auth_session.dart';

/// Inicialización que corre antes de `runApp`. Dispara la restauración de
/// sesión guardada y arma el `ProviderContainer` que se reutiliza como root
/// de `ProviderScope` (así no se pierde el trabajo ya hecho por
/// `restoreSession()`). El observer de Riverpod solo se agrega en debug —
/// en release no tiene sentido loggear cada rebuild de provider.
Future<ProviderContainer> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  final container = ProviderContainer(
    observers: kDebugMode ? [TalkerRiverpodObserver(talker: Talker())] : const [],
  );

  await container.read(authSessionProvider.notifier).restoreSession();

  return container;
}
