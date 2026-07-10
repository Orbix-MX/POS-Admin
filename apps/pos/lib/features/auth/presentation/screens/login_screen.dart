import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../../../../core/auth/auth_session.dart';

/// Pantalla simple de login. Vive en `features/auth/` — feature simple
/// (presentation/ + providers/ + services/), sin `domain/`/`data/` porque
/// no cumple ninguna señal de promoción de la sección 2.4 del audit: un
/// solo origen de datos (`AuthRepository` en `core/auth/`), sin mapeo
/// complejo, consumida por una sola pantalla.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authSessionProvider);
    final isLoading = session.status == AuthStatus.authenticating;

    return Scaffold(
      backgroundColor: OrbixColors.page,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 380),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Orbix', style: OrbixText.ui(size: 28, weight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('Inicia sesión para continuar',
                    style: OrbixText.ui(size: 14, color: OrbixColors.textMuted)),
                const SizedBox(height: 24),
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Correo electrónico'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Contraseña'),
                  onSubmitted: (_) => _submit(),
                ),
                if (session.errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(session.errorMessage!,
                      style: OrbixText.ui(size: 13, color: OrbixColors.red)),
                ],
                const SizedBox(height: 20),
                isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : OrbixButton(label: 'Entrar', onPressed: _submit, expand: true),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _submit() {
    ref.read(authSessionProvider.notifier).login(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
  }
}
