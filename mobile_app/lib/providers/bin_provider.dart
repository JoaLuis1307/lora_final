import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import '../models/bin_model.dart';
import '../models/device_model.dart';
import '../services/api_service.dart';

import '../services/storage_service.dart';

class BinProvider with ChangeNotifier {
  List<BinModel> _bins = [];
  List<DeviceModel> _devices = [];
  bool _isLoading = false;
  String _errorMessage = '';
  DateTime? _lastFetch;

  Timer? _pollTimer;
  WebSocket? _ws;
  Timer? _wsReconnectTimer;

  static const int _pollIntervalSec = 6;
  static const int _fetchCooldownSec = 4;

  List<BinModel> get bins => _bins;
  List<DeviceModel> get devices => _devices;
  bool get isLoading => _isLoading;
  String get errorMessage => _errorMessage;
  DateTime? get lastFetch => _lastFetch;

  List<BinModel> _cachedCritical = [];
  List<BinModel> _cachedWarning = [];
  List<BinModel> _cachedNormal = [];

  List<BinModel> get criticalBins => _cachedCritical;
  List<BinModel> get warningBins => _cachedWarning;
  List<BinModel> get normalBins => _cachedNormal;

  void _updateFilteredCaches() {
    _cachedCritical = _bins.where((b) => b.fillLevel >= 80.0).toList();
    _cachedWarning = _bins.where((b) => b.fillLevel >= 50.0 && b.fillLevel < 80.0).toList();
    _cachedNormal = _bins.where((b) => b.fillLevel < 50.0).toList();
  }

