import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Download, MapPin, Battery, AlertTriangle, 
  Clock, Activity, Gauge, Navigation, 
  ShieldAlert, Edit, X, BarChart3, Router, Cpu, Plus, Layers, Lock, Unlock, LayoutGrid, List
} from 'lucide-react';
import { motion } from 'framer-motion';
import { containerStagger, fadeSlideUp, fadeInFromTop, fadeInFromRight } from '../shared/animations';
import { useTheme } from '@mui/material/styles';
import contenedorImg from '../assets/contenedor.png';
import {
  Box, Paper, Typography, Button, Chip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Select, MenuItem, FormControl, InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { deviceService, Device } from '../services/deviceService';
import { mapService } from '../services/mapService';
import { getWsUrl } from '../services/config';
import { calculateFillPercentage } from '../utils/fillCalculator';

const defaultBins: any[] = [];

const getFillColor = (fill: number) => {
  if (fill >= 90) return '#ea4335'; // Softer Google Red
  if (fill >= 75) return '#f9ab00'; // Softer Google Amber
  return '#34a853'; // Google Green (safe state)
};

const formatLastSeen = (dateStr: string | null | undefined) => {
  if (!dateStr) return '---';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
};

const googleCardSx = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  backdropFilter: 'blur(20px)',
  border: 'none',
  borderRadius: '24px',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 16px rgba(0,0,0,0.03)',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
});

