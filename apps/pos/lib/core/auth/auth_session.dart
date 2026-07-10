import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../business/models/tenant.dart';
import '../../business/models/user.dart';
import '../error/failures.dart';
import '../storage/secure_storage.dart';
import 'auth_repository.dart';
import 'biometric_service.dart';

enum AuthStatus { restoring, unauthenticated, authenticating, authenticated, sessionExpired, locked }

class AuthSessionState {
  const AuthSessionState({
    this.status = AuthStatus.restoring,
    this.user,
    this.tenant,
    this.availableTenants,
    this.errorMessage,
  });

  final AuthStatus status;
  final User? user;
  final Tenant? tenant;
  final List<Tenant>? availableTenants;
  final String? errorMessage;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  /// Sesión válida pero sin tenant activo — el router redirige a
  /// selección de empresa (ver `auth_guard.dart`).
  bool get needsTenantSelection => isAuthenticated && tenant == null;

  AuthSessionState copyWith({
    AuthStatus? status,
    User? user,
    Tenant? tenant,
    List<Tenant>? availableTenants,
    String? errorMessage,
  }) =>
      AuthSessionState(
        status: status ?? this.status,
        user: user ?? this.user,
        tenant: tenant ?? this.tenant,
        availableTenants: availableTenants ?? this.availableTenants,
        errorMessage: errorMessage,
      );
}

/// Fuente única de sesión: usuario, tenant activo, estado de autenticación.
/// Mantiene el JWT fuera de este estado (vive en `SecureStorage`) — este
/// notifier solo orquesta login/logout/cambio de tenant y expone estado de
/// UI, nunca llama a `dio` directamente (regla del proyecto #4).
class AuthSessionNotifier extends Notifier<AuthSessionState> {
  late final AuthRepository _repository;
  late final SecureStorage _secureStorage;
  late final BiometricService _biometricService;

  /// Guardado al bloquear para poder restaurar `user`/`tenant` al
  /// desbloquear sin volver a pedir `/auth/me` (el token sigue vivo).
  AuthSessionState? _preLockState;

  @override
  AuthSessionState build() {
    _repository = ref.watch(authRepositoryProvider);
    _secureStorage = ref.watch(secureStorageProvider);
    _biometricService = ref.watch(biometricServiceProvider);
    return const AuthSessionState();
  }

  Future<void> login({required String email, required String password, String? tenantSlug}) async {
    state = state.copyWith(status: AuthStatus.authenticating, errorMessage: null);

    final result = await _repository.login(email: email, password: password, tenantSlug: tenantSlug);

    result.fold(
      (login) async {
        await _secureStorage.writeTokens(accessToken: login.accessToken, refreshToken: login.refreshToken);
        state = AuthSessionState(
          status: AuthStatus.authenticated,
          user: login.user,
          tenant: login.tenant,
          availableTenants: login.availableTenants,
        );
      },
      (failure) {
        state = state.copyWith(status: AuthStatus.unauthenticated, errorMessage: failure.displayMessage);
      },
    );
  }

  Future<void> selectTenant(String slug) async {
    final result = await _repository.selectTenant(slug);
    result.fold(
      (tenant) => state = state.copyWith(tenant: tenant),
      (failure) => state = state.copyWith(errorMessage: failure.displayMessage),
    );
  }

  /// Llamado por el `RefreshInterceptor`/router cuando un 401 no se pudo
  /// resolver — fuerza el estado a `sessionExpired` para que el guard
  /// redirija a `/login` sin perder el mensaje de "tu sesión expiró".
  void markSessionExpired() {
    state = state.copyWith(status: AuthStatus.sessionExpired);
  }

  /// Bloqueo local: no llama a la API ni toca los tokens, solo gatea la UI
  /// (ver `auth_guard.dart`). No-op si no hay PIN local configurado — no
  /// tiene sentido bloquear sin forma de desbloquear.
  Future<void> lock() async {
    if (!state.isAuthenticated) return;
    if (!await _secureStorage.hasLocalPin()) return;

    _preLockState = state;
    state = state.copyWith(status: AuthStatus.locked);
  }

  /// Intenta desbloquear con biometría (si está habilitada). No re-loguea
  /// contra el backend — solo restaura el estado guardado antes de bloquear.
  Future<bool> unlockWithBiometric() async {
    if (state.status != AuthStatus.locked) return false;

    bool enabled;
    try {
      enabled = await _secureStorage.isBiometricEnabled().timeout(const Duration(seconds: 5));
    } catch (_) {
      return false;
    }
    if (!enabled) return false;

    final ok = await _biometricService.authenticate();
    if (ok) _restoreFromLock();
    return ok;
  }

  /// Desbloquea comparando contra el hash del PIN local guardado.
  ///
  /// `flutter_secure_storage` puede colgarse en Android si una lectura se
  /// solapa con otra (ver `LockScreen._tryBiometric`, que lee
  /// `isBiometricEnabled` justo al montar la pantalla) — sin timeout, el
  /// `Future` nunca resuelve y la UI se queda sin feedback indefinidamente.
  Future<bool> unlockWithPin(String pin) async {
    if (state.status != AuthStatus.locked) return false;

    bool ok;
    try {
      ok = await _secureStorage.verifyLocalPin(pin).timeout(const Duration(seconds: 5));
    } catch (_) {
      state = state.copyWith(errorMessage: 'No se pudo verificar el PIN. Intenta de nuevo.');
      return false;
    }

    if (ok) {
      _restoreFromLock();
    } else {
      state = state.copyWith(errorMessage: 'PIN incorrecto.');
    }
    return ok;
  }

  void _restoreFromLock() {
    final restored = _preLockState;
    state = restored?.copyWith(status: AuthStatus.authenticated) ??
        state.copyWith(status: AuthStatus.authenticated);
    _preLockState = null;
  }

  Future<void> logout() async {
    final refreshToken = await _secureStorage.readRefreshToken();
    await _repository.logout(refreshToken: refreshToken);
    await _secureStorage.clear();
    state = const AuthSessionState(status: AuthStatus.unauthenticated);
  }

  /// Llamado una vez al arrancar la app (`bootstrap.dart`). Si hay un
  /// access token guardado, intenta hidratar la sesión con `/auth/me` sin
  /// pedir credenciales de nuevo; si no hay token o el token ya no es
  /// válido, cae a `unauthenticated` y el guard manda a `/login`.
  Future<void> restoreSession() async {
    final token = await _secureStorage.readAccessToken();
    if (token == null) {
      state = const AuthSessionState(status: AuthStatus.unauthenticated);
      return;
    }

    final result = await _repository.getProfile();
    result.fold(
      (profile) => state = AuthSessionState(
        status: AuthStatus.authenticated,
        user: profile.user,
        tenant: profile.tenant,
      ),
      (_) => state = const AuthSessionState(status: AuthStatus.unauthenticated),
    );
  }
}

final authSessionProvider = NotifierProvider<AuthSessionNotifier, AuthSessionState>(
  AuthSessionNotifier.new,
);
