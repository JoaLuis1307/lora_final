import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/bin_provider.dart';
import '../providers/fleet_provider.dart';
import '../widgets/custom_card.dart';
import '../widgets/skeleton_loader.dart';

class OverviewScreen extends StatelessWidget {
  const OverviewScreen({Key? key}) : super(key: key);

  Widget _buildStatCard({
    required ColorScheme cs,
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return CustomCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  value,
                  textAlign: TextAlign.end,
                  style: TextStyle(
                    color: cs.onSurface,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Expanded(
            child: Align(
              alignment: Alignment.bottomLeft,
              child: Text(
                title,
                style: TextStyle(
                  color: cs.onSurfaceVariant,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.1,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    final totalBins = context.select<BinProvider, int>((p) => p.bins.length);
    final criticalCount = context.select<BinProvider, int>((p) => p.criticalBins.length);
    final isLoading = context.select<BinProvider, bool>((p) => p.isLoading && p.bins.isEmpty);
    final criticalBins = context.select<BinProvider, List>((p) => p.criticalBins);
    final activeTrucks = context.select<FleetProvider, int>((p) => p.vehicles.where((v) => v.status == 'In Route').length);
    final totalGateways = context.select<BinProvider, int>((p) => p.devices.where((d) => d.type.toLowerCase() == 'gateway').length);

    final double screenWidth = MediaQuery.of(context).size.width;
    final double crossAxisSpacing = 12.0;
    final double horizontalPadding = 16.0 * 2;
    final double itemWidth = (screenWidth - horizontalPadding - crossAxisSpacing) / 2;
    final double desiredHeight = 96.0;
    final double dynamicAspectRatio = itemWidth / desiredHeight;

    return Scaffold(
      appBar: AppBar(
        title: const Text('OVERVIEW'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              context.read<BinProvider>().fetchData(forceLoading: true);
              context.read<FleetProvider>().fetchData(forceLoading: true);
            },
          ),
        ],
      ),
      body: isLoading
          ? const OverviewSkeleton()
          : RefreshIndicator(
              color: cs.primary,
              onRefresh: () async {
                await context.read<BinProvider>().fetchData();
                await context.read<FleetProvider>().fetchData();
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: cs.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'SISTEMA DE MONITOREO EN TIEMPO REAL',
                            style: TextStyle(
                              color: cs.onSurfaceVariant,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.2,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: dynamicAspectRatio > 0 ? dynamicAspectRatio : 1.3,
                      children: [
                        _buildStatCard(
                          cs: cs,
                          title: 'TOTAL TACHOS',
                          value: totalBins.toString(),
                          icon: Icons.delete_rounded,
                          color: cs.secondary,
                        ),
                        _buildStatCard(
                          cs: cs,
                          title: 'ALERTAS CRÍTICAS',
                          value: criticalCount.toString(),
                          icon: Icons.warning_amber_rounded,
                          color: cs.error,
                        ),
                        _buildStatCard(
                          cs: cs,
                          title: 'CAMIONES EN RUTA',
                          value: activeTrucks.toString(),
                          icon: Icons.local_shipping_rounded,
                          color: cs.primary,
                        ),
                        _buildStatCard(
                          cs: cs,
                          title: 'GATEWAYS LORA',
                          value: totalGateways.toString(),
                          icon: Icons.router_rounded,
                          color: cs.tertiary,
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    Text(
                      'ALERTAS RECIENTES (LLENADO ≥ 80%)',
                      style: TextStyle(
                        color: cs.onSurfaceVariant,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 12),

                    if (criticalBins.isEmpty)
                      CustomCard(
                        padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(Icons.check_circle_outline, color: cs.primary.withValues(alpha: 0.5), size: 40),
                              const SizedBox(height: 12),
                              Text(
                                'Todos los contenedores están bajo control',
                                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: criticalBins.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final bin = criticalBins[index] as dynamic;
                          return CustomCard(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: cs.error.withValues(alpha: 0.12),
                                    shape: BoxShape.circle,
                                  ),
                                  child: Icon(Icons.delete_outline_rounded, color: cs.error, size: 22),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        bin.name,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Temp: ${bin.temperature.toStringAsFixed(1)}°C | ${bin.description ?? "Sin descripción"}',
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
                                      '${bin.fillLevel.toStringAsFixed(0)}%',
                                      style: TextStyle(
                                        color: cs.error,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                      ),
                                    ),
                                    Text(
                                      'Capacidad',
                                      style: TextStyle(color: cs.onSurfaceVariant, fontSize: 9),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
    );
  }
}
