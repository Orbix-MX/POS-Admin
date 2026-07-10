import 'package:flutter/material.dart';

import '../../theme.dart';

/// Barra de herramientas (56px) sobre el grid: filtros + selector de vista.
class ProductToolbar extends StatelessWidget {
  const ProductToolbar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.borderLight)),
      ),
      child: Row(children: [
        _chip('Todas', primary: true),
        const SizedBox(width: 10),
        _chip('Ordenar: Nombre', trailing: Icons.swap_vert, size: 10),
        const SizedBox(width: 10),
        _chip('Disponibilidad', trailing: Icons.arrow_drop_down),
        const Spacer(),
        Text('Vista',
            style: AppText.ui(
                size: 12, weight: FontWeight.w600, color: AppColors.textFaint)),
        const SizedBox(width: 10),
        _viewToggle(),
      ]),
    );
  }

  Widget _chip(String label,
      {bool primary = false, IconData? trailing, double size = 18}) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: primary ? 18 : 14, vertical: 8),
      decoration: BoxDecoration(
        color: primary ? AppColors.primaryTint : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: primary ? AppColors.primaryTintBorder : AppColors.borderInput),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label,
            style: AppText.ui(
                size: primary ? 13 : 12.5,
                weight: primary ? FontWeight.w700 : FontWeight.w600,
                color: primary ? AppColors.primaryText : AppColors.textMuted)),
        if (trailing != null) ...[
          const SizedBox(width: 6),
          Icon(trailing, size: size, color: AppColors.textMuted),
        ],
      ]),
    );
  }

  Widget _viewToggle() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.fill,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Row(children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(7),
            boxShadow: const [
              BoxShadow(color: Colors.black12, blurRadius: 2, offset: Offset(0, 1))
            ],
          ),
          child: const Icon(Icons.grid_view_rounded,
              size: 15, color: AppColors.textPrimary),
        ),
        const SizedBox(width: 4),
        const SizedBox(
          width: 28,
          height: 28,
          child: Icon(Icons.view_list_rounded, size: 16, color: AppColors.textFaint),
        ),
      ]),
    );
  }
}
