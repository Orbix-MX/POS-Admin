/// Umbrales de ancho únicos para todas las apps/verticales de Orbix.
///
/// Antes vivían hardcodeados dentro de `PosSaleScreen` (`_wide`/`_medium`).
/// Cualquier pantalla que decida su layout por ancho debe usar estas
/// constantes, nunca redefinir sus propios números.
class OrbixBreakpoints {
  OrbixBreakpoints._();

  /// Tablet ancha / desktop pequeño: sidebar fija + contenido + panel lateral.
  static const double wide = 1160;

  /// Tablet angosta / phablet: contenido + panel lateral, sidebar en drawer.
  static const double medium = 900;

  static bool isWide(double width) => width >= wide;

  static bool isMedium(double width) => width >= medium;

  static bool isCompact(double width) => width < medium;
}
