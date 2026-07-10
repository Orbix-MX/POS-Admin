import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../../domain/entities/cart_line.dart';
import '../providers/pos_sale_notifier.dart';
import 'common.dart';

/// Panel de ticket / pedido (392px en tablet, hoja completa en móvil).
class TicketPanel extends ConsumerWidget {
  const TicketPanel({
    super.key,
    required this.onCobrar,
    this.onClose,
  });

  final VoidCallback onCobrar;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(posSaleProvider).requireValue;
    final lines = data.cartLines;
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
            child: Row(children: [
              Text('Mesa / Pedido',
                  style: OrbixText.ui(size: 15, weight: FontWeight.w800)),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: OrbixColors.fill,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.shopping_bag_outlined,
                      size: 13, color: OrbixColors.textPrimary),
                  const SizedBox(width: 6),
                  Text('Para llevar',
                      style: OrbixText.ui(size: 12, weight: FontWeight.w700)),
                ]),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: onClose,
                child: Icon(onClose == null ? Icons.more_horiz : Icons.close,
                    size: 20, color: OrbixColors.textFaint),
              ),
            ]),
          ),
          // Líneas del carrito
          Expanded(
            child: lines.isEmpty
                ? Center(
                    child: Text('Sin artículos',
                        style: OrbixText.ui(color: OrbixColors.textFaint)),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    itemCount: lines.length,
                    itemBuilder: (_, i) => _CartLineTile(line: lines[i]),
                  ),
          ),
          // Nota
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: OrbixColors.borderLight)),
            ),
            child: Row(children: [
              const Icon(Icons.sticky_note_2_outlined,
                  size: 15, color: OrbixColors.textMuted),
              const SizedBox(width: 8),
              Text('Agregar nota o referencia',
                  style: OrbixText.ui(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: OrbixColors.textMuted)),
              const Spacer(),
              const Icon(Icons.chevron_right,
                  size: 18, color: OrbixColors.textMuted),
            ]),
          ),
          // Totales + acciones
          _Totals(data: data, onCobrar: onCobrar),
        ],
      ),
    );
  }
}

class _CartLineTile extends ConsumerWidget {
  const _CartLineTile({required this.line});
  final CartLine line;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(posSaleProvider.notifier);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: OrbixColors.borderLight)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 46,
            height: 46,
            child: PlaceholderThumb(label: line.product.name, radius: 8),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(line.product.name,
                          style: OrbixText.ui(
                              size: 13.5, weight: FontWeight.w700, height: 1.3)),
                    ),
                    InkWell(
                      onTap: () => notifier.remove(line.product.id),
                      child: const Icon(Icons.close,
                          size: 15, color: OrbixColors.textFaint),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    SizedBox(
                      width: 96,
                      height: 24,
                      child: QtyStepper(
                        qty: line.qty,
                        compact: true,
                        onDec: () => notifier.decrement(line.product.id),
                        onInc: () => notifier.increment(line.product.id),
                      ),
                    ),
                    Text(line.lineTotal.format(),
                        style:
                            OrbixText.mono(size: 13.5, weight: FontWeight.w700)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.data, required this.onCobrar});
  final PosSaleData data;
  final VoidCallback onCobrar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: OrbixColors.border)),
      ),
      child: Column(
        children: [
          _row('Subtotal', data.subtotal.format()),
          _row('Descuento', '–${data.discount.format()}', color: OrbixColors.greenText),
          _row('Impuestos (16%)', data.taxes.format()),
          Container(
            margin: const EdgeInsets.only(top: 10),
            padding: const EdgeInsets.only(top: 10),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: OrbixColors.border)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total',
                    style: OrbixText.ui(size: 15, weight: FontWeight.w800)),
                Text(data.total.format(),
                    style: OrbixText.mono(size: 21, weight: FontWeight.w800)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          // Mini acciones
          Row(children: [
            _mini(Icons.sell_outlined, 'Descuento'),
            const SizedBox(width: 8),
            _mini(Icons.person_outline, 'Cliente'),
            const SizedBox(width: 8),
            _mini(Icons.more_horiz, 'Más acciones'),
          ]),
          const SizedBox(height: 10),
          // Cobrar
          Material(
            color: OrbixColors.primary,
            borderRadius: BorderRadius.circular(28),
            elevation: 2,
            shadowColor: Colors.black26,
            child: InkWell(
              borderRadius: BorderRadius.circular(28),
              onTap: onCobrar,
              child: Container(
                height: 56,
                padding: const EdgeInsets.symmetric(horizontal: 22),
                alignment: Alignment.center,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Cobrar',
                        style: OrbixText.ui(
                            size: 15,
                            weight: FontWeight.w700,
                            color: Colors.white)),
                    Text(data.total.format(),
                        style: OrbixText.mono(
                            size: 15,
                            weight: FontWeight.w700,
                            color: Colors.white)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Guardar
          Container(
            height: 46,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(23),
              border: Border.all(color: OrbixColors.borderInput),
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.bookmark_border,
                  size: 15, color: OrbixColors.textSubtle),
              const SizedBox(width: 8),
              Text('Guardar venta',
                  style: OrbixText.ui(
                      size: 13.5,
                      weight: FontWeight.w700,
                      color: OrbixColors.textSubtle)),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {Color color = OrbixColors.textMuted}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: OrbixText.ui(size: 13, color: color)),
            Text(value, style: OrbixText.mono(size: 13, weight: FontWeight.w500, color: color)),
          ],
        ),
      );

  Widget _mini(IconData icon, String label) => Expanded(
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: OrbixColors.borderInput),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: OrbixColors.textPrimary),
              const SizedBox(height: 2),
              Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: OrbixText.ui(size: 11, weight: FontWeight.w700)),
            ],
          ),
        ),
      );
}
