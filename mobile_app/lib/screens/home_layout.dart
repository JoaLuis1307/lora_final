import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/bin_provider.dart';
import '../providers/fleet_provider.dart';
import 'overview_screen.dart';
import 'bins_screen.dart';
import 'fleet_screen.dart';
import 'routes_screen.dart';
import 'settings_screen.dart';

class HomeLayout extends StatefulWidget {
  const HomeLayout({Key? key}) : super(key: key);

  @override
  State<HomeLayout> createState() => _HomeLayoutState();
}

class _HomeLayoutState extends State<HomeLayout> with WidgetsBindingObserver {
  int _currentIndex = 0;
  bool _appInForeground = true;

  final List<Widget> _screens = const [
    OverviewScreen(),
    BinsScreen(),
    FleetScreen(),
    RoutesScreen(),
    SettingsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startPolling();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stopPolling();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _appInForeground = true;
      _startPolling();
    } else if (state == AppLifecycleState.paused) {
      _appInForeground = false;
      _stopPolling();
    }
  }

  void _startPolling() {
    if (!_appInForeground) return;
    Provider.of<BinProvider>(context, listen: false).startPolling();
    Provider.of<FleetProvider>(context, listen: false).startPolling();
  }

  void _stopPolling() {
    Provider.of<BinProvider>(context, listen: false).stopPolling();
    Provider.of<FleetProvider>(context, listen: false).stopPolling();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Overview',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.delete_outline_rounded),
            activeIcon: Icon(Icons.delete_rounded),
            label: 'Tachos',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.map_outlined),
            activeIcon: Icon(Icons.map),
            label: 'Mapa',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.alt_route_outlined),
            activeIcon: Icon(Icons.alt_route_sharp),
            label: 'Rutas',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings_outlined),
            activeIcon: Icon(Icons.settings),
            label: 'Ajustes',
          ),
        ],
      ),
    );
  }
}
