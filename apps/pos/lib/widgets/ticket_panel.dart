import 'package:flutter/material.dart';

import '../pos_controller.dart';
import '../theme.dart';
import 'common.dart';

/// Panel de ticket / pedido (392px en tablet, hoja completa en móvil).
class TicketPanel extends StatelessWidget {
  const TicketPanel({
    super.key,
    required this.controller,
    required this.onCobrar,
    this.onClose,
  });

  final PosController controller;
  final VoidCallback onCobrar;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final lines = controller.cartLines;
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
            child: Row(children: [
              Text('Mesa / Pedido',
                  style: AppText.ui(size: 15, weight: FontWeight.w800)),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.fill,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.shopping_bag_outlined,
                      size: 13, color: AppColors.textPrimary),
                  const SizedBox(width: 6),
                  Text('Para llevar',
                      style: AppText.ui(size: 12, weight: FontWeight.w700)),
                ]),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: onClose,
                child: Icon(onClose == null ? Icons.more_horiz : Icons.close,
                    size: 20, color: AppColors.textFaint),
              ),
            ]),
          ),
          // Líneas del carrito
          Expanded(
            child: lines.isEmpty
                ? Center(
                    child: Text('Sin artículos',
                        style: AppText.ui(color: AppColors.textFaint)),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    itemCount: lines.length,
                    itemBuilder: (_, i) =>
                        _CartLineTile(controller: controller, line: lines[i]),
                  ),
          ),
          // Nota
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.borderLight)),
            ),
            child: Row(children: [
              const Icon(Icons.sticky_note_2_outlined,
                  size: 15, color: AppColors.textMuted),
              const SizedBox(width: 8),
              Text('Agregar nota o referencia',
                  style: AppText.ui(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: AppColors.textMuted)),
              const Spacer(),
              const Icon(Icons.chevron_right,
                  size: 18, color: AppColors.textMuted),
            ]),
          ),
          // Totales + acciones
          _Totals(controller: controller, onCobrar: onCobrar),
        ],
      ),
    );
  }
}

class _CartLineTile extends StatelessWidget {
  const _CartLineTile({required this.controller, required this.line});
  final PosController controller;
  final dynamic line; // CartLine

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.borderLight)),
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
                          style: AppText.ui(
                              size: 13.5, weight: FontWeight.w700, height: 1.3)),
                    ),
                    InkWell(
                      onTap: () => controller.remove(line.product.id),
                      child: const Icon(Icons.close,
                          size: 15, color: AppColors.textFaint),
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
                        onDec: () => controller.decrement(line.product.id),
                        onInc: () => controller.increment(line.product.id),
                      ),
                    ),
                    Text(money(line.lineTotal),
                        style:
                            AppText.mono(size: 13.5, weight: FontWeight.w700)),
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
  const _Totals({required this.controller, required this.onCobrar});
  final PosController controller;
  final VoidCallback onCobrar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          _row('Subtotal', money(controller.subtotal)),
          _row('Descuento', '–${money(PosController.discount)}',
              color: AppColors.greenText),
          _row('Impuestos (16%)', money(controller.taxes)),
          Container(
            margin: const EdgeInsets.only(top: 10),
            padding: const EdgeInsets.only(top: 10),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Total',
                    style: AppText.ui(size: 15, weight: FontWeight.w800)),
                Text(money(controller.total),
                    style: AppText.mono(size: 21, weight: FontWeight.w800)),
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
            color: AppColors.primary,
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
                        style: AppText.ui(
                            size: 15,
                            weight: FontWeight.w700,
                            color: Colors.white)),
                    Text(money(controller.total),
                        style: AppText.mono(
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
              border: Border.all(color: AppColors.borderInput),
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.bookmark_border,
                  size: 15, color: AppColors.textSubtle),
              const SizedBox(width: 8),
              Text('Guardar venta',
                  style: AppText.ui(
                      size: 13.5,
                      weight: FontWeight.w700,
                      color: AppColors.textSubtle)),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {Color color = AppColors.textMuted}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: AppText.ui(size: 13, color: color)),
            Text(value, style: AppText.mono(size: 13, weight: FontWeight.w500, color: color)),
          ],
        ),
      );

  Widget _mini(IconData icon, String label) => Expanded(
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.borderInput),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: AppColors.textPrimary),
              const SizedBox(height: 2),
              Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.ui(size: 11, weight: FontWeight.w700)),
            ],
          ),
        ),
      );
}
