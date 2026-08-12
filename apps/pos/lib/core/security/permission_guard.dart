import '../../business/models/permission.dart';
import 'permission_service.dart';

/// Redirect de `go_router` por permiso de ruta — distinto de
/// `core/auth/auth_guard.dart`, que solo resuelve "hay sesión o no". Cada
/// ruta protegida por permiso declara el `Permission` requerido; el router
/// consulta esta función antes de entrar.
String? resolvePermissionRedirect({
  required PermissionService permissions,
  required Permission? requiredPermission,
}) {
  if (requiredPermission == null) return null;
  if (permissions.has(requiredPermission)) return null;
  return '/not-authorized';
}
