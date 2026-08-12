/// Configuración estática de la app, independiente del entorno.
class AppConfig {
  const AppConfig._();

  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 20);
  static const Duration sendTimeout = Duration(seconds: 20);

  /// Reintentos para errores de red transitorios (no aplica a 4xx).
  static const int networkRetryAttempts = 2;
  static const Duration networkRetryDelay = Duration(milliseconds: 500);
}
