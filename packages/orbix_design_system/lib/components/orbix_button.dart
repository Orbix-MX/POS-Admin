import 'package:flutter/material.dart';

import '../tokens/colors.dart';
import '../tokens/typography.dart';

/// Botón primario del ODS. Reemplaza los `Material`+`InkWell` a mano que
/// aparecían repetidos en cada pantalla de POS.
class OrbixButton extends StatelessWidget {
  const OrbixButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final child = Material(
      color: onPressed == null ? OrbixColors.fill : OrbixColors.primary,
      borderRadius: BorderRadius.circular(26),
      child: InkWell(
        borderRadius: BorderRadius.circular(26),
        onTap: onPressed,
        child: Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 28),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: OrbixColors.white),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: OrbixText.ui(
                  size: 15,
                  weight: FontWeight.w700,
                  color: OrbixColors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    return expand ? SizedBox(width: double.infinity, child: child) : child;
  }
}
