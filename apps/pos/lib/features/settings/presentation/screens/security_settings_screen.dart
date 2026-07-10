import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../../../../core/auth/auth_session.dart';
import '../../../../core/auth/biometric_service.dart';
import '../../../../core/storage/secure_storage.dart';

/// Configuración del bloqueo local (PIN + biometría) — opcional, vive
/// aparte del PIN de operador del backend (`staff.controller.ts`), que
/// identifica al empleado para atribución de ventas.
class SecuritySettingsScreen extends ConsumerStatefulWidget {
  const SecuritySettingsScreen({super.key});

  @override
  ConsumerState<SecuritySettingsScreen> createState() => _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState extends ConsumerState<SecuritySettingsScreen> {
  final _pinController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _hasPin = false;
  bool _biometricEnabled = false;
  bool _canUseBiometrics = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pinController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final storage = ref.read(secureStorageProvider);
    final biometrics = ref.read(biometricServiceProvider);
    final hasPin = await storage.hasLocalPin();
    final biometricEnabled = await storage.isBiometricEnabled();
    final canUseBiometrics = await biometrics.canUseBiometrics();
    if (!mounted) return;
    setState(() {
      _hasPin = hasPin;
      _biometricEnabled = biometricEnabled;
      _canUseBiometrics = canUseBiometrics;
    });
  }

  Future<void> _savePin() async {
    setState(() {
      _error = null;
      _success = null;
    });

    final pin = _pinController.text.trim();
    final confirm = _confirmController.text.trim();

    if (pin.length < 4 || pin.length > 6 || int.tryParse(pin) == null) {
      setState(() => _error = 'El PIN debe tener entre 4 y 6 dígitos.');
      return;
    }
    if (pin != confirm) {
      setState(() => _error = 'Los PIN no coinciden.');
      return;
    }

    await ref.read(secureStorageProvider).writeLocalPin(pin);
    _pinController.clear();
    _confirmController.clear();
    if (!mounted) return;
    setState(() {
      _hasPin = true;
      _success = 'PIN local guardado.';
    });
  }

  Future<void> _clearPin() async {
    await ref.read(secureStorageProvider).clearLocalPin();
    if (!mounted) return;
    setState(() {
      _hasPin = false;
      _biometricEnabled = false;
      _success = 'PIN local eliminado.';
    });
  }

  Future<void> _toggleBiometric(bool value) async {
    await ref.read(secureStorageProvider).setBiometricEnabled(value);
    if (!mounted) return;
    setState(() => _biometricEnabled = value);
  }

  void _lockNow() {
    ref.read(authSessionProvider.notifier).lock();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OrbixColors.page,
      appBar: AppBar(title: const Text('Seguridad')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Bloqueo local', style: OrbixText.ui(size: 20, weight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(
                  'PIN para desbloquear la app tras inactividad o segundo plano. '
                  'No reemplaza tu inicio de sesión ni el PIN de operador.',
                  style: OrbixText.ui(size: 13, color: OrbixColors.textMuted),
                ),
                const SizedBox(height: 20),
                if (_hasPin) ...[
                  Text('PIN local configurado.', style: OrbixText.ui(size: 14, weight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: _clearPin, child: const Text('Eliminar PIN local')),
                ] else ...[
                  TextField(
                    controller: _pinController,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 6,
                    decoration: const InputDecoration(labelText: 'Nuevo PIN (4-6 dígitos)'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _confirmController,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 6,
                    decoration: const InputDecoration(labelText: 'Confirmar PIN'),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: OrbixText.ui(size: 13, color: OrbixColors.red)),
                  ],
                  const SizedBox(height: 12),
                  OrbixButton(label: 'Guardar PIN', onPressed: _savePin, expand: true),
                ],
                if (_success != null) ...[
                  const SizedBox(height: 8),
                  Text(_success!, style: OrbixText.ui(size: 13, color: OrbixColors.green)),
                ],
                const SizedBox(height: 24),
                if (_hasPin && _canUseBiometrics)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Usar biometría para desbloquear'),
                    value: _biometricEnabled,
                    onChanged: _toggleBiometric,
                  ),
                const SizedBox(height: 12),
                if (_hasPin)
                  OutlinedButton.icon(
                    onPressed: _lockNow,
                    icon: const Icon(Icons.lock_outline),
                    label: const Text('Bloquear ahora'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
