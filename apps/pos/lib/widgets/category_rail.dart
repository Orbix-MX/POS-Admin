import 'package:flutter/material.dart';

import '../pos_controller.dart';
import '../theme.dart';
import 'common.dart';

/// Riel de categorías (150px) a la izquierda del grid.
class CategoryRail extends StatelessWidget {
  const CategoryRail({super.key, required this.controller});
  final PosController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          _quick(const StarIcon(), 'Favoritos'),
          _quick(
            const Icon(Icons.trending_up, size: 14, color: AppColors.primary),
            'Más vendidos',
          ),
          Container(
            height: 1,
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            color: AppColors.borderLight,
          ),
          for (final c in controller.categories)
            _CategoryTile(
              label: c,
              active: controller.activeCategory == c,
              onTap: () => controller.setCategory(c),
            ),
          const SizedBox(height: 6),
          _seeMore(),
        ],
      ),
    );
  }

  Widget _quick(Widget icon, String label) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(children: [
          icon,
          const SizedBox(width: 8),
          Text(label,
              style: AppText.ui(
                  size: 13, weight: FontWeight.w600, color: AppColors.textSubtle)),
        ]),
      );

  Widget _seeMore() => Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderInput),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text('Ver más',
              style: AppText.ui(
                  size: 12.5, weight: FontWeight.w600, color: AppColors.textMuted)),
          const SizedBox(width: 6),
          const Icon(Icons.arrow_drop_down, size: 16, color: AppColors.textMuted),
        ]),
      );
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile(
      {required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.primaryTint : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Text(label,
              style: AppText.ui(
                  size: 13,
                  weight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? AppColors.primaryText : AppColors.textMuted)),
        ),
      ),
    );
  }
}
