import 'package:flutter/material.dart';

/// Paleta de color del Orbix Design System.
///
/// El diseño original define colores en oklch; aquí están convertidos a sRGB
/// (aproximación fiel) para usarse como [Color] de Flutter. El nombre conserva
/// la intención semántica del token, no el valor oklch literal.
class OrbixColors {
  OrbixColors._();

  // Marca
  static const primary = Color(0xFF1276CE); // oklch(56% 0.16 252)
  static const primaryText = Color(0xFF2350AE); // oklch(40% 0.14 252)
  static const primaryTint = Color(0xFFE4EAFB); // oklch(94% 0.035 252)
  static const primaryTintBorder = Color(0xFFC5D4F5); // oklch(85% 0.06 252)

  // Superficies
  static const page = Color(0xFFE2E3E6); // oklch(90% 0.004 260)
  static const surface = Color(0xFFFBFAF8); // oklch(98.5% 0.003 80)
  static const white = Color(0xFFFFFFFF);
  static const fill = Color(0xFFF3F0EC); // oklch(96% 0.006 80)
  static const fillAlt = Color(0xFFF6F3EF); // oklch(97% 0.004 80)

  // Texto
  static const textPrimary = Color(0xFF302D28); // oklch(23% 0.012 80)
  static const textSubtle = Color(0xFF514C45); // oklch(35% 0.012 80)
  static const textMuted = Color(0xFF6D675F); // oklch(46% 0.012 80)
  static const textFaint = Color(0xFF98928A); // oklch(62% 0.01 80)

  // Bordes
  static const border = Color(0xFFE7E3DE); // oklch(90% 0.006 80)
  static const borderLight = Color(0xFFEDEAE6); // oklch(93% 0.004 80)
  static const borderInput = Color(0xFFE4E0DA); // oklch(89% 0.007 80)

  // Estado
  static const green = Color(0xFF2FA96E); // oklch(62% 0.13 152)
  static const greenText = Color(0xFF2C8F5C); // oklch(50% 0.13 152)
  static const red = Color(0xFFD9463A); // oklch(58% 0.19 25)
  static const star = Color(0xFFD89B34); // oklch(75% 0.15 85)
}
