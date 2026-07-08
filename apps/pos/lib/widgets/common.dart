import 'package:flutter/material.dart';

import '../theme.dart';

/// Placeholder de imagen (equivalente al `image-slot` del diseño): rectángulo
/// tintado con la etiqueta del producto centrada. Sin fotos reales disponibles.
class PlaceholderThumb extends StatelessWidget {
  const PlaceholderThumb({
    super.key,
    required this.label,
    this.radius = 0,
    this.showLabel = true,
  });

  final String label;
  final double radius;
  final bool showLabel;

  // Tinte estable derivado del nombre.
  Color get _tint {
    final h = label.codeUnits.fold<int>(0, (a, c) => a + c);
    const hues = [
      Color(0xFFDCE7F6), Color(0xFFF6E6DC), Color(0xFFE3F1E4),
      Color(0xFFF3E1EC), Color(0xFFF6F0DA), Color(0xFFE7E3F5),
    ];
    return hues[h % hues.length];
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _tint,
        borderRadius: BorderRadius.circular(radius),
      ),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(6),
      child: showLabel
          ? Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: AppText.ui(
                size: 11,
                weight: FontWeight.w600,
                color: AppColors.textMuted,
              ),
            )
          : null,
    );
  }
}

/// Estrella (favorito) dibujada, como en el diseño (icono amarillo).
class StarIcon extends StatelessWidget {
  const StarIcon({super.key, this.size = 13, this.color = AppColors.star});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      Icon(Icons.star_rounded, size: size + 3, color: color);
}

/// Mini gráfico de línea (sparkline) sobre el viewBox 70x30 del diseño.
class Sparkline extends StatelessWidget {
  const Sparkline({super.key, required this.points, this.color = AppColors.primary});
  final List<(double, double)> points;
  final Color color;

  @override
  Widget build(BuildContext context) => CustomPaint(
        size: const Size(70, 30),
        painter: _SparklinePainter(points, color),
      );
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.points, this.color);
  final List<(double, double)> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final sx = size.width / 70.0;
    final sy = size.height / 30.0;
    final path = Path();
    for (var i = 0; i < points.length; i++) {
      final (x, y) = points[i];
      final o = Offset(x * sx, y * sy);
      i == 0 ? path.moveTo(o.dx, o.dy) : path.lineTo(o.dx, o.dy);
    }
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter old) =>
      old.points != points || old.color != color;
}

/// Stepper redondo –/+ reutilizable (grid de productos y ticket).
class QtyStepper extends StatelessWidget {
  const QtyStepper({
    super.key,
    required this.qty,
    required this.onDec,
    required this.onInc,
    this.compact = false,
  });

  final int qty;
  final VoidCallback onDec;
  final VoidCallback onInc;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final btn = compact ? 24.0 : 30.0;
    final radius = compact ? 7.0 : 999.0;
    return Row(
      children: [
        _StepBtn(
          size: btn,
          radius: radius,
          background: AppColors.fill,
          foreground: AppColors.textPrimary,
          icon: '–',
          onTap: onDec,
        ),
        Expanded(
          child: Center(
            child: Text('$qty',
                style: AppText.mono(size: 13, weight: FontWeight.w700)),
          ),
        ),
        _StepBtn(
          size: btn,
          radius: radius,
          background: compact ? AppColors.fill : AppColors.primary,
          foreground: compact ? AppColors.textPrimary : Colors.white,
          icon: '+',
          onTap: onInc,
        ),
      ],
    );
  }
}

class _StepBtn extends StatelessWidget {
  const _StepBtn({
    required this.size,
    required this.radius,
    required this.background,
    required this.foreground,
    required this.icon,
    required this.onTap,
  });

  final double size;
  final double radius;
  final Color background;
  final Color foreground;
  final String icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      borderRadius: BorderRadius.circular(radius),
      child: InkWell(
        borderRadius: BorderRadius.circular(radius),
        onTap: onTap,
        child: SizedBox(
          width: size,
          height: size,
          child: Center(
            child: Text(
              icon,
              style: AppText.ui(size: 16, weight: FontWeight.w700, color: foreground),
            ),
          ),
        ),
      ),
    );
  }
}
