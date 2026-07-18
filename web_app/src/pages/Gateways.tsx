import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { containerStagger, fadeSlideUp } from '../shared/animations';
import { deviceService, Device } from '../services/deviceService';
import { mapService, MapPoint } from '../services/mapService';
import { getWsUrl } from '../services/config';
import {
  Box, Paper, Typography, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, MenuItem as MuiMenuItem, ListItemIcon, ListItemText,
  Chip, Card, CardContent, LinearProgress, TablePagination, InputAdornment,
} from '@mui/material';
import {
  Plus, Router, Signal, Cpu, HardDrive, Trash2, Search,
  MoreVertical, LineChart, X, Map as MapIcon, Battery, Clock
} from 'lucide-react';

const getRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return '--';
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
};

const getSignalBars = (rssi: number | undefined): { bars: number; color: string } => {
  if (rssi === undefined || rssi === null) return { bars: 0, color: 'text.text_muted' };
  if (rssi > -60) return { bars: 4, color: 'success.main' };
  if (rssi > -75) return { bars: 3, color: 'success.main' };
  if (rssi > -85) return { bars: 2, color: 'warning.main' };
  if (rssi > -95) return { bars: 1, color: 'warning.main' };
  return { bars: 0, color: 'error.main' };
};

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
  const paletteMap = { primary: 'primary', secondary: 'secondary', success: 'success', warning: 'warning', error: 'error' } as const;
  const colorKey = paletteMap[color];

  return (
    <Paper sx={(t) => ({ p: 3, borderRadius: '16px', position: 'relative', overflow: 'hidden', bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff', border: 'none', boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)' })}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box
          sx={{
            color: (t) => t.palette[colorKey].main,
            transition: '0.2s',
            '&:hover': { transform: 'scale(1.1)' },
          }}
        >
          {icon}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>
          {value}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: '0.2em', opacity: 0.6 }}>
        {label}
      </Typography>
    </Paper>
  );
};

