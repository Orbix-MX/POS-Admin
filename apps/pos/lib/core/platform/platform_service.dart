import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Abstrae `Platform.isX` detrás de una interfaz. Ningún feature debe
/// importar `dart:io` `Platform` directamente — cuando llegue Flutter
/// Desktop (Fase 4), el punto de cambio es uno solo.
class PlatformService {
  const PlatformService();

  bool get isAndroid => !kIsWeb && Platform.isAndroid;

  bool get isIOS => !kIsWeb && Platform.isIOS;

  bool get isWindows => !kIsWeb && Platform.isWindows;

  bool get isMacOS => !kIsWeb && Platform.isMacOS;

  bool get isLinux => !kIsWeb && Platform.isLinux;

  bool get isMobile => isAndroid || isIOS;

  bool get isDesktop => isWindows || isMacOS || isLinux;
}

final platformServiceProvider = Provider<PlatformService>((ref) => const PlatformService());
