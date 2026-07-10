import 'package:flutter/material.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import 'common.dart';

/// Tarjeta de estadística inferior con su mini serie (sparkline). Datos de
/// muestra — se reemplaza por un feature de Reportes real en Fase 4
/// (roadmap `docs/ARCHITECTURE_AUDIT.md`), esta barra no consume backend.
class StatCard {
  const StatCard({
    required this.label,
    required this.value,
    required this.trend,
    required this.points,
  });

  final String label;
  final String value;
  final String trend;

  /// Puntos normalizados en el viewBox 70x30 del diseño.
  final List<(double, double)> points;
}

const _kStats = <StatCard>[
  StatCard(label: 'Ventas del día', value: '\$8,245.50', trend: '12.5%', points: [
    (0, 22), (12, 20), (24, 16), (36, 18), (48, 10), (60, 12), (70, 4)
  ]),
  StatCard(label: 'Transacciones', value: '128', trend: '8.3%', points: [
    (0, 18), (12, 20), (24, 12), (36, 15), (48, 8), (60, 14), (70, 6)
  ]),
  StatCard(label: 'Ticket promedio', value: '\$64.41', trend: '5.7%', points: [
    (0, 20), (12, 14), (24, 18), (36, 10), (48, 16), (60, 8), (70, 10)
  ]),
  StatCard(label: 'Artículos vendidos', value: '342', trend: '11.2%', points: [
    (0, 24), (12, 16), (24, 20), (36, 8), (48, 14), (60, 6), (70, 2)
  ]),
];

/// Barra inferior de estadísticas (96px) con 4 métricas y sparklines.
class StatsBar extends StatelessWidget {
  const StatsBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 96,
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: OrbixColors.border)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < _kStats.length; i++)
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                decoration: BoxDecoration(
                  border: i == _kStats.length - 1
                      ? null
                      : const Border(
                          right: BorderSide(color: OrbixColors.borderLight)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_kStats[i].label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: OrbixText.ui(
                                  size: 12,
                                  weight: FontWeight.w600,
                                  color: OrbixColors.textFaint)),
                          const SizedBox(height: 4),
                          Text(_kStats[i].value,
                              style: OrbixText.mono(
                                  size: 19, weight: FontWeight.w800)),
                          const SizedBox(height: 3),
                          Text('↑ ${_kStats[i].trend}',
                              style: OrbixText.ui(
                                  size: 11.5,
                                  weight: FontWeight.w700,
                                  color: OrbixColors.greenText)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Sparkline(points: _kStats[i].points),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
