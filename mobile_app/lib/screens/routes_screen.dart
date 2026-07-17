import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/route_model.dart';
import '../providers/fleet_provider.dart';
import '../widgets/custom_card.dart';

class RoutesScreen extends StatefulWidget {
  const RoutesScreen({Key? key}) : super(key: key);

  @override
  State<RoutesScreen> createState() => _RoutesScreenState();
}

class _RoutesScreenState extends State<RoutesScreen> {
  RouteModel? _selectedRoute;

  @override
  Widget build(BuildContext context) {
    final fleetProvider = Provider.of<FleetProvider>(context);
    final cs = Theme.of(context).colorScheme;

    final LatLng defaultCenter = const LatLng(-16.3988, -71.5368);

    final List<Polyline> polylines = [];
    final List<Marker> markers = [];

    if (_selectedRoute != null && _selectedRoute!.points.isNotEmpty) {
      Color routeColor = cs.secondary;
      try {
        final hex = _selectedRoute!.color.replaceFirst('#', '');
        routeColor = Color(int.parse('FF$hex', radix: 16));
      } catch (_) {}

      polylines.add(
        Polyline(
          points: _selectedRoute!.points,
          color: routeColor,
          strokeWidth: 4.5,
        ),
      );

      markers.add(
        Marker(
          point: _selectedRoute!.points.first,
          width: 32,
          height: 32,
          child: const Icon(Icons.play_circle_fill, color: Colors.green, size: 28),
        ),
      );

      markers.add(
        Marker(
          point: _selectedRoute!.points.last,
          width: 32,
          height: 32,
          child: const Icon(Icons.stop_circle, color: Colors.red, size: 28),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('RUTAS DE RECOLECCIÓN'),
      ),
      body: fleetProvider.isLoading && fleetProvider.routes.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  flex: 3,
                  child: Stack(
                    children: [
                      FlutterMap(
                        options: MapOptions(
                          initialCenter: _selectedRoute != null && _selectedRoute!.points.isNotEmpty
                              ? _selectedRoute!.points.first
                              : defaultCenter,
                          initialZoom: 13.0,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.smartcontainers.mobile_app',
                          ),
                          if (polylines.isNotEmpty) PolylineLayer(polylines: polylines),
                          if (markers.isNotEmpty) MarkerLayer(markers: markers),
                        ],
                      ),
                      if (_selectedRoute == null)
                        Container(
                          color: Colors.black.withOpacity(0.5),
                          child: const Center(
                            child: Padding(
                              padding: EdgeInsets.all(20),
                              child: Text(
                                'Seleccione una ruta abajo para visualizarla en el mapa',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

                Expanded(
                  flex: 2,
                  child: Container(
                    color: Theme.of(context).scaffoldBackgroundColor,
                    child: fleetProvider.routes.isEmpty
                        ? Center(
                            child: Text(
                              'No hay rutas optimizadas registradas',
                              style: TextStyle(color: cs.onSurfaceVariant),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: fleetProvider.routes.length,
                            separatorBuilder: (context, index) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final route = fleetProvider.routes[index];
                              final isSelected = _selectedRoute?.id == route.id;

                              return CustomCard(
                                color: isSelected ? cs.primary.withOpacity(0.08) : null,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                onTap: () {
                                  setState(() {
                                    _selectedRoute = route;
                                  });
                                },
                                child: Row(
                                  children: [
                                    Icon(
                                      Icons.route_outlined,
                                      color: isSelected ? cs.primary : cs.onSurfaceVariant,
                                      size: 32,
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            route.name,
                                            style: TextStyle(
                                              fontWeight: FontWeight.bold,
                                              color: isSelected ? cs.primary : cs.onSurface,
                                              fontSize: 14,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            'Distrito: ${route.district}',
                                            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${route.distance.toStringAsFixed(1)} km',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                          maxLines: 1,
                                        ),
                                        Text(
                                          '${route.duration} min',
                                          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11),
                                          maxLines: 1,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}
