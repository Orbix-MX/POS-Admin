/// Envoltorio genérico de paginación para listas del backend.
class Paginated<T> {
  const Paginated({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory Paginated.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) =>
      Paginated<T>(
        items: (json['items'] as List<dynamic>)
            .map((e) => fromJsonT(e as Map<String, dynamic>))
            .toList(),
        page: json['page'] as int,
        pageSize: json['pageSize'] as int,
        total: json['total'] as int,
      );

  final List<T> items;
  final int page;
  final int pageSize;
  final int total;

  bool get hasNextPage => page * pageSize < total;
}
