import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Map as MapIcon, Route as RouteIcon, Trash2, Save, Database, Code,
  ChevronRight, Filter, Navigation, Clock, MapPin, X, Palette, Edit3, Truck, Eye, Layers
} from 'lucide-react';
import {
  Box, Paper, Typography, IconButton, Button, TextField, InputBase, Chip, Divider
} from '@mui/material';
import RouteMap from '../components/dashboard/RouteMap/RouteMap';
import { routeService, RouteData } from '../services/routeService';

const RoutesPage: React.FC = () => {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [newRouteData, setNewRouteData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const mapRef = useRef<any>(null);
  const [routeName, setRouteName] = useState('');
  const [routeDistrict, setRouteDistrict] = useState('');
  const [routeColor, setRouteColor] = useState('#3b82f6');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeLayer, setActiveLayer] = useState<'dark' | 'bright' | 'liberty' | 'satellite' | 'hybrid'>(() => {
    const savedTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
    return (savedTheme === 'light' ? 'bright' : 'dark') as any;
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const layerMenuRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');

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

  useEffect(() => {
    loadRoutes();
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
      setRouteName(''); setRouteDistrict(''); setRouteColor('#3b82f6');
      setNewRouteData(null);
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

  const filteredRoutes = routes.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.district.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Box sx={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1 }}>
          <RouteMap
            ref={mapRef}
            onRouteCreated={setNewRouteData}
            activeRoute={activeRoute}
            selectedColor={routeColor}
            drawingMode={isDrawingMode}
            onDrawingModeChange={setIsDrawingMode}
            mapStyle={activeLayer}
            pitch={viewMode === '3D' ? 45 : 0}
          />
        </Box>

        {activeRoute && (
          <Paper sx={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 2.5, px: 2.5, py: 1, borderRadius: 2, boxShadow: 12 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1, bgcolor: 'primary.main' + '14', borderRadius: 1, color: 'primary.main' }}>
                <Navigation size={16} strokeWidth={3} />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.2, mb: 0.25, display: 'block' }}>
                  {activeRoute.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{activeRoute.district}</Typography>
                  <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.secondary', opacity: 0.4 }} />
                  <Typography variant="caption" color="secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Turno: 08-16h</Typography>
                </Box>
              </Box>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: 8, mb: 0.25, display: 'block' }}>Distancia</Typography>
                <Typography variant="caption" sx={{ fontWeight: 900 }}>{activeRoute.distance} <Typography component="span" variant="caption" sx={{ opacity: 0.4, fontSize: 9 }}>km</Typography></Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: 8, mb: 0.25, display: 'block' }}>Tiempo</Typography>
                <Typography variant="caption" sx={{ fontWeight: 900 }}>{activeRoute.duration} <Typography component="span" variant="caption" sx={{ opacity: 0.4, fontSize: 9 }}>min</Typography></Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setActiveRoute(null)} sx={{ ml: 1, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
              <X size={14} />
            </IconButton>
          </Paper>
        )}

        <Box sx={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 1.5, pointerEvents: 'none' }}>
          <Paper sx={{ display: 'flex', alignItems: 'center', gap: 0.75, p: 0.5, borderRadius: 3, boxShadow: 12, pointerEvents: 'auto' }}>
            <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              sx={{ width: 40, height: 40, bgcolor: isSidebarOpen ? 'primary.main' : 'transparent', color: isSidebarOpen ? 'white' : 'text.secondary', '&:hover': { bgcolor: isSidebarOpen ? 'primary.main' : 'action.hover' } }}>
              <RouteIcon size={18} strokeWidth={2.5} />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            <Button onClick={() => setViewMode(viewMode === '2D' ? '3D' : '2D')} sx={{ minWidth: 48, height: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              <Typography variant="caption" sx={{ fontWeight: 900, lineHeight: 1, fontSize: 11 }}>{viewMode === '2D' ? '3D' : '2D'}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 7, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Vista</Typography>
            </Button>
          </Paper>

          <Paper sx={{ display: 'flex', alignItems: 'center', gap: 0.75, p: 1, borderRadius: 3, boxShadow: 12, pointerEvents: 'auto' }}>
            <IconButton onClick={() => setIsDrawingMode(!isDrawingMode)}
              sx={{ width: 40, height: 40, bgcolor: isDrawingMode ? 'primary.main' : 'transparent', color: isDrawingMode ? 'white' : 'text.secondary', '&:hover': { bgcolor: isDrawingMode ? 'primary.main' : 'action.hover' } }}>
              <Plus size={18} strokeWidth={2.5} />
            </IconButton>
            <IconButton sx={{ width: 40, height: 40, color: 'text.secondary' }}>
              <Edit3 size={18} strokeWidth={2.5} />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            <IconButton sx={{ width: 40, height: 40, color: 'text.secondary' }}>
              <Truck size={18} strokeWidth={2.5} />
            </IconButton>
          </Paper>

          <Box sx={{ position: 'relative', pointerEvents: 'auto' }} ref={layerMenuRef}>
            {showLayerMenu && (
              <Paper sx={{ position: 'absolute', bottom: '100%', left: 0, mb: 1.5, width: 192, borderRadius: 2, overflow: 'hidden', p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5, boxShadow: 12 }}>
                {[
                  { id: 'dark', label: 'Modo Noche' },
                  { id: 'satellite', label: 'Satélite Puro' },
                  { id: 'hybrid', label: 'Híbrido 3D' },
                  { id: 'bright', label: 'Modo Claro' },
                  { id: 'liberty', label: 'Terreno' }
                ].map((l) => (
                  <Button key={l.id} onClick={() => { setActiveLayer(l.id as any); setShowLayerMenu(false); }}
                    variant={activeLayer === l.id ? 'contained' : 'text'}
                    sx={{ justifyContent: 'flex-start', textTransform: 'uppercase', fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', px: 1.5, py: 1 }}>
                    {l.label}
                  </Button>
                ))}
              </Paper>
            )}
            <Paper sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, borderRadius: 2, boxShadow: 12, pointerEvents: 'auto' }}>
              <IconButton onClick={() => setShowLayerMenu(!showLayerMenu)}
                sx={{ width: 40, height: 40, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <Layers size={18} strokeWidth={2.5} />
              </IconButton>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
              <IconButton onClick={() => mapRef.current?.clearRoute()} sx={{ width: 40, height: 40, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                <Trash2 size={18} strokeWidth={2.5} />
              </IconButton>
            </Paper>
          </Box>
        </Box>
      </Box>

      <Box sx={{
        display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', zIndex: 10,
        transition: 'all 0.5s ease-in-out', overflow: 'hidden',
        width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0,
        minWidth: isSidebarOpen ? 320 : 0,
      }}>
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 320 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', lineHeight: 1.2, mb: 0.25 }}>Rutas</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gestión Logística</Typography>
            </Box>
            <IconButton onClick={() => setIsSidebarOpen(false)} size="small" sx={{ bgcolor: 'action.hover', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              <X size={16} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 3 }}>
            <Paper sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 0.5, display: 'block', fontSize: 8 }}>Cobertura</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                {routes.reduce((acc, r) => acc + (parseFloat(r.distance.toString()) || 0), 0).toFixed(1)}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 700, ml: 0.25 }}>km</Typography>
              </Typography>
            </Paper>
            <Paper sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 0.5, display: 'block', fontSize: 8 }}>Eficiencia</Typography>
              <Typography variant="h6" color="success.main" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                94<Typography component="span" variant="caption" color="success.main" sx={{ fontWeight: 700, ml: 0.25 }}>%</Typography>
              </Typography>
            </Paper>
          </Box>

          <Paper sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.5, borderRadius: 2, mb: 2.5 }}>
            <Search size={14} />
            <InputBase sx={{ ml: 1, flex: 1, fontSize: 13, fontWeight: 700 }} placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </Paper>

          {newRouteData && !activeRoute && (
            <Paper sx={{ p: 3, borderRadius: 4, mb: 4, boxShadow: 12, bgcolor: 'primary.main' + '05' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton size="small" sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
                    <Navigation size={14} />
                  </IconButton>
                  <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Nueva Planificación</Typography>
                </Box>
                <IconButton size="small" onClick={() => setNewRouteData(null)} sx={{ color: 'text.secondary' }}>
                  <X size={16} />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField label="Alias de Ruta" placeholder="Eje: Ruta Norte A-1" size="small" fullWidth value={routeName} onChange={(e) => setRouteName(e.target.value)} />
                <TextField label="Distrito Operativo" placeholder="Eje: Yanahuara" size="small" fullWidth value={routeDistrict} onChange={(e) => setRouteDistrict(e.target.value)} />
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Palette size={12} color="primary" /> Identificador Visual
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
                    {colors.map(c => (
                      <IconButton key={c.value} onClick={() => setRouteColor(c.value)}
                        sx={{
                          width: 36, height: 36, bgcolor: c.value,
                          transform: routeColor === c.value ? 'scale(1.1)' : 'scale(1)',
                          opacity: routeColor === c.value ? 1 : 0.6,
                          '&:hover': { opacity: 1, transform: 'scale(1.05)' },
                          transition: 'all 0.2s'
                        }}>
                        {routeColor === c.value && <Plus size={14} strokeWidth={4} color="white" />}
                      </IconButton>
                    ))}
                  </Box>
                </Box>
                <Paper sx={{ p: 1.5, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 8 }}>Distancia Estimada</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{newRouteData.distance} km</Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 8 }}>Tiempo Aproximado</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{newRouteData.duration} min</Typography>
                  </Box>
                </Paper>
                <Button variant="contained" onClick={handleSaveRoute} disabled={isSaving || !routeName}
                  startIcon={isSaving ? <Clock size={16} className="spin" /> : <Save size={16} />}
                   sx={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 900, letterSpacing: '0.2em', py: 1.5, boxShadow: 8 }}>
                  {isSaving ? 'REGISTRANDO...' : 'GUARDAR EN BASE DE DATOS'}
                </Button>
              </Box>
            </Paper>
          )}

          <Box sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
            {Object.entries(
              filteredRoutes.reduce((acc, route) => {
                const district = route.district || 'General';
                if (!acc[district]) acc[district] = [];
                acc[district].push(route);
                return acc;
              }, {} as Record<string, RouteData[]>)
            ).map(([district, districtRoutes]) => (
              <Box key={district} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 1 }}>
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.secondary', opacity: 0.3 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>{district}</Typography>
                </Box>
                <Box>
                  {districtRoutes.map((route) => (
                    <Box key={route.id} onClick={() => setActiveRoute(route)}
                      sx={{
                        py: 1, px: 1.5, borderRadius: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        bgcolor: activeRoute?.id === route.id ? 'primary.main' + '14' : 'transparent',
                        color: activeRoute?.id === route.id ? 'primary.main' : 'text.primary',
                        '&:hover': { bgcolor: 'action.hover' }, transition: 'all 0.15s'
                      }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ width: 4, height: 16, borderRadius: 2, bgcolor: route.color || '#3b82f6' }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{route.name}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                            {route.distance} km
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0, '&:hover': { opacity: 1 }, '.group &:hover &': { opacity: 1 } }}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteRoute(route.id!); }}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'error.main' + '14' } }}>
                          <Trash2 size={12} />
                        </IconButton>
                        <ChevronRight size={12} style={{ opacity: 0.5 }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default RoutesPage;
