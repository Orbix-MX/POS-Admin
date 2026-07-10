import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

/// Wrapper delgado sobre `local_auth` — solo se usa para desbloquear la
/// pantalla localmente (`LockScreen`), nunca para autenticar contra la API.
class BiometricService {
  BiometricService(this._auth);

  final LocalAuthentication _auth;

  Future<bool> canUseBiometrics() async {
    final supported = await _auth.isDeviceSupported();
    final canCheck = await _auth.canCheckBiometrics;
    return supported && canCheck;
  }

  Future<bool> authenticate() async {
    try {
      return await _auth.authenticate(
        localizedReason: 'Desbloquea Orbix',
        options: const AuthenticationOptions(biometricOnly: true, stickyAuth: true),
      );
    } on Exception {
      return false;
    }
  }
}

final biometricServiceProvider = Provider<BiometricService>((ref) {
  return BiometricService(LocalAuthentication());
});
