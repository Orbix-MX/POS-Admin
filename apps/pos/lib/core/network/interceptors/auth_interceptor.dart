import 'package:dio/dio.dart';

import '../../storage/secure_storage.dart';

/// Adjunta el JWT vigente a cada request. El backend embebe tenant/branch
/// dentro del propio JWT (`JwtPayload.tenantId/branchId` — ver
/// `api/.../jwt.strategy.ts`), así que no hace falta un header de tenant
/// separado: renovar el token (select-tenant/select-branch) ya cambia el
/// contexto para las siguientes requests.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._secureStorage);

  final SecureStorage _secureStorage;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _secureStorage.readAccessToken();
    if (token != null && !options.extra.containsKey('skipAuth')) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}
