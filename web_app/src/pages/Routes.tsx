import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Plus, Search, Map as MapIcon, Route as RouteIcon, Trash2, Save,
  ChevronRight, Navigation, Clock, MapPin, X, Palette, Truck, Layers,
  Sparkles, Fuel, ArrowRight, Activity
} from 'lucide-react';
import {
  Box, Paper, Typography, IconButton, Button, TextField, InputBase, Chip, Divider,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, alpha
} from '@mui/material';
import RouteMap from '../components/dashboard/RouteMap/RouteMap';
import { routeService, RouteData } from '../services/routeService';
import { deviceService, Device } from '../services/deviceService';
import { mapService, MapPoint } from '../services/mapService';
import { calculateFillPercentage } from '../utils/fillCalculator';

const DEPOT: [number, number] = [-71.5375, -16.4090]; // Yanahuara municipal depot center

const googleCardSx = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
  border: 'none',
  boxShadow: 'none',
  borderRadius: '16px',
});

const RoutesPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  // Core routing state
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [newRouteData, setNewRouteData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const mapRef = useRef<any>(null);
  
  // Save form states
  const [routeName, setRouteName] = useState('');
  const [routeDistrict, setRouteDistrict] = useState('');
  const [routeColor, setRouteColor] = useState('#3b82f6');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation & theme states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeLayer, setActiveLayer] = useState<'dark' | 'bright' | 'liberty' | 'satellite' | 'hybrid'>(() => {
    const savedTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
    return (savedTheme === 'light' ? 'bright' : 'dark') as any;
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const layerMenuRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');

  // AI EcoRoute specific states
  const [isAiMode, setIsAiMode] = useState(false);
  const [truckType, setTruckType] = useState<'heavy' | 'light'>('heavy');
  const [aiOptimized, setAiOptimized] = useState(false);
  const [optimizedBinsList, setOptimizedBinsList] = useState<any[]>([]);
  
  // Live IoT data
  const [dbPoints, setDbPoints] = useState<MapPoint[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});
  const [loadingIoT, setLoadingIoT] = useState(false);

  // Close layer menu click listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target as Node)) {
        setShowLayerMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colors = [
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Esmeralda', value: '#10b981' },
    { name: 'Violeta', value: '#8b5cf6' },
    { name: 'Naranja', value: '#f59e0b' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Cian', value: '#06b6d4' },
  ];

  // Sync theme
  useEffect(() => {
    loadRoutes();
    loadIoTData();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme');
          if (activeLayer === 'bright' || activeLayer === 'dark') {
            setActiveLayer(newTheme === 'light' ? 'bright' : 'dark');
          }
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [activeLayer]);

  const loadRoutes = async () => {
    try {
      const data = await routeService.getRoutes();
      setRoutes(data);
    } catch (err) {
      console.error('Error loading routes:', err);
    }
  };

  const loadIoTData = async () => {
    setLoadingIoT(true);
    try {
      const [pts, devs, tel] = await Promise.all([
        mapService.getPoints(),
        deviceService.getDevices(),
        deviceService.getLatestTelemetry()
      ]);
      setDbPoints(pts);
      setDevices(devs);
      setTelemetry(tel);
    } catch (err) {
      console.error('Error loading IoT data for routes:', err);
    } finally {
      setLoadingIoT(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!newRouteData || !routeName) return;
    setIsSaving(true);
    try {
      await routeService.saveRoute({
        name: routeName,
        district: routeDistrict || 'General',
        points: newRouteData.points,
        distance: newRouteData.distance,
        duration: newRouteData.duration,
        color: routeColor
      });
      setRouteName('');
      setRouteDistrict('');
      setRouteColor('#3b82f6');
      setNewRouteData(null);
      setAiOptimized(false);
      setOptimizedBinsList([]);
      loadRoutes();
    } catch (err: any) {
      console.error('Error saving route:', err);
      alert(`Error al guardar la ruta: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoute = async (id: number) => {
    if (!window.confirm('¿Eliminar esta ruta?')) return;
    try {
      await routeService.deleteRoute(id);
      loadRoutes();
      if (activeRoute?.id === id) setActiveRoute(null);
    } catch (err) {
      console.error('Error deleting route:', err);
    }
  };

  // Euclidean Distance
  const getEuclideanDistance = (p1: [number, number], p2: [number, number]) => {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
  };

  // Run AI Route Optimization (TSP Solver)
  const handleAiOptimize = () => {
    const bins = dbPoints.filter(p => p.type === 'bin');
    
    // Filter bins that are nearly full (>= 70%)
    let criticalList = bins.map(bin => {
      const associated = devices.find(d => d.map_point_id === bin.id && d.registered);
      let fill = 50; // fallback
      if (associated) {
        const dt = telemetry[associated.device_id] || {};
        const dist = dt.tof_cm ?? dt.ultrasonic_cm;
        if (dist !== undefined) fill = calculateFillPercentage(dist);
      }
      return {
        id: bin.id!,
        name: bin.name,
        coords: [bin.longitude, bin.latitude] as [number, number],
        fill
      };
    }).filter(b => b.fill >= 70);

    // Fallback: If no bins >= 70%, pick top 3 highest filled bins for demo
    if (criticalList.length === 0) {
      const sorted = bins.map(bin => {
        const associated = devices.find(d => d.map_point_id === bin.id && d.registered);
        let fill = 45;
        if (associated) {
          const dt = telemetry[associated.device_id] || {};
          const dist = dt.tof_cm ?? dt.ultrasonic_cm;
          if (dist !== undefined) fill = calculateFillPercentage(dist);
        }
        return {
          id: bin.id!,
          name: bin.name,
          coords: [bin.longitude, bin.latitude] as [number, number],
          fill
        };
      }).sort((a, b) => b.fill - a.fill).slice(0, 3);
      criticalList = sorted;
    }

    if (criticalList.length === 0) {
      alert("No hay contenedores registrados en la base de datos.");
      return;
    }

    // Solve TSP (Nearest Neighbor)
    const unvisited = [...criticalList];
    const path: typeof criticalList = [];
    let currentCoords = DEPOT;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minD = getEuclideanDistance(currentCoords, unvisited[0].coords);
      for (let i = 1; i < unvisited.length; i++) {
        const d = getEuclideanDistance(currentCoords, unvisited[i].coords);
        if (d < minD) {
          minD = d;
          nearestIdx = i;
        }
      }
      const nextBin = unvisited.splice(nearestIdx, 1)[0];
      path.push(nextBin);
      currentCoords = nextBin.coords;
    }

    setOptimizedBinsList(path);

    // Form sequence: DEPOT -> sequence of critical bins -> DEPOT
    const finalPoints: [number, number][] = [
      DEPOT,
      ...path.map(b => b.coords),
      DEPOT
    ];

    if (mapRef.current) {
      mapRef.current.setPoints(finalPoints);
      setRouteName(`Ruta Optimizada IA - ${new Date().toLocaleDateString()}`);
      setRouteDistrict(path[0]?.name.split(' ')[0] || 'Arequipa');
      setAiOptimized(true);
    }
  };

  // Compute fuel and carbon offsets
  const fuelMetrics = useMemo(() => {
    if (!newRouteData) return { consumption: 0, savings: 0, co2Saved: 0 };
    const distance = parseFloat(newRouteData.distance.toString()) || 0;
    const efficiency = truckType === 'heavy' ? 12 : 18; // km per gallon
    const consumption = parseFloat((distance / efficiency).toFixed(2));
    
    // Non-optimized route visits all spots blindly: estimate 2.4x the distance
    const nonOptDistance = distance * 2.4;
    const nonOptConsumption = nonOptDistance / efficiency;
    const savings = parseFloat(Math.max(0.1, nonOptConsumption - consumption).toFixed(2));
    
    // EPA Diesel factor: ~10.15 kg CO2 per gallon of diesel consumed
    const co2Saved = parseFloat((savings * 10.15).toFixed(1));

    return { consumption, savings, co2Saved };
  }, [newRouteData, truckType]);

  const filteredRoutes = routes.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.district.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStopFillColor = (fill: number) => {
    if (fill >= 90) return '#f28b82'; // critical red
    if (fill >= 70) return '#fdd663'; // warning amber
    return '#81c995'; // optimal green
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', overflow: 'hidden', bgcolor: 'background.default' }}>
      
      {/* Map Side */}
      <Box sx={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1 }}>
          <RouteMap
            ref={mapRef}
            onRouteCreated={setNewRouteData}
            activeRoute={activeRoute}
            selectedColor={routeColor}
            drawingMode={isDrawingMode && !isAiMode}
            onDrawingModeChange={setIsDrawingMode}
            mapStyle={activeLayer}
            pitch={viewMode === '3D' ? 45 : 0}
          />
        </Box>

        {/* Floating Route Info Header */}
        {activeRoute && (
          <Paper sx={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 2.5, px: 2.5, py: 1, borderRadius: '24px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1, bgcolor: 'primary.main' + '14', borderRadius: '50%', color: 'primary.main', display: 'flex' }}>
                <Navigation size={16} strokeWidth={2.5} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em', mb: 0.1, display: 'block' }}>
                  {activeRoute.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{activeRoute.district}</Typography>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.secondary', opacity: 0.4 }} />
                  <Typography variant="caption" color="success.main" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>Activa</Typography>
                </Box>
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 8, mb: 0.1, display: 'block' }}>Distancia</Typography>
                <Typography variant="caption" sx={{ fontWeight: 900 }}>{activeRoute.distance} <Typography component="span" variant="caption" sx={{ opacity: 0.5, fontSize: 9 }}>km</Typography></Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 8, mb: 0.1, display: 'block' }}>Tiempo</Typography>
                <Typography variant="caption" sx={{ fontWeight: 900 }}>{activeRoute.duration} <Typography component="span" variant="caption" sx={{ opacity: 0.5, fontSize: 9 }}>min</Typography></Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setActiveRoute(null)} sx={{ ml: 1, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
              <X size={14} />
            </IconButton>
          </Paper>
        )}

        {/* Overlay Toolbar - Bottom Center */}
        <Box sx={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 1.5, pointerEvents: 'none' }}>
          <Paper sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, borderRadius: '24px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', pointerEvents: 'auto' }}>
            <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              sx={{ width: 40, height: 40, bgcolor: isSidebarOpen ? 'rgba(26,115,232,0.08)' : 'transparent', color: isSidebarOpen ? 'primary.main' : 'text.secondary', borderRadius: '50%', '&:hover': { bgcolor: 'action.hover' } }}>
              <RouteIcon size={18} strokeWidth={2.5} />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            <Button onClick={() => setViewMode(viewMode === '2D' ? '3D' : '2D')} sx={{ minWidth: 48, height: 40, borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              <Typography variant="caption" sx={{ fontWeight: 900, lineHeight: 1, fontSize: 11 }}>{viewMode === '2D' ? '3D' : '2D'}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 7, opacity: 0.4, textTransform: 'uppercase' }}>Vista</Typography>
            </Button>
          </Paper>

          {!isAiMode && (
            <Paper sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, borderRadius: '24px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', pointerEvents: 'auto' }}>
              <IconButton onClick={() => setIsDrawingMode(!isDrawingMode)}
                sx={{ width: 40, height: 40, bgcolor: isDrawingMode ? 'primary.main' : 'transparent', color: isDrawingMode ? 'white' : 'text.secondary', borderRadius: '50%', '&:hover': { bgcolor: isDrawingMode ? 'primary.main' : 'action.hover' } }}>
                <Plus size={18} strokeWidth={2.5} />
              </IconButton>
            </Paper>
          )}

          <Box sx={{ position: 'relative', pointerEvents: 'auto' }} ref={layerMenuRef}>
            {showLayerMenu && (
              <Paper sx={{ position: 'absolute', bottom: '100%', left: 0, mb: 1.5, width: 180, borderRadius: '16px', border: 'none', overflow: 'hidden', p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                {[
                  { id: 'dark', label: 'Modo Noche' },
                  { id: 'satellite', label: 'Satélite Puro' },
                  { id: 'hybrid', label: 'Híbrido 3D' },
                  { id: 'bright', label: 'Modo Claro' },
                  { id: 'liberty', label: 'Terreno' }
                ].map((l) => (
                  <Button key={l.id} onClick={() => { setActiveLayer(l.id as any); setShowLayerMenu(false); }}
                    variant={activeLayer === l.id ? 'contained' : 'text'}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none', fontSize: 11, fontWeight: 700, px: 2, py: 0.75, borderRadius: '8px' }}>
                    {l.label}
                  </Button>
                ))}
              </Paper>
            )}
            <Paper sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, borderRadius: '24px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', pointerEvents: 'auto' }}>
              <IconButton onClick={() => setShowLayerMenu(!showLayerMenu)}
                sx={{ width: 40, height: 40, color: 'text.secondary', borderRadius: '50%', '&:hover': { color: 'primary.main' } }}>
                <Layers size={18} strokeWidth={2.5} />
              </IconButton>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
              <IconButton onClick={() => { mapRef.current?.clearRoute(); setAiOptimized(false); setOptimizedBinsList([]); }} sx={{ width: 40, height: 40, color: 'text.secondary', borderRadius: '50%', '&:hover': { color: 'error.main' } }}>
                <Trash2 size={18} strokeWidth={2.5} />
              </IconButton>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Sidebar Panel */}
      <Box sx={{
        display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', zIndex: 10,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden',
        width: isSidebarOpen ? 340 : 0, opacity: isSidebarOpen ? 1 : 0,
        minWidth: isSidebarOpen ? 340 : 0,
        borderLeft: '1px solid',
        borderColor: 'divider'
      }}>
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 340 }}>
          
          {/* Sidebar Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3.5 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.25 }}>Rutas</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gestión Logística</Typography>
            </Box>
            <IconButton onClick={() => setIsSidebarOpen(false)} size="small" sx={{ bgcolor: 'action.hover', color: 'text.secondary', borderRadius: '50%', '&:hover': { color: 'primary.main' } }}>
              <X size={16} />
            </IconButton>
          </Box>

          {/* AI Optimizer Mode Switcher */}
          <Box sx={{ display: 'flex', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', p: 0.5, borderRadius: '12px', mb: 3.5 }}>
            <Button
              fullWidth
              onClick={() => { setIsAiMode(false); mapRef.current?.clearRoute(); setAiOptimized(false); setOptimizedBinsList([]); }}
              variant={!isAiMode ? 'contained' : 'text'}
              sx={{
                py: 0.8,
                fontSize: 11,
                fontWeight: 800,
                borderRadius: '8px',
                textTransform: 'none',
                bgcolor: !isAiMode ? 'background.paper' : 'transparent',
                color: !isAiMode ? 'text.primary' : 'text.secondary',
                boxShadow: !isAiMode ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                '&:hover': { bgcolor: !isAiMode ? 'background.paper' : 'action.hover' }
              }}
            >
              Manual
            </Button>
            <Button
              fullWidth
              onClick={() => { setIsAiMode(true); mapRef.current?.clearRoute(); }}
              variant={isAiMode ? 'contained' : 'text'}
              sx={{
                py: 0.8,
                fontSize: 11,
                fontWeight: 800,
                borderRadius: '8px',
                textTransform: 'none',
                bgcolor: isAiMode ? 'background.paper' : 'transparent',
                color: isAiMode ? 'primary.main' : 'text.secondary',
                boxShadow: isAiMode ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                '&:hover': { bgcolor: isAiMode ? 'background.paper' : 'action.hover' },
                display: 'flex', gap: 0.75, alignItems: 'center'
              }}
            >
              <Sparkles size={13} /> IA EcoRoute
            </Button>
          </Box>

          {!isAiMode ? (
            /* MANUAL ROUTING VIEW */
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 3 }}>
                <Paper sx={{ ...googleCardSx(theme), p: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5, display: 'block', fontSize: 8 }}>Cobertura</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                    {routes.reduce((acc, r) => acc + (parseFloat(r.distance.toString()) || 0), 0).toFixed(1)}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 700, ml: 0.25 }}>km</Typography>
                  </Typography>
                </Paper>
                <Paper sx={{ ...googleCardSx(theme), p: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.5, display: 'block', fontSize: 8 }}>Eficiencia</Typography>
                  <Typography variant="h6" color="success.main" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                    94<Typography component="span" variant="caption" color="success.main" sx={{ fontWeight: 700, ml: 0.25 }}>%</Typography>
                  </Typography>
                </Paper>
              </Box>

              <Paper sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.5, borderRadius: '24px', mb: 2.5, border: 'none', bgcolor: 'action.hover' }}>
                <Search size={14} style={{ opacity: 0.5 }} />
                <InputBase sx={{ ml: 1, flex: 1, fontSize: 12.5, fontWeight: 700 }} placeholder="Buscar ruta..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </Paper>

              {newRouteData && !activeRoute && (
                <Paper sx={{ p: 2.5, borderRadius: '16px', mb: 3.5, border: 'none', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(26,115,232,0.03)' : 'rgba(26,115,232,0.015)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton size="small" sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
                        <Navigation size={13} />
                      </IconButton>
                      <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Nueva Ruta</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setNewRouteData(null)} sx={{ color: 'text.secondary' }}>
                      <X size={15} />
                    </IconButton>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField label="Nombre de Ruta" placeholder="Ej: Ruta Principal Cayma" size="small" fullWidth value={routeName} onChange={(e) => setRouteName(e.target.value)} />
                    <TextField label="Distrito Operativo" placeholder="Ej: Cayma" size="small" fullWidth value={routeDistrict} onChange={(e) => setRouteDistrict(e.target.value)} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 9.5 }}>
                        Color Identificador
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
                        {colors.map(c => (
                          <IconButton key={c.value} onClick={() => setRouteColor(c.value)}
                            sx={{
                              width: 32, height: 32, bgcolor: c.value,
                              transform: routeColor === c.value ? 'scale(1.1)' : 'scale(1)',
                              opacity: routeColor === c.value ? 1 : 0.6,
                              '&:hover': { opacity: 1, transform: 'scale(1.05)' },
                              transition: 'all 0.2s', borderRadius: '50%'
                            }}>
                            {routeColor === c.value && <Plus size={12} strokeWidth={4} color="white" />}
                          </IconButton>
                        ))}
                      </Box>
                    </Box>
                    <Paper sx={{ p: 1.5, borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', bgcolor: 'background.paper' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 8 }}>Distancia</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>{newRouteData.distance} km</Typography>
                      </Box>
                      <Divider orientation="vertical" flexItem />
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 8 }}>Tiempo</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 900 }}>{newRouteData.duration} min</Typography>
                      </Box>
                    </Paper>
                    <Button variant="contained" onClick={handleSaveRoute} disabled={isSaving || !routeName}
                      sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 700, py: 1.2, borderRadius: '24px', boxShadow: 'none' }}>
                      {isSaving ? 'Guardando...' : 'Guardar Ruta'}
                    </Button>
                  </Box>
                </Paper>
              )}

              <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                {Object.entries(
                  filteredRoutes.reduce((acc, route) => {
                    const district = route.district || 'General';
                    if (!acc[district]) acc[district] = [];
                    acc[district].push(route);
                    return acc;
                  }, {} as Record<string, RouteData[]>)
                ).map(([district, districtRoutes]) => (
                  <Box key={district} sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 0.5 }}>
                      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.secondary', opacity: 0.4 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 9 }}>{district}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {districtRoutes.map((route) => (
                        <Box key={route.id} onClick={() => setActiveRoute(route)}
                          sx={{
                            py: 1.2, px: 1.5, borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            bgcolor: activeRoute?.id === route.id ? 'action.selected' : 'transparent',
                            color: activeRoute?.id === route.id ? 'primary.main' : 'text.primary',
                            '&:hover': { bgcolor: 'action.hover' }, transition: 'all 0.15s'
                          }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 4, height: 16, borderRadius: 2, bgcolor: route.color || '#3b82f6' }} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 12.5 }}>{route.name}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, opacity: 0.7 }}>
                                {route.distance} km
                              </Typography>
                            </Box>
                          </Box>
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteRoute(route.id!); }}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'error.main' + '14' } }}>
                            <Trash2 size={12} />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          ) : (
            /* AI ECOROUTE OPTIMIZER VIEW */
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5, fontWeight: 500, lineHeight: 1.4 }}>
                Optimiza la logística del camión seleccionando únicamente contenedores con niveles críticos (≥ 70%) para reducir costos.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 3 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Vehículo Asignado</InputLabel>
                  <Select
                    value={truckType}
                    label="Vehículo Asignado"
                    onChange={(e) => setTruckType(e.target.value as any)}
                  >
                    <MenuItem value="heavy">Compactador Pesado (12 km/gal)</MenuItem>
                    <MenuItem value="light">Urbano Ligero (18 km/gal)</MenuItem>
                  </Select>
                </FormControl>

                <Button
                  onClick={handleAiOptimize}
                  variant="contained"
                  fullWidth
                  startIcon={loadingIoT ? <CircularProgress size={12} color="inherit" /> : <Sparkles size={15} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '24px',
                    py: 1.2,
                    bgcolor: '#1a73e8',
                    color: '#ffffff',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#1557b0', boxShadow: 'none' }
                  }}
                >
                  Calcular Ruta Inteligente IA
                </Button>
              </Box>

              <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* AI SAVINGS & METRICS CARD */}
                {aiOptimized && newRouteData && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    
                    {/* Glassmorphic CO2 savings badge */}
                    <Paper 
                      sx={{ 
                        p: 2, 
                        borderRadius: '16px', 
                        border: 'none', 
                        bgcolor: 'rgba(52,168,83,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5
                      }}
                    >
                      <Box sx={{ p: 1, borderRadius: '50%', bgcolor: 'rgba(52,168,83,0.1)', color: '#34a853', display: 'flex' }}>
                        <Fuel size={16} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#34a853' }}>
                          Ahorro Ecológico IA
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          Evitados: <strong style={{ color: '#34a853' }}>{fuelMetrics.co2Saved} kg de CO₂</strong> (-{fuelMetrics.savings} gal)
                        </Typography>
                      </Box>
                    </Paper>

                    {/* Standard OSRM calculated route stats */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <Paper sx={{ ...googleCardSx(theme), p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 0.5, display: 'block', fontSize: 8 }}>Recorrido</Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {newRouteData.distance} km
                        </Typography>
                      </Paper>
                      <Paper sx={{ ...googleCardSx(theme), p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 0.5, display: 'block', fontSize: 8 }}>Combustible</Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {fuelMetrics.consumption} gal
                        </Typography>
                      </Paper>
                    </Box>

                    {/* Pickup stops list */}
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', mb: 1.5, fontSize: 9.5 }}>
                        Secuencia TSP Optimizada ({optimizedBinsList.length} Paradas)
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: '8px', bgcolor: 'action.hover' }}>
                          <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: 9, fontWeight: 900 }}>D</Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Depósito Municipal (Inicio)</Typography>
                        </Box>
                        {optimizedBinsList.map((stop, i) => (
                          <Box key={stop.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderRadius: '8px', bgcolor: 'action.hover' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: 9, fontWeight: 900 }}>{i + 1}</Box>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.name}</Typography>
                            </Box>
                            <Chip label={`${stop.fill}%`} size="small" sx={{ height: 18, fontSize: 8.5, fontWeight: 900, bgcolor: alpha(getStopFillColor(stop.fill), 0.08), color: getStopFillColor(stop.fill), border: 'none' }} />
                          </Box>
                        ))}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: '8px', bgcolor: 'action.hover' }}>
                          <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: 9, fontWeight: 900 }}>D</Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Depósito Municipal (Cierre)</Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Save Optimized Route Form */}
                    <Paper sx={{ p: 2, borderRadius: '12px', border: 'none', bgcolor: 'action.hover', mt: 1.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', mb: 1.5, display: 'block', letterSpacing: '0.05em' }}>
                        Registrar en Base de Datos
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <TextField label="Nombre de Ruta" placeholder="Ej: AI EcoRoute Cayma" size="small" fullWidth value={routeName} onChange={(e) => setRouteName(e.target.value)} />
                        <TextField label="Distrito" placeholder="Ej: Cayma" size="small" fullWidth value={routeDistrict} onChange={(e) => setRouteDistrict(e.target.value)} />
                        <Button variant="contained" onClick={handleSaveRoute} disabled={isSaving || !routeName}
                          sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11.5, py: 1, borderRadius: '24px', boxShadow: 'none' }}>
                          {isSaving ? 'Guardando...' : 'Guardar Ruta'}
                        </Button>
                      </Box>
                    </Paper>
                  </Box>
                )}

                {/* Empty State */}
                {!aiOptimized && (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 1.5, opacity: 0.5 }}>
                    <Activity size={32} />
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Sin optimización activa
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}

        </Box>
      </Box>
    </Box>
  );
};

export default RoutesPage;
