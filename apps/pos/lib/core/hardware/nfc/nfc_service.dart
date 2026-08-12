import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Interfaz NFC (pago sin contacto, credencial de acceso en gimnasio/taller).
/// Stub — sin implementación real todavía.
abstract class NfcService {
  Future<String?> readTag();
}

class NoopNfcService implements NfcService {
  const NoopNfcService();

  @override
  Future<String?> readTag() async => null;
}

final nfcServiceProvider = Provider<NfcService>((ref) => const NoopNfcService());
