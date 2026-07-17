class VehicleModel {
  final String id;
  final String plate;
  final String driver;
  final String status; // 'In Route' | 'Maintenance' | 'Available' | 'Low Fuel'
  final double fuel; // percentage 0-100
  final double capacity; // percentage 0-100
  final String location;
  final String lastUpdate;
  final double speed;

  VehicleModel({
    required this.id,
    required this.plate,
    required this.driver,
    required this.status,
    required this.fuel,
    required this.capacity,
    required this.location,
    required this.lastUpdate,
    required this.speed,
  });

  factory VehicleModel.fromJson(Map<String, dynamic> json) {
    return VehicleModel(
      id: json['id'] as String? ?? '',
      plate: json['plate'] as String? ?? '',
      driver: json['driver'] as String? ?? '',
      status: json['status'] as String? ?? 'Available',
      fuel: (json['fuel'] as num?)?.toDouble() ?? 100.0,
      capacity: (json['capacity'] as num?)?.toDouble() ?? 0.0,
      location: json['location'] as String? ?? '',
      lastUpdate: json['last_update'] as String? ?? json['lastUpdate'] as String? ?? 'Ahora',
      speed: (json['speed'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'plate': plate,
      'driver': driver,
      'status': status,
      'fuel': fuel,
      'capacity': capacity,
      'location': location,
      'last_update': lastUpdate,
      'speed': speed,
    };
  }
}
