import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../models/vehicle_model.dart';
import '../models/route_model.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class FleetProvider with ChangeNotifier {
  List<VehicleModel> _vehicles = [];
  List<RouteModel> _routes = [];
  bool _isLoading = false;
  String _errorMessage = '';
  DateTime? _lastFetch;

  Timer? _pollTimer;
  WebSocket? _ws;
  Timer? _wsReconnectTimer;

  static const int _pollIntervalSec = 6;
  static const int _fetchCooldownSec = 4;

  List<VehicleModel> get vehicles => _vehicles;
  List<RouteModel> get routes => _routes;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;
  DateTime? get lastFetch => _lastFetch;

  void startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(Duration(seconds: _pollIntervalSec), (_) {
      fetchData();
    });
    _connectWebSocket();
  }

  void stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _ws?.close();
    _ws = null;
    _wsReconnectTimer?.cancel();
  }

  Future<String> _getWsUrl() async {
    final baseUrl = await StorageService.getApiBaseUrl();
    final host = baseUrl
        .replaceFirst('http://', '')
        .replaceFirst('https://', '')
        .replaceFirst('/api/v1', '');
    return 'ws://$host/ws';
  }

  void _connectWebSocket() async {
    _wsReconnectTimer?.cancel();
    try {
      final url = await _getWsUrl();
      _ws = await WebSocket.connect(url);
      _ws!.listen(
        (data) {
          try {
            final parsed = jsonDecode(data as String);
            if (parsed['event'] == 'fleet_update' && parsed['data'] != null) {
              _applyFleetUpdate(parsed['data']);
            }
          } catch (_) {}
        },
        onDone: () {
          _wsReconnectTimer = Timer(const Duration(seconds: 3), _connectWebSocket);
        },
        onError: (_) {
          _wsReconnectTimer = Timer(const Duration(seconds: 3), _connectWebSocket);
        },
      );
    } catch (_) {
      _wsReconnectTimer = Timer(const Duration(seconds: 5), _connectWebSocket);
    }
  }

  void _applyFleetUpdate(dynamic data) {
    final updated = VehicleModel.fromJson(data as Map<String, dynamic>);
    final idx = _vehicles.indexWhere((v) => v.id == updated.id);
    if (idx >= 0) {
      _vehicles[idx] = updated;
    } else {
      _vehicles.add(updated);
    }
    notifyListeners();
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }

  bool _shouldSkipFetch() {
    if (_lastFetch == null) return false;
    return DateTime.now().difference(_lastFetch!).inSeconds < _fetchCooldownSec;
  }

  Future<void> fetchData({bool forceLoading = false}) async {
    if (_shouldSkipFetch()) return;

    if (forceLoading || _vehicles.isEmpty) {
      _isLoading = true;
      _errorMessage = '';
      notifyListeners();
    }

    try {
      final userInfoStr = await StorageService.getUserInfo();
      bool isGuest = false;
      if (userInfoStr != null) {
        final userMap = jsonDecode(userInfoStr);
        if (userMap['email'] == 'guest@smartcontainers.com') {
          isGuest = true;
        }
      }

      if (isGuest) {
        _loadMockData();
        return;
      }

      final vehicleResponse = await ApiService.get('/fleet/vehicles');
      if (vehicleResponse.statusCode == 200) {
        final List<dynamic> vehicleJson = jsonDecode(vehicleResponse.body);
        _vehicles = vehicleJson.map((v) => VehicleModel.fromJson(v)).toList();
      } else {
        throw Exception('Failed to load vehicles: ${vehicleResponse.statusCode}');
      }

      final routesResponse = await ApiService.get('/routes');
      if (routesResponse.statusCode == 200) {
        final List<dynamic> routesJson = jsonDecode(routesResponse.body);
        _routes = routesJson.map((r) => RouteModel.fromJson(r)).toList();
      }

      _lastFetch = DateTime.now();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      if (_vehicles.isEmpty) _loadMockData();
      else {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  void _loadMockData() {
    _vehicles = [
      VehicleModel(id: 'T-101', plate: 'V5X-901', driver: 'Juan Pérez', status: 'In Route', fuel: 78.0, capacity: 62.0, location: 'Av. Ejército 410', lastUpdate: 'Ahora', speed: 42.0),
      VehicleModel(id: 'T-102', plate: 'Z2W-108', driver: 'Carlos Ruiz', status: 'Available', fuel: 95.0, capacity: 0.0, location: 'Base de Operaciones', lastUpdate: 'Hace 5 min', speed: 0.0),
      VehicleModel(id: 'T-103', plate: 'A8B-567', driver: 'Luis Gómez', status: 'Maintenance', fuel: 40.0, capacity: 85.0, location: 'Taller Central', lastUpdate: 'Hace 2 horas', speed: 0.0),
    ];
    _routes = [
      RouteModel(id: 1, name: 'Ruta A - Cayma y Yanahuara', district: 'Cayma', distance: 12.5, duration: 45, color: '#2dd4bf', points: [
        LatLng(-16.398, -71.536),
        LatLng(-16.399, -71.535),
        LatLng(-16.403, -71.536),
      ]),
      RouteModel(id: 2, name: 'Ruta B - Cercado Express', district: 'Cercado', distance: 8.2, duration: 30, color: '#f59e0b', points: [
        LatLng(-16.398, -71.536),
        LatLng(-16.407, -71.527),
      ]),
    ];
    _lastFetch = DateTime.now();
    _isLoading = false;
    notifyListeners();
  }
}
