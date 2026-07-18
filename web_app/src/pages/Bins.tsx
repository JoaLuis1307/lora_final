import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Download, MapPin, Battery, AlertTriangle, 
  Clock, Activity, Gauge, Navigation, 
  ShieldAlert, Edit, X, BarChart3, Router, Cpu, Plus, LayoutGrid, List
} from 'lucide-react';
import { deviceService, Device } from '../services/deviceService';
import { mapService } from '../services/mapService';
import { getWsUrl } from '../services/config';
import { calculateFillPercentage } from '../utils/fillCalculator';
import {
  Box, Paper, Typography, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Select, MenuItem, FormControl, InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup, CircularProgress
} from '@mui/material';

const defaultBins: any[] = [];

const getFillColor = (fill: number) => {
  if (fill >= 90) return '#d93025'; // Google Red
  if (fill >= 75) return '#f59e0b'; // Google Orange
  if (fill >= 30) return '#eab308'; // Yellow
  return '#188038'; // Google Green
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
  border: 'none',
  borderRadius: '16px',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
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
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

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
    { label: 'Total Contenedores', value: totalBinsCount, icon: <Trash2 size={20} />, sub: 'Registrados en red' },
    { label: 'Carga Media', value: `${averageFill}%`, icon: <Gauge size={20} />, sub: 'Nivel medio general' },
    { label: 'Alertas Críticas', value: criticalCount, icon: <AlertTriangle size={20} />, sub: 'Requieren recolección' },
    { label: 'Batería Crítica', value: lowBatteryCount, icon: <Battery size={20} />, sub: 'Batería menor a 20%' },
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
      
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.02em', color: 'text.primary' }}>
            Gestión de Contenedores
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 550, mt: 0.5, opacity: 0.8 }}>
            Monitoreo, estado físico y capacidad de carga de dispositivos LoRa P2P.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {editMode && (
            <Button 
              variant="contained" 
              onClick={() => {
                setIsCreateMode(true);
                setEditBinData({ id: '', name: '', location: '', lat: -16.3888, lng: -71.5415 });
                setEditBinModalOpen(true);
              }}
              startIcon={<Plus size={16} />}
              sx={{ fontSize: 11.5, fontWeight: 800, borderRadius: '24px', px: 2.5 }}
            >
              Añadir Contenedor
            </Button>
          )}
          <Button 
            variant={editMode ? "contained" : "outlined"}
            color={editMode ? "error" : "inherit"}
            onClick={() => setEditMode(!editMode)}
            sx={{ fontSize: 11.5, fontWeight: 800, borderRadius: '24px', px: 2.5 }}
          >
            {editMode ? "Guardar cambios" : "Editar Recursos"}
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
                px: 1.75, py: 0.5,
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  color: 'text.primary'
                }
              }
            }}
          >
            <ToggleButton value="table"><List size={15} /></ToggleButton>
            <ToggleButton value="grid"><LayoutGrid size={15} /></ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* KPI Stats Row - Google Analytics / M3 Style */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 3 }}>
        {liveKpis.map((kpi, i) => (
          <Paper key={i} sx={(t) => ({
            ...googleCardSx(t),
            p: 2.5,
            borderLeft: `4px solid ${i === 2 && criticalCount > 0 ? '#d93025' : (i === 3 && lowBatteryCount > 0 ? '#f59e0b' : '#1a73e8')}`
          })}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', fontSize: 10 }}>
                  {kpi.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: 'text.primary', mt: 0.75 }}>
                  {kpi.value}
                </Typography>
              </Box>
              <Box sx={{ opacity: 0.4, color: 'text.secondary' }}>
                {kpi.icon}
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Main Content: Table/Grid + Alerts Sidebar */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: showSidebar ? { xs: '1fr', xl: '1fr 340px' } : '1fr', 
        gap: 4 
      }}>
        {/* Table/Grid Container */}
        <Box sx={{ minWidth: 0 }}>
          
          {/* Section title & Filters */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Activity size={15} /> Inventario de Contenedores
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={filterType}
                  onChange={(e: any) => setFilterType(e.target.value)}
                  sx={{ 
                    fontSize: 10.5, 
                    fontWeight: 800, 
                    borderRadius: '24px',
                    height: 32,
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                  }}
                >
                  <MenuItem value="all">TODOS LOS NODOS</MenuItem>
                  <MenuItem value="real">HARDWARE REAL</MenuItem>
                  <MenuItem value="simulated">SIMULADOS</MenuItem>
                  <MenuItem value="independent">INDEPENDIENTES</MenuItem>
                </Select>
              </FormControl>
              
              <Chip 
                label={`${filteredBins.length} activos`} 
                size="small" 
                sx={{ fontWeight: 800, fontSize: 10, borderRadius: '6px', border: 'none' }} 
              />
            </Box>
          </Box>

          {loading && filteredBins.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
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
            /* Grid View (Clean dynamic card layout without cartoonish PNGs) */
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: showSidebar ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                xl: showSidebar ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
              }, 
              gap: 2.5 
            }}>
              {filteredBins.map(bin => {
                const isSync = devices.some(d => d.device_id.toLowerCase() === bin.id.toLowerCase() && d.registered !== false);
                const gw = devices.find(d => d.device_id.toLowerCase() === bin.gateway_id?.toLowerCase() && d.type?.toLowerCase() === 'gateway');
                const gwName = gw ? gw.name : (bin.gateway_id === 'gateway_01' ? 'Gateway Real' : (bin.gateway_id === 'gateway_02' ? 'Gateway Virtual' : 'Sin Gateway'));

                return (
                  <Paper key={bin.id} sx={(t) => ({ 
                    ...googleCardSx(t), 
                    p: 2.5, 
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 250,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { 
                      borderColor: 'text.secondary',
                    } 
                  })}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* Name & Address */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15.5, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bin.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <MapPin size={11} style={{ flexShrink: 0 }} />
                          <Typography variant="caption" sx={{ fontWeight: 550, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bin.location}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Status Badges */}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: isSync ? 'rgba(24,128,56,0.08)' : 'rgba(217,48,37,0.08)', px: 1, py: 0.25, borderRadius: '4px' }}>
                          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: isSync ? '#188038' : '#d93025' }} />
                          <Typography sx={{ fontSize: 8.5, fontWeight: 800, color: isSync ? '#188038' : '#d93025', textTransform: 'uppercase' }}>
                            {isSync ? 'SINCRONIZADO' : 'PENDIENTE'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'action.hover', px: 1, py: 0.25, borderRadius: '4px', color: 'text.secondary' }}>
                          <Router size={9} />
                          <Typography sx={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase' }}>
                            {gwName}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Capacity progress */}
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 9.5, color: 'text.secondary', textTransform: 'uppercase' }}>Capacidad</Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: 18, fontFamily: 'monospace', color: getFillColor(bin.fill) }}>{bin.fill}%</Typography>
                        </Box>
                        <Box sx={{ height: 6, bgcolor: 'action.hover', borderRadius: 100, overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${bin.fill}%`, bgcolor: getFillColor(bin.fill), borderRadius: 100 }} />
                        </Box>
                      </Box>

                      {/* Grid parameters */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 8.5, color: 'text.secondary', display: 'block', mb: 0.25 }}>NODO EUI</Typography>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{bin.id}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 8.5, color: 'text.secondary', display: 'block', mb: 0.25 }}>SENSOR IR</Typography>
                          <Typography sx={{ fontSize: 11, fontWeight: 800, color: bin.ir ? 'error.main' : 'success.main', fontFamily: 'monospace' }}>
                            {bin.ir ? 'OBSTRUIDO' : 'LIBRE'}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Secondary row */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px dashed', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Battery size={13} color={bin.battery < 20 ? '#d93025' : '#188038'} />
                          <Typography variant="caption" sx={{ fontWeight: 750, color: bin.battery < 20 ? 'error.main' : 'text.primary', fontSize: 10.5 }}>
                            {bin.battery}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <Clock size={11} />
                          <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600 }}>{bin.lastUpdate}</Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Button size="small" variant="outlined" onClick={() => navigate(`/stats?device=${bin.id}`)} sx={{ flex: 1, borderRadius: '24px', textTransform: 'none', fontWeight: 800 }}>Historial</Button>
                      <Button size="small" variant="text" onClick={() => navigate(`/mapa?lat=${bin.lat}&lng=${bin.lng}&zoom=17.5`)} sx={{ flex: 1, borderRadius: '24px', textTransform: 'none', fontWeight: 800 }}>Mapa</Button>
                      {editMode && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => {
                            setIsCreateMode(false);
                            setEditBinData({ id: bin.id, name: bin.name, location: bin.location, lat: bin.lat, lng: bin.lng });
                            setEditBinModalOpen(true);
                          }}><Edit size={14} /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteBin(bin.id)}><Trash2 size={14} /></IconButton>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Alerts & Sidebar */}
        {showSidebar && (
          <Box sx={{ flexShrink: 0 }}>
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
          </Box>
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
