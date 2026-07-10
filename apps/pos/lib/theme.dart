import 'package:flutter/material.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

/// Adaptador temporal sobre `orbix_design_system` — mantiene `AppColors`/
/// `AppText`/`buildAppTheme()` funcionando para el código de `pos_sale_screen.dart`
/// y sus widgets (`shared/widgets/*`) sin duplicar tokens mientras esos
/// archivos no se migran a `features/pos/` (Fase 2 del roadmap de
/// arquitectura). Se elimina en esa migración — nada nuevo debe importar
/// este archivo, usar `orbix_design_system` directamente.
class AppColors {
  AppColors._();

  static const primary = OrbixColors.primary;
  static const primaryText = OrbixColors.primaryText;
  static const primaryTint = OrbixColors.primaryTint;
  static const primaryTintBorder = OrbixColors.primaryTintBorder;
  static const page = OrbixColors.page;
  static const surface = OrbixColors.surface;
  static const white = OrbixColors.white;
  static const fill = OrbixColors.fill;
  static const fillAlt = OrbixColors.fillAlt;
  static const textPrimary = OrbixColors.textPrimary;
  static const textSubtle = OrbixColors.textSubtle;
  static const textMuted = OrbixColors.textMuted;
  static const textFaint = OrbixColors.textFaint;
  static const border = OrbixColors.border;
  static const borderLight = OrbixColors.borderLight;
  static const borderInput = OrbixColors.borderInput;
  static const green = OrbixColors.green;
  static const greenText = OrbixColors.greenText;
  static const red = OrbixColors.red;
  static const star = OrbixColors.star;
}

class AppText {
  AppText._();

  static TextStyle ui({
    double size = 13,
    FontWeight weight = FontWeight.w500,
    Color color = OrbixColors.textPrimary,
    double? height,
    double letterSpacing = 0,
  }) =>
      OrbixText.ui(size: size, weight: weight, color: color, height: height, letterSpacing: letterSpacing);

  static TextStyle mono({
    double size = 13,
    FontWeight weight = FontWeight.w700,
    Color color = OrbixColors.textPrimary,
  }) =>
      OrbixText.mono(size: size, weight: weight, color: color);
}

ThemeData buildAppTheme() => buildOrbixTheme();
