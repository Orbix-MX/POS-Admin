import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../config/app_config.dart';
import '../config/environment.dart';
import '../storage/secure_storage.dart';
import '../utils/logger.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/error_interceptor.dart';
import 'interceptors/logging_interceptor.dart';
import 'interceptors/refresh_interceptor.dart';

/// Cliente HTTP único de la app. Expuesto vía Riverpod (`dioProvider`) —
/// ningún repositorio/service debe instanciar `Dio` por su cuenta (regla del
/// proyecto #2).
///
/// Orden de interceptores: auth (adjunta token) → logging → error mapping →
/// refresh-on-401. El refresh va al final porque reintenta la request ya
/// vestida con headers/logging aplicados.
final dioProvider = Provider<Dio>((ref) {
  final secureStorage = ref.watch(secureStorageProvider);
  final talker = ref.watch(talkerProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: EnvironmentX.current.baseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      sendTimeout: AppConfig.sendTimeout,
      headers: {
        'Accept-Language': 'es-MX',
      },
    ),
  );

  dio.interceptors.addAll([
    AuthInterceptor(secureStorage),
    buildLoggingInterceptor(talker),
    ErrorInterceptor(),
    RefreshInterceptor(secureStorage, dio),
  ]);

  PackageInfo.fromPlatform().then((info) {
    dio.options.headers['X-App-Version'] = '${info.version}+${info.buildNumber}';
  });

  return dio;
});
