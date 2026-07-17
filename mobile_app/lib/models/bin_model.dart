class BinModel {
  final int? id;
  final String name;
  final double latitude;
  final double longitude;
  final String type; // e.g. "bin"
  final String? description;
  final String? createdAt;
  
  // Custom fields calculated from latest telemetry if bound to a device
  double fillLevel; // Percentage 0-100
  double temperature;
  String status; // 'green', 'orange', 'red', 'gray' (offline)

  BinModel({
    this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.type,
    this.description,
    this.createdAt,
    this.fillLevel = 0.0,
    this.temperature = 20.0,
    this.status = 'green',
  });

  factory BinModel.fromJson(Map<String, dynamic> json) {
    return BinModel(
      id: json['id'] as int?,
      name: json['name'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      type: json['type'] as String? ?? 'bin',
      description: json['description'] as String?,
      createdAt: json['created_at'] as String? ?? json['createdAt'] as String?,
      fillLevel: (json['fillLevel'] as num?)?.toDouble() ?? 0.0,
      temperature: (json['temperature'] as num?)?.toDouble() ?? 20.0,
      status: json['status'] as String? ?? 'green',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'name': name,
      'latitude': latitude,
      'longitude': longitude,
      'type': type,
      'description': description,
      if (createdAt != null) 'created_at': createdAt,
    };
  }
}
