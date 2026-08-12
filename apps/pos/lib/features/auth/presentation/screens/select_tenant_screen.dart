import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../../../../core/auth/auth_session.dart';
import '../../../../core/router/route_paths.dart';

/// Selección de empresa cuando el login devuelve más de un tenant
/// disponible (`AuthSessionState.needsTenantSelection`).
class SelectTenantScreen extends ConsumerWidget {
  const SelectTenantScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    final tenants = session.availableTenants ?? const [];

    return Scaffold(
      backgroundColor: OrbixColors.page,
      appBar: AppBar(title: const Text('Selecciona tu empresa')),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: tenants.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final tenant = tenants[i];
          return Material(
            color: OrbixColors.white,
            borderRadius: BorderRadius.circular(12),
            child: ListTile(
              title: Text(tenant.name, style: OrbixText.ui(weight: FontWeight.w700)),
              subtitle: Text(tenant.slug, style: OrbixText.ui(color: OrbixColors.textMuted)),
              onTap: () async {
                await ref.read(authSessionProvider.notifier).selectTenant(tenant.slug);
                if (context.mounted) context.go(RoutePaths.pos);
              },
            ),
          );
        },
      ),
    );
  }
}
