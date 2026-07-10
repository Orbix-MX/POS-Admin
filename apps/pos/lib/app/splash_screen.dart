import 'package:flutter/material.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

/// Pantalla mostrada mientras `bootstrap.dart` resuelve si hay una sesión
/// válida guardada (token en `SecureStorage`) antes de decidir el primer
/// redirect real del router.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: OrbixColors.green,
      body: Center(
        child: CircularProgressIndicator(color: OrbixColors.white),
      ),
    );
  }
}
