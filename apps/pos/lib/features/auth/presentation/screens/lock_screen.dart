import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../../../../core/auth/auth_session.dart';
import '../../../../core/storage/secure_storage.dart';

/// Pantalla de bloqueo local. No re-loguea contra la API — solo restaura
/// la UI si el PIN local o la biometría coinciden (ver
/// `AuthSessionNotifier.unlockWithPin`/`unlockWithBiometric`).
class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  String _pin = '';
  bool _biometricTried = false;
  int _pinLength = 4;

  @override
  void initState() {
    super.initState();
    ref.read(secureStorageProvider).getLocalPinLength().then((length) {
      if (mounted) setState(() => _pinLength = length);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_biometricTried) {
      _biometricTried = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometric());
    }
  }

  Future<void> _tryBiometric() async {
    final secureStorage = ref.read(secureStorageProvider);
    if (!await secureStorage.isBiometricEnabled()) return;
    await ref.read(authSessionProvider.notifier).unlockWithBiometric();
  }

  void _onDigit(String digit) {
    if (_pin.length >= 6) return;
    setState(() => _pin += digit);
    if (_pin.length == _pinLength) _tryUnlock();
  }

  void _onBackspace() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _tryUnlock() async {
    final pin = _pin;
    final ok = await ref.read(authSessionProvider.notifier).unlockWithPin(pin);
    if (!ok && mounted) setState(() => _pin = '');
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authSessionProvider);

    return Scaffold(
      backgroundColor: OrbixColors.page,
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 340),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline, size: 40, color: OrbixColors.textMuted),
                const SizedBox(height: 12),
                Text('Orbix bloqueado', style: OrbixText.ui(size: 22, weight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(
                  session.user?.fullName ?? 'Ingresa tu PIN para continuar',
                  style: OrbixText.ui(size: 14, color: OrbixColors.textMuted),
                ),
                const SizedBox(height: 24),
                _PinDots(length: _pin.length),
                if (session.errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(session.errorMessage!, style: OrbixText.ui(size: 13, color: OrbixColors.red)),
                ],
                const SizedBox(height: 24),
                _Keypad(onDigit: _onDigit, onBackspace: _onBackspace),
                const SizedBox(height: 12),
                FutureBuilder<bool>(
                  future: ref.read(secureStorageProvider).isBiometricEnabled(),
                  builder: (context, snapshot) {
                    if (snapshot.data != true) return const SizedBox.shrink();
                    return TextButton.icon(
                      onPressed: _tryBiometric,
                      icon: const Icon(Icons.fingerprint),
                      label: const Text('Usar biometría'),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PinDots extends StatelessWidget {
  const _PinDots({required this.length});

  final int length;
  static const _maxDots = 6;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(_maxDots, (i) {
        final filled = i < length;
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 6),
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: filled ? OrbixColors.primary : OrbixColors.fill,
          ),
        );
      }),
    );
  }
}

class _Keypad extends StatelessWidget {
  const _Keypad({required this.onDigit, required this.onBackspace});

  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;

  @override
  Widget build(BuildContext context) {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', '⌫'],
    ];

    return Column(
      children: rows
          .map((row) => Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: row.map((key) {
                  if (key.isEmpty) return const SizedBox(width: 72, height: 60);
                  return _KeypadButton(
                    label: key,
                    onTap: key == '⌫' ? onBackspace : () => onDigit(key),
                  );
                }).toList(),
              ))
          .toList(),
    );
  }
}

class _KeypadButton extends StatelessWidget {
  const _KeypadButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      height: 60,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Center(
            child: Text(label, style: OrbixText.ui(size: 22, weight: FontWeight.w700)),
          ),
        ),
      ),
    );
  }
}
