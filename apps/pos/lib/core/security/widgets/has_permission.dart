import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../business/models/permission.dart';
import '../permission_service.dart';

/// Oculta/reemplaza UI según permiso, sin repetir
/// `if (permissionService.can...)` en cada pantalla.
class HasPermission extends ConsumerWidget {
  const HasPermission({
    super.key,
    required this.permission,
    required this.builder,
    this.fallback,
  });

  final Permission permission;
  final WidgetBuilder builder;
  final WidgetBuilder? fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final permissions = ref.watch(permissionServiceProvider);
    if (permissions.has(permission)) return builder(context);
    return fallback?.call(context) ?? const SizedBox.shrink();
  }
}
