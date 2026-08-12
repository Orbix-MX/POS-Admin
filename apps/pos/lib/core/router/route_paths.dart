/// Constantes de ruta — evita strings sueltos repetidos entre
/// `app_router.dart` y las llamadas a `context.go(...)` de cada feature.
class RoutePaths {
  const RoutePaths._();

  static const splash = '/splash';
  static const login = '/login';
  static const lock = '/lock';
  static const onboarding = '/onboarding';
  static const selectTenant = '/select-tenant';
  static const notAuthorized = '/not-authorized';

  static const pos = '/pos';
  static const inventory = '/inventory';
  static const customers = '/customers';
  static const cashbox = '/cashbox';
  static const restaurant = '/restaurant';
  static const reports = '/reports';
  static const settings = '/settings';
}
