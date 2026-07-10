import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/splash_screen.dart';
import '../../features/auth/presentation/screens/lock_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/not_authorized_screen.dart';
import '../../features/auth/presentation/screens/select_tenant_screen.dart';
import '../../features/settings/presentation/screens/security_settings_screen.dart';
import '../../pos_sale_screen.dart';
import '../auth/auth_guard.dart';
import '../auth/auth_session.dart';
import 'route_paths.dart';

/// Puente entre el estado de Riverpod (`authSessionProvider`) y
/// `refreshListenable` de `go_router`, que espera un `Listenable` clásico.
class _RouterRefreshNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}

/// Router raíz de la app. `redirect` resuelve solo autenticación
/// (`resolveAuthRedirect`) — el permiso por ruta se agrega por-`GoRoute`
/// cuando el primer feature con permisos granulares lo necesite
/// (`core/security/permission_guard.dart`).
///
/// El `ShellRoute` hoy es un passthrough: `PosSaleScreen` todavía es dueña
/// de su propio `Scaffold`/`Drawer`/layout responsive. Subir ese chrome
/// compartido al shell es trabajo de Fase 2 (migración de `pos/` a feature
/// completo) — ver sección 4 del audit de arquitectura.
final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefreshNotifier();
  ref.listen(authSessionProvider, (_, _) => refresh.notify());
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: RoutePaths.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final session = ref.read(authSessionProvider);
      return resolveAuthRedirect(session, state.matchedLocation);
    },
    routes: [
      GoRoute(path: RoutePaths.splash, builder: (context, state) => const SplashScreen()),
      GoRoute(path: RoutePaths.login, builder: (context, state) => const LoginScreen()),
      GoRoute(path: RoutePaths.lock, builder: (context, state) => const LockScreen()),
      GoRoute(
        path: RoutePaths.selectTenant,
        builder: (context, state) => const SelectTenantScreen(),
      ),
      GoRoute(
        path: RoutePaths.notAuthorized,
        builder: (context, state) => const NotAuthorizedScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => child,
        routes: [
          GoRoute(path: RoutePaths.pos, builder: (context, state) => const PosSaleScreen()),
          GoRoute(
            path: RoutePaths.settings,
            builder: (context, state) => const SecuritySettingsScreen(),
          ),
        ],
      ),
    ],
  );
});
