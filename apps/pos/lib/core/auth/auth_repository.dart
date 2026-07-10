import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../business/models/tenant.dart';
import '../../business/models/user.dart';
import '../error/failures.dart';
import '../error/result.dart';
import '../network/api_endpoints.dart';
import '../network/dio_client.dart';

/// Resultado de un login/refresh exitoso — espejo de `AuthResponseDto` del
/// backend (`api/.../auth-response.dto.ts`).
class LoginResult {
  const LoginResult({
    required this.accessToken,
    this.refreshToken,
    required this.user,
    this.tenant,
    this.availableTenants,
  });

  final String accessToken;
  final String? refreshToken;
  final User user;
  final Tenant? tenant;
  final List<Tenant>? availableTenants;
}

/// Espejo de `ProfileResponseDto` — usado para restaurar sesión con un
/// token guardado sin tener que pedir credenciales de nuevo.
class ProfileResult {
  const ProfileResult({required this.user, this.tenant});

  final User user;
  final Tenant? tenant;
}

abstract class AuthRepository {
  Future<Result<LoginResult>> login({required String email, required String password, String? tenantSlug});

  Future<Result<Tenant>> selectTenant(String slug);

  Future<Result<ProfileResult>> getProfile();

  Future<Result<void>> logout({String? refreshToken});
}

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<Result<LoginResult>> login({
    required String email,
    required String password,
    String? tenantSlug,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.login,
        data: {
          'email': email,
          'password': password,
          'tenantSlug': ?tenantSlug,
        },
      );
      final data = response.data!;
      return Result.ok(
        LoginResult(
          accessToken: data['accessToken'] as String,
          refreshToken: data['refreshToken'] as String?,
          user: User.fromJson(data['user'] as Map<String, dynamic>),
          tenant: data['tenant'] != null ? Tenant.fromJson(data['tenant'] as Map<String, dynamic>) : null,
          availableTenants: (data['availableTenants'] as List<dynamic>?)
              ?.map((t) => Tenant.fromJson(t as Map<String, dynamic>))
              .toList(),
        ),
      );
    } on DioException catch (e) {
      return Result.err(e.error is Failure ? e.error as Failure : const Failure.unknown('Error al iniciar sesión.'));
    }
  }

  @override
  Future<Result<Tenant>> selectTenant(String slug) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(ApiEndpoints.selectTenant(slug));
      final data = response.data!;
      return Result.ok(Tenant.fromJson(data['tenant'] as Map<String, dynamic>));
    } on DioException catch (e) {
      return Result.err(e.error is Failure ? e.error as Failure : const Failure.unknown('Error al seleccionar empresa.'));
    }
  }

  @override
  Future<Result<ProfileResult>> getProfile() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(ApiEndpoints.me);
      final data = response.data!;
      return Result.ok(
        ProfileResult(
          user: User.fromJson(data['user'] as Map<String, dynamic>),
          tenant: data['currentTenant'] != null
              ? Tenant.fromJson(data['currentTenant'] as Map<String, dynamic>)
              : null,
        ),
      );
    } on DioException catch (e) {
      return Result.err(e.error is Failure ? e.error as Failure : const Failure.unknown('Error al cargar la sesión.'));
    }
  }

  @override
  Future<Result<void>> logout({String? refreshToken}) async {
    try {
      await _dio.post<void>(ApiEndpoints.logout, data: {'refreshToken': ?refreshToken});
      return const Result.ok(null);
    } on DioException catch (e) {
      // Logout es best-effort del lado servidor — la sesión local se limpia
      // de todas formas en `AuthSession.logout()`.
      return Result.err(e.error is Failure ? e.error as Failure : const Failure.unknown('Error al cerrar sesión.'));
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(ref.watch(dioProvider));
});
