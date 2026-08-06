/// Excepciones de capa `data`. Se capturan en el repositorio o en el
/// `error_interceptor` de red y se traducen a un [Failure] tipado — nunca
/// deben cruzar hacia `presentation` sin pasar por esa traducción.
sealed class AppException implements Exception {
  const AppException(this.message);

  final String message;
}

class ServerException extends AppException {
  const ServerException(super.message, {this.statusCode, this.code});

  final int? statusCode;
  final String? code;
}

class NetworkException extends AppException {
  const NetworkException(super.message);
}

class CacheException extends AppException {
  const CacheException(super.message);
}

class ValidationException extends AppException {
  const ValidationException(super.message, {this.fieldErrors});

  final Map<String, List<String>>? fieldErrors;
}

class AuthException extends AppException {
  const AuthException(super.message);
}

class NotFoundException extends AppException {
  const NotFoundException(super.message);
}

class UnknownException extends AppException {
  const UnknownException(super.message);
}
