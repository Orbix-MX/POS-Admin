# Contribuir a Orbix Mobile

Arquitectura completa: [`docs/ARCHITECTURE_AUDIT.md`](docs/ARCHITECTURE_AUDIT.md). Esto es el resumen operativo — las 11 reglas no negociables (sección 17 del audit).

## Reglas del proyecto

1. Ningún feature importa otro feature. Lo compartido sube a `business/` o al paquete `orbix_design_system`.
2. Todo acceso HTTP pasa por `dio_client` — cero `http.get`/sockets crudos en features.
3. Todo estado compartido entre pantallas vive en Riverpod — cero `ChangeNotifier` instanciado a mano dentro de un `State`.
4. Ningún widget conoce la API directamente — siempre a través de un provider/service/repositorio.
5. Ningún token se guarda fuera de `flutter_secure_storage`.
6. Todo componente visual reutilizable pertenece a `orbix_design_system`, nunca a una carpeta `shared/` de la app.
7. Un feature empieza simple (`presentation/ + providers/ + services/`); solo promueve a `domain/ + data/` cuando cumple el criterio de la sección 2.4 del audit — no por plantilla, no "por si acaso".
8. Acceso a hardware (impresora, scanner, báscula, NFC, cajón) siempre a través de la interfaz en `core/hardware/`, nunca el plugin del SDK directo en un feature.
9. Comunicación entre features solo por `core/events/EventBus` (notificar hechos) o subiendo el contrato a `business/` (compartir datos) — nunca importando un feature desde otro.
10. Permisos se consultan vía `core/security/PermissionService` — nunca un `if (user.role == 'admin')` disperso en un feature o widget.
11. Riverpod, Dio, go_router, ODS propio y feature-first son decisiones congeladas — no se reabren por preferencia de estilo.

## Convenciones de nombres

Ver sección 13 del audit. Resumen rápido:

- Screens: `xxx_screen.dart` → `XxxScreen`.
- Providers/Notifiers: `xxxProvider` → `XxxNotifier`.
- Repositorios (solo en features promovidos): `XxxRepository` / `XxxRepositoryImpl`.
- Servicios (feature simple o `core/`): `XxxService`.
- Modelos transversales: `business/models/xxx.dart` → `Xxx` (sin sufijo).
- Componentes ODS: `orbix_design_system/lib/components/` → `OrbixXxx`.

## Antes de abrir un PR

- `flutter analyze` sin errores.
- Ningún import de un feature hacia otro feature (revisar en el diff).
- Si el PR cierra una fase del roadmap (ver sección 15 del audit), correr la auditoría de esa fase antes de mergear.
