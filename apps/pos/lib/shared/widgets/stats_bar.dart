import 'package:flutter/material.dart';

import '../../data.dart';
import '../../theme.dart';
import 'common.dart';

/// Barra inferior de estadísticas (96px) con 4 métricas y sparklines.
class StatsBar extends StatelessWidget {
  const StatsBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 96,
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < kStats.length; i++)
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                decoration: BoxDecoration(
                  border: i == kStats.length - 1
                      ? null
                      : const Border(
                          right: BorderSide(color: AppColors.borderLight)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(kStats[i].label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.ui(
                                  size: 12,
                                  weight: FontWeight.w600,
                                  color: AppColors.textFaint)),
                          const SizedBox(height: 4),
                          Text(kStats[i].value,
                              style: AppText.mono(
                                  size: 19, weight: FontWeight.w800)),
                          const SizedBox(height: 3),
                          Text('↑ ${kStats[i].trend}',
                              style: AppText.ui(
                                  size: 11.5,
                                  weight: FontWeight.w700,
                                  color: AppColors.greenText)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Sparkline(points: kStats[i].points),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
