import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../../../../business/models/product.dart';
import '../providers/pos_sale_notifier.dart';

/// Grid de productos, responsivo: el número de columnas se ajusta al ancho.
class ProductGrid extends ConsumerWidget {
  const ProductGrid({
    super.key,
    this.padding = const EdgeInsets.fromLTRB(6, 14, 20, 14),
  });

  final EdgeInsets padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(posSaleProvider).requireValue;
    final notifier = ref.read(posSaleProvider.notifier);

    return LayoutBuilder(builder: (context, c) {
      final available = c.maxWidth - padding.horizontal;
      // Tarjetas de ~160px (sin imagen, más compactas que el diseño anterior).
      final cols = (available / 160).floor().clamp(1, 6);
      return GridView.builder(
        padding: padding,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: cols,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          mainAxisExtent: 132,
        ),
        itemCount: data.products.length,
        itemBuilder: (_, i) {
          final p = data.products[i];
          return ProductCard(
            product: p,
            qty: data.qtyOf(p.id),
            onTap: () => notifier.increment(p.id),
            onInc: () => notifier.increment(p.id),
            onDec: () => notifier.decrement(p.id),
          );
        },
      );
    });
  }
}

/// Tarjeta de producto sin imagen: precio en badge + nombre + acciones
/// (Personalizar / +) arriba y (–) abajo, como tarjeta de "quick add".
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    required this.qty,
    required this.onTap,
    required this.onInc,
    required this.onDec,
  });

  final Product product;
  final int qty;
  final VoidCallback onTap;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: OrbixColors.border),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x0F1E1408), blurRadius: 2, offset: Offset(0, 1))
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: OrbixText.ui(
                      size: 13.5, weight: FontWeight.w700, height: 1.25),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: _PriceBadge(price: product.price)),
                  const SizedBox(width: 8),
                  _SquareIconButton(
                    icon: Icons.add,
                    background: OrbixColors.textPrimary,
                    foreground: Colors.white,
                    onTap: onInc,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Badge amarillo con el precio, como en el diseño de referencia.
class _PriceBadge extends StatelessWidget {
  const _PriceBadge({required this.price});

  final double price;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      decoration: BoxDecoration(
        // color: const Color(0xFFF6DF7A), // amarillo suave del badge de precio
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '\$${price.toStringAsFixed(2)}',
        overflow: TextOverflow.ellipsis,
        style: OrbixText.mono(
            size: 18, weight: FontWeight.w800, color: const Color.fromARGB(255, 136, 126, 102))
      ),
    );
  }
}

class _SquareIconButton extends StatelessWidget {
  const _SquareIconButton({
    required this.icon,
    required this.background,
    required this.foreground,
    required this.onTap,
  });

  final IconData icon;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: SizedBox(
          width: 28,
          height: 28,
          child: Icon(icon, size: 16, color: foreground),
        ),
      ),
    );
  }
}
