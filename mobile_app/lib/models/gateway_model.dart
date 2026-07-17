class GatewayModel {
  final String id;
  final String name;
  final String status; // 'online' | 'offline' | 'warning'
  final String macAddress;
  final int connectedNodes;
  final int signalStrength; // dBm
  final int batteryLevel;
  final String? lastSeen;
  final String? mapPointName;
  final double? latitude;
  final double? longitude;

  GatewayModel({
    required this.id,
    required this.name,
    required this.status,
    required this.macAddress,
    this.connectedNodes = 0,
    required this.signalStrength,
    required this.batteryLevel,
    this.lastSeen,
    this.mapPointName,
    this.latitude,
    this.longitude,
  });

  factory GatewayModel.fromJson(Map<String, dynamic> json) {
    return GatewayModel(
      id: json['device_id'] as String? ?? json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Concentrador LoRa',
      status: json['status'] as String? ?? 'offline',
      macAddress: json['mac_address'] as String? ?? json['macAddress'] as String? ?? '',
      connectedNodes: json['connected_nodes'] as int? ?? 0,
      signalStrength: json['signal_strength'] as int? ?? json['signalStrength'] as int? ?? -50,
      batteryLevel: json['battery_level'] as int? ?? json['batteryLevel'] as int? ?? 100,
      lastSeen: json['last_seen'] as String? ?? json['lastSeen'] as String?,
      mapPointName: json['map_point_name'] as String? ?? json['mapPointName'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'device_id': id,
      'name': name,
      'status': status,
      'mac_address': macAddress,
      'connected_nodes': connectedNodes,
      'signal_strength': signalStrength,
      'battery_level': batteryLevel,
      'last_seen': lastSeen,
      'map_point_name': mapPointName,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    };
  }
}
