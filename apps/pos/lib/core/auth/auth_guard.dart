import 'auth_session.dart';

/// Rutas accesibles sin sesión completa — el usuario puede *quedarse* aquí
/// sin sesión, a diferencia de `/splash` (transitoria, ver abajo).
const _authScreens = ['/login', '/onboarding'];

/// Resuelve el redirect por "hay sesión o no" (autenticación). El permiso
/// por ruta ("qué puedo hacer con esta sesión") es responsabilidad de
/// `core/security/permission_guard.dart`, no de este archivo.
String? resolveAuthRedirect(AuthSessionState session, String currentPath) {
  // Mientras se restaura la sesión guardada, el splash se queda quieto —
  // todavía no sabemos si hay sesión válida o no.
  if (session.status == AuthStatus.restoring) {
    return currentPath == '/splash' ? null : '/splash';
  }

  if (session.status == AuthStatus.sessionExpired && currentPath != '/login') {
    return '/login';
  }

  // Bloqueo local (inactividad/segundo plano/manual) — la sesión sigue
  // viva, solo se gatea la UI hasta que se resuelva PIN/biometría en
  // `LockScreen`. No confundir con `sessionExpired` (ahí sí hay que volver
  // a loguearse contra la API). `isAuthenticated` es `false` en este
  // estado, así que hay que salir aquí antes del chequeo genérico de abajo.
  if (session.status == AuthStatus.locked) {
    return currentPath == '/lock' ? null : '/lock';
  }

  if (!session.isAuthenticated) {
    return _authScreens.contains(currentPath) ? null : '/login';
  }

  if (session.needsTenantSelection) {
    return currentPath == '/select-tenant' ? null : '/select-tenant';
  }

  // Sesión completa (autenticada + tenant activo): nadie se queda parado
  // en splash/login/onboarding/lock — de ahí siempre se avanza a /pos.
  // `/lock` entra aquí también: tras un unlock exitoso el status pasa a
  // `authenticated` y esta es la única regla que saca de esa ruta.
  if (currentPath == '/splash' || currentPath == '/lock' || _authScreens.contains(currentPath)) {
    return '/pos';
  }

  return null;
}
