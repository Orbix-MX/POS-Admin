/// Envoltorio genérico de paginación para listas del backend. Espejo de
/// `PaginatedResponse<T>` (`api/src/common/dto/pagination.dto.ts`):
/// `{ data: T[], meta: { page, limit, total, totalPages } }`.
class Paginated<T> {
  const Paginated({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
  });

  factory Paginated.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    final meta = json['meta'] as Map<String, dynamic>;
    return Paginated<T>(
      items: (json['data'] as List<dynamic>)
          .map((e) => fromJsonT(e as Map<String, dynamic>))
          .toList(),
      page: meta['page'] as int,
      pageSize: meta['limit'] as int,
      total: meta['total'] as int,
      totalPages: meta['totalPages'] as int,
    );
  }

  final List<T> items;
  final int page;
  final int pageSize;
  final int total;
  final int totalPages;

  bool get hasNextPage => page < totalPages;
}
