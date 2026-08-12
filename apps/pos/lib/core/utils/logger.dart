import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:talker/talker.dart';

/// Instancia única de logging. `UnknownFailure` siempre se loggea aquí con
/// stacktrace completo; `Failure`s esperados (red, validación) en
/// info/warning — ver `core/error/failures.dart`.
final talkerProvider = Provider<Talker>((ref) => Talker());
