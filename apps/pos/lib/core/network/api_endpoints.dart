/// Rutas de la API NestJS (prefijo global `/api` ya incluido en `baseUrl`,
/// ver `core/config/environment.dart`). Espejo de `api/src/modules/**`.
class ApiEndpoints {
  const ApiEndpoints._();

  static const login = '/auth/login';
  static const register = '/auth/register';
  static const refresh = '/auth/refresh';
  static const logout = '/auth/logout';
  static const me = '/auth/me';
  static const meCapabilities = '/auth/me/capabilities';
  static String selectTenant(String slug) => '/auth/select-tenant/$slug';
  static String selectBranch(String branchId) => '/auth/select-branch/$branchId';

  static const products = '/products';
  static const categories = '/categories';
  static const orders = '/orders';
}
