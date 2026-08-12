import 'package:dio/dio.dart';
import 'package:talker/talker.dart';
import 'package:talker_dio_logger/talker_dio_logger_interceptor.dart';
import 'package:talker_dio_logger/talker_dio_logger_settings.dart';

/// Wrapper fino sobre `talker_dio_logger` — mantiene el punto de
/// configuración en `core/network/interceptors/` en vez de disperso en
/// `dio_client.dart`, y es el único lugar que decide qué tan verboso es el
/// log de red (por ahora: request/response completos, sin bodies gigantes).
Interceptor buildLoggingInterceptor(Talker talker) => TalkerDioLogger(
      talker: talker,
      settings: const TalkerDioLoggerSettings(
        printRequestHeaders: false,
        printResponseHeaders: false,
      ),
    );
