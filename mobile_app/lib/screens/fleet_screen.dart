import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/device_model.dart';
import '../providers/bin_provider.dart';
import '../providers/fleet_provider.dart';
import '../widgets/status_indicator.dart';

double _rs(double size, double sw) {
  return size * (sw / 390);
}

double _rclamp(double size, double min, double max) {
  return size.clamp(min, max);
}

class FleetScreen extends StatefulWidget {
  const FleetScreen({Key? key}) : super(key: key);

  @override
  State<FleetScreen> createState() => _FleetScreenState();
}

class _FleetScreenState extends State<FleetScreen> {
  final MapController _mapController = MapController();
  final TextEditingController _searchController = TextEditingController();
  String _mapStyle = 'clasico';
  bool _showSearch = false;
  LatLng _defaultCenter = const LatLng(-16.3988, -71.5368);

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _zoomTo(LatLng position) {
    _mapController.move(position, 16.5);
  }

  @override
  Widget build(BuildContext context) {
    final binProvider = Provider.of<BinProvider>(context);
    final fleetProvider = Provider.of<FleetProvider>(context);
    final cs = Theme.of(context).colorScheme;

    const String darkTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
    const String satTileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const String classicTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    final sw = MediaQuery.of(context).size.width;
    final rs = (double s) => _rclamp(_rs(s, sw), s * 0.75, s * 1.3);
    final ms = _rclamp(_rs(44, sw), 34, 52);

    final List<Marker> markers = binProvider.bins.map((bin) {
      Color statusColor;
      switch (bin.status) {
        case 'red':
          statusColor = cs.error;
          break;
        case 'orange':
          statusColor = cs.tertiary;
          break;
        case 'green':
          statusColor = cs.primary;
          break;
        case 'gray':
        default:
          statusColor = cs.onSurfaceVariant;
          break;
      }

      final isCritical = bin.fillLevel >= 80.0;

      return Marker(
        point: LatLng(bin.latitude, bin.longitude),
        width: ms,
        height: ms,
        child: GestureDetector(
          onTap: () {
            final device = binProvider.devices.firstWhere(
              (d) => d.mapPointId == bin.id,
              orElse: () => DeviceModel(
                id: -1, deviceId: '', name: '', type: '', status: '',
                latitude: 0, longitude: 0, batteryLevel: 0, signalStrength: 0,
              ),
            );

            showModalBottomSheet(
              context: context,
              backgroundColor: Theme.of(context).cardColor,
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              builder: (context) => Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: cs.outlineVariant,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            bin.name,
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: cs.onSurface),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        StatusIndicator(status: bin.status),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      bin.description ?? 'Sin descripción',
                      style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
                    ),
                    Divider(height: 24, color: cs.outlineVariant),
                    Row(
                      children: [
                        _buildBottomSheetStat(
                          icon: Icons.delete_outline,
                          label: 'Llenado',
                          value: '${bin.fillLevel.toStringAsFixed(0)}%',
                          color: statusColor,
                        ),
                        _buildBottomSheetStat(
                          icon: Icons.thermostat_outlined,
                          label: 'Temp.',
                          value: '${bin.temperature.toStringAsFixed(1)}°C',
                          color: cs.secondary,
                        ),
                        _buildBottomSheetStat(
                          icon: Icons.battery_charging_full,
                          label: 'Batería',
                          value: device.id != -1 ? '${device.batteryLevel}%' : '--',
                          color: device.id != -1 && device.batteryLevel < 20 ? cs.error : cs.primary,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Dispositivo: ${device.id != -1 ? device.deviceId : "No Vinculado"}',
                          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11),
                        ),
                        Text(
                          'Ubicación: ${bin.latitude.toStringAsFixed(5)}, ${bin.longitude.toStringAsFixed(5)}',
                          style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11, fontStyle: FontStyle.italic),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (isCritical)
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.85, end: 1.15),
                  duration: const Duration(milliseconds: 1200),
                  builder: (context, value, child) {
                    return Container(
                      width: ms * 0.9 * value,
                      height: ms * 0.9 * value,
                      decoration: BoxDecoration(
                        color: cs.error.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                        border: Border.all(color: cs.error.withValues(alpha: 0.25), width: 1.5),
                      ),
                    );
                  },
                ),
              Container(
                width: ms * 0.77,
                height: ms * 0.77,
                decoration: BoxDecoration(
                  color: statusColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: ms * 0.055),
                  boxShadow: [
                    BoxShadow(
                      color: statusColor.withValues(alpha: 0.4),
                      blurRadius: ms * 0.18,
                      offset: Offset(0, ms * 0.045),
                    ),
                  ],
                ),
                child: Icon(Icons.delete_rounded, color: Colors.white, size: ms * 0.41),
              ),
            ],
          ),
        ),
      );
    }).toList();

    for (var vehicle in fleetProvider.vehicles) {
      LatLng vPos = _defaultCenter;
      if (vehicle.location.contains(',')) {
        try {
          final parts = vehicle.location.split(',');
          vPos = LatLng(double.parse(parts[0].trim()), double.parse(parts[1].trim()));
        } catch (_) {}
      } else {
        final int idVal = vehicle.id.hashCode % 10;
        vPos = LatLng(_defaultCenter.latitude + (idVal - 5) * 0.003, _defaultCenter.longitude + (idVal - 5) * 0.003);
      }

      markers.add(
        Marker(
          point: vPos,
          width: ms + 4,
          height: ms + 12,
          child: GestureDetector(
            onTap: () {
              showModalBottomSheet(
                context: context,
                backgroundColor: Theme.of(context).cardColor,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                builder: (context) => Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: cs.outlineVariant,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              'Vehículo: ${vehicle.id}',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: cs.onSurface),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          StatusIndicator(status: vehicle.status),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Placa: ${vehicle.plate} | Chofer: ${vehicle.driver}',
                        style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
                      ),
                      Divider(height: 24, color: cs.outlineVariant),
                      Row(
                        children: [
                          _buildBottomSheetStat(
                            icon: Icons.local_gas_station_outlined,
                            label: 'Combustible',
                            value: '${vehicle.fuel.toStringAsFixed(0)}%',
                            color: vehicle.fuel < 20 ? cs.error : cs.primary,
                          ),
                          _buildBottomSheetStat(
                            icon: Icons.storage_outlined,
                            label: 'Capacidad',
                            value: '${vehicle.capacity.toStringAsFixed(0)}%',
                            color: cs.tertiary,
                          ),
                          _buildBottomSheetStat(
                            icon: Icons.speed_outlined,
                            label: 'Velocidad',
                            value: '${vehicle.speed.toStringAsFixed(0)} km/h',
                            color: cs.secondary,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Últ. GPS: ${vehicle.lastUpdate}',
                            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11),
                          ),
                          Text(
                            'Coords: ${vPos.latitude.toStringAsFixed(5)}, ${vPos.longitude.toStringAsFixed(5)}',
                            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 11, fontStyle: FontStyle.italic),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: ms,
                      height: ms,
                      decoration: BoxDecoration(
                        color: cs.secondary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Theme.of(context).cardColor, width: ms * 0.065),
                        boxShadow: [
                          BoxShadow(
                            color: cs.secondary.withValues(alpha: 0.4),
                            blurRadius: ms * 0.18,
                            offset: Offset(0, ms * 0.045),
                          ),
                        ],
                      ),
                      child: Icon(Icons.local_shipping, color: Colors.white, size: ms * 0.5),
                    ),
                    Container(
                      width: ms * 0.23,
                      height: ms * 0.23,
                      decoration: BoxDecoration(
                        color: cs.secondary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Theme.of(context).cardColor, width: ms * 0.045),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _defaultCenter,
              initialZoom: 13.5,
              maxZoom: 18,
              minZoom: 10,
            ),
            children: [
              TileLayer(
                urlTemplate: _mapStyle == 'satelite'
                    ? satTileUrl
                    : (_mapStyle == 'clasico' ? classicTileUrl : darkTileUrl),
                subdomains: const ['a', 'b', 'c', 'd'],
                userAgentPackageName: 'com.smartcontainers.mobile_app',
              ),
              MarkerLayer(markers: markers),
            ],
          ),

          Positioned(
            top: MediaQuery.of(context).padding.top + rs(12),
            left: rs(16),
            right: rs(16),
            child: Row(
              children: [
                Expanded(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    height: rs(50),
                    decoration: BoxDecoration(
                      color: Theme.of(context).cardColor.withOpacity(0.9),
                      borderRadius: BorderRadius.circular(rs(12)),
                      border: Border.all(color: cs.outlineVariant),
                      boxShadow: [
                        BoxShadow(color: cs.shadow.withOpacity(0.08), blurRadius: rs(10)),
                      ],
                    ),
                    child: _showSearch
                        ? TextField(
                            controller: _searchController,
                            autofocus: true,
                            style: TextStyle(color: cs.onSurface, fontSize: rs(14)),
                            onChanged: (val) => setState(() {}),
                            decoration: InputDecoration(
                              hintText: 'Buscar contenedor o camión...',
                              prefixIcon: Icon(Icons.search, size: rs(20), color: cs.onSurfaceVariant),
                              contentPadding: EdgeInsets.symmetric(vertical: rs(14)),
                              suffixIcon: IconButton(
                                icon: Icon(Icons.clear, size: rs(20), color: cs.onSurfaceVariant),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() {
                                    _showSearch = false;
                                  });
                                },
                              ),
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                            ),
                          )
                        : Padding(
                            padding: EdgeInsets.symmetric(horizontal: rs(16)),
                            child: Row(
                              children: [
                                Icon(Icons.map_outlined, color: cs.primary, size: rs(20)),
                                SizedBox(width: rs(10)),
                                Text(
                                  'MAPA DE MONITOREO',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.1,
                                    fontSize: rs(13),
                                    color: cs.onSurface,
                                  ),
                                ),
                                const Spacer(),
                                IconButton(
                                  icon: Icon(Icons.search, color: cs.onSurface, size: rs(20)),
                                  onPressed: () {
                                    setState(() {
                                      _showSearch = true;
                                    });
                                  },
                                ),
                              ],
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),

          if (_showSearch && _searchController.text.isNotEmpty)
            Positioned(
              top: MediaQuery.of(context).padding.top + rs(70),
              left: rs(16),
              right: rs(16),
              child: Container(
                constraints: BoxConstraints(maxHeight: rs(200)),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardColor.withOpacity(0.95),
                  borderRadius: BorderRadius.circular(rs(12)),
                  border: Border.all(color: cs.outlineVariant),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(rs(12)),
                  child: ListView(
                    shrinkWrap: true,
                    padding: EdgeInsets.zero,
                    children: [
                      ...binProvider.bins
                          .where((b) => b.name.toLowerCase().contains(_searchController.text.toLowerCase()))
                          .map((b) => ListTile(
                                leading: Icon(Icons.delete_outline, color: cs.primary, size: rs(24)),
                                title: Text(b.name, style: TextStyle(color: cs.onSurface, fontSize: rs(13))),
                                subtitle: Text('Nivel: ${b.fillLevel.toStringAsFixed(0)}%', style: TextStyle(fontSize: rs(11))),
                                dense: true,
                                onTap: () {
                                  _zoomTo(LatLng(b.latitude, b.longitude));
                                  setState(() {
                                    _showSearch = false;
                                    _searchController.clear();
                                  });
                                },
                              )),
                      ...fleetProvider.vehicles
                          .where((v) => v.id.toLowerCase().contains(_searchController.text.toLowerCase()))
                          .map((v) {
                        LatLng vPos = _defaultCenter;
                        if (v.location.contains(',')) {
                          try {
                            final parts = v.location.split(',');
                            vPos = LatLng(double.parse(parts[0].trim()), double.parse(parts[1].trim()));
                          } catch (_) {}
                        }
                        return ListTile(
                          leading: Icon(Icons.local_shipping_outlined, color: cs.secondary, size: rs(24)),
                          title: Text('Vehículo ${v.id}', style: TextStyle(color: cs.onSurface, fontSize: rs(13))),
                          subtitle: Text('Estado: ${v.status} | Placa: ${v.plate}', style: TextStyle(fontSize: rs(11))),
                          dense: true,
                          onTap: () {
                            _zoomTo(vPos);
                            setState(() {
                              _showSearch = false;
                              _searchController.clear();
                            });
                          },
                        );
                      }),
                    ],
                  ),
                ),
              ),
            ),

          Positioned(
            bottom: rs(24),
            left: rs(16),
            child: Container(
              padding: EdgeInsets.all(rs(sw < 360 ? 8 : 10)),
              decoration: BoxDecoration(
                color: Theme.of(context).cardColor.withOpacity(0.9),
                borderRadius: BorderRadius.circular(rs(12)),
                border: Border.all(color: cs.outlineVariant),
                boxShadow: [
                  BoxShadow(color: cs.shadow.withOpacity(0.08), blurRadius: rs(10)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.circle, color: cs.primary, size: rs(12)),
                      SizedBox(width: rs(6)),
                      Text('Normal (<50%)', style: TextStyle(fontSize: rs(sw < 360 ? 8 : 10), color: cs.onSurface)),
                    ],
                  ),
                  SizedBox(height: rs(4)),
                  Row(
                    children: [
                      Icon(Icons.circle, color: cs.tertiary, size: rs(12)),
                      SizedBox(width: rs(6)),
                      Text('Advertencia (≥50%)', style: TextStyle(fontSize: rs(sw < 360 ? 8 : 10), color: cs.onSurface)),
                    ],
                  ),
                  SizedBox(height: rs(4)),
                  Row(
                    children: [
                      Icon(Icons.circle, color: cs.error, size: rs(12)),
                      SizedBox(width: rs(6)),
                      Text('Crítico (≥80%)', style: TextStyle(fontSize: rs(sw < 360 ? 8 : 10), color: cs.onSurface)),
                    ],
                  ),
                  SizedBox(height: rs(4)),
                  Row(
                    children: [
                      Icon(Icons.local_shipping, color: cs.secondary, size: rs(12)),
                      SizedBox(width: rs(6)),
                      Text('Camión Recolector', style: TextStyle(fontSize: rs(sw < 360 ? 8 : 10), color: cs.onSurface)),
                    ],
                  ),
                ],
              ),
            ),
          ),

          Positioned(
            bottom: rs(24),
            right: rs(16),
            child: Column(
              children: [
                _buildMapControlBtn(
                  icon: Icons.add,
                  onTap: () {
                    _mapController.move(_mapController.camera.center, _mapController.camera.zoom + 1);
                  },
                ),
                SizedBox(height: rs(8)),
                _buildMapControlBtn(
                  icon: Icons.remove,
                  onTap: () {
                    _mapController.move(_mapController.camera.center, _mapController.camera.zoom - 1);
                  },
                ),
                SizedBox(height: rs(8)),
                _buildMapControlBtn(
                  icon: _mapStyle == 'oscuro'
                      ? Icons.nights_stay
                      : (_mapStyle == 'clasico' ? Icons.map : Icons.satellite_outlined),
                  color: cs.primary,
                  onTap: () {
                    setState(() {
                      if (_mapStyle == 'oscuro') {
                        _mapStyle = 'clasico';
                      } else if (_mapStyle == 'clasico') {
                        _mapStyle = 'satelite';
                      } else {
                        _mapStyle = 'oscuro';
                      }
                    });
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapControlBtn({
    required IconData icon,
    required VoidCallback onTap,
    Color? color,
  }) {
    final cs = Theme.of(context).colorScheme;
    final sw = MediaQuery.of(context).size.width;
    final s = _rclamp(_rs(44, sw), 36, 52);
    return Container(
      width: s,
      height: s,
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor.withOpacity(0.9),
        shape: BoxShape.circle,
        border: Border.all(color: cs.outlineVariant),
        boxShadow: [
          BoxShadow(color: cs.shadow.withOpacity(0.08), blurRadius: _rclamp(_rs(5, sw), 3, 7)),
        ],
      ),
      child: IconButton(
        icon: Icon(icon, color: color ?? cs.onSurface, size: s * 0.45),
        onPressed: onTap,
      ),
    );
  }

  Widget _buildBottomSheetStat({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    final cs = Theme.of(context).colorScheme;
    final sw = MediaQuery.of(context).size.width;
    final rs = (double s) => _rclamp(_rs(s, sw), s * 0.75, s * 1.3);
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: color, size: rs(24)),
          SizedBox(height: rs(6)),
          Text(
            value,
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: rs(16), color: cs.onSurface),
          ),
          SizedBox(height: rs(2)),
          Text(
            label,
            style: TextStyle(color: cs.onSurfaceVariant, fontSize: rs(10)),
          ),
        ],
      ),
    );
  }
}
