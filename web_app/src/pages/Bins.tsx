import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Download, MapPin, Battery, AlertTriangle, 
  Clock, Activity, Gauge, Navigation, 
  Thermometer, Droplets, Wind, ShieldAlert,
  Lock, Unlock, Edit, X, BarChart3, Router, Cpu, Database, Layers, Plus
} from 'lucide-react';
import { motion } from 'framer-motion';
import { containerStagger, fadeSlideUp, fadeInFromTop, fadeInFromRight } from '../shared/animations';
import contenedorImg from '../assets/contenedor.png';
import {
  Box, Paper, Typography, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Select, MenuItem, FormControl
} from '@mui/material';
import { deviceService, Device } from '../services/deviceService';
import { mapService } from '../services/mapService';

const defaultBins: any[] = [];

const getFillColor = (fill: number) => {
  if (fill >= 90) return '#f28b82';
  if (fill >= 75) return '#ffb74d';
  if (fill >= 30) return '#fdd835';
  return '#81c784';
};



const googleCardSx = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  backdropFilter: 'blur(20px)',
  border: 'none',
  borderRadius: '24px',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
});

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

  const handleDeleteBin = async (binId: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el contenedor ${binId}?`)) return;
    try {
      const liveDevice = devices.find(d => d.device_id === binId);
      
      // 1. Delete linked MapPoint in DB if exists
      if (liveDevice && liveDevice.map_point_id) {
        await mapService.deletePoint(liveDevice.map_point_id);
      }
      
      // 2. Delete the Device from DB
      await deviceService.deleteDevice(binId);
      
      // Refresh state
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
        // Check if device_id already exists
        const exists = devices.some(d => d.device_id.toLowerCase() === editBinData.id.toLowerCase());
        if (exists) {
          alert('El ID de dispositivo ya existe');
          return;
        }

        const lat = editBinData.lat || -16.3888;
        const lng = editBinData.lng || -71.5415;
        
        // 1. Save MapPoint
        const np = await mapService.savePoint({
          name: editBinData.name,
          description: editBinData.location,
          latitude: lat,
          longitude: lng,
          type: 'bin',
        });

        // 2. Register Device
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
          // 1. Update Device name/coordinates in DB
          await deviceService.updateDevice(editBinData.id, {
            name: editBinData.name,
            latitude: editBinData.lat || liveDevice.latitude,
            longitude: editBinData.lng || liveDevice.longitude
          });

          // 2. Update linked MapPoint in DB if exists
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

      // Fetch latest data to refresh the UI
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

  useEffect(() => {
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

    fetchData();

    // Setup live WebSocket listener
    const wsHost = window.location.hostname;
    const wsUrl = process.env.REACT_APP_WS_URL || `ws://${wsHost}:3001/ws`;
    let socket: WebSocket;
    let reconnectTimer: any;

    function connectWS() {
      console.log('[BINS WEBSOCKET] Conectando a:', wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[BINS WEBSOCKET] Conectado para recibir telemetría viva.');
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'telemetry' && parsed.device_id && parsed.data) {
            console.log('[BINS WEBSOCKET] Telemetría viva recibida en contenedores:', parsed.device_id, parsed.data);
            setTelemetry(prev => ({
              ...prev,
              [parsed.device_id]: parsed.data
            }));
            
            setDevices(prev => prev.map(d => {
              if (d.device_id === parsed.device_id) {
                const fillDistance = parsed.data.tof_cm ?? parsed.data.ultrasonic_cm ?? 80;
                const fillPct = Math.round(Math.max(0, Math.min(100, ((120 - fillDistance) / 120) * 100)));
                const status = fillPct >= 90 ? 'Warning' : 'Online';
                return { 
                  ...d, 
                  status,
                  battery_level: parsed.data.battery ?? d.battery_level,
                  last_seen: new Date().toISOString()
                };
              }
              return d;
            }));
          } else if (parsed.event === 'device_update' && parsed.device_id && parsed.data) {
            console.log('[BINS WEBSOCKET] Actualización de dispositivo en tiempo real:', parsed.device_id, parsed.data);
            setDevices(prev => prev.map(d => {
              if (d.device_id === parsed.device_id) {
                return { 
                  ...d, 
                  ...parsed.data
                };
              }
              return d;
            }));
          }
        } catch (err) {
          console.error('[BINS WEBSOCKET] Error procesando telemetría en tiempo real:', err);
        }
      };

      socket.onclose = () => {
        console.warn('[BINS WEBSOCKET] Conexión cerrada. Reintentando en 3s...');
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      socket.onerror = (err) => {
        console.error('[BINS WEBSOCKET] Error:', err);
        socket.close();
      };
    }

    connectWS();

    // Polling interval as robust fallback
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

  // Merge live devices and defaultBins
  const processedBins = defaultBins.map(mockBin => {
    const liveDevice = devices.find(d => d.device_id === mockBin.id);
    const dt = telemetry[mockBin.id];
    
    let fill = mockBin.fill;
    let battery = mockBin.battery;
    let temp = mockBin.temp;
    let hum = mockBin.hum;
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
        if (fillDistance <= 120) {
          fill = Math.round(Math.max(0, Math.min(100, ((120 - fillDistance) / 120) * 100)));
        } else {
          fill = Math.min(100, Math.max(0, fillDistance));
        }
      }
      temp = dt.temperature ?? dt.temperatura ?? temp;
      hum = dt.humidity ?? dt.humedad ?? hum;
      aq = dt.air_quality ?? aq;
      ir = dt.obstacle === 1;
      battery = dt.battery ?? battery;
      if (dt.timestamp) {
        lastUpdate = formatLastSeen(dt.timestamp);
      }
    }
    
    let status: 'critical' | 'high' | 'warning' | 'optimal' = 'optimal';
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
      temp,
      hum,
      aq,
      ir,
      lat,
      lng,
      gateway_id
    };
  });

  // Append any new dynamically auto-registered devices from DB that aren't in the defaultBins list
  const extraBins = devices
    .filter(d => (d.type === 'Nodo Sensor' || d.device_id.startsWith('N')) && !defaultBins.some(mb => mb.id === d.device_id))
    .map(d => {
      const dt = telemetry[d.device_id];
      let fill = 0;
      let temp = 20;
      let hum = 50;
      let aq = 100;
      let ir = false;
      let battery = d.battery_level ?? 80;
      
      if (dt) {
        const fillDistance = dt.tof_cm ?? dt.ultrasonic_cm;
        if (fillDistance !== undefined) {
          if (fillDistance <= 120) {
            fill = Math.round(Math.max(0, Math.min(100, ((120 - fillDistance) / 120) * 100)));
          } else {
            fill = Math.min(100, Math.max(0, fillDistance));
          }
        }
        temp = dt.temperature ?? temp;
        hum = dt.humidity ?? hum;
        aq = dt.air_quality ?? aq;
        ir = dt.obstacle === 1;
        battery = dt.battery ?? battery;
      }
      
      let status: 'critical' | 'high' | 'warning' | 'optimal' = 'optimal';
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
        temp,
        hum,
        aq,
        ir,
        lat: d.latitude,
        lng: d.longitude,
        gateway_id: d.gateway_id
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
        msg = `Sensor IR colapsado`;
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
    { id: 'BIN-402', msg: 'Carga crítica — 94% ocupado', time: 'Hace 5 min', severity: 'error' as const },
    { id: 'BIN-088', msg: 'Batería baja — 12% restante', time: 'Hace 1 hora', severity: 'warning' as const },
    { id: 'BIN-222', msg: 'Carga crítica — 91% ocupado', time: 'Hace 8 min', severity: 'error' as const },
  ];

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
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {editMode && (
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => {
                  setIsCreateMode(true);
                  setEditBinData({ id: '', name: '', location: '', lat: -16.3888, lng: -71.5415 });
                  setEditBinModalOpen(true);
                }}
                startIcon={<Plus size={16} />}
                sx={{ 
                  fontSize: 11.5, 
                  fontWeight: 600, 
                  borderRadius: '24px', 
                  bgcolor: 'primary.main', 
                  '&:hover': { bgcolor: 'primary.dark' },
                  color: 'primary.contrastText',
                  px: 2, py: 0.75
                }}
              >
                Añadir Contenedor
              </Button>
            )}
            <Button 
              variant={editMode ? "contained" : "outlined"}
              color={editMode ? "error" : "inherit"}
              onClick={() => setEditMode(!editMode)}
              startIcon={editMode ? <Unlock size={16} /> : <Lock size={16} />}
              sx={{ 
                fontSize: 11.5, 
                fontWeight: 600, 
                borderRadius: '24px', 
                borderColor: editMode ? 'transparent' : (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)', 
                color: editMode ? '#fff' : 'text.primary',
                px: 2, py: 0.75
              }}
            >
              {editMode ? "Edición activa" : "Modo edición"}
            </Button>
            <Button variant="outlined" startIcon={<Download size={16} />} sx={{ fontSize: 11.5, fontWeight: 600, borderRadius: '24px', borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)', color: 'text.primary', px: 2, py: 0.75 }}>
              Reportes
            </Button>
            <Button variant="contained" startIcon={<Navigation size={16} />} sx={{ fontSize: 11.5, fontWeight: 600, borderRadius: '24px', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, color: 'primary.contrastText', px: 2, py: 0.75 }}>
              Optimizar rutas
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => setShowSidebar(!showSidebar)} 
              startIcon={<Layers size={16} />} 
              sx={{ 
                fontSize: 11.5, 
                fontWeight: 600, 
                borderRadius: '24px', 
                borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)', 
                color: 'text.primary',
                px: 2, py: 0.75
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
                bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(20px)',
                border: 'none',
                borderRadius: '16px',
                p: 2.5,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.75)' : 'rgba(255,255,255,0.9)',
                  transform: 'translateY(-2px)',
                  boxShadow: t.palette.mode === 'dark' ? '0 10px 25px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.04)',
                },
              })}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', fontSize: 10, display: 'block', mb: 0.75 }}>
                      {kpi.label}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 30, fontFamily: '"Outfit", "Inter", sans-serif', color: 'text.primary', lineHeight: 1.1 }}>
                      {kpi.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 9.5, opacity: 0.6, mt: 0.5 }}>
                      {kpi.sub}
                    </Typography>
                  </Box>
                  <Box sx={{ 
                    color: i === 2 && criticalCount > 0 ? '#f28b82' : (i === 3 && lowBatteryCount > 0 ? '#ffb74d' : 'primary.main'), 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    opacity: 0.8
                  }}>
                    {kpi.icon}
                  </Box>
                </Box>
              </Paper>
            </motion.div>
          ))}
        </Box>
      </motion.div>

      {/* Main Content: Container Grid + Alerts */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: showSidebar ? { xs: '1fr', xl: '1fr 340px' } : '1fr', 
        gap: 4 
      }}>
        {/* Container Grid */}
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
                  label={`${combinedBins.filter(b => {
                    if (filterType === 'real') return b.gateway_id?.toLowerCase() === 'gateway_01';
                    if (filterType === 'simulated') return b.gateway_id?.toLowerCase() === 'gateway_02';
                    if (filterType === 'independent') return !b.gateway_id || (b.gateway_id.toLowerCase() !== 'gateway_01' && b.gateway_id.toLowerCase() !== 'gateway_02');
                    return true;
                  }).length} activos`} 
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
            
            {loading && combinedBins.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                <Typography variant="body1" color="text.secondary">Cargando telemetrías...</Typography>
              </Box>
            ) : (() => {
              const filteredBins = combinedBins.filter(b => {
                if (filterType === 'real') return b.gateway_id?.toLowerCase() === 'gateway_01';
                if (filterType === 'simulated') return b.gateway_id?.toLowerCase() === 'gateway_02';
                if (filterType === 'independent') return !b.gateway_id || (b.gateway_id.toLowerCase() !== 'gateway_01' && b.gateway_id.toLowerCase() !== 'gateway_02');
                return true;
              });

              const renderBinCard = (bin: typeof combinedBins[0]) => {
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
                        boxShadow: t.palette.mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.35)' : '0 8px 20px rgba(0,0,0,0.06)',
                      } 
                    })}>

                      {/* Main Split Content */}
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch' }}>
                        
                        {/* Left Side: Parameters & Data */}
                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {/* Name and ID */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 16, fontFamily: '"Outfit", "Inter", sans-serif', lineHeight: 1.25, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bin.name}>
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
                            {/* Sync status */}
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 0.5, 
                              bgcolor: isSync ? 'rgba(129, 199, 132, 0.08)' : 'rgba(242, 139, 130, 0.08)',
                              px: 1.25, 
                              py: 0.5, 
                              borderRadius: '100px', 
                              border: 'none'
                            }}>
                              <Box sx={{ 
                                width: 4, 
                                height: 4, 
                                borderRadius: '50%', 
                                bgcolor: isSync ? '#81c784' : '#f28b82',
                                boxShadow: `0 0 4px ${isSync ? '#81c784' : '#f28b82'}`
                              }} />
                              <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: isSync ? '#81c784' : '#f28b82', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {isSync ? `Sincronizado (${bin.id})` : 'No Sincronizado'}
                              </Typography>
                            </Box>

                            {/* Gateway info */}
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 0.5, 
                              bgcolor: 'rgba(255,255,255,0.02)', 
                              px: 1.25, 
                              py: 0.5, 
                              borderRadius: '100px', 
                              border: 'none'
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
                              <Typography sx={{ fontWeight: 800, fontSize: 24, fontFamily: '"Outfit", "Inter", monospace', color: getFillColor(bin.fill), lineHeight: 1 }}>
                                {bin.fill}%
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.6, color: 'text.secondary' }}>
                                Llenado
                              </Typography>
                            </Box>

                            {/* Minimalist Progress Bar */}
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
                                <Database size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
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
                                <ShieldAlert size={10.5} style={{ opacity: 0.8, color: bin.ir ? '#f28b82' : '#81c784' }} />
                                <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                  Sensor de Paso
                                </Typography>
                              </Box>
                              <Typography sx={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: bin.ir ? '#f28b82' : '#81c784', pl: 1.75 }}>
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

                            {/* Unified static telemetry row (never shifts the card height!) */}
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
                                  <Thermometer size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
                                  <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                    Temp
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: 'text.primary', pl: 1.75 }}>
                                  {bin.temp !== undefined ? `${Number(bin.temp).toFixed(1)}°C` : '--.-°C'}
                                </Typography>
                              </Box>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                  <Droplets size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
                                  <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                    Humedad
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: 'text.primary', pl: 1.75 }}>
                                  {bin.hum !== undefined ? `${Number(bin.hum).toFixed(0)}%` : '--%'}
                                </Typography>
                              </Box>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                  <Wind size={10.5} style={{ opacity: 0.8, color: 'text.secondary' }} />
                                  <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                                    Aire
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: 'text.primary', pl: 1.75 }}>
                                  {bin.aq !== undefined ? `${bin.aq} ppm` : '---'}
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
                          {/* Battery status */}
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 0.5, 
                            bgcolor: bin.battery < 20 ? 'rgba(242,139,130,0.08)' : 'rgba(255,255,255,0.02)', 
                            border: 'none',
                            px: 1.25, 
                            py: 0.25, 
                            borderRadius: '100px' 
                          }}>
                            <Battery size={13} color={bin.battery < 20 ? '#f28b82' : '#81c784'} />
                            <Typography variant="caption" sx={{ fontWeight: 700, color: bin.battery < 20 ? '#f28b82' : 'text.secondary', fontSize: 10.5 }}>
                              {bin.battery}%
                            </Typography>
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
                            <>
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
                                  border: 'none',
                                  color: 'text.secondary',
                                  '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', color: 'text.primary' }
                                }}
                                title="Editar Contenedor"
                              >
                                <Edit size={14} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteBin(bin.id)}
                                sx={{
                                  width: '32px', height: '32px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  color: 'error.main',
                                  '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)' }
                                }}
                                title="Eliminar Contenedor"
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  </motion.div>
                );
              };

              return (
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
                  {filteredBins.map(renderBinCard)}
                </Box>
              );
            })()}
          </Box>
        </motion.div>

        {/* Alerts & Sidebar */}
        {showSidebar && (
          <motion.div variants={fadeInFromRight} initial="hidden" animate="show" style={{ flexShrink: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              {/* Alerts Paper */}
              <Paper sx={(t) => ({ ...googleCardSx(t), p: 3 })}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <AlertTriangle size={15} color="#ffd600" /> Alertas del Canal
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  {alertsToDisplay.map((a, i) => (
                    <Box key={i} sx={{ 
                      p: 1.75, 
                      borderRadius: '16px', 
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', 
                      border: 'none', 
                      display: 'flex', 
                      gap: 1.5, 
                      alignItems: 'flex-start' 
                    }}>
                      <Box sx={{
                        width: 6, height: 6, borderRadius: '50%',
                        bgcolor: a.severity === 'error' ? '#f28b82' : a.severity === 'warning' ? '#ffb74d' : 'primary.main',
                        mt: 0.75, flexShrink: 0,
                        boxShadow: `0 0 6px ${a.severity === 'error' ? 'rgba(242,139,130,0.4)' : a.severity === 'warning' ? 'rgba(255,183,77,0.4)' : 'rgba(45,212,191,0.4)'}`
                      }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: 'text.primary', display: 'block', mb: 0.3, lineHeight: 1.35 }}>
                          {a.id} — {a.msg}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 9.5, opacity: 0.5 }}>{a.time}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>

              {/* Efficiency Paper */}
              <Paper sx={(t) => ({ ...googleCardSx(t), p: 3, position: 'relative', overflow: 'hidden' })}>
                <Activity size={120} style={{ position: 'absolute', right: -24, bottom: -24, opacity: 0.03, pointerEvents: 'none' }} />
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>
                  Eficiencia de Recolección
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 11.5, opacity: 0.8, mb: 2.5, lineHeight: 1.4 }}>
                  La optimización de rutas mejoró la recolección diaria en un <Typography component="span" sx={{ color: 'success.main', fontWeight: 700 }}>15.7%</Typography> este mes.
                </Typography>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.5 }}>Cobertura</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10.5, color: '#81c784', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Excelente</Typography>
                  </Box>
                  <Box sx={{ height: 6, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', borderRadius: '4px', bgcolor: 'success.main', width: '88%' }} />
                  </Box>
                </Box>
              </Paper>

              {/* Upcoming Collections Paper */}
              <Paper sx={(t) => ({ ...googleCardSx(t), p: 3 })}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <Clock size={15} color="#ffd600" /> Cola de Recolección
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {[
                    { id: 'N2', task: 'Recolección Urgente', date: 'En 30 min' },
                    { id: 'BIN-222', task: 'Recolección Programada', date: 'Hoy 15:00' },
                  ].map((m, i) => (
                    <Box key={i} sx={{ 
                      p: 1.5, 
                      borderRadius: '16px', 
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      border: 'none' 
                    }}>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 11.5, color: 'text.primary' }}>{m.id}</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 9.5, opacity: 0.6, display: 'block', mt: 0.25 }}>{m.task}</Typography>
                      </Box>
                      <Chip label={m.date} size="small" sx={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.02em', bgcolor: 'rgba(255,183,77,0.08)', color: '#ffb74d', borderRadius: '100px', border: 'none' }} />
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Box>
          </motion.div>
        )}
      </Box>

      {/* Modal para Editar Contenedor */}
      <Dialog 
        open={editBinModalOpen} 
        onClose={() => { setEditBinModalOpen(false); setEditBinData(null); }}
        maxWidth="xs" 
        fullWidth
        sx={{
          '& .MuiPaper-root': {
            borderRadius: '28px',
            p: 2.5,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.95)' : '#ffffff',
            backdropFilter: 'blur(16px)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.3px', fontFamily: '"Outfit", "Inter", sans-serif' }}>
              {isCreateMode ? 'Añadir Contenedor' : 'Editar Contenedor'}
            </Typography>
            {!isCreateMode && (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                ID del Dispositivo: {editBinData?.id}
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => { setEditBinModalOpen(false); setEditBinData(null); }} size="small" sx={{ borderRadius: '50%' }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveBinEdit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {isCreateMode && (
              <TextField
                label="ID del Dispositivo EUI"
                required
                fullWidth
                autoFocus
                value={editBinData?.id || ''}
                onChange={(e) => setEditBinData(prev => prev ? { ...prev, id: e.target.value } : null)}
                placeholder="Ej: N3"
              />
            )}
            <TextField
              label="Nombre Personalizado"
              required
              fullWidth
              autoFocus={!isCreateMode}
              value={editBinData?.name || ''}
              onChange={(e) => setEditBinData(prev => prev ? { ...prev, name: e.target.value } : null)}
              placeholder="Ej: Contenedor Sector A"
            />
            <TextField
              label="Ubicación / Referencia"
              required
              fullWidth
              value={editBinData?.location || ''}
              onChange={(e) => setEditBinData(prev => prev ? { ...prev, location: e.target.value } : null)}
              placeholder="Ej: Calle Mercaderes 102"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Latitud"
                required
                type="number"
                slotProps={{ htmlInput: { step: "any" } }}
                value={editBinData?.lat ?? -16.3888}
                onChange={(e) => setEditBinData(prev => prev ? { ...prev, lat: parseFloat(e.target.value) || 0 } : null)}
                fullWidth
              />
              <TextField
                label="Longitud"
                required
                type="number"
                slotProps={{ htmlInput: { step: "any" } }}
                value={editBinData?.lng ?? -71.5415}
                onChange={(e) => setEditBinData(prev => prev ? { ...prev, lng: parseFloat(e.target.value) || 0 } : null)}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1.5 }}>
            <Button onClick={() => { setEditBinModalOpen(false); setEditBinData(null); }} variant="outlined" color="inherit" fullWidth sx={{ borderRadius: '24px' }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" color="primary" fullWidth sx={{ borderRadius: '24px', color: 'primary.contrastText' }}>
              {isCreateMode ? 'Añadir Contenedor' : 'Guardar Cambios'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Bins;
