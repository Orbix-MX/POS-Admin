import 'package:flutter/material.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

const _kNavLabels = <String>[
  'Venta', 'Caja', 'Clientes', 'Productos', 'Inventario', 'Reportes', 'Más',
];

const _navIcons = <IconData>[
  Icons.shopping_cart_outlined, // Venta
  Icons.point_of_sale_outlined, // Caja
  Icons.person_outline, // Clientes
  Icons.sell_outlined, // Productos
  Icons.inventory_2_outlined, // Inventario
  Icons.bar_chart, // Reportes
  Icons.more_horiz, // Más
];

/// Barra lateral de navegación (176px) del layout de tablet.
class SideNav extends StatelessWidget {
  const SideNav({super.key, this.activeIndex = 0, this.onSelect});

  final int activeIndex;
  final ValueChanged<int>? onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 176,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(12, 18, 12, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // FAB nueva venta
          Align(
            alignment: Alignment.centerLeft,
            child: Material(
              color: OrbixColors.primary,
              borderRadius: BorderRadius.circular(16),
              elevation: 3,
              shadowColor: Colors.black26,
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () {},
                child: const SizedBox(
                  width: 56,
                  height: 56,
                  child: Icon(Icons.add, color: Colors.white, size: 26),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Items
          for (var i = 0; i < _kNavLabels.length; i++)
            _NavItem(
              label: _kNavLabels[i],
              icon: _navIcons[i],
              active: i == activeIndex,
              onTap: () => onSelect?.call(i),
            ),
          const Spacer(),
          // Contexto de sucursal / impresora
          _InfoCard(
            icon: Icons.storefront_outlined,
            title: 'Sucursal',
            subtitle: 'Matriz Centro',
          ),
          const SizedBox(height: 10),
          _InfoCard(
            icon: Icons.print_outlined,
            title: 'Impresora',
            subtitle: 'Térmica 01',
            online: true,
          ),
          const SizedBox(height: 10),
          _QuickActions(),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? OrbixColors.primaryText : OrbixColors.textSubtle;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: active ? OrbixColors.primaryTint : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 10),
              Text(label,
                  style: OrbixText.ui(
                      size: 13.5,
                      weight: active ? FontWeight.w700 : FontWeight.w600,
                      color: color)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.online = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool online;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: OrbixColors.fillAlt,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: OrbixColors.textMuted),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: OrbixText.ui(size: 11.5, weight: FontWeight.w700)),
                Row(children: [
                  Flexible(
                    child: Text(subtitle,
                        overflow: TextOverflow.ellipsis,
                        style: OrbixText.ui(
                            size: 11.5, color: OrbixColors.textMuted)),
                  ),
                  if (online) ...[
                    const SizedBox(width: 5),
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                          color: OrbixColors.green, shape: BoxShape.circle),
                    ),
                  ],
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Material(
      color: OrbixColors.primaryTint,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () {},
        child: SizedBox(
          height: 42,
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.bolt, size: 15, color: OrbixColors.primaryText),
                const SizedBox(width: 7),
                Text('Acciones rápidas',
                    style: OrbixText.ui(
                        size: 12.5,
                        weight: FontWeight.w700,
                        color: OrbixColors.primaryText)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
