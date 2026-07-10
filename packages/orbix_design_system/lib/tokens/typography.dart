import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'colors.dart';

/// Helpers tipográficos del ODS. Inter para UI, JetBrains Mono para cifras/precios.
class OrbixText {
  OrbixText._();

  static TextStyle ui({
    double size = 13,
    FontWeight weight = FontWeight.w500,
    Color color = OrbixColors.textPrimary,
    double? height,
    double letterSpacing = 0,
  }) =>
      GoogleFonts.inter(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
        letterSpacing: letterSpacing,
      );

  static TextStyle mono({
    double size = 13,
    FontWeight weight = FontWeight.w700,
    Color color = OrbixColors.textPrimary,
  }) =>
      GoogleFonts.jetBrainsMono(
        fontSize: size,
        fontWeight: weight,
        color: color,
      );
}
