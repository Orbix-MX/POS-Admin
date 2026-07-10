import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../providers/pos_sale_notifier.dart';
import 'common.dart';

/// Riel de categorías (150px) a la izquierda del grid.
class CategoryRail extends ConsumerWidget {
  const CategoryRail({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(posSaleProvider).requireValue;
    final notifier = ref.read(posSaleProvider.notifier);

    return Container(
      width: 150,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          _quick(const StarIcon(), 'Favoritos'),
          _quick(
            const Icon(Icons.trending_up, size: 14, color: OrbixColors.primary),
            'Más vendidos',
          ),
          Container(
            height: 1,
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            color: OrbixColors.borderLight,
          ),
          for (final c in data.categories)
            _CategoryTile(
              label: c.name,
              active: data.activeCategory == c.name,
              onTap: () => notifier.setCategory(c.name),
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
              style: OrbixText.ui(
                  size: 13, weight: FontWeight.w600, color: OrbixColors.textSubtle)),
        ]),
      );

  Widget _seeMore() => Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: OrbixColors.borderInput),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text('Ver más',
              style: OrbixText.ui(
                  size: 12.5, weight: FontWeight.w600, color: OrbixColors.textMuted)),
          const SizedBox(width: 6),
          const Icon(Icons.arrow_drop_down, size: 16, color: OrbixColors.textMuted),
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
      color: active ? OrbixColors.primaryTint : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Text(label,
              style: OrbixText.ui(
                  size: 13,
                  weight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? OrbixColors.primaryText : OrbixColors.textMuted)),
        ),
      ),
    );
  }
}
