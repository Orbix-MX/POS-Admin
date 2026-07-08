import 'models.dart';

/// Datos de muestra tomados 1:1 del diseño "POS - Venta actual".

const kProducts = <Product>[
  Product(id: 'coca', name: 'Coca Cola 600 ml', price: 18, stock: 24, category: 'Bebidas'),
  Product(id: 'agua', name: 'Agua Ciel 1L', price: 15, stock: 42, category: 'Bebidas'),
  Product(id: 'jugo', name: 'Jugo Del Valle 1L', price: 28, stock: 18, category: 'Bebidas'),
  Product(id: 'sandwich', name: 'Sandwich Club', price: 65, stock: 12, category: 'Comidas'),
  Product(id: 'hamburguesa', name: 'Hamburguesa Clásica', price: 89, stock: 8, category: 'Comidas'),
  Product(id: 'pizza', name: 'Pizza Pepperoni', price: 125, stock: 6, category: 'Comidas'),
  Product(id: 'cheesecake', name: 'Cheesecake', price: 55, stock: 10, category: 'Postres'),
  Product(id: 'brownie', name: 'Brownie con Helado', price: 60, stock: 9, category: 'Postres'),
  Product(id: 'papas', name: 'Papas a la Francesa', price: 45, stock: 20, category: 'Snacks'),
  Product(id: 'leche', name: 'Leche Entera 1L', price: 22, stock: 30, category: 'Lácteos'),
  Product(id: 'pandecaja', name: 'Pan de Caja', price: 32, stock: 16, category: 'Panadería'),
  Product(id: 'huevo', name: 'Huevo Blanco 12 pzas', price: 42, stock: 25, category: 'Abarrotes'),
];

const kNavLabels = <String>[
  'Venta', 'Caja', 'Clientes', 'Productos', 'Inventario', 'Reportes', 'Más',
];

const kCategories = <String>[
  'Bebidas', 'Comidas', 'Postres', 'Snacks', 'Lácteos',
  'Abarrotes', 'Limpieza', 'Panadería', 'Carnes',
];

/// Carrito inicial del diseño.
const kInitialCart = <String, int>{
  'hamburguesa': 1,
  'coca': 2,
  'papas': 1,
  'cheesecake': 1,
};

const kStats = <StatCard>[
  StatCard(label: 'Ventas del día', value: '\$8,245.50', trend: '12.5%', points: [
    (0, 22), (12, 20), (24, 16), (36, 18), (48, 10), (60, 12), (70, 4)
  ]),
  StatCard(label: 'Transacciones', value: '128', trend: '8.3%', points: [
    (0, 18), (12, 20), (24, 12), (36, 15), (48, 8), (60, 14), (70, 6)
  ]),
  StatCard(label: 'Ticket promedio', value: '\$64.41', trend: '5.7%', points: [
    (0, 20), (12, 14), (24, 18), (36, 10), (48, 16), (60, 8), (70, 10)
  ]),
  StatCard(label: 'Artículos vendidos', value: '342', trend: '11.2%', points: [
    (0, 24), (12, 16), (24, 20), (36, 8), (48, 14), (60, 6), (70, 2)
  ]),
];
