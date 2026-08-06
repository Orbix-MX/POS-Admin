import 'package:flutter/material.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

/// Destino de `resolvePermissionRedirect` cuando la sesión no tiene el
/// permiso requerido por la ruta.
class NotAuthorizedScreen extends StatelessWidget {
  const NotAuthorizedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: OrbixErrorView(
        icon: Icons.lock_outline,
        message: 'No tienes permiso para ver esta sección.',
      ),
    );
  }
}
