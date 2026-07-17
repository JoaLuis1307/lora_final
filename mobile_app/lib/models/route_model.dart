import 'package:latlong2/latlong.dart';

class RouteModel {
  final int? id;
  final String name;
  final String district;
  final List<LatLng> points;
  final double distance;
  final int duration; // in minutes
  final String color;

  RouteModel({
    this.id,
    required this.name,
    required this.district,
    required this.points,
    required this.distance,
    required this.duration,
    this.color = '#2dd4bf',
  });

  factory RouteModel.fromJson(Map<String, dynamic> json) {
    var pointsList = <LatLng>[];
    if (json['points'] != null) {
      // Points can be stored as a JSON array of [lat, lng] or [lng, lat]
      for (var point in json['points']) {
        if (point is List && point.length >= 2) {
          pointsList.add(LatLng((point[0] as num).toDouble(), (point[1] as num).toDouble()));
        }
      }
    }
    return RouteModel(
      id: json['id'] as int?,
      name: json['name'] as String? ?? 'Ruta',
      district: json['district'] as String? ?? '',
      points: pointsList,
      distance: (json['distance'] as num?)?.toDouble() ?? 0.0,
      duration: json['duration'] as int? ?? 0,
      color: json['color'] as String? ?? '#2dd4bf',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      'name': name,
      'district': district,
      'points': points.map((p) => [p.latitude, p.longitude]).toList(),
      'distance': distance,
      'duration': duration,
      'color': color,
    };
  }
}
