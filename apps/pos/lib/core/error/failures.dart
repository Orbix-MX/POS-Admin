import 'package:freezed_annotation/freezed_annotation.dart';

part 'failures.freezed.dart';

/// Estado de error de dominio expuesto a `presentation`. Todo `Failure`
/// esperado (red, validación) se loggea en info/warning; `unknown` siempre
/// con stacktrace completo (ver `core/utils/logger.dart`).
@freezed
sealed class Failure with _$Failure {
  const factory Failure.network(String message) = NetworkFailure;

  const factory Failure.auth(String message) = AuthFailure;

  const factory Failure.validation(
    String message, {
    Map<String, List<String>>? fieldErrors,
  }) = ValidationFailure;

  const factory Failure.server(String message, {int? statusCode, String? code}) = ServerFailure;

  const factory Failure.notFound(String message) = NotFoundFailure;

  const factory Failure.unknown(String message, {Object? error, StackTrace? stackTrace}) =
      UnknownFailure;
}

extension FailureMessage on Failure {
  /// Mensaje humano por defecto. Las pantallas pueden sobreescribirlo con
  /// copy específico de contexto, pero nunca deben mostrar `error.toString()`.
  String get displayMessage => when(
        network: (m) => m.isNotEmpty ? m : 'Sin conexión. Revisa tu internet e intenta de nuevo.',
        auth: (m) => m.isNotEmpty ? m : 'Tu sesión expiró. Inicia sesión de nuevo.',
        validation: (m, _) => m,
        server: (m, _, _) => m.isNotEmpty ? m : 'Ocurrió un error en el servidor.',
        notFound: (m) => m.isNotEmpty ? m : 'No se encontró el recurso solicitado.',
        unknown: (m, _, _) => m.isNotEmpty ? m : 'Ocurrió un error inesperado.',
      );
}
