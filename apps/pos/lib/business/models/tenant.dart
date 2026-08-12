/// Empresa/tenant activo. Espejo de `TenantSummaryDto` del backend.
class Tenant {
  const Tenant({
    required this.id,
    required this.name,
    required this.slug,
    required this.memberRole,
    required this.plan,
  });

  factory Tenant.fromJson(Map<String, dynamic> json) => Tenant(
        id: json['id'] as String,
        name: json['name'] as String,
        slug: json['slug'] as String,
        memberRole: json['memberRole'] as String,
        plan: json['plan'] as String,
      );

  final String id;
  final String name;
  final String slug;

  /// `TenantRole` del backend (owner/admin/staff...).
  final String memberRole;

  /// `TenantPlan` del backend (FREE/PRO/...).
  final String plan;
}
