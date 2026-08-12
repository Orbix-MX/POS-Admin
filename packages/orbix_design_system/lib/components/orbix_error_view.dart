import 'package:flutter/material.dart';

import '../tokens/colors.dart';
import '../tokens/typography.dart';

/// Vista de error única del ODS. Ningún feature debe escribir su propio
/// `Text('Error: $e')` — siempre se traduce a un mensaje humano + acción
/// antes de llegar aquí (ver `core/error/failures.dart` en la app).
class OrbixErrorView extends StatelessWidget {
  const OrbixErrorView({
    super.key,
    required this.message,
    this.onRetry,
    this.icon = Icons.error_outline,
  });

  final String message;
  final VoidCallback? onRetry;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: OrbixColors.textFaint),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: OrbixText.ui(size: 14, color: OrbixColors.textMuted),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              TextButton(
                onPressed: onRetry,
                child: Text(
                  'Reintentar',
                  style: OrbixText.ui(
                    size: 14,
                    weight: FontWeight.w700,
                    color: OrbixColors.primaryText,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
