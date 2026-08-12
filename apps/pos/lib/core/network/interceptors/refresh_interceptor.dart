import 'package:dio/dio.dart';

import '../../config/environment.dart';
import '../../storage/secure_storage.dart';
import '../api_endpoints.dart';

/// Al recibir 401, intenta refrescar el token una sola vez (lock evita
/// refresh en carrera si varias requests fallan a la vez), reintenta la
/// request original con el nuevo token. Si el refresh falla, limpia la
/// sesión y deja que el 401 se propague — `AuthSession`/`auth_guard`
/// redirigen a `/login` al detectar que no hay token válido.
class RefreshInterceptor extends Interceptor {
  RefreshInterceptor(this._secureStorage, this._dio);

  final SecureStorage _secureStorage;
  final Dio _dio;

  Future<String>? _refreshing;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final isUnauthorized = err.response?.statusCode == 401;
    final isRefreshCall = err.requestOptions.path == ApiEndpoints.refresh;

    if (!isUnauthorized || isRefreshCall) {
      handler.next(err);
      return;
    }

    try {
      final newToken = await _refresh();
      final retryOptions = err.requestOptions;
      retryOptions.headers['Authorization'] = 'Bearer $newToken';
      final response = await _dio.fetch(retryOptions);
      handler.resolve(response);
    } catch (_) {
      await _secureStorage.clear();
      handler.next(err);
    }
  }

  Future<String> _refresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<String> _doRefresh() async {
    final refreshToken = await _secureStorage.readRefreshToken();
    if (refreshToken == null) {
      throw StateError('No hay refresh token disponible');
    }

    final refreshDio = Dio(BaseOptions(baseUrl: EnvironmentX.current.baseUrl));
    final response = await refreshDio.post<Map<String, dynamic>>(
      ApiEndpoints.refresh,
      data: {'refreshToken': refreshToken},
    );

    final data = response.data!;
    final accessToken = data['accessToken'] as String;
    final newRefreshToken = data['refreshToken'] as String;
    await _secureStorage.writeTokens(accessToken: accessToken, refreshToken: newRefreshToken);
    return accessToken;
  }
}
