import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/device_model.dart';
import '../providers/bin_provider.dart';
import '../services/debounce.dart';

import '../widgets/skeleton_loader.dart';
import '../widgets/status_indicator.dart';

class _RS {
  static double scale(double size, double screenWidth) {
    return size * (screenWidth / 390);
  }

  static double clamp(double size, double min, double max) {
    return size.clamp(min, max);
  }
}

class BinsScreen extends StatefulWidget {
  const BinsScreen({Key? key}) : super(key: key);

  @override
  State<BinsScreen> createState() => _BinsScreenState();
}

class _BinsScreenState extends State<BinsScreen> {
  String _filter = 'all';
  final _searchController = TextEditingController();
  final _debouncer = Debouncer(delay: const Duration(milliseconds: 250));
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    _debouncer.dispose();
    super.dispose();
  }

  Color _fillColor(double level) {
    if (level >= 80) return const Color(0xFFEF4444);
    if (level >= 50) return const Color(0xFFF59E0B);
    if (level >= 30) return const Color(0xFFEAB308);
    return const Color(0xFF10B981);
  }

  Widget _statusDot(String colorHex, String label) {
    final color = Color(int.parse(colorHex.replaceFirst('#', '0xFF')));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 5, height: 5, decoration: BoxDecoration(color: color, shape: BoxShape.circle, boxShadow: [BoxShadow(color: color.withOpacity(0.5), blurRadius: 3)])),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, letterSpacing: 0.3, color: color)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final binProvider = context.watch<BinProvider>();
    final cs = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sw = MediaQuery.of(context).size.width;
    final rs = (double s) => _RS.clamp(_RS.scale(s, sw), s * 0.8, s * 1.3);

    final imgSize = rs(80);
    final cardHPad = rs(14);
    final cardVPad = rs(14);
    final fName = rs(14);
    final fValue = rs(20);

    var binsToDisplay = binProvider.bins;
    if (_filter == 'critical') {
      binsToDisplay = binProvider.criticalBins;
    } else if (_filter == 'warning') {
      binsToDisplay = binProvider.warningBins;
    } else if (_filter == 'normal') {
      binsToDisplay = binProvider.normalBins;
    }

    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      binsToDisplay = binsToDisplay.where((b) => b.name.toLowerCase().contains(q)).toList();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('CONTENEDORES'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => binProvider.fetchData(forceLoading: true),
          ),
        ],
      ),
      body: binProvider.isLoading && binProvider.bins.isEmpty
          ? ListView.builder(
              padding: EdgeInsets.all(rs(16)),
              itemCount: 6,
              itemBuilder: (_, __) => Padding(
                padding: EdgeInsets.only(bottom: rs(12)),
                child: SkeletonCard(),
              ),
            )
          : Column(
              children: [
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: rs(16), vertical: rs(8)),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) {
                      _debouncer.call(() {
                        if (mounted) setState(() => _searchQuery = val);
                      });
                    },
                    decoration: InputDecoration(
                      hintText: 'Buscar contenedor...',
                      prefixIcon: Icon(Icons.search, color: cs.onSurfaceVariant),
                      contentPadding: EdgeInsets.symmetric(vertical: rs(12)),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _searchController.clear();
                                setState(() {
                                  _searchQuery = '';
                                });
                              },
                            )
                          : null,
                    ),
                  ),
                ),

                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: EdgeInsets.symmetric(horizontal: rs(16), vertical: rs(8)),
                  child: Row(
                    children: [
                      FilterChip(
                        label: Text('Todos', style: TextStyle(fontSize: rs(13))),
                        selected: _filter == 'all',
                        onSelected: (_) => setState(() => _filter = 'all'),
                        selectedColor: cs.primary.withValues(alpha: 0.25),
                        checkmarkColor: cs.primary,
                      ),
                      SizedBox(width: rs(8)),
                      FilterChip(
                        label: Text('Críticos (≥80%)', style: TextStyle(fontSize: rs(13))),
                        selected: _filter == 'critical',
                        onSelected: (_) => setState(() => _filter = 'critical'),
                        selectedColor: cs.error.withValues(alpha: 0.25),
                        checkmarkColor: cs.error,
                      ),
                      SizedBox(width: rs(8)),
                      FilterChip(
                        label: Text('Advertencia (≥50%)', style: TextStyle(fontSize: rs(13))),
                        selected: _filter == 'warning',
                        onSelected: (_) => setState(() => _filter = 'warning'),
                        selectedColor: cs.tertiary.withValues(alpha: 0.25),
                        checkmarkColor: cs.tertiary,
                      ),
                      SizedBox(width: rs(8)),
                      FilterChip(
                        label: Text('Normal', style: TextStyle(fontSize: rs(13))),
                        selected: _filter == 'normal',
                        onSelected: (_) => setState(() => _filter = 'normal'),
                        selectedColor: cs.secondary.withValues(alpha: 0.25),
                        checkmarkColor: cs.secondary,
                      ),
                    ],
                  ),
                ),

                Expanded(
                  child: binsToDisplay.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.inventory_2_outlined, size: rs(56), color: cs.onSurfaceVariant.withValues(alpha: 0.4)),
                              SizedBox(height: rs(12)),
                              Text(
                                _searchQuery.isNotEmpty ? 'Sin resultados de búsqueda' : 'No hay contenedores registrados',
                                style: TextStyle(color: cs.onSurfaceVariant, fontSize: rs(14)),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: EdgeInsets.all(rs(16)),
                          itemCount: binsToDisplay.length,
                          separatorBuilder: (_, __) => SizedBox(height: rs(12)),
                          itemBuilder: (context, index) {
                            final bin = binsToDisplay[index];

                            final boundDevice = binProvider.devices.firstWhere(
                              (d) => d.mapPointId == bin.id,
                              orElse: () => DeviceModel(
                                id: -1, deviceId: '', name: '', type: '', status: '',
                                latitude: 0, longitude: 0, batteryLevel: 0, signalStrength: 0,
                              ),
                            );

                            final fillColor = _fillColor(bin.fillLevel);
                            final isCritical = bin.fillLevel >= 80;

                            return Container(
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF1E293B).withOpacity(0.75) : Colors.white.withOpacity(0.85),
                                borderRadius: BorderRadius.circular(rs(16)),
                                border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                                boxShadow: [
                                  BoxShadow(
                                    color: isDark ? Colors.black.withOpacity(0.2) : Colors.black.withOpacity(0.03),
                                    blurRadius: rs(12),
                                    offset: Offset(0, rs(4)),
                                  ),
                                ],
                              ),
                              child: Padding(
                                padding: EdgeInsets.fromLTRB(cardHPad, cardVPad, cardHPad, cardVPad),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  bin.name,
                                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: fName, color: cs.onSurface),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                              SizedBox(width: rs(8)),
                                              StatusIndicator(status: bin.status),
                                            ],
                                          ),
                                          SizedBox(height: rs(4)),
                                          Row(
                                            children: [
                                              Icon(Icons.location_on_outlined, size: rs(11), color: cs.onSurfaceVariant.withOpacity(0.6)),
                                              SizedBox(width: rs(3)),
                                              Flexible(
                                                child: Text(
                                                  '${bin.latitude.toStringAsFixed(4)}, ${bin.longitude.toStringAsFixed(4)}',
                                                  style: TextStyle(fontSize: rs(9.5), color: cs.onSurfaceVariant.withOpacity(0.6)),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                            ],
                                          ),
                                          SizedBox(height: rs(10)),
                                          Row(
                                            children: [
                                              Text(
                                                '${bin.fillLevel.toStringAsFixed(0)}%',
                                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: fValue, fontFamily: 'monospace', color: fillColor),
                                              ),
                                              SizedBox(width: rs(6)),
                                              Text('Llenado', style: TextStyle(fontSize: rs(9), fontWeight: FontWeight.w700, letterSpacing: 0.3, color: cs.onSurfaceVariant.withOpacity(0.5))),
                                              const Spacer(),
                                              if (isCritical)
                                                _statusDot('#EF4444', 'CRÍTICO'),
                                            ],
                                          ),
                                          SizedBox(height: rs(6)),
                                          Container(
                                            height: rs(6),
                                            decoration: BoxDecoration(
                                              color: isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
                                              borderRadius: BorderRadius.circular(rs(4)),
                                            ),
                                            child: FractionallySizedBox(
                                              alignment: Alignment.centerLeft,
                                              widthFactor: (bin.fillLevel / 100.0).clamp(0.0, 1.0),
                                              child: Container(
                                                decoration: BoxDecoration(
                                                  borderRadius: BorderRadius.circular(rs(4)),
                                                  gradient: LinearGradient(colors: [fillColor.withOpacity(0.8), fillColor]),
                                                ),
                                              ),
                                            ),
                                          ),
                                          SizedBox(height: rs(12)),
                                          Container(
                                            padding: EdgeInsets.only(top: rs(12)),
                                            decoration: BoxDecoration(
                                              border: Border(top: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0), width: 0.5)),
                                            ),
                                            child: Row(
                                              children: [
                                                _paramColumn('Temperatura', '${bin.temperature.toStringAsFixed(1)}°C', Icons.thermostat_outlined, const Color(0xFFFB923C), cs, rs),
                                                SizedBox(width: rs(14)),
                                                _paramColumn('Batería', boundDevice.id != -1 ? '${boundDevice.batteryLevel}%' : '--', Icons.battery_charging_full,
                                                    boundDevice.id != -1 && boundDevice.batteryLevel < 20 ? const Color(0xFFEF4444) : const Color(0xFF10B981), cs, rs),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    SizedBox(width: rs(10)),
                                    SizedBox(
                                      width: imgSize,
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(rs(8)),
                                            child: Image.asset(
                                              'assets/contenedor.png',
                                              height: imgSize,
                                              width: imgSize,
                                              fit: BoxFit.contain,
                                              errorBuilder: (_, __, ___) => Icon(Icons.delete_outline, size: imgSize * 0.6, color: cs.onSurfaceVariant.withOpacity(0.3)),
                                            ),
                                          ),
                                          SizedBox(height: rs(3)),
                                          Text(
                                            boundDevice.id != -1 ? boundDevice.deviceId : '',
                                            style: TextStyle(fontSize: rs(7.5), fontWeight: FontWeight.w600, color: cs.onSurfaceVariant.withOpacity(0.4)),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }

  Widget _paramColumn(String label, String value, IconData icon, Color iconColor, ColorScheme cs, double Function(double) rs) {
    return Expanded(
      child: Row(
        children: [
          Icon(icon, size: rs(13), color: iconColor),
          SizedBox(width: rs(5)),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(fontSize: rs(8.5), fontWeight: FontWeight.w700, letterSpacing: 0.3, color: cs.onSurfaceVariant.withOpacity(0.5))),
              Text(value, style: TextStyle(fontSize: rs(11), fontWeight: FontWeight.w700, fontFamily: 'monospace', color: cs.onSurface)),
            ],
          ),
        ],
      ),
    );
  }
}
