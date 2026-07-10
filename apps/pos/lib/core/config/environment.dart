/// Entornos soportados por la app. Resuelto en build/run vía
/// `--dart-define=ORBIX_ENV=prod` (ver [Environment.fromString]).
enum Environment { local, dev, qa, demo, prod }

extension EnvironmentX on Environment {
  static const _envName = String.fromEnvironment('ORBIX_ENV', defaultValue: 'local');

  static Environment get current => Environment.values.firstWhere(
        (e) => e.name == _envName,
        orElse: () => Environment.local,
      );

  /// Base URL de la API NestJS (prefijo global `/api`, puerto default 3001).
  /// `local` apunta al emulador Android (`10.0.2.2`) por default — para
  /// dispositivo físico o iOS simulator, sobreescribir con
  /// `--dart-define=ORBIX_API_BASE_URL=http://<ip-lan>:3001/api`.
  String get baseUrl {
    const override = String.fromEnvironment('ORBIX_API_BASE_URL');
    if (override.isNotEmpty) return override;
    return switch (this) {
      Environment.local => 'http://192.168.3.62:3001/api',
      Environment.dev => 'http://192.168.3.62:3001/api',
      Environment.qa => 'https://qa-api.orbix.app/api',
      Environment.demo => 'https://demo-api.orbix.app/api',
      Environment.prod => 'https://api.orbix.app/api',
    };
  }

  bool get isProd => this == Environment.prod;
}
