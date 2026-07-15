import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:orbix_design_system/orbix_design_system.dart';

import '../core/auth/auth_session.dart';
import '../core/platform/platform_service.dart';
import '../core/router/app_router.dart';

/// Tiempo de inactividad tras el cual se bloquea la app sola (ver
/// `AuthSessionNotifier.lock`). Único lugar donde vive esta constante.
const _inactivityTimeout = Duration(minutes: 2);

class OrbixApp extends ConsumerWidget {
  const OrbixApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return _LockTrigger(
      child: MaterialApp.router(
        title: 'Orbix',
        debugShowCheckedModeBanner: false,
        theme: buildOrbixTheme(),
        routerConfig: router,
      ),
    );
  }
}

/// Bloquea la sesión (`AuthSessionNotifier.lock`, no-op sin sesión o sin PIN
/// local configurado) por inactividad o al volver de segundo plano. No
/// toca tokens — es puramente un gatillo de UI, la lógica de qué hacer con
/// el bloqueo vive en `auth_session.dart`/`auth_guard.dart`.
class _LockTrigger extends ConsumerStatefulWidget {
  const _LockTrigger({required this.child});
  final Widget child;

  @override
  ConsumerState<_LockTrigger> createState() => _LockTriggerState();
}

class _LockTriggerState extends ConsumerState<_LockTrigger> with WidgetsBindingObserver {
  Timer? _inactivityTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _resetInactivityTimer();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _inactivityTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      ref.read(authSessionProvider.notifier).lock();
    }
    // Android suele restaurar la chrome del sistema (status/nav bar) al
    // volver de segundo plano — se reoculta aquí en vez de solo en
    // `bootstrap()`, que corre una única vez al arrancar la app.
    if (state == AppLifecycleState.resumed && const PlatformService().isMobile) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    }
  }

  void _resetInactivityTimer() {
    _inactivityTimer?.cancel();
    _inactivityTimer = Timer(_inactivityTimeout, () {
      ref.read(authSessionProvider.notifier).lock();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _resetInactivityTimer(),
      behavior: HitTestBehavior.translucent,
      child: widget.child,
    );
  }
}
