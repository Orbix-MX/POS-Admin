import 'package:flutter/material.dart';

import '../theme.dart';

/// Encabezado superior (72px) del layout de tablet.
class TopHeader extends StatelessWidget {
  const TopHeader({super.key, this.onMenu});
  final VoidCallback? onMenu;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 72,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          // Logo
          Row(children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Center(
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 9),
            Text('Orbix',
                style: AppText.ui(
                    size: 19, weight: FontWeight.w800, letterSpacing: -0.4)),
          ]),
          const SizedBox(width: 20),
          _divider(),
          const SizedBox(width: 20),
          // Título de sección
          InkWell(
            onTap: onMenu,
            child: Row(children: [
              const Icon(Icons.menu, size: 20, color: AppColors.textPrimary),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Venta actual',
                      style: AppText.ui(size: 15, weight: FontWeight.w700)),
                  Row(children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                          color: AppColors.green, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 5),
                    Text('Caja abierta · 02:15:36',
                        style:
                            AppText.ui(size: 12, color: AppColors.textMuted)),
                  ]),
                ],
              ),
            ]),
          ),
          const SizedBox(width: 20),
          // Búsqueda
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: _SearchField(),
              ),
            ),
          ),
          const SizedBox(width: 20),
          // Cluster derecho
          _NotificationBell(),
          const SizedBox(width: 12),
          _pill(Icons.person_outline, 'Clientes'),
          const SizedBox(width: 12),
          _divider(),
          const SizedBox(width: 12),
          _user(),
        ],
      ),
    );
  }

  Widget _divider() =>
      Container(width: 1, height: 32, color: AppColors.border);

  Widget _pill(IconData icon, String label) => Container(
        height: 38,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderInput),
        ),
        child: Row(children: [
          Icon(icon, size: 16, color: AppColors.textPrimary),
          const SizedBox(width: 7),
          Text(label, style: AppText.ui(size: 13, weight: FontWeight.w600)),
        ]),
      );

  Widget _user() => Row(children: [
        const PlaceholderThumbCircle(),
        const SizedBox(width: 9),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Carlos R.', style: AppText.ui(size: 13, weight: FontWeight.w700)),
            Text('Administrador',
                style: AppText.ui(size: 11, color: AppColors.textFaint)),
          ],
        ),
        const SizedBox(width: 4),
        const Icon(Icons.arrow_drop_down, size: 18, color: AppColors.textFaint),
      ]);
}

class PlaceholderThumbCircle extends StatelessWidget {
  const PlaceholderThumbCircle({super.key});
  @override
  Widget build(BuildContext context) => Container(
        width: 38,
        height: 38,
        decoration: const BoxDecoration(
            color: AppColors.fill, shape: BoxShape.circle),
        alignment: Alignment.center,
        child: Text('CR',
            style: AppText.ui(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.textMuted)),
      );
}

class _SearchField extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 42,
      padding: const EdgeInsets.only(left: 14, right: 8),
      decoration: BoxDecoration(
        color: AppColors.fill,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        const Icon(Icons.search, size: 18, color: AppColors.textFaint),
        const SizedBox(width: 10),
        Expanded(
          child: TextField(
            style: AppText.ui(size: 13.5),
            decoration: InputDecoration.collapsed(
              hintText: 'Buscar productos, SKU o código de barras',
              hintStyle: AppText.ui(size: 13.5, color: AppColors.textFaint),
            ),
          ),
        ),
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.borderInput),
          ),
          child: const Icon(Icons.qr_code_scanner,
              size: 16, color: AppColors.textMuted),
        ),
      ]),
    );
  }
}

class _NotificationBell extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 38,
      height: 38,
      child: Stack(clipBehavior: Clip.none, children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppColors.fill,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.notifications_none,
              size: 20, color: AppColors.textPrimary),
        ),
        Positioned(
          top: -4,
          right: -4,
          child: Container(
            width: 17,
            height: 17,
            decoration: const BoxDecoration(
                color: AppColors.red, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text('3',
                style: AppText.ui(
                    size: 10, weight: FontWeight.w800, color: Colors.white)),
          ),
        ),
      ]),
    );
  }
}
