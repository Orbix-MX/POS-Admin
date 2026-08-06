import 'failures.dart';

/// Resultado de una operación que puede fallar. Evita que un repositorio o
/// service devuelva `null`/lance excepciones crudas hacia `presentation`.
sealed class Result<T> {
  const Result();

  const factory Result.ok(T data) = Ok<T>;

  const factory Result.err(Failure failure) = Err<T>;

  R fold<R>(R Function(T data) onOk, R Function(Failure failure) onErr) => switch (this) {
        Ok<T>(data: final data) => onOk(data),
        Err<T>(failure: final failure) => onErr(failure),
      };

  bool get isOk => this is Ok<T>;

  bool get isErr => this is Err<T>;
}

final class Ok<T> extends Result<T> {
  const Ok(this.data);

  final T data;
}

final class Err<T> extends Result<T> {
  const Err(this.failure);

  final Failure failure;
}
