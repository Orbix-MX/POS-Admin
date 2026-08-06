import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'colors.dart';

/// Construye el [ThemeData] base de Orbix a partir de los tokens del ODS.
ThemeData buildOrbixTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: OrbixColors.primary,
      primary: OrbixColors.primary,
      surface: OrbixColors.surface,
    ),
    scaffoldBackgroundColor: OrbixColors.page,
    splashFactory: InkRipple.splashFactory,
  );
  return base.copyWith(
    textTheme: GoogleFonts.interTextTheme(base.textTheme),
  );
}
