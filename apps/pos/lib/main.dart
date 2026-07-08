import 'package:flutter/material.dart';

import 'pos_sale_screen.dart';
import 'theme.dart';

void main() => runApp(const OrbixPosApp());

class OrbixPosApp extends StatelessWidget {
  const OrbixPosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Orbix POS',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const PosSaleScreen(),
    );
  }
}
