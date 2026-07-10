import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../../../../business/models/product.dart';
import '../providers/pos_sale_notifier.dart';
import 'common.dart';

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
      // Tarjetas de ~215px como en el diseño (grid de 3 en el panel de tablet).
      final cols = (available / 215).floor().clamp(1, 5);
      return GridView.builder(
        padding: padding,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: cols,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          // Alto de la tarjeta: imagen (16/11) + bloque de texto/stepper (~118).
          mainAxisExtent: (available - (cols - 1) * 14) / cols * 11 / 16 + 118,
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
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: OrbixColors.border),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x0F1E1408), blurRadius: 2, offset: Offset(0, 1))
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Imagen + favorito
              AspectRatio(
                aspectRatio: 16 / 11,
                child: Stack(children: [
                  Positioned.fill(child: PlaceholderThumb(label: product.name)),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      width: 26,
                      height: 26,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                              color: Colors.black26,
                              blurRadius: 3,
                              offset: Offset(0, 1))
                        ],
                      ),
                      child: const StarIcon(size: 13),
                    ),
                  ),
                ]),
              ),
              // Info
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: OrbixText.ui(
                            size: 13.5, weight: FontWeight.w700, height: 1.3)),
                    const SizedBox(height: 2),
                    Text('\$${product.price.toStringAsFixed(2)}',
                        style: OrbixText.mono(size: 13.5, weight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text('Stock: ${product.stock}',
                        style:
                            OrbixText.ui(size: 11.5, color: OrbixColors.textFaint)),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 30,
                      child: QtyStepper(qty: qty, onDec: onDec, onInc: onInc),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
