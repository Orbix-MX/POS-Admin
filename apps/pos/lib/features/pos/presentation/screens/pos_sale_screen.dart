import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../../../../core/auth/auth_session.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/platform/platform_service.dart';
import '../../../../core/router/route_paths.dart';
import '../providers/pos_sale_notifier.dart';
import '../widgets/category_rail.dart';
import '../widgets/product_grid.dart';
import '../widgets/side_nav.dart';
import '../widgets/stats_bar.dart';
import '../widgets/ticket_panel.dart';
import '../widgets/toolbar.dart';
import '../widgets/top_header.dart';

/// Pantalla "Venta actual". Tablet-first: layout de tres paneles que se adapta
/// a tablet chica (sin sidebar) y a móvil (grid + ticket en hoja inferior).
class PosSaleScreen extends ConsumerStatefulWidget {
  const PosSaleScreen({super.key});

  @override
  ConsumerState<PosSaleScreen> createState() => _PosSaleScreenState();
}

class _PosSaleScreenState extends ConsumerState<PosSaleScreen> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();

  // Umbral tablet/móvil. El umbral de sidebar fijo ya no es de ancho — ver
  // `platformServiceProvider().isDesktop` en `_buildLoaded`.
  static const _medium = 900.0; // main + ticket (sidebar en drawer)

  @override
  Widget build(BuildContext context) {
    final sale = ref.watch(posSaleProvider);

    return sale.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        body: OrbixErrorView(
          message: error is Failure ? error.displayMessage : 'No se pudo cargar el catálogo.',
          onRetry: () => ref.invalidate(posSaleProvider),
        ),
      ),
      data: (_) => _buildLoaded(context),
    );
  }

  Widget _buildLoaded(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    // El sidebar fijo (siempre visible, sin drawer) es exclusivo de
    // desktop. En móvil y tablet el drawer permanece oculto por default y
    // solo se abre con el botón de hamburguesa — independientemente del
    // ancho de pantalla.
    final isDesktop = ref.watch(platformServiceProvider).isDesktop;
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: OrbixColors.surface,
      drawer: isDesktop
          ? null
          : Drawer(
              width: 300,
              backgroundColor: Colors.white,
              child: SafeArea(child: SideNav(onSelect: (_) => Navigator.pop(context))),
            ),
      body: SafeArea(
        child: w >= _medium ? _tabletLayout(isDesktop: isDesktop) : _mobileLayout(),
      ),
    );
  }

  // ── Tablet ────────────────────────────────────────────────────────────────
  Widget _tabletLayout({required bool isDesktop}) {
    return Column(
      children: [
        TopHeader(
          // En desktop el sidebar es fijo — no hay drawer que abrir
          // (`Scaffold.openDrawer()` truena si `drawer` es null).
          onMenu: isDesktop ? null : () => _scaffoldKey.currentState?.openDrawer(),
          onLock: () => ref.read(authSessionProvider.notifier).lock(),
          onSecuritySettings: () => context.push(RoutePaths.settings),
        ),
        Expanded(
          child: Row(
            children: [
              if (isDesktop) const SideNav(),
              const Expanded(child: _MainColumn()),
              SizedBox(
                width: 320,
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    border: Border(left: BorderSide(color: OrbixColors.border)),
                  ),
                  child: TicketPanel(onCobrar: () => _cobrar(context)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── Móvil ─────────────────────────────────────────────────────────────────
  Widget _mobileLayout() {
    return Column(
      children: [
        _mobileHeader(),
        const _MobileCategories(),
        const Expanded(
          child: ProductGrid(padding: EdgeInsets.fromLTRB(12, 12, 12, 12)),
        ),
        _MobileCheckoutBar(onCobrar: () => _cobrar(context), onOpenTicket: _openTicketSheet),
      ],
    );
  }

  Widget _mobileHeader() {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: OrbixColors.border)),
      ),
      child: Row(children: [
        IconButton(
          icon: const Icon(Icons.menu, color: OrbixColors.textPrimary),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Venta actual',
                style: OrbixText.ui(size: 15, weight: FontWeight.w700)),
            Row(children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                    color: OrbixColors.green, shape: BoxShape.circle),
              ),
              const SizedBox(width: 5),
              Text('Caja abierta · 02:15:36',
                  style: OrbixText.ui(size: 11, color: OrbixColors.textMuted)),
            ]),
          ],
        ),
        const Spacer(),
        const _NotifDot(),
      ]),
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
      builder: (ctx) => FractionallySizedBox(
        heightFactor: 0.9,
        child: TicketPanel(
          onClose: () => Navigator.pop(ctx),
          onCobrar: () {
            Navigator.pop(ctx);
            _cobrar(context);
          },
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
      builder: (ctx) => Consumer(
        builder: (ctx, ref, _) {
          final total = ref.watch(posSaleProvider).requireValue.total;
          return SafeArea(
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
                          style: OrbixText.ui(size: 16, weight: FontWeight.w800)),
                      Text(total.format(),
                          style: OrbixText.mono(size: 20, weight: FontWeight.w800)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  for (final m in const [
                    ('Efectivo', 'CASH', Icons.payments_outlined),
                    ('Tarjeta', 'CARD', Icons.credit_card),
                    ('Transferencia', 'TRANSFER', Icons.account_balance_outlined),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _payMethod(ctx, m.$1, m.$2, m.$3),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _payMethod(BuildContext ctx, String label, String method, IconData icon) => Material(
        color: OrbixColors.fill,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () async {
            Navigator.pop(ctx);
            final result = await ref.read(posSaleProvider.notifier).checkout(paymentMethod: method);
            if (!mounted) return;
            result.fold(
              (sale) => ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Cobrado ${sale.total.format()} · $label')),
              ),
              (failure) => ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(failure.displayMessage)),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(children: [
              Icon(icon, size: 20, color: OrbixColors.primaryText),
              const SizedBox(width: 12),
              Text(label, style: OrbixText.ui(size: 14, weight: FontWeight.w700)),
              const Spacer(),
              const Icon(Icons.chevron_right, color: OrbixColors.textFaint),
            ]),
          ),
        ),
      );
}

class _MainColumn extends StatelessWidget {
  const _MainColumn();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        ProductToolbar(),
        Expanded(
          child: Row(
            children: [
              CategoryRail(),
              Expanded(child: ProductGrid()),
            ],
          ),
        ),
        StatsBar(),
      ],
    );
  }
}

class _MobileCategories extends ConsumerWidget {
  const _MobileCategories();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(posSaleProvider).requireValue;
    final notifier = ref.read(posSaleProvider.notifier);
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: _catChip('Todos', data.activeCategory.isEmpty,
                () => notifier.setCategory('')),
          ),
          for (final c in data.categories)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _catChip(c.name, data.activeCategory == c.id,
                  () => notifier.setCategory(c.id)),
            ),
        ],
      ),
    );
  }

  Widget _catChip(String label, bool active, VoidCallback onTap) => Material(
        color: active ? OrbixColors.primaryTint : OrbixColors.fill,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Center(
              child: Text(label,
                  style: OrbixText.ui(
                      size: 13,
                      weight: active ? FontWeight.w700 : FontWeight.w600,
                      color:
                          active ? OrbixColors.primaryText : OrbixColors.textMuted)),
            ),
          ),
        ),
      );
}

