/// Permiso individual. El backend expone permisos como `List<String>` en
/// `ProfileResponseDto.permissions` (ver `api/.../auth-response.dto.ts`) —
/// este value object le da identidad de tipo dentro de la app en vez de
/// pasar `String` sueltos entre `AuthSession`, el router y los widgets.
class Permission {
  const Permission(this.key);

  factory Permission.fromJson(String key) => Permission(key);

  final String key;

  @override
  String toString() => key;

  @override
  bool operator ==(Object other) => other is Permission && other.key == key;

  @override
  int get hashCode => key.hashCode;
}
