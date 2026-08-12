import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Único lugar aceptable para guardar JWT/refresh token (regla del
/// proyecto #5). Nunca `SharedPreferences` para credenciales.
///
/// También guarda el PIN de bloqueo *local* (distinto del PIN de operador
/// del backend en `staff.controller.ts`): este PIN nunca sale del
/// dispositivo, solo gatea la UI tras un bloqueo por inactividad/segundo
/// plano — no re-autentica contra la API.
class SecureStorage {
  SecureStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _accessTokenKey = 'orbix.auth.accessToken';
  static const _refreshTokenKey = 'orbix.auth.refreshToken';
  static const _localPinHashKey = 'orbix.auth.localPinHash';
  static const _localPinLengthKey = 'orbix.auth.localPinLength';
  static const _biometricEnabledKey = 'orbix.auth.biometricEnabled';

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> writeTokens({required String accessToken, String? refreshToken}) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await clearLocalPin();
  }

  String _hashPin(String pin) => sha256.convert(utf8.encode('orbix.local-pin:$pin')).toString();

  Future<void> writeLocalPin(String pin) async {
    await _storage.write(key: _localPinHashKey, value: _hashPin(pin));
    await _storage.write(key: _localPinLengthKey, value: '${pin.length}');
  }

  Future<bool> verifyLocalPin(String pin) async {
    final stored = await _storage.read(key: _localPinHashKey);
    return stored != null && stored == _hashPin(pin);
  }

  Future<bool> hasLocalPin() async => await _storage.read(key: _localPinHashKey) != null;

  /// Longitud del PIN configurado (4-6) — la pantalla de bloqueo la
  /// necesita para saber cuándo el PIN está completo y no verificar antes
  /// de tiempo (ver `LockScreen`). `4` es el default si por alguna razón
  /// no se guardó (PIN configurado antes de este campo existir).
  Future<int> getLocalPinLength() async {
    final stored = await _storage.read(key: _localPinLengthKey);
    return stored != null ? int.parse(stored) : 4;
  }

  Future<void> clearLocalPin() async {
    await _storage.delete(key: _localPinHashKey);
    await _storage.delete(key: _localPinLengthKey);
    await _storage.delete(key: _biometricEnabledKey);
  }

  Future<void> setBiometricEnabled(bool enabled) =>
      _storage.write(key: _biometricEnabledKey, value: enabled.toString());

  Future<bool> isBiometricEnabled() async => await _storage.read(key: _biometricEnabledKey) == 'true';
}

final secureStorageProvider = Provider<SecureStorage>((ref) {
  return SecureStorage(const FlutterSecureStorage());
});
