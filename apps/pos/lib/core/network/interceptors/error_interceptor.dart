import 'package:dio/dio.dart';

import '../../error/failures.dart';

/// Traduce todo `DioException` a un [Failure] tipado antes de que llegue al
/// repositorio. El repositorio nunca debe capturar `DioException`
/// directamente — captura `DioException` solo para leer `e.error as
/// Failure` (ver `mapDioExceptionToFailure`), nunca inspecciona
/// `statusCode`/`type` por su cuenta.
class ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final failure = mapDioExceptionToFailure(err);
    handler.next(err.copyWith(error: failure));
  }
}

Failure mapDioExceptionToFailure(DioException err) {
  switch (err.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.connectionError:
      return const Failure.network('Sin conexión. Revisa tu internet e intenta de nuevo.');
    case DioExceptionType.cancel:
      return const Failure.unknown('Solicitud cancelada.');
    case DioExceptionType.badResponse:
      return _mapBadResponse(err);
    case DioExceptionType.badCertificate:
    case DioExceptionType.unknown:
    default:
      return Failure.unknown(err.message ?? 'Error de red desconocido.', error: err);
  }
}

Failure _mapBadResponse(DioException err) {
  final statusCode = err.response?.statusCode;
  final body = err.response?.data;
  final message = (body is Map && body['message'] is String)
      ? body['message'] as String
      : 'Ocurrió un error en el servidor.';

  switch (statusCode) {
    case 401:
      return Failure.auth(message);
    case 400:
    case 422:
      final fieldErrors = (body is Map && body['errors'] is Map)
          ? (body['errors'] as Map).map(
              (k, v) => MapEntry(k as String, (v as List).cast<String>()),
            )
          : null;
      return Failure.validation(message, fieldErrors: fieldErrors);
    case 404:
      return Failure.notFound(message);
    default:
      return Failure.server(message, statusCode: statusCode, code: body is Map ? body['code'] as String? : null);
  }
}
