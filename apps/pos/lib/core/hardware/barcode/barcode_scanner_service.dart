import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Interfaz de lectura de código de barras (lector dedicado o cámara).
/// Stub — sin implementación real hasta que un feature (POS/Inventario) lo
/// necesite; existe ya para que nadie importe un plugin de scanner directo
/// en un feature.
abstract class BarcodeScannerService {
  Stream<String> scan();
}

class NoopBarcodeScannerService implements BarcodeScannerService {
  const NoopBarcodeScannerService();

  @override
  Stream<String> scan() => const Stream.empty();
}

final barcodeScannerServiceProvider =
    Provider<BarcodeScannerService>((ref) => const NoopBarcodeScannerService());
