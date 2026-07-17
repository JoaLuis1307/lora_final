class DeviceModel {
  final int id;
  final String deviceId;
  final String name;
  final String type;
  final String status;
  final double latitude;
  final double longitude;
  final int batteryLevel;
  final int signalStrength;
  final String? lastSeen;
  final String? macAddress;
  final int? mapPointId;
  final String? gatewayId;

  DeviceModel({
    required this.id,
    required this.deviceId,
    required this.name,
    required this.type,
    required this.status,
    required this.latitude,
    required this.longitude,
    required this.batteryLevel,
    required this.signalStrength,
    this.lastSeen,
    this.macAddress,
    this.mapPointId,
    this.gatewayId,
  });

  factory DeviceModel.fromJson(Map<String, dynamic> json) {
    return DeviceModel(
      id: json['id'] as int,
      deviceId: json['device_id'] as String? ?? json['deviceId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? '',
      status: json['status'] as String? ?? 'Offline',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      batteryLevel: json['battery_level'] as int? ?? json['batteryLevel'] as int? ?? 100,
      signalStrength: json['signal_strength'] as int? ?? json['signalStrength'] as int? ?? -50,
      lastSeen: json['last_seen'] as String? ?? json['lastSeen'] as String?,
      macAddress: json['mac_address'] as String? ?? json['macAddress'] as String?,
      mapPointId: json['map_point_id'] as int? ?? json['mapPointId'] as int?,
      gatewayId: json['gateway_id'] as String? ?? json['gatewayId'] as String?,
    );
  }

  DeviceModel copyWith({
    int? id,
    String? deviceId,
    String? name,
    String? type,
    String? status,
    double? latitude,
    double? longitude,
    int? batteryLevel,
    int? signalStrength,
    String? lastSeen,
    String? macAddress,
    int? mapPointId,
    String? gatewayId,
  }) {
    return DeviceModel(
      id: id ?? this.id,
      deviceId: deviceId ?? this.deviceId,
      name: name ?? this.name,
      type: type ?? this.type,
      status: status ?? this.status,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      signalStrength: signalStrength ?? this.signalStrength,
      lastSeen: lastSeen ?? this.lastSeen,
      macAddress: macAddress ?? this.macAddress,
      mapPointId: mapPointId ?? this.mapPointId,
      gatewayId: gatewayId ?? this.gatewayId,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'device_id': deviceId,
      'name': name,
      'type': type,
      'status': status,
      'latitude': latitude,
      'longitude': longitude,
      'battery_level': batteryLevel,
      'signal_strength': signalStrength,
      'last_seen': lastSeen,
      'mac_address': macAddress,
      'map_point_id': mapPointId,
      'gateway_id': gatewayId,
    };
  }
}
