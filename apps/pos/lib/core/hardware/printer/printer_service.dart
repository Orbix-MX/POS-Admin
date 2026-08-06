import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../error/result.dart';

/// Interfaz de impresión térmica. Los features consumen esto vía Riverpod,
/// nunca el plugin del SDK de la impresora directamente (regla del proyecto
/// #8) — así cambiar de fabricante/SDK no toca ningún feature.
abstract class PrinterService {
  Future<Result<void>> printReceipt(List<int> escposBytes);

  Future<bool> get isConnected;
}

/// Implementación no-op — sin impresora conectada todavía. Primer caso de
/// uso real llega en Fase 2 (impresión de ticket de POS).
class NoopPrinterService implements PrinterService {
  const NoopPrinterService();

  @override
  Future<bool> get isConnected async => false;

  @override
  Future<Result<void>> printReceipt(List<int> escposBytes) async => const Result.ok(null);
}

final printerServiceProvider = Provider<PrinterService>((ref) => const NoopPrinterService());
