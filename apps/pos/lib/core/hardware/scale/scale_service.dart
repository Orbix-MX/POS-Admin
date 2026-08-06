import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Interfaz de báscula (peso de producto por kg, relevante en abarrotes).
/// Stub — sin implementación real todavía.
abstract class ScaleService {
  Stream<double> weightGrams();
}

class NoopScaleService implements ScaleService {
  const NoopScaleService();

  @override
  Stream<double> weightGrams() => const Stream.empty();
}

final scaleServiceProvider = Provider<ScaleService>((ref) => const NoopScaleService());