  bool _shouldSkipFetch() {
    if (_lastFetch == null) return false;
    return DateTime.now().difference(_lastFetch!).inSeconds < _fetchCooldownSec;
  }

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
            if (parsed['event'] == 'telemetry' && parsed['device_id'] != null) {
              _applyTelemetry(parsed['device_id'] as String, parsed['data']);
            } else if (parsed['event'] == 'device_update' && parsed['device_id'] != null) {
              _applyDeviceUpdate(parsed['device_id'] as String, parsed['data']);
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

  void _applyTelemetry(String deviceId, dynamic data) {
    bool changed = false;
    for (var bin in _bins) {
      final bound = _devices.where((d) => d.mapPointId == bin.id).firstOrNull;
      if (bound != null && bound.deviceId == deviceId) {
        final distance = (data['ultrasonic_cm'] as num?)?.toDouble() ?? (data['tof_cm'] as num?)?.toDouble();
        if (distance != null && distance < 120) {
          final fill = ((120.0 - distance) / 110.0 * 100).clamp(0.0, 100.0);
          bin.fillLevel = fill;
        }
        if (data['temperature'] != null) {
          bin.temperature = (data['temperature'] as num).toDouble();
        }
        if (data['battery'] != null) {
          _devices[_devices.indexOf(bound)] = bound.copyWith(batteryLevel: (data['battery'] as num).toInt());
        }
        bin.status = _computeStatus(bound.status, bin.fillLevel);
        changed = true;
      }
    }
    if (changed) {
      _updateFilteredCaches();
      notifyListeners();
    }
  }

  void _applyDeviceUpdate(String deviceId, dynamic data) {
    bool changed = false;
    for (var i = 0; i < _devices.length; i++) {
      if (_devices[i].deviceId == deviceId) {
        _devices[i] = _devices[i].copyWith(
          status: data['status'] as String?,
          batteryLevel: data['battery_level'] != null ? (data['battery_level'] as num).toInt() : null,
        );
        changed = true;
      }
    }
    if (changed) {
      for (var bin in _bins) {
        final bound = _devices.where((d) => d.mapPointId == bin.id).firstOrNull;
        if (bound != null) {
          bin.status = _computeStatus(bound.status, bin.fillLevel);
        }
      }
      _updateFilteredCaches();
      notifyListeners();
    }
  }

  String _computeStatus(String deviceStatus, double fillLevel) {
    if (deviceStatus.toLowerCase() == 'offline') return 'gray';
    if (fillLevel >= 80.0) return 'red';
    if (fillLevel >= 50.0) return 'orange';
    return 'green';
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }

  Future<void> fetchData({bool forceLoading = false}) async {
    if (_shouldSkipFetch()) return;

    if (forceLoading || _bins.isEmpty) {
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

      final ptsResponse = await ApiService.get('/map-points');
      if (ptsResponse.statusCode != 200) {
        throw Exception('Failed to load map points: ${ptsResponse.statusCode}');
      }

      final List<dynamic> ptsJson = jsonDecode(ptsResponse.body);
      final rawBins = ptsJson
          .where((p) => p['type'] == 'bin' || p['type'] == 'node')
          .map((p) => BinModel.fromJson(p))
          .toList();

      final devResponse = await ApiService.get('/devices');
      List<DeviceModel> activeDevices = [];
      if (devResponse.statusCode == 200) {
        final List<dynamic> devJson = jsonDecode(devResponse.body);
        activeDevices = devJson.map((d) => DeviceModel.fromJson(d)).toList();
      }
      _devices = activeDevices;

      final telemetryResponse = await ApiService.get('/telemetry/latest');
      Map<String, dynamic> latestTelemetry = {};
      if (telemetryResponse.statusCode == 200) {
        latestTelemetry = jsonDecode(telemetryResponse.body);
      }

      for (var bin in rawBins) {
        if (bin.id == null) continue;
        final boundDevice = _devices.firstWhere(
          (d) => d.mapPointId == bin.id,
          orElse: () => DeviceModel(
            id: -1, deviceId: '', name: '', type: '', status: '',
            latitude: 0, longitude: 0, batteryLevel: 0, signalStrength: 0,
          ),
        );

        if (boundDevice.id != -1 && latestTelemetry.containsKey(boundDevice.deviceId)) {
          final tel = latestTelemetry[boundDevice.deviceId];
          final double distance = (tel['ultrasonic_cm'] as num?)?.toDouble() ?? 120.0;
          double fillPct = 0.0;
          if (distance < 120.0) {
            fillPct = ((120.0 - distance) / 110.0) * 100.0;
            if (fillPct < 0) fillPct = 0.0;
            if (fillPct > 100) fillPct = 100.0;
          }

          bin.fillLevel = fillPct;
          bin.temperature = (tel['temperature'] as num?)?.toDouble() ?? 20.0;

          bin.status = _computeStatus(boundDevice.status, fillPct);
        } else {
          bin.fillLevel = 0.0;
          bin.status = 'gray';
        }
      }

      _bins = rawBins;
      _updateFilteredCaches();
      _lastFetch = DateTime.now();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      if (_bins.isEmpty) _loadMockData();
      else {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  void _loadMockData() {
    _bins = [
      BinModel(id: 1, name: 'Contenedor Av. Ejército 402', latitude: -16.403, longitude: -71.536, type: 'bin', description: 'Papel y Cartón', fillLevel: 45.0, status: 'green', temperature: 22.5),
      BinModel(id: 2, name: 'Contenedor Plaza de Armas', latitude: -16.398, longitude: -71.536, type: 'bin', description: 'Plásticos y Latas', fillLevel: 82.0, status: 'red', temperature: 24.1),
      BinModel(id: 3, name: 'Contenedor Calle Mercaderes 115', latitude: -16.399, longitude: -71.535, type: 'bin', description: 'Residuos Orgánicos', fillLevel: 61.0, status: 'orange', temperature: 21.8),
      BinModel(id: 4, name: 'Contenedor C.C. Real Plaza', latitude: -16.407, longitude: -71.527, type: 'bin', description: 'Vidrio', fillLevel: 12.0, status: 'green', temperature: 19.5),
    ];
    _devices = [
      DeviceModel(id: 1, deviceId: 'N1', name: 'Nodo Sensor 01', type: 'Nodo Sensor', status: 'Online', latitude: -16.403, longitude: -71.536, batteryLevel: 94, signalStrength: -68, mapPointId: 1),
      DeviceModel(id: 2, deviceId: 'N2', name: 'Nodo Sensor 02', type: 'Nodo Sensor', status: 'Online', latitude: -16.398, longitude: -71.536, batteryLevel: 82, signalStrength: -72, mapPointId: 2),
      DeviceModel(id: 3, deviceId: 'N3', name: 'Nodo Sensor 03', type: 'Nodo Sensor', status: 'Online', latitude: -16.399, longitude: -71.535, batteryLevel: 15, signalStrength: -85, mapPointId: 3),
      DeviceModel(id: 4, deviceId: 'N4', name: 'Nodo Sensor 04', type: 'Nodo Sensor', status: 'Offline', latitude: -16.407, longitude: -71.527, batteryLevel: 0, signalStrength: -99, mapPointId: 4),
    ];
    _updateFilteredCaches();
    _lastFetch = DateTime.now();
    _isLoading = false;
    notifyListeners();
  }
}
