/// Usuario autenticado. Espejo de `UserResponseDto` del backend
/// (`api/src/modules/core/auth/dto/auth-response.dto.ts`).
class User {
  const User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.status,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        role: json['role'] as String,
        status: json['status'] as String,
      );

  final String id;
  final String email;
  final String firstName;
  final String lastName;

  /// `UserRole` del backend (superadmin/owner/employee...) — se mantiene
  /// como `String` aquí; solo se tipa como enum si `business/enums` lo
  /// necesita en más de un lugar.
  final String role;

  /// `UserStatus` del backend (ACTIVE/INACTIVE...).
  final String status;

  String get fullName => '$firstName $lastName';
}