const Bins: React.FC = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editBinModalOpen, setEditBinModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [editBinData, setEditBinData] = useState<{ id: string; name: string; location: string; lat?: number; lng?: number } | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'real' | 'simulated' | 'independent'>('all');
  const [showSidebar, setShowSidebar] = useState(true);
  const [discoveredIds, setDiscoveredIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid'); // Default back to original grid view

  const theme = useTheme();

  const handleDeleteBin = async (binId: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el contenedor ${binId}?`)) return;
    try {
      const liveDevice = devices.find(d => d.device_id === binId);
      if (liveDevice && liveDevice.map_point_id) {
        await mapService.deletePoint(liveDevice.map_point_id);
      }
      await deviceService.deleteDevice(binId);
      
      const [devicesData, telemetryData] = await Promise.all([
        deviceService.getDevices(),
        deviceService.getLatestTelemetry()
      ]);
      setDevices(devicesData);
      setTelemetry(telemetryData);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el contenedor');
    }
  };

  const handleSaveBinEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBinData) return;
    try {
      if (isCreateMode) {
        const exists = devices.some(d => d.device_id.toLowerCase() === editBinData.id.toLowerCase());
        if (exists) {
          alert('El ID de dispositivo ya existe');
          return;
        }

        const lat = editBinData.lat || -16.3888;
        const lng = editBinData.lng || -71.5415;
        
        const np = await mapService.savePoint({
          name: editBinData.name,
          description: editBinData.location,
          latitude: lat,
          longitude: lng,
          type: 'bin',
        });

        await deviceService.registerDevice({
          device_id: editBinData.id,
          name: editBinData.name,
          type: 'Nodo Sensor',
          registered: true,
          latitude: lat,
          longitude: lng,
          map_point_id: np.id,
        });
      } else {
        const liveDevice = devices.find(d => d.device_id === editBinData.id);
        if (liveDevice) {
          await deviceService.updateDevice(editBinData.id, {
            name: editBinData.name,
            latitude: editBinData.lat || liveDevice.latitude,
            longitude: editBinData.lng || liveDevice.longitude
          });

          if (liveDevice.map_point_id) {
            await mapService.updatePoint(liveDevice.map_point_id, {
              name: editBinData.name,
              description: editBinData.location,
              latitude: editBinData.lat || liveDevice.latitude,
              longitude: editBinData.lng || liveDevice.longitude
            });
          }
        }
      }

      const [devicesData, telemetryData] = await Promise.all([
        deviceService.getDevices(),
        deviceService.getLatestTelemetry()
      ]);
      setDevices(devicesData);
      setTelemetry(telemetryData);

      setEditBinModalOpen(false);
      setEditBinData(null);
    } catch (err) {
      console.error(err);
      alert('Error al guardar los cambios del contenedor');
    }
  };

  const fetchData = async () => {
    try {
      const [devicesData, telemetryData] = await Promise.all([
        deviceService.getDevices(),
        deviceService.getLatestTelemetry()
      ]);
      setDevices(devicesData);
      setTelemetry(telemetryData);
    } catch (err) {
      console.error('Error fetching containers data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const wsUrl = getWsUrl();
    let socket: WebSocket;
    let reconnectTimer: any;

    function connectWS() {
      socket = new WebSocket(wsUrl);
      socket.onclose = () => {
        reconnectTimer = setTimeout(connectWS, 3000);
      };
      socket.onerror = (err) => {
        socket.close();
      };
    }
    connectWS();

    const interval = setInterval(fetchData, 5000);
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const loadDiscovered = useCallback(async () => {
    try {
      const discovered = await deviceService.getDiscoveredDevices();
      const registeredIds = new Set(devices.map(d => d.device_id.toLowerCase()));
      const ids = discovered
        .map(d => d.device_id)
        .filter((id): id is string => !!id && !registeredIds.has(id.toLowerCase()));
      setDiscoveredIds(ids);
    } catch (err) {
      console.error('Error loading discovered devices:', err);
    }
  }, [devices]);

  useEffect(() => {
    if (editBinModalOpen && isCreateMode) {
      loadDiscovered();
    }
  }, [editBinModalOpen, isCreateMode, loadDiscovered]);

  // Compile active resources lists
  const processedBins = defaultBins.map(mockBin => {
    const liveDevice = devices.find(d => d.device_id === mockBin.id);
    const dt = telemetry[mockBin.id];
    
    let fill = mockBin.fill;
    let battery = mockBin.battery;
    let aq = mockBin.aq;
    let ir = mockBin.ir;
    let lastUpdate = mockBin.lastUpdate;
    let name = mockBin.name;
    let lat = mockBin.lat;
    let lng = mockBin.lng;
    let gateway_id = liveDevice?.gateway_id || 'gateway_02';
    
    if (liveDevice) {
      name = liveDevice.name || name;
      battery = liveDevice.battery_level ?? battery;
      lastUpdate = formatLastSeen(liveDevice.last_seen);
      lat = liveDevice.latitude ?? lat;
      lng = liveDevice.longitude ?? lng;
    }
    
    if (dt) {
      const fillDistance = dt.tof_cm ?? dt.ultrasonic_cm;
      if (fillDistance !== undefined) {
        fill = calculateFillPercentage(fillDistance);
      }
      aq = dt.air_quality ?? aq;
      ir = dt.obstacle === 1;
      battery = dt.battery ?? battery;
      if (dt.timestamp) {
        lastUpdate = formatLastSeen(dt.timestamp);
      }
    }
    
    let status = 'optimal';
    if (fill >= 90) status = 'critical';
    else if (fill >= 75) status = 'high';
    else if (fill >= 30) status = 'warning';
    
    return {
      ...mockBin,
      name,
      fill,
      battery,
      status,
      lastUpdate,
      aq,
      ir,
      lat,
      lng,
      gateway_id,
      satellites: dt?.satellites ?? mockBin.satellites ?? 0
    };
  });

  const extraBins = devices
    .filter(d => (d.type === 'Nodo Sensor' || d.device_id.startsWith('N')) && !defaultBins.some(mb => mb.id === d.device_id))
    .map(d => {
      const dt = telemetry[d.device_id];
      let fill = 0;
      let aq = 100;
      let ir = false;
      let battery = d.battery_level ?? 80;
      
      if (dt) {
        const fillDistance = dt.tof_cm ?? dt.ultrasonic_cm;
        if (fillDistance !== undefined) {
          fill = calculateFillPercentage(fillDistance);
        }
        aq = dt.air_quality ?? aq;
        ir = dt.obstacle === 1;
        battery = dt.battery ?? battery;
      }
      
      let status = 'optimal';
      if (fill >= 90) status = 'critical';
      else if (fill >= 75) status = 'high';
      else if (fill >= 30) status = 'warning';
      
      return {
        id: d.device_id,
        name: d.name || `Contenedor ${d.device_id}`,
        location: `GPS: ${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}`,
        fill,
        battery,
        status,
        lastUpdate: formatLastSeen(d.last_seen),
        capacity: 1100,
        aq,
        ir,
        lat: d.latitude,
        lng: d.longitude,
        gateway_id: d.gateway_id,
        satellites: dt?.satellites ?? 0
      };
    });

  const combinedBins = [...processedBins, ...extraBins];

  // Compute live KPIs
  const totalBinsCount = combinedBins.length;
  const averageFill = combinedBins.length > 0
    ? Math.round(combinedBins.reduce((sum, b) => sum + b.fill, 0) / combinedBins.length)
    : 0;
  const criticalCount = combinedBins.filter(b => b.status === 'critical' || b.status === 'high').length;
  const lowBatteryCount = combinedBins.filter(b => b.battery < 20).length;

  const liveKpis = [
    { label: 'Dispositivos Activos', value: totalBinsCount, icon: <Trash2 size={18} />, sub: 'Monitoreo en tiempo real' },
    { label: 'Carga Media', value: `${averageFill}%`, icon: <Gauge size={18} />, sub: 'Nivel medio general' },
    { label: 'Alertas Críticas', value: criticalCount, icon: <AlertTriangle size={18} />, sub: 'Requieren recolección' },
    { label: 'Baterías Bajas', value: lowBatteryCount, icon: <Battery size={18} />, sub: 'Menos del 20%' },
  ];

  // Generate dynamic live alerts
  const liveAlerts = combinedBins
    .filter(b => b.status === 'critical' || b.battery < 20 || b.ir)
    .map(b => {
      let msg = '';
      let severity: 'error' | 'warning' | 'info' = 'info';
      if (b.status === 'critical') {
        msg = `Carga crítica — ${b.fill}% ocupado`;
        severity = 'error';
      } else if (b.battery < 20) {
        msg = `Batería baja — ${b.battery}% restante`;
        severity = 'warning';
      } else if (b.ir) {
        msg = `Sensor de paso obstruído`;
        severity = 'warning';
      }
      return {
        id: b.id,
        msg,
        time: b.lastUpdate,
        severity
      };
    });

  const alertsToDisplay = liveAlerts.length > 0 ? liveAlerts.slice(0, 5) : [
    { id: 'N1', msg: 'Carga crítica — 94% ocupado', time: 'Hace 5 min', severity: 'error' as const },
    { id: 'N2', msg: 'Batería baja — 12% restante', time: 'Hace 1 hora', severity: 'warning' as const },
  ];

  const filteredBins = useMemo(() => {
    return combinedBins.filter(b => {
      if (filterType === 'real') return b.gateway_id?.toLowerCase() === 'gateway_01';
      if (filterType === 'simulated') return b.gateway_id?.toLowerCase() === 'gateway_02';
      if (filterType === 'independent') return !b.gateway_id || (b.gateway_id.toLowerCase() !== 'gateway_01' && b.gateway_id.toLowerCase() !== 'gateway_02');
      return true;
    }).sort((a, b) => b.fill - a.fill); // Sort by fill capacity descending (Google Console efficiency)
  }, [combinedBins, filterType]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, p: 0.5 }}>
      
      {/* Header - Subtle Material UI style */}
      <motion.div variants={fadeInFromTop} initial="hidden" animate="show">
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2.5 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
              Gestión de Contenedores
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5, opacity: 0.8 }}>
              Monitoreo en tiempo real de telemetrías y variables de red MQTT.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {editMode && (
              <Button 
                onClick={() => {
                  setIsCreateMode(true);
                  setEditBinData({ id: '', name: '', location: '', lat: -16.3888, lng: -71.5415 });
                  setEditBinModalOpen(true);
                }}
                startIcon={<Plus size={16} />}
                sx={{ 
                  fontSize: 11.5, 
                  fontWeight: 700, 
                  borderRadius: '24px', 
                  px: 2.5, py: 0.75,
                  border: 'none',
                  textTransform: 'none',
                  bgcolor: '#1a73e8', // Google Blue
                  color: '#ffffff',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: '#1557b0',
                    boxShadow: 'none'
                  }
                }}
              >
                Añadir Contenedor
              </Button>
            )}
            <Button 
              onClick={() => setEditMode(!editMode)}
              startIcon={editMode ? <Unlock size={16} /> : <Lock size={16} />}
              sx={{ 
                fontSize: 11.5, 
                fontWeight: 700, 
                borderRadius: '24px', 
                px: 2.5, py: 0.75,
                border: 'none',
                textTransform: 'none',
                bgcolor: editMode 
                  ? 'rgba(217,48,37,0.1)' 
                  : (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                color: editMode 
                  ? '#ea4335' 
                  : 'text.primary',
                '&:hover': {
                  bgcolor: editMode 
                    ? 'rgba(217,48,37,0.18)' 
                    : (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.065)',
                }
              }}
            >
              {editMode ? "Edición activa" : "Modo edición"}
            </Button>
            
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, v) => v && setViewMode(v)}
              size="small"
              sx={{
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                borderRadius: '24px',
                p: 0.5,
                border: 'none',
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: '20px !important',
                  px: 1.5, py: 0.5,
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    color: 'text.primary'
                  }
                }
              }}
            >
              <ToggleButton value="table"><List size={14} /></ToggleButton>
              <ToggleButton value="grid"><LayoutGrid size={14} /></ToggleButton>
            </ToggleButtonGroup>
            
            <Button 
              onClick={() => setShowSidebar(!showSidebar)} 
              startIcon={<Layers size={16} />} 
              sx={{ 
                fontSize: 11.5, 
                fontWeight: 700, 
                borderRadius: '24px', 
                px: 2.5, py: 0.75,
                border: 'none',
                textTransform: 'none',
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                color: 'text.primary',
                '&:hover': {
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.065)',
                }
              }}
            >
              {showSidebar ? "Ocultar resumen" : "Mostrar resumen"}
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* KPI Stats Row - Google Analytics / M3 Style */}
      <motion.div variants={containerStagger} initial="hidden" animate="show">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 3 }}>
          {liveKpis.map((kpi, i) => (
            <motion.div key={i} variants={fadeSlideUp}>
              <Paper sx={(t) => ({
                ...googleCardSx(t),
                p: 2.5,
                borderLeft: `4px solid ${i === 2 && criticalCount > 0 ? '#d93025' : (i === 3 && lowBatteryCount > 0 ? '#f59e0b' : '#1a73e8')}`,
                '&:hover': {
                  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.75)' : 'rgba(255,255,255,0.9)',
                  transform: 'translateY(-2px)',
                  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 6px 20px rgba(0,0,0,0.03)',
                },
              })}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', fontSize: 10, display: 'block', mb: 0.75 }}>
                      {kpi.label}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 30, color: 'text.primary', lineHeight: 1.1 }}>
                      {kpi.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 9.5, opacity: 0.6, mt: 0.5 }}>
                      {kpi.sub}
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    color: 'text.secondary', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.6
                  }}>
                    {kpi.icon}
                  </Box>
                </Box>
              </Paper>
            </motion.div>
          ))}
        </Box>
      </motion.div>

      {/* Main Content: Table/Grid + Alerts */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: showSidebar ? { xs: '1fr', xl: '1fr 340px' } : '1fr', 
        gap: 4 
      }}>
        {/* Container list/grid */}
        <motion.div variants={containerStagger} initial="hidden" animate="show" style={{ minWidth: 0 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Activity size={16} /> Contenedores Inteligentes
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <Select
                    value={filterType}
                    onChange={(e: any) => setFilterType(e.target.value)}
                    sx={{ 
                      fontSize: 10.5, 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      borderRadius: '8px',
                      height: 32,
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <MenuItem value="all" sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' }}>Todos los Nodos</MenuItem>
                    <MenuItem value="real" sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' }}>Hardware Real</MenuItem>
                    <MenuItem value="simulated" sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' }}>Simulados</MenuItem>
                    <MenuItem value="independent" sx={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' }}>Independientes</MenuItem>
                  </Select>
                </FormControl>
                
                <Chip 
                  label={`${filteredBins.length} activos`} 
                  size="small" 
                  sx={{ 
                    fontWeight: 800, 
                    fontSize: 10, 
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', 
                    color: 'text.primary', 
                    border: 'none', 
                    borderRadius: '6px' 
                  }} 
                />
              </Box>
            </Box>
            
            {loading && filteredBins.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                <CircularProgress size={32} />
              </Box>
            ) : viewMode === 'table' ? (
              /* Table View (Default Google Admin Style) */
              <TableContainer component={Paper} sx={(t) => ({ ...googleCardSx(t), overflow: 'hidden' })}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Nombre</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Identificador</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Dirección / Coordenadas</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Capacidad</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Sensor IR</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Batería</TableCell>
                      <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Gateway Base</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredBins.map(bin => {
                      const gw = devices.find(d => d.device_id.toLowerCase() === bin.gateway_id?.toLowerCase() && d.type?.toLowerCase() === 'gateway');
                      const gwName = gw ? gw.name : (bin.gateway_id === 'gateway_01' ? 'Gateway Real' : (bin.gateway_id === 'gateway_02' ? 'Gateway Virtual' : 'Sin Gateway'));
                      return (
                        <TableRow key={bin.id} hover>
                          <TableCell sx={{ fontWeight: 800 }}>{bin.name}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>{bin.id}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: 12.5 }}>{bin.location}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Typography sx={{ fontWeight: 800, fontSize: 12.5, fontFamily: 'monospace', color: getFillColor(bin.fill) }}>{bin.fill}%</Typography>
                              <Box sx={{ width: 60, height: 5, bgcolor: 'action.hover', borderRadius: 10, overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', width: `${bin.fill}%`, bgcolor: getFillColor(bin.fill) }} />
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={bin.ir ? 'OBSTRUIDO' : 'LIBRE'} 
                              size="small" 
                              sx={{ 
                                fontWeight: 800, 
                                fontSize: 9, 
                                bgcolor: bin.ir ? 'rgba(217,48,37,0.08)' : 'rgba(24,128,56,0.08)',
                                color: bin.ir ? '#d93025' : '#188038',
                                border: 'none'
                              }} 
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 750, color: bin.battery < 20 ? 'error.main' : 'text.primary', fontSize: 12.5 }}>{bin.battery}%</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{gwName}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                              <Button size="small" onClick={() => navigate(`/stats?device=${bin.id}`)} sx={{ textTransform: 'none', fontWeight: 800 }}>Historial</Button>
                              <Button size="small" onClick={() => navigate(`/mapa?lat=${bin.lat}&lng=${bin.lng}&zoom=17.5`)} sx={{ textTransform: 'none', fontWeight: 800 }} color="secondary">Mapa</Button>
                              {editMode && (
                                <>
                                  <IconButton size="small" onClick={() => {
                                    setIsCreateMode(false);
                                    setEditBinData({ id: bin.id, name: bin.name, location: bin.location, lat: bin.lat, lng: bin.lng });
                                    setEditBinModalOpen(true);
                                  }}><Edit size={14} /></IconButton>
                                  <IconButton size="small" color="error" onClick={() => handleDeleteBin(bin.id)}><X size={14} /></IconButton>
                                </>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              /* Grid View (Original Animated Card View with 3D Image Restore) */
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: showSidebar ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                  lg: showSidebar ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
                  xl: showSidebar ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
                }, 
                gap: 2.5 
              }}>
                {filteredBins.map(bin => {
                  const isSync = devices.some(d => d.device_id.toLowerCase() === bin.id.toLowerCase() && d.registered !== false);
                  const gw = devices.find(d => d.device_id.toLowerCase() === bin.gateway_id?.toLowerCase() && d.type?.toLowerCase() === 'gateway');
                  const gwName = gw ? gw.name : (bin.gateway_id === 'gateway_01' ? 'Gateway Real' : (bin.gateway_id === 'gateway_02' ? 'Gateway Virtual' : 'Sin Gateway'));

                  return (
                    <motion.div key={bin.id} variants={fadeSlideUp} style={{ display: 'flex' }}>
                      <Paper sx={(t) => ({ 
                        ...googleCardSx(t), 
                        p: 2.5, 
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 285,
                        position: 'relative',
                        '&:hover': { 
                          transform: 'translateY(-3px)',
                          borderColor: t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                          boxShadow: t.palette.mode === 'dark' ? 'none' : '0 8px 24px rgba(0,0,0,0.06)',
                        } 
                      })}>

                        {/* Main Split Content */}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch' }}>
                          
                          {/* Left Side: Parameters & Data */}
                          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {/* Name and ID */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bin.name}>
                                {bin.name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.6 }}>
                                <MapPin size={11} style={{ flexShrink: 0, color: '#2dd4bf' }} />
                                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {bin.location}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Sync & Gateway status badges */}
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 0.5, 
                                bgcolor: isSync ? 'rgba(24,128,56,0.08)' : 'rgba(217,48,37,0.08)',
                                px: 1.25, 
                                py: 0.5, 
                                borderRadius: '100px'
                              }}>
                                <Box sx={{ 
                                  width: 4, 
                                  height: 4, 
                                  borderRadius: '50%', 
                                  bgcolor: isSync ? '#188038' : '#d93025'
                                }} />
                                <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: isSync ? '#188038' : '#d93025', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  {isSync ? 'Sincronizado' : 'Pendiente'}
                                </Typography>
                              </Box>

                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 0.5, 
                                bgcolor: 'rgba(255,255,255,0.02)', 
                                px: 1.25, 
                                py: 0.5, 
                                borderRadius: '100px'
                              }}>
                                <Router size={8.5} style={{ opacity: 0.6, color: 'text.secondary' }} />
                                <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  {gwName}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Gauge and Fill indicator */}
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.75 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 24, color: getFillColor(bin.fill), lineHeight: 1 }}>
                                  {bin.fill}%
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.6, color: 'text.secondary' }}>
                                  Llenado
                                </Typography>
                              </Box>
                              <Box sx={{ height: 8, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                                <Box sx={{ 
                                  height: '100%', 
                                  borderRadius: '4px', 
                                  background: getFillColor(bin.fill), 
                                  width: `${bin.fill}%`, 
                                  transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                }} />
                              </Box>
                            </Box>

                            {/* Sleek Industrial Parameters Grid */}
                            <Box sx={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(2, 1fr)', 
                              gap: 1.5,
                              mt: 0.5,
                              pt: 1.5,
                              borderTop: '1px solid',
                              borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'
                            }}>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                  <Cpu size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
                                  <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                    Dispositivo EUI
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'text.primary', pl: 1.75 }}>
                                  {bin.id}
                                </Typography>
                              </Box>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                  <BarChart3 size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
                                  <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                    Capacidad
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'text.primary', pl: 1.75 }}>
                                  {bin.capacity} L
                                </Typography>
                              </Box>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                  <ShieldAlert size={10.5} style={{ opacity: 0.8, color: bin.ir ? '#d93025' : '#188038' }} />
                                  <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                    Sensor de Paso
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: bin.ir ? '#d93025' : '#188038', pl: 1.75 }}>
                                  {bin.ir ? 'OBSTRUIDO' : 'LIBRE'}
                                </Typography>
                              </Box>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                  <Router size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
                                  <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                    Pasarela Base
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pl: 1.75 }} title={gwName}>
                                  {gwName}
                                </Typography>
                              </Box>
                              <Box sx={{ gridColumn: 'span 2' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                  <MapPin size={10.5} style={{ opacity: 0.8, color: '#38bdf8' }} />
                                  <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                    Ubicación GPS (Latitud, Longitud)
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'text.primary', pl: 1.75 }}>
                                  {bin.lat !== undefined && bin.lng !== undefined ? `${bin.lat.toFixed(5)}, ${bin.lng.toFixed(5)}` : 'Sin Coordenadas'}
                                </Typography>
                              </Box>

                              {/* Simplified telemetry row (no temp/hum as requested) */}
                              <Box sx={{ 
                                gridColumn: 'span 2', 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                pt: 1.5, 
                                borderTop: '1px dashed', 
                                borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                minHeight: 44
                              }}>
                                <Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                    <Activity size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
                                    <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                      Calidad Aire
                                    </Typography>
                                  </Box>
                                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: 'text.primary', pl: 1.75 }}>
                                    {bin.aq !== undefined ? `${bin.aq} ppm` : '---'}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                    <Layers size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
                                    <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                      Satélites GPS
                                    </Typography>
                                  </Box>
                                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: 'text.primary', pl: 1.75 }}>
                                    {bin.satellites !== undefined ? `${bin.satellites} sats` : '0 sats'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          </Box>

                          {/* Right Side: Clean Transparent Container Image */}
                          <Box sx={{
                            width: { xs: 90, sm: 105, md: 110 },
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                          }}>
                            <Box
                              component="img"
                              src={contenedorImg}
                              alt=""
                              sx={{
                                maxWidth: '100%',
                                maxHeight: '100px',
                                objectFit: 'contain',
                                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': { 
                                  transform: 'scale(1.08) translateY(-2px)',
                                }
                              }}
                            />
                          </Box>
                        </Box>

                        {/* Bottom Info Row & Action Button */}
                        <Box sx={{ mt: 2, pt: 1.25, borderTop: '1px solid', borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            {/* Battery & GPS Status badges */}
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 0.5, 
                                bgcolor: bin.battery < 20 ? 'rgba(217,48,37,0.08)' : 'rgba(255,255,255,0.02)', 
                                border: 'none',
                                px: 1.25, 
                                py: 0.25, 
                                borderRadius: '100px' 
                              }}>
                                <Battery size={13} color={bin.battery < 20 ? '#d93025' : '#188038'} />
                                <Typography variant="caption" sx={{ fontWeight: 700, color: bin.battery < 20 ? '#d93025' : 'text.secondary', fontSize: 10.5 }}>
                                  {bin.battery}%
                                </Typography>
                              </Box>

                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 0.5, 
                                bgcolor: bin.satellites > 0 ? 'rgba(24,128,56,0.08)' : 'rgba(255,255,255,0.02)', 
                                border: 'none',
                                px: 1.25, 
                                py: 0.25, 
                                borderRadius: '100px' 
                              }}>
                                <Navigation size={11} color={bin.satellites > 0 ? '#188038' : '#a1a1aa'} />
                                <Typography variant="caption" sx={{ fontWeight: 700, color: bin.satellites > 0 ? '#188038' : 'text.secondary', fontSize: 10.5 }}>
                                  {bin.satellites > 0 ? `GPS OK (${bin.satellites})` : 'GPS NO FIX'}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Last seen time */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Clock size={11} style={{ opacity: 0.5, color: '#2dd4bf' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 10 }}>
                                {bin.lastUpdate}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Action buttons row */}
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => navigate(`/mapa?lat=${bin.lat}&lng=${bin.lng}&zoom=17`)}
                              sx={{
                                flex: 1,
                                fontSize: 11, fontWeight: 600, textTransform: 'none',
                                borderRadius: '24px', height: '32px',
                                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)', 
                                color: 'text.primary',
                                '&:hover': { borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)', bgcolor: 'rgba(255,255,255,0.02)' }
                              }}
                            >
                              <Navigation size={12} style={{ marginRight: 6 }} /> Abrir Mapa
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => navigate(`/stats?device=${bin.id}`)}
                              sx={{
                                flex: 1,
                                fontSize: 11, fontWeight: 600, textTransform: 'none',
                                borderRadius: '24px', height: '32px',
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(45,212,191,0.08)' : 'rgba(13,148,136,0.08)',
                                color: 'primary.main',
                                '&:hover': { bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(45,212,191,0.15)' : 'rgba(13,148,136,0.15)' }
                              }}
                            >
                              <BarChart3 size={12} style={{ marginRight: 6 }} /> Estadísticas
                            </Button>
                            {editMode && (
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setIsCreateMode(false);
                                    setEditBinData({
                                      id: bin.id,
                                      name: bin.name,
                                      location: bin.location,
                                      lat: bin.lat,
                                      lng: bin.lng
                                    });
                                    setEditBinModalOpen(true);
                                  }}
                                  sx={{
                                    width: '32px', height: '32px',
                                    borderRadius: '50%',
                                    color: 'text.secondary'
                                  }}
                                >
                                  <Edit size={14} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteBin(bin.id)}
                                  sx={{
                                    width: '32px', height: '32px',
                                    borderRadius: '50%'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </IconButton>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    </motion.div>
                  );
                })}
              </Box>
            )}
          </Box>
        </motion.div>

        {/* Alerts & Sidebar */}
        {showSidebar && (
          <motion.div variants={fadeInFromRight} initial="hidden" animate="show" style={{ flexShrink: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              {/* Alerts Paper */}
              <Paper sx={(t) => ({ ...googleCardSx(t), p: 3 })}>
                <Typography variant="body2" sx={{ fontWeight: 850, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <AlertTriangle size={15} color="#ffd600" /> Alertas del Canal
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  {alertsToDisplay.map((a, i) => (
                    <Box key={i} sx={{ 
                      p: 1.75, 
                      borderRadius: '12px', 
                      bgcolor: 'action.hover', 
                      display: 'flex', 
                      gap: 1.5, 
                      alignItems: 'flex-start',
                      borderLeft: `4px solid ${a.severity === 'error' ? '#d93025' : '#f59e0b'}`
                    }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: 'text.primary', mb: 0.5 }}>
                          Dispositivo {a.id}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5, fontWeight: 550 }}>
                          {a.msg}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', fontSize: 9.5, opacity: 0.5, fontWeight: 500 }}>
                          {a.time}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Box>
          </motion.div>
        )}
      </Box>

      {/* Edit/Create Dialog */}
      <Dialog open={editBinModalOpen} onClose={() => setEditBinModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 850, fontSize: 16 }}>
          {isCreateMode ? 'REGISTRAR CONTENEDOR' : 'EDITAR CONTENEDOR'}
        </DialogTitle>
        <form onSubmit={handleSaveBinEdit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {isCreateMode ? (
              <FormControl size="small" fullWidth required>
                <InputLabel id="discovered-device-label">Dispositivo Descubierto</InputLabel>
                <Select
                  labelId="discovered-device-label"
                  value={editBinData?.id || ''}
                  label="Dispositivo Descubierto"
                  onChange={(e) => setEditBinData(prev => prev ? { ...prev, id: e.target.value } : null)}
                  sx={{ borderRadius: '8px' }}
                >
                  {discoveredIds.length === 0 ? (
                    <MenuItem value="" disabled>No hay hardware libre detectado</MenuItem>
                  ) : (
                    discoveredIds.map(id => (
                      <MenuItem key={id} value={id}>{id}</MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            ) : (
              <TextField
                label="Identificador de Nodo"
                value={editBinData?.id || ''}
                disabled
                size="small"
                fullWidth
                slotProps={{ input: { style: { fontFamily: 'monospace' } } }}
              />
            )}
            <TextField
              label="Nombre del Contenedor"
              value={editBinData?.name || ''}
              onChange={(e) => setEditBinData(prev => prev ? { ...prev, name: e.target.value } : null)}
              required
              size="small"
              fullWidth
            />
            <TextField
              label="Dirección / Ubicación"
              value={editBinData?.location || ''}
              onChange={(e) => setEditBinData(prev => prev ? { ...prev, location: e.target.value } : null)}
              required
              size="small"
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Latitud"
                type="number"
                slotProps={{ htmlInput: { step: 'any' } }}
                value={editBinData?.lat !== undefined ? editBinData.lat : ''}
                onChange={(e) => setEditBinData(prev => prev ? { ...prev, lat: parseFloat(e.target.value) || 0 } : null)}
                required
                size="small"
              />
              <TextField
                label="Longitud"
                type="number"
                slotProps={{ htmlInput: { step: 'any' } }}
                value={editBinData?.lng !== undefined ? editBinData.lng : ''}
                onChange={(e) => setEditBinData(prev => prev ? { ...prev, lng: parseFloat(e.target.value) || 0 } : null)}
                required
                size="small"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2.5, pt: 1.5 }}>
            <Button onClick={() => setEditBinModalOpen(false)} sx={{ textTransform: 'none', fontWeight: 800 }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '24px' }}>
              Guardar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

    </Box>
  );
};

export default Bins;