class _MobileCheckoutBar extends ConsumerWidget {
  const _MobileCheckoutBar({required this.onCobrar, required this.onOpenTicket});

  final VoidCallback onCobrar;
  final VoidCallback onOpenTicket;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(posSaleProvider).requireValue;
    final count = data.cartLines.fold<int>(0, (a, l) => a + l.qty);
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: OrbixColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(children: [
          InkWell(
            onTap: onOpenTicket,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('$count artículos · ver pedido',
                      style: OrbixText.ui(
                          size: 12, color: OrbixColors.textMuted)),
                  Text(data.total.format(),
                      style: OrbixText.mono(size: 18, weight: FontWeight.w800)),
                ],
              ),
            ),
          ),
          const Spacer(),
          Material(
            color: OrbixColors.primary,
            borderRadius: BorderRadius.circular(26),
            child: InkWell(
              borderRadius: BorderRadius.circular(26),
              onTap: onCobrar,
              child: Container(
                height: 52,
                padding: const EdgeInsets.symmetric(horizontal: 28),
                alignment: Alignment.center,
                child: Text('Cobrar',
                    style: OrbixText.ui(
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
}

class _NotifDot extends StatelessWidget {
  const _NotifDot();
  @override
  Widget build(BuildContext context) => Stack(clipBehavior: Clip.none, children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
              color: OrbixColors.fill, borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.notifications_none,
              size: 20, color: OrbixColors.textPrimary),
        ),
        Positioned(
          top: -3,
          right: -3,
          child: Container(
            width: 16,
            height: 16,
            decoration:
                const BoxDecoration(color: OrbixColors.red, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text('3',
                style: OrbixText.ui(
                    size: 10, weight: FontWeight.w800, color: Colors.white)),
          ),
        ),
      ]);
}
