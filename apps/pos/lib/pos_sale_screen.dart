import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/auth/auth_session.dart';
import 'core/router/route_paths.dart';
import 'pos_controller.dart';
import 'theme.dart';
import 'shared/widgets/category_rail.dart';
import 'shared/widgets/product_grid.dart';
import 'shared/widgets/side_nav.dart';
import 'shared/widgets/stats_bar.dart';
import 'shared/widgets/ticket_panel.dart';
import 'shared/widgets/toolbar.dart';
import 'shared/widgets/top_header.dart';

/// Pantalla "Venta actual". Tablet-first: layout de tres paneles que se adapta
/// a tablet chica (sin sidebar) y a móvil (grid + ticket en hoja inferior).
class PosSaleScreen extends StatefulWidget {
  const PosSaleScreen({super.key});

  @override
  State<PosSaleScreen> createState() => _PosSaleScreenState();
}

class _PosSaleScreenState extends State<PosSaleScreen> {
  final _controller = PosController();
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // Umbrales
  static const _wide = 1160.0; // sidebar + main + ticket
  static const _medium = 900.0; // main + ticket (sidebar en drawer)

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final w = MediaQuery.sizeOf(context).width;
        return Scaffold(
          key: _scaffoldKey,
          backgroundColor: AppColors.surface,
          drawer: w >= _wide
              ? null
              : Drawer(
                  width: 200,
                  backgroundColor: Colors.white,
                  child: SafeArea(child: SideNav(onSelect: (_) => Navigator.pop(context))),
                ),
          body: SafeArea(
            child: w >= _medium ? _tabletLayout(w) : _mobileLayout(),
          ),
        );
      },
    );
  }

  // ── Tablet ────────────────────────────────────────────────────────────────
  Widget _tabletLayout(double w) {
    return Column(
      children: [
        TopHeader(
          onMenu: () => _scaffoldKey.currentState?.openDrawer(),
          onLock: () => ProviderScope.containerOf(context, listen: false)
              .read(authSessionProvider.notifier)
              .lock(),
          onSecuritySettings: () => context.push(RoutePaths.settings),
        ),
        Expanded(
          child: Row(
            children: [
              if (w >= _wide) const SideNav(),
              Expanded(child: _mainColumn()),
              SizedBox(
                width: 392,
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    border: Border(left: BorderSide(color: AppColors.border)),
                  ),
                  child: TicketPanel(
                    controller: _controller,
                    onCobrar: () => _cobrar(context),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _mainColumn() {
    return Column(
      children: [
        const ProductToolbar(),
        Expanded(
          child: Row(
            children: [
              CategoryRail(controller: _controller),
              Expanded(child: ProductGrid(controller: _controller)),
            ],
          ),
        ),
        const StatsBar(),
      ],
    );
  }

  // ── Móvil ─────────────────────────────────────────────────────────────────
  Widget _mobileLayout() {
    return Column(
      children: [
        _mobileHeader(),
        _mobileCategories(),
        Expanded(
          child: ProductGrid(
            controller: _controller,
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
          ),
        ),
        _mobileCheckoutBar(),
      ],
    );
  }

  Widget _mobileHeader() {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.menu, color: AppColors.textPrimary),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
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
                  style: AppText.ui(size: 11, color: AppColors.textMuted)),
            ]),
          ],
        ),
        const Spacer(),
        const _NotifDot(),
      ]),
    );
  }

  Widget _mobileCategories() {
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: [
          for (final c in _controller.categories)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _catChip(c, _controller.activeCategory == c,
                  () => _controller.setCategory(c)),
            ),
        ],
      ),
    );
  }

  Widget _catChip(String label, bool active, VoidCallback onTap) => Material(
        color: active ? AppColors.primaryTint : AppColors.fill,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Center(
              child: Text(label,
                  style: AppText.ui(
                      size: 13,
                      weight: active ? FontWeight.w700 : FontWeight.w600,
                      color:
                          active ? AppColors.primaryText : AppColors.textMuted)),
            ),
          ),
        ),
      );

  Widget _mobileCheckoutBar() {
    final count = _controller.cartLines.fold<int>(0, (a, l) => a + l.qty);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(children: [
          InkWell(
            onTap: _openTicketSheet,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('$count artículos · ver pedido',
                      style: AppText.ui(
                          size: 12, color: AppColors.textMuted)),
                  Text(money(_controller.total),
                      style: AppText.mono(size: 18, weight: FontWeight.w800)),
                ],
              ),
            ),
          ),
          const Spacer(),
          Material(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(26),
            child: InkWell(
              borderRadius: BorderRadius.circular(26),
              onTap: () => _cobrar(context),
              child: Container(
                height: 52,
                padding: const EdgeInsets.symmetric(horizontal: 28),
                alignment: Alignment.center,
                child: Text('Cobrar',
                    style: AppText.ui(
                        size: 15,
                        weight: FontWeight.w700,
                        color: Colors.white)),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  void _openTicketSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => AnimatedBuilder(
        animation: _controller,
        builder: (ctx, _) => FractionallySizedBox(
          heightFactor: 0.9,
          child: TicketPanel(
            controller: _controller,
            onClose: () => Navigator.pop(ctx),
            onCobrar: () {
              Navigator.pop(ctx);
              _cobrar(context);
            },
          ),
        ),
      ),
    );
  }

  // ── Flujo de cobro (3er toque): confirmar método de pago ──────────────────
  void _cobrar(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Cobrar',
                      style: AppText.ui(size: 16, weight: FontWeight.w800)),
                  Text(money(_controller.total),
                      style: AppText.mono(size: 20, weight: FontWeight.w800)),
                ],
              ),
              const SizedBox(height: 16),
              for (final m in const [
                ('Efectivo', Icons.payments_outlined),
                ('Tarjeta', Icons.credit_card),
                ('Transferencia', Icons.account_balance_outlined),
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _payMethod(ctx, m.$1, m.$2),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _payMethod(BuildContext ctx, String label, IconData icon) => Material(
        color: AppColors.fill,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            Navigator.pop(ctx);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Cobrado ${money(_controller.total)} · $label')),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(children: [
              Icon(icon, size: 20, color: AppColors.primaryText),
              const SizedBox(width: 12),
              Text(label, style: AppText.ui(size: 14, weight: FontWeight.w700)),
              const Spacer(),
              const Icon(Icons.chevron_right, color: AppColors.textFaint),
            ]),
          ),
        ),
      );
}

class _NotifDot extends StatelessWidget {
  const _NotifDot();
  @override
  Widget build(BuildContext context) => Stack(clipBehavior: Clip.none, children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
              color: AppColors.fill, borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.notifications_none,
              size: 20, color: AppColors.textPrimary),
        ),
        Positioned(
          top: -3,
          right: -3,
          child: Container(
            width: 16,
            height: 16,
            decoration:
                const BoxDecoration(color: AppColors.red, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text('3',
                style: AppText.ui(
                    size: 10, weight: FontWeight.w800, color: Colors.white)),
          ),
        ),
      ]);
}
