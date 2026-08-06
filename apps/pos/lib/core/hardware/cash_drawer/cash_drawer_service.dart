import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../error/result.dart';

/// Interfaz de cajón de dinero (apertura vía comando ESC/POS o pulso directo
/// a la impresora térmica). Stub — sin implementación real todavía.
abstract class CashDrawerService {
  Future<Result<void>> open();
}

class NoopCashDrawerService implements CashDrawerService {
  const NoopCashDrawerService();

  @override
  Future<Result<void>> open() async => const Result.ok(null);
}

final cashDrawerServiceProvider = Provider<CashDrawerService>((ref) => const NoopCashDrawerService());
