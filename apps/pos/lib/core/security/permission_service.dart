import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../business/models/permission.dart';
import '../auth/auth_session.dart';

/// Responde "qué puedo hacer", nunca "quién soy" (eso es `AuthSession`).
/// Consumido por el router (`permission_guard.dart`) y por widgets
/// (`HasPermission`) — nunca un `if (user.role == 'admin')` disperso en un
/// feature (regla del proyecto #10).
///
/// El backend expone permisos en `ProfileResponseDto.permissions`
/// (`GET /auth/me`) — hoy `AuthSessionState` no los trae todavía porque el
/// login solo devuelve `AuthResponseDto`; se completan con una llamada a
/// `/auth/me` cuando el primer feature con permisos granulares lo necesite.
class PermissionService {
  PermissionService(this._permissions);

  final Set<Permission> _permissions;

  bool has(Permission permission) => _permissions.contains(permission);

  bool canView(String resource) => has(Permission('$resource.view'));

  bool canEdit(String resource) => has(Permission('$resource.edit'));

  bool canDelete(String resource) => has(Permission('$resource.delete'));
}

final permissionServiceProvider = Provider<PermissionService>((ref) {
  ref.watch(authSessionProvider); // se recalcula si cambia la sesión/tenant
  return PermissionService(const {});
});
