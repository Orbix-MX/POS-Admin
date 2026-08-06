import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Interfaz de cámara (captura de foto para catálogo, escaneo visual de
/// código de barras). Stub — sin implementación real todavía.
abstract class CameraService {
  Future<String?> capturePhoto();
}

class NoopCameraService implements CameraService {
  const NoopCameraService();

  @override
  Future<String?> capturePhoto() async => null;
}

final cameraServiceProvider = Provider<CameraService>((ref) => const NoopCameraService());
