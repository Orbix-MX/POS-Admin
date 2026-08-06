import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:internet_connection_checker_plus/internet_connection_checker_plus.dart';

/// Consultado por un repositorio antes de decidir red vs. caché local — el
/// gancho para offline (Fase 3) sin que el feature lo sepa.
abstract class NetworkInfo {
  Future<bool> get isConnected;
}

class NetworkInfoImpl implements NetworkInfo {
  NetworkInfoImpl(this._connectivity, this._internetChecker);

  final Connectivity _connectivity;
  final InternetConnection _internetChecker;

  @override
  Future<bool> get isConnected async {
    final result = await _connectivity.checkConnectivity();
    if (result.contains(ConnectivityResult.none)) return false;
    // `connectivity_plus` solo confirma "hay una interfaz de red" (ej. wifi
    // de tienda sin salida a internet real) — `internet_connection_checker_plus`
    // valida que de verdad haya internet.
    return _internetChecker.hasInternetAccess;
  }
}

final networkInfoProvider = Provider<NetworkInfo>((ref) {
  return NetworkInfoImpl(Connectivity(), InternetConnection());
});