const Gateways: React.FC = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState({
    device_id: '',
    name: '',
    type: 'node',
    map_point_id: ''
  });

  const loadDevices = async () => {
    try {
      const data = await deviceService.getDevices();
      setDevices(data);
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMapPoints = async () => {
    try {
      const points = await mapService.getPoints();
      setMapPoints(points);
    } catch (err) {
      console.error('Error loading map points:', err);
    }
  };

  const loadLatestTelemetry = async () => {
    try {
      const data = await deviceService.getLatestTelemetry();
      localStorage.setItem('last_telemetry', JSON.stringify(data));
    } catch (err) {
      console.error('Error fetching telemetry:', err);
    }
  };

  useEffect(() => {
    loadDevices();
    loadMapPoints();
    loadLatestTelemetry();

    // Setup live WebSocket listener for real-time updates
    const wsUrl = getWsUrl();
    let socket: WebSocket;
    let reconnectTimer: any;

    function connectWS() {
      console.log('[GATEWAYS WEBSOCKET] Conectando a:', wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[GATEWAYS WEBSOCKET] Conectado para recibir telemetría viva y actualizaciones de red.');
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          // 1. Live Telemetry Event
          if (parsed.event === 'telemetry' && parsed.device_id && parsed.data) {
            console.log('[GATEWAYS WEBSOCKET] Telemetría viva recibida:', parsed.device_id, parsed.data);
            
            setDevices(prev => prev.map(d => {
              if (d.device_id === parsed.device_id) {
                const bat = parsed.data.battery ?? parsed.data.bateria ?? parsed.data.batt ?? parsed.data.bat;
                const rssi = parsed.data.rssi;
                return { 
                  ...d, 
                  status: 'online',
                  battery_level: bat !== undefined ? bat : d.battery_level,
                  signal_strength: rssi !== undefined ? rssi : d.signal_strength,
                  last_seen: new Date().toISOString()
                };
              }
              return d;
            }));
          }
          
          // 2. Real-Time API Device Update Event
          else if (parsed.event === 'device_update' && parsed.device_id && parsed.data) {
            console.log('[GATEWAYS WEBSOCKET] Actualización de dispositivo en tiempo real:', parsed.device_id, parsed.data);
            
            setDevices(prev => prev.map(d => {
              if (d.device_id === parsed.device_id) {
                return { 
                  ...d, 
                  ...parsed.data,
                  last_seen: new Date().toISOString()
                };
              }
              return d;
            }));
          }
          
          // 3. Real-Time API Device Registration Event
          else if (parsed.event === 'device_register' && parsed.device_id && parsed.data) {
            console.log('[GATEWAYS WEBSOCKET] Nuevo dispositivo registrado en tiempo real:', parsed.device_id, parsed.data);
            
            setDevices(prev => {
              if (prev.some(d => d.device_id === parsed.device_id)) return prev;
              return [...prev, parsed.data];
            });
          }
        } catch (err) {
          console.error('[GATEWAYS WEBSOCKET] Error procesando mensaje de red en tiempo real:', err);
        }
      };

      socket.onclose = () => {
        console.warn('[GATEWAYS WEBSOCKET] Conexión de red cerrada. Reintentando en 3s...');
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      socket.onerror = (err) => {
        console.error('[GATEWAYS WEBSOCKET] Error de red:', err);
        socket.close();
      };
    }

    connectWS();

    // Polling interval as robust fallback
    const interval = setInterval(loadDevices, 5000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const unregistered = useMemo(() => devices.filter(d => !d.registered), [devices]);
  const registered = useMemo(() => {
    const filtered = devices.filter(d => {
      if (!d.registered) return false;
      if (d.type?.toLowerCase() !== 'gateway') return false; // Exclude non-gateways
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.device_id.toLowerCase().includes(q) ||
        (d.name || '').toLowerCase().includes(q) ||
        (d.type || '').toLowerCase().includes(q)
      );
    });
    return filtered;
  }, [devices, searchQuery]);

  useEffect(() => { setPage(0); }, [searchQuery]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await deviceService.registerDevice({
        device_id: formData.device_id,
        name: formData.name,
        type: formData.type,
        map_point_id: formData.map_point_id ? parseInt(formData.map_point_id) : undefined
      });
      setShowRegisterModal(false);
      loadDevices();
    } catch (err) {
      alert('Error al registrar el dispositivo');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, device: Device) => {
    setAnchorEl(event.currentTarget);
    setSelectedDevice(device);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDevice(null);
  };

  if (loading && devices.length === 0) {
    return (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 20 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </Box>
    );
  }

  return (
    <>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2, animation: 'fadeIn 0.3s ease' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2.5 }}>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: -0.5, textTransform: 'uppercase' }}>
              Gateways
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', animation: 'pulse 2s infinite' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: '0.15em' }}>
                IoT Gateway Monitoring Dashboard
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => {
              setFormData({ device_id: '', name: '', type: 'node', map_point_id: '' });
              setShowRegisterModal(true);
            }}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Vincular Hardware
          </Button>
        </Box>

        {/* Stats Row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 2.5 }}>
          <StatCard label="Total Gateways" value={devices.filter(d => d.type?.toLowerCase() === 'gateway').length} icon={<Router size={20} />} color="primary" />
          <StatCard label="Online" value={devices.filter(d => d.type?.toLowerCase() === 'gateway' && d.status?.toLowerCase() === 'online').length} icon={<Signal size={20} />} color="success" />
          <StatCard label="Offline" value={devices.filter(d => d.type?.toLowerCase() === 'gateway' && d.status?.toLowerCase() === 'offline').length} icon={<Cpu size={20} />} color="warning" />
          <StatCard label="Alerts" value={devices.filter(d => d.type?.toLowerCase() === 'gateway' && d.status?.toLowerCase() === 'warning').length} icon={<HardDrive size={20} />} color="error" />
        </Box>

        {/* Live Scanner */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Signal size={14} style={{ animation: 'pulse 2s infinite' }} color="#2dd4bf" />
            <Typography variant="overline" color="primary" sx={{ fontWeight: 900, letterSpacing: '0.3em', lineHeight: 1 }}>
              Frecuencias Detectadas
            </Typography>
            <Box sx={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(45,212,191,0.2), transparent)' }} />
          </Box>

          <Box component={motion.div} variants={containerStagger} initial="hidden" animate="show" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 2.5 }}>
            {unregistered.length === 0 ? (
              <Box sx={(t) => ({ gridColumn: '1 / -1', py: 12, textAlign: 'center', borderRadius: '16px', bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff', border: 'none', boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)' })}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 4 }}>
                  <Search size={32} style={{ opacity: 0.3, color: 'primary.main' }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: '0.2em', maxWidth: 300, mx: 'auto' }}>
                  Escaneando señales LoRa P2P cercanas...
                </Typography>
              </Box>
            ) : (
              unregistered.map((device, i) => (
                <motion.div
                  key={device.device_id}
                  variants={fadeSlideUp}
                >
                  <Card sx={(t) => ({ borderRadius: '16px', bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff', border: 'none', boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden', position: 'relative' })}>
                    <Box sx={{ position: 'absolute', top: 0, right: 0, width: 128, height: 128, borderRadius: '50%', transform: 'translate(50%, -50%)', bgcolor: 'rgba(138,180,248,0.06)', transition: '0.3s', filter: 'blur(40px)' }} />
                    <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                        <Box
                          sx={{
                            color: 'primary.main',
                            transition: '0.2s',
                          }}
                        >
                          {device.type?.toLowerCase() === 'gateway' ? <Router size={28} /> : <Cpu size={28} />}
                        </Box>
                        <IconButton
                          size="small"
                          onClick={async () => {
                            if (window.confirm('¿Eliminar este dispositivo detectado?')) {
                              try { await deviceService.deleteDevice(device.device_id); loadDevices(); }
                              catch { alert('Error al eliminar'); }
                            }
                          }}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'rgba(251,113,133,0.08)' } }}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5, fontFamily: 'monospace', fontSize: '0.95rem' }}>
                        {device.device_id}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', animation: 'pulse 2s infinite' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: '0.15em', opacity: 0.7, textTransform: 'uppercase' }}>
                          {device.type?.toLowerCase() === 'gateway' ? 'Estación Base Detectada' : 'Señal de Nodo Cruda'}
                        </Typography>
                      </Box>
                      <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={() => {
                          setFormData({
                            device_id: device.device_id,
                            name: device.type === 'gateway' ? 'Gateway Alpha' : `Node ${device.device_id.slice(-2)}`,
                            type: device.type,
                            map_point_id: ''
                          });
                          setShowRegisterModal(true);
                        }}
                        sx={{ borderRadius: '24px', boxShadow: 'none' }}
                      >
                        Configurar Infraestructura
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </Box>
        </Box>

        {/* Gateway Grid */}
        <Box>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, justifyContent: 'space-between', alignItems: { lg: 'center' }, gap: 2.5, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(45,212,191,0.1)', color: 'primary.main' }}>
                <HardDrive size={24} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.3, textTransform: 'uppercase' }}>
                  Gateway Inventory
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: '0.15em', opacity: 0.5 }}>
                  Registered IoT infrastructure
                </Typography>
              </Box>
            </Box>
            <TextField
              size="small"
              placeholder="Search by ID, name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} style={{ opacity: 0.5 }} />
                    </InputAdornment>
                  ),
                }
              }}
              sx={{ minWidth: 280, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
            />
          </Box>

          <Box component={motion.div} variants={containerStagger} initial="hidden" animate="show" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 2.5 }}>
            {registered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).length === 0 ? (
              <Box sx={(t) => ({ gridColumn: '1 / -1', py: 12, textAlign: 'center', borderRadius: '16px', bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff', border: 'none' })}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
                  <Search size={24} style={{ opacity: 0.3 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: '0.15em', opacity: 0.5 }}>
                  {searchQuery ? 'No results for this search.' : 'No registered devices. Use the scanner to link hardware.'}
                </Typography>
              </Box>
            ) : (
              registered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((device, i) => {
                const isOnline = device.status?.toLowerCase() === 'online';
                const isOffline = device.status?.toLowerCase() === 'offline';
                const isWarning = device.status?.toLowerCase() === 'warning';
                const linkedPoint = mapPoints.find(p => p.id === device.map_point_id);
                const signal = getSignalBars(device.signal_strength);
                const bat = device.battery_level;
                const connectedNodes = devices.filter(d => 
                  d.registered &&
                  d.type?.toLowerCase() !== 'gateway' &&
                  d.gateway_id?.toLowerCase() === device.device_id.toLowerCase()
                );
                const devicesAtLocation = connectedNodes.length;

                return (
                  <motion.div
                    key={device.device_id}
                    variants={fadeSlideUp}
                  >
                    <Card sx={(t) => ({
                      borderRadius: '16px',
                      bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
                      border: 'none',
                      boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
                      overflow: 'hidden',
                      position: 'relative',
                      transition: '0.3s',
                      '&:hover': { transform: 'translateY(-2px)' },
                    })}>
                      <Box sx={{
                        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
                        borderRadius: '50%',
                        bgcolor: isOnline ? 'rgba(138,180,248,0.04)' : isWarning ? 'rgba(251,191,36,0.04)' : 'rgba(100,116,139,0.04)',
                        filter: 'blur(60px)',
                      }} />

                      <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{
                              color: isOnline ? 'success.main' : isWarning ? 'warning.main' : 'text.disabled',
                              display: 'flex', alignItems: 'center',
                            }}>
                              {device.type?.toLowerCase() === 'gateway' ? <Router size={22} /> : <Cpu size={22} />}
                            </Box>
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                                {device.name && device.name.trim() !== "" ? device.name : (device.type?.toLowerCase() === 'gateway' ? 'Concentrador LoRa' : 'Sensor IoT')}
                              </Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'text.secondary', opacity: 0.7, letterSpacing: '0.05em' }}>
                                {device.device_id}
                              </Typography>
                            </Box>
                          </Box>
                          <IconButton
                            onClick={(e) => handleMenuOpen(e, device)}
                            size="small"
                            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'rgba(45,212,191,0.08)' } }}
                          >
                            <MoreVertical size={18} />
                          </IconButton>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                          <Box sx={{
                            width: 10, height: 10, borderRadius: '50%',
                            bgcolor: isOnline ? 'success.main' : isOffline ? '#64748b' : 'warning.main',
                            boxShadow: isOnline
                              ? '0 0 12px rgba(52,211,153,0.6)'
                              : isWarning
                                ? '0 0 12px rgba(251,191,36,0.6)'
                                : '0 0 6px rgba(100,116,139,0.3)',
                            animation: isOnline ? 'pulse 2s infinite' : 'none',
                          }} />
                          <Typography variant="body2" sx={{ fontWeight: 900, textTransform: 'capitalize' }}>
                            {device.status}
                          </Typography>
                          <Typography variant="caption" sx={{ ml: 'auto', fontFamily: 'monospace', fontSize: '0.6rem', color: 'text.secondary', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Clock size={10} /> {getRelativeTime(device.last_seen)}
                          </Typography>
                        </Box>

                        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.2)', mb: 2.5 }}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', opacity: 0.5, fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                                Network ID
                              </Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'primary.main', fontWeight: 700, display: 'block' }}>
                                {device.mac_address || device.device_id}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', opacity: 0.5, fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                                Connected Devices
                              </Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', opacity: 0.6 }} />
                                {devicesAtLocation}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', opacity: 0.5, fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                              Signal
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.2, height: 14 }}>
                                {[1, 2, 3, 4].map(bar => (
                                  <Box key={bar} sx={{
                                    width: 3, borderRadius: '1px 1px 0 0', transition: '0.3s',
                                    height: `${bar * 25}%`,
                                    bgcolor: bar <= signal.bars ? signal.color : 'rgba(255,255,255,0.06)',
                                  }} />
                                ))}
                              </Box>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary' }}>
                                {device.signal_strength ?? '--'} dBm
                              </Typography>
                            </Box>
                          </Box>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', opacity: 0.5, fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1, display: 'block' }}>
                              Battery
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ flex: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={bat || 0}
                                  color={bat > 70 ? 'success' : bat > 20 ? 'warning' : 'error'}
                                  sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)' }}
                                />
                              </Box>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.6rem', fontWeight: 700 }}>
                                {bat || 0}%
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                       {/* Connected Nodes List Chips */}
                       {connectedNodes.length > 0 && (
                         <Box sx={{ mt: 2.5, mb: 1.5 }}>
                           <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', opacity: 0.5, fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                             Nodos Enlazados ({connectedNodes.length})
                           </Typography>
                           <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                             {connectedNodes.map(node => {
                               const isNodeOnline = node.status?.toLowerCase() === 'online';
                               return (
                                 <Chip
                                   key={node.device_id}
                                   label={node.device_id}
                                   size="small"
                                   onClick={() => navigate(`/analisis?device=${node.device_id}`)}
                                   sx={{
                                     fontSize: 9.5,
                                     fontWeight: 800,
                                     cursor: 'pointer',
                                     bgcolor: isNodeOnline ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                                     color: isNodeOnline ? '#22c55e' : 'text.secondary',
                                     border: 'none',
                                     transition: 'all 0.2s',
                                     '&:hover': {
                                       bgcolor: isNodeOnline ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                                     }
                                   }}
                                 />
                               );
                             })}
                           </Box>
                         </Box>
                       )}

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 0.5 }}>
                          {linkedPoint ? (
                            <Button
                              size="small"
                              onClick={() => navigate(`/mapa?lat=${linkedPoint.latitude}&lng=${linkedPoint.longitude}&zoom=17`)}
                              startIcon={<MapIcon size={12} />}
                              sx={{ textTransform: 'uppercase', fontWeight: 900, fontSize: '0.6rem', letterSpacing: '0.1em', gap: 0.5, color: 'primary.main', minWidth: 0, border: 'none' }}
                            >
                              {linkedPoint.name}
                            </Button>
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em', opacity: 0.4, fontStyle: 'italic', fontSize: '0.6rem' }}>
                              Sin vincular
                            </Typography>
                          )}
                          <Chip
                            label={device.type || 'Infrastructure'}
                            size="small"
                            sx={{
                              ml: 'auto',
                              fontFamily: 'monospace', fontWeight: 900, fontSize: '0.55rem',
                              letterSpacing: '0.1em', bgcolor: 'rgba(138,180,248,0.08)',
                              color: 'primary.main', height: 20,
                              border: 'none'
                            }}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <TablePagination
              component="div"
              count={registered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
              labelRowsPerPage="Filas por página"
            />
          </Box>
        </Box>
      </Box>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 200, mt: 1 } } }}
      >
        <MuiMenuItem onClick={() => { if (selectedDevice) navigate(`/analisis?device=${selectedDevice.device_id}`); handleMenuClose(); }}>
          <ListItemIcon><LineChart size={16} /></ListItemIcon>
          <ListItemText>Historial Métricas</ListItemText>
        </MuiMenuItem>
        <MuiMenuItem onClick={() => {
          if (selectedDevice) {
            setFormData({
              device_id: selectedDevice.device_id,
              name: selectedDevice.name,
              type: selectedDevice.type,
              map_point_id: selectedDevice.map_point_id?.toString() || ''
            });
            setShowRegisterModal(true);
          }
          handleMenuClose();
        }}>
          <ListItemIcon><Cpu size={16} /></ListItemIcon>
          <ListItemText>Configuración HW</ListItemText>
        </MuiMenuItem>
        <Box sx={{ height: 1, bgcolor: 'divider', mx: 2, my: 0.5 }} />
        <MuiMenuItem onClick={async () => {
          if (selectedDevice && window.confirm('¿Eliminar definitivamente este registro?')) {
            try { await deviceService.deleteDevice(selectedDevice.device_id); loadDevices(); }
            catch { alert('Error al eliminar'); }
          }
          handleMenuClose();
        }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Trash2 size={16} color="#fb7185" /></ListItemIcon>
          <ListItemText>Baja del Sistema</ListItemText>
        </MuiMenuItem>
      </Menu>

      {/* Register Dialog */}
      <Dialog open={showRegisterModal} onClose={() => setShowRegisterModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: -0.3, textTransform: 'uppercase' }}>
                Vincular Hardware
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: '0.15em', opacity: 0.6 }}>
                Configuración de nodo LoRa P2P
              </Typography>
            </Box>
            <IconButton onClick={() => setShowRegisterModal(false)} size="small" sx={{ color: 'text.secondary' }}>
              <X size={20} />
            </IconButton>
          </Box>
        </DialogTitle>
        <form onSubmit={handleRegister}>
          <DialogContent sx={{ pt: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Identificador EUI"
                required
                value={formData.device_id}
                onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                placeholder="HEX Identifier"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><Cpu size={18} style={{ opacity: 0.5 }} /></InputAdornment>,
                  }
                }}
                sx={{ '& input': { fontFamily: 'monospace' } }}
              />
              <TextField
                label="Alias del Dispositivo"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre descriptivo"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><HardDrive size={18} style={{ opacity: 0.5 }} /></InputAdornment>,
                  }
                }}
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel id="type-label">Tipo</InputLabel>
                  <Select
                    labelId="type-label"
                    value={formData.type}
                    label="Tipo"
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <MenuItem value="node">IoT Node</MenuItem>
                    <MenuItem value="gateway">Base Station</MenuItem>
                    <MenuItem value="repeater">Repeater</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="location-label">Ubicación</InputLabel>
                  <Select
                    labelId="location-label"
                    value={formData.map_point_id}
                    label="Ubicación"
                    onChange={(e) => setFormData({ ...formData, map_point_id: e.target.value })}
                  >
                    <MenuItem value="">Sin vincular</MenuItem>
                    {mapPoints.map(point => (
                      <MenuItem key={point.id} value={point.id}>{point.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={() => setShowRegisterModal(false)} color="inherit" fullWidth>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" color="primary" fullWidth                         sx={{}}>
              Finalizar Registro
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};

export default Gateways;
