import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { deviceService, Device } from '../services/deviceService';
import { mapService, MapPoint } from '../services/mapService';
import { getWsUrl } from '../services/config';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Chip, Menu, MenuItem, ListItemIcon, ListItemText, IconButton, InputBase,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, FormControl, InputLabel
} from '@mui/material';
import {
  Wifi, Battery, Cpu, Router, MoreVertical, LineChart, Activity,
  Search, Clock, Thermometer, Droplets, Smartphone, WifiOff, TriangleAlert, Zap, Trash2, Pen,
  MapPin, Layers, Radio, Wind, Plus, X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { containerStagger, fadeSlideUp } from '../shared/animations';
const StyledDialog = Dialog as any;
const StyledTextField = TextField as any;
const googlePaper = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  borderRadius: '16px',
  border: 'none',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
});
const glassPaper = googlePaper;



const formatLastSeen = (dateStr: string | null) => {
  if (!dateStr) return '---';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
};

const getBatteryColorHex = (level: number) => {
  if (level > 70) return '#81c995';
  if (level > 20) return '#fdd663';
  return '#f28b82';
};

const getStatusBadge = (device: Device) => {
  if (device.registered === false) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.75, 
        bgcolor: 'rgba(253,214,99,0.1)', 
        px: 1, 
        py: 0.25, 
        borderRadius: '4px', 
        border: 'none'
      }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'warning.main', textTransform: 'uppercase' }}>No Registrado</Typography>
      </Box>
    );
  }
  const statusLower = device.status?.toLowerCase() || 'offline';
  const config: Record<string, { dot: string; label: string; color: string; bg: string }> = {
    online: { dot: 'success.main', label: 'En línea', color: 'success.main', bg: 'rgba(129,201,149,0.1)' },
    offline: { dot: 'text.secondary', label: 'Fuera de línea', color: 'text.secondary', bg: 'rgba(255,255,255,0.03)' },
    warning: { dot: 'warning.main', label: 'Advertencia', color: 'warning.main', bg: 'rgba(253,214,99,0.1)' },
    alert: { dot: 'error.main', label: 'Alerta', color: 'error.main', bg: 'rgba(242,139,130,0.1)' },
  };
  const c = config[statusLower] || { dot: 'text.secondary', label: device.status, color: 'text.secondary', bg: 'rgba(255,255,255,0.03)' };
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 0.75, 
      bgcolor: c.bg, 
      px: 1, 
      py: 0.25, 
      borderRadius: '4px', 
      border: 'none'
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: 'uppercase' }}>{c.label}</Typography>
    </Box>
  );
};

const Devices: React.FC = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Dialog State
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDeviceData, setSelectedDeviceData] = useState<Partial<Device>>({
    device_id: '',
    name: '',
    type: 'Nodo Sensor',
    latitude: -16.3988,
    longitude: -71.5368,
    mac_address: '',
    gateway_id: '',
    map_point_id: undefined,
    registered: true
  });

  // Delete Confirm State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Discovery Scan State
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<Partial<Device>[]>([]);
  const [scanning, setScanning] = useState(false);
  const [isDiscoveryRegistration, setIsDiscoveryRegistration] = useState(false);

  const handleScanDevices = async () => {
    setScanning(true);
    setDiscoverDialogOpen(true);
    try {
      const data = await deviceService.getDiscoveredDevices();
      setDiscoveredDevices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setScanning(false);
      }, 1200);
    }
  };

  const handleOpenAddDialog = () => {
    setIsDiscoveryRegistration(false);
    setIsEditMode(false);
    setSelectedDeviceData({
      device_id: '',
      name: '',
      type: 'Nodo Sensor',
      latitude: -16.3988,
      longitude: -71.5368,
      mac_address: '',
      gateway_id: devices.find(d => d.type?.toLowerCase() === 'gateway')?.device_id || '',
      map_point_id: undefined,
      registered: true
    });
    setDeviceDialogOpen(true);
  };

  const handleOpenEditDialog = () => {
    const dev = devices.find(d => d.device_id === selectedDevice);
    if (dev) {
      setIsDiscoveryRegistration(false);
      setIsEditMode(true);
      setSelectedDeviceData({
        device_id: dev.device_id,
        name: dev.name,
        type: dev.type,
        latitude: dev.latitude,
        longitude: dev.longitude,
        mac_address: dev.mac_address || '',
        gateway_id: dev.gateway_id || '',
        map_point_id: dev.map_point_id || undefined,
        registered: dev.registered ?? true
      });
      setDeviceDialogOpen(true);
    }
    setAnchorEl(null);
  };

  const handleOpenRegisterDialog = (dev: Device) => {
    setIsDiscoveryRegistration(true);
    setIsEditMode(false);
    setSelectedDeviceData({
      device_id: dev.device_id,
      name: dev.name || `Contenedor ${dev.device_id.toUpperCase()}`,
      type: dev.type || 'Nodo Sensor',
      latitude: dev.latitude || -16.3988,
      longitude: dev.longitude || -71.5368,
      mac_address: dev.mac_address || '',
      gateway_id: dev.gateway_id || devices.find(d => d.type?.toLowerCase() === 'gateway')?.device_id || '',
      map_point_id: dev.map_point_id || undefined,
      registered: false
    });
    setDeviceDialogOpen(true);
  };

  const handleOpenDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
    setAnchorEl(null);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        // Update device in DB
        const updated = await deviceService.updateDevice(selectedDeviceData.device_id!, {
          name: selectedDeviceData.name,
          type: selectedDeviceData.type,
          latitude: Number(selectedDeviceData.latitude),
          longitude: Number(selectedDeviceData.longitude),
          mac_address: selectedDeviceData.mac_address,
          gateway_id: selectedDeviceData.type === 'Gateway' ? null : selectedDeviceData.gateway_id,
          map_point_id: selectedDeviceData.type === 'Gateway' ? undefined : selectedDeviceData.map_point_id,
          registered: true
        });

        // Also update local state
        setDevices(prev => prev.map(d => d.device_id === updated.device_id ? updated : d));
      } else {
        // Register new device in DB
        const created = await deviceService.registerDevice({
          device_id: selectedDeviceData.device_id,
          name: selectedDeviceData.name,
          type: selectedDeviceData.type,
          latitude: Number(selectedDeviceData.latitude),
          longitude: Number(selectedDeviceData.longitude),
          mac_address: selectedDeviceData.mac_address,
          gateway_id: selectedDeviceData.type === 'Gateway' ? null : selectedDeviceData.gateway_id,
          map_point_id: selectedDeviceData.type === 'Gateway' ? undefined : selectedDeviceData.map_point_id,
          registered: true,
          status: 'Online',
          battery_level: 100,
          signal_strength: -50,
          last_seen: new Date().toISOString()
        });

        // Update local state
        setDevices(prev => [...prev.filter(d => d.device_id !== created.device_id), created]);
      }
      setDeviceDialogOpen(false);
      setSelectedDevice(null);
    } catch (err) {
      console.error(err);
      alert('Error al guardar el dispositivo');
    }
  };

  const handleDeleteDevice = async () => {
    if (!selectedDevice) return;
    try {
      await deviceService.deleteDevice(selectedDevice);
      setDevices(prev => prev.filter(d => d.device_id !== selectedDevice));
      setDeleteConfirmOpen(false);
      handleMenuClose();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el dispositivo');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [devicesData, telemetryData, pointsData] = await Promise.all([
          deviceService.getDevices(),
          deviceService.getLatestTelemetry(),
          mapService.getPoints().catch(() => [])
        ]);
        setDevices(devicesData);
        setTelemetry(telemetryData);
        setMapPoints(pointsData);
      } catch (err) {
        console.error('Error fetching devices:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Setup live WebSocket listener for real-time updates
    const wsUrl = getWsUrl();
    let socket: WebSocket;
    let reconnectTimer: any;

    function connectWS() {
      console.log('[DEVICES WEBSOCKET] Conectando a:', wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[DEVICES WEBSOCKET] Conectado para recibir telemetría viva y actualizaciones de red.');
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          // 1. Live Telemetry Packet Event (battery, rssi, snr, temp, hum)
          if (parsed.event === 'telemetry' && parsed.device_id && parsed.data) {
            console.log('[DEVICES WEBSOCKET] Telemetría viva recibida:', parsed.device_id, parsed.data);
            
            setTelemetry(prev => ({
              ...prev,
              [parsed.device_id]: parsed.data
            }));
            
            setDevices(prev => prev.map(d => {
              if (d.device_id === parsed.device_id) {
                const bat = parsed.data.battery ?? parsed.data.bateria ?? parsed.data.batt ?? parsed.data.bat;
                const rssi = parsed.data.rssi;
                return { 
                  ...d, 
                  status: 'online', // Telemetry arrival signifies active/online state
                  battery_level: bat !== undefined ? bat : d.battery_level,
                  signal_strength: rssi !== undefined ? rssi : d.signal_strength,
                  last_seen: new Date().toISOString()
                };
              }
              return d;
            }));
          }
          
          // 2. Real-Time API Device Update Event (battery, signal, status)
          else if (parsed.event === 'device_update' && parsed.device_id && parsed.data) {
            console.log('[DEVICES WEBSOCKET] Actualización de dispositivo en tiempo real:', parsed.device_id, parsed.data);
            
            setDevices(prev => prev.map(d => {
              if (d.device_id === parsed.device_id) {
                return { 
                  ...d, 
                  ...parsed.data,
                  last_seen: parsed.data.last_seen || d.last_seen
                };
              }
              return d;
            }));
          }
          
          // 3. Real-Time API Device Registration Event
          else if (parsed.event === 'device_register' && parsed.device_id && parsed.data) {
            console.log('[DEVICES WEBSOCKET] Nuevo dispositivo registrado en tiempo real:', parsed.device_id, parsed.data);
            
            setDevices(prev => {
              if (prev.some(d => d.device_id === parsed.device_id)) return prev;
              return [...prev, parsed.data];
            });
          }
          
          // 4. Real-Time API Device Discovery Event
          else if (parsed.event === 'device_discovered' && parsed.device_id && parsed.data) {
            console.log('[DEVICES WEBSOCKET] Nuevo dispositivo descubierto en tiempo real:', parsed.device_id, parsed.data);
            
            setDiscoveredDevices(prev => {
              if (prev.some(d => d.device_id?.toLowerCase() === parsed.device_id.toLowerCase())) return prev;
              return [...prev, parsed.data];
            });
          }
        } catch (err) {
          console.error('[DEVICES WEBSOCKET] Error procesando mensaje de red en tiempo real:', err);
        }
      };

      socket.onclose = () => {
        console.warn('[DEVICES WEBSOCKET] Conexión de red cerrada. Reintentando en 3s...');
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      socket.onerror = (err) => {
        console.error('[DEVICES WEBSOCKET] Error de red:', err);
        socket.close();
      };
    }

    connectWS();

    // Polling interval as robust fallback
    const interval = setInterval(fetchData, 4000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);


  if (loading && devices.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </Box>
    );
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, deviceId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedDevice(deviceId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDevice(null);
  };


  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.status?.toLowerCase() === 'online').length;
  const offlineDevices = devices.filter(d => d.status?.toLowerCase() !== 'online').length;
  const alertDevices = devices.filter(d => {
    const t = telemetry[d.device_id] || {};
    const isFull = t.is_full === 1 || t.status_text === 'FULL';
    return isFull || d.status?.toLowerCase() === 'warning' || d.status?.toLowerCase() === 'alert';
  }).length;

  const filteredDevices = devices.filter(device => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (
      device.device_id.toLowerCase().includes(q) ||
      (device.name && device.name.toLowerCase().includes(q)) ||
      (device.type && device.type.toLowerCase().includes(q)) ||
      (device.mac_address && device.mac_address.toLowerCase().includes(q))
    );
    let matchesFilter = true;
    if (filterType === 'gateway') {
      matchesFilter = device.type?.toLowerCase() === 'gateway';
    } else if (filterType === 'node') {
      matchesFilter = device.type?.toLowerCase() !== 'gateway';
    } else if (filterType !== 'all') {
      matchesFilter = device.type?.toLowerCase() !== 'gateway' && 
                      device.gateway_id?.toLowerCase() === filterType.toLowerCase();
    }
    return matchesSearch && matchesFilter;
  });

  const stats = [
    { label: 'Total Dispositivos', value: totalDevices, icon: <Cpu size={18} /> },
    { label: 'En Línea', value: onlineDevices, icon: <Activity size={18} /> },
    { label: 'Fuera de Línea', value: offlineDevices, icon: <WifiOff size={18} /> },
    { label: 'Alertas', value: alertDevices, icon: <TriangleAlert size={18} /> },
  ];

  const countAll = devices.length;
  const countGateways = devices.filter(d => d.type?.toLowerCase() === 'gateway').length;
  const countAllNodes = devices.filter(d => d.type?.toLowerCase() !== 'gateway').length;

  const dynamicGatewayTabs = devices
    .filter(d => d.type?.toLowerCase() === 'gateway' && d.registered)
    .map((gw, idx) => {
      const isG1 = gw.device_id.toLowerCase() === 'gateway_01';
      const isG2 = gw.device_id.toLowerCase() === 'gateway_02';
      const count = devices.filter(d => d.type?.toLowerCase() !== 'gateway' && d.gateway_id?.toLowerCase() === gw.device_id.toLowerCase()).length;
      
      let color = 'primary.main';
      let icon = <Cpu size={18} />;
      let desc = `Nodos de pasarela ${gw.device_id.toUpperCase()}`;
      let glow = '';
      
      if (isG1) {
        color = 'primary.main';
        icon = <Cpu size={18} />;
        desc = 'Hardware real - Yanahuara';
      } else if (isG2) {
        color = 'primary.main';
        icon = <Activity size={18} />;
        desc = 'Red Virtual (Python)';
      } else {
        color = 'primary.main';
      }
      
      return {
        value: gw.device_id,
        label: isG1 ? 'Nodos G1 (Físicos)' : isG2 ? 'Nodos G2 (Virtuales)' : `Nodos ${gw.device_id.toUpperCase()}`,
        count,
        color,
        icon,
        desc,
        glow
      };
    });

  const tabOptions = [
    { 
      value: 'all', 
      label: 'Toda la Red', 
      count: countAll, 
      color: 'primary.main', 
      icon: <Layers size={18} />, 
      desc: 'Infraestructura total',
    },
    { 
      value: 'gateway', 
      label: 'Gateways', 
      count: countGateways, 
      color: 'primary.main', 
      icon: <Router size={18} />, 
      desc: 'Concentradores base',
    },
    ...dynamicGatewayTabs,
    { 
      value: 'node', 
      label: 'Todos los Nodos', 
      count: countAllNodes, 
      color: 'primary.main', 
      icon: <Smartphone size={18} />, 
      desc: 'Buzones sensores',
    }
  ];

  const currentActiveTab = tabOptions.find(opt => opt.value === filterType);

  const renderDeviceCard = (device: Device) => {
    const deviceTelemetry = telemetry[device.device_id] || {};
    const bat = deviceTelemetry.battery ?? deviceTelemetry.bateria ?? deviceTelemetry.batt ?? deviceTelemetry.bat;
    const temp = deviceTelemetry.temperature ?? deviceTelemetry.temperatura ?? deviceTelemetry.temp;
    const hum = deviceTelemetry.humidity ?? deviceTelemetry.humedad ?? deviceTelemetry.hum;
    const currentRssi = deviceTelemetry.rssi !== undefined ? deviceTelemetry.rssi : device.signal_strength;
    const currentBattery = bat !== undefined ? bat : device.battery_level;
    const signalColor = !currentRssi || currentRssi === 0 ? 'rgba(255,255,255,0.1)' : currentRssi > -60 ? '#22c55e' : currentRssi > -80 ? '#f59e0b' : '#ef4444';
    const deviceTypeLabel = device.type?.toLowerCase() === 'gateway' ? 'Gateway' : 'Sensor Node';
    const linkedPoint = mapPoints.find(p => p.id === device.map_point_id);
    const locationName = linkedPoint ? linkedPoint.name : 'Sin Ubicación';
    const isGateway = device.type?.toLowerCase() === 'gateway';
    const connectedGateway = !isGateway && device.gateway_id 
      ? devices.find(d => d.device_id === device.gateway_id) 
      : null;
    const gatewayName = connectedGateway 
      ? connectedGateway.name 
      : (device.gateway_id ? device.gateway_id.toUpperCase() : 'Ninguno');

    return (
      <Box
        key={device.id}
        sx={{ display: 'flex', flex: 1 }}
      >
        <Paper sx={(t) => ({ 
          bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
          border: 'none',
          borderRadius: '16px',
          boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
          p: 2.5, 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 275,
          position: 'relative',
          transition: 'background-color 0.25s ease-in-out',
          '&:hover': { 
            bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.8)' : '#f8fafd',
          } 
        })}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {/* 1. Header Row (Classification & EUI) */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: '6px',
                  bgcolor: (t) => isGateway ? (t.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.08)' : 'rgba(26, 115, 232, 0.08)') : (t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                  color: isGateway ? 'primary.main' : 'text.secondary',
                }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: isGateway ? 'primary.main' : 'text.secondary' }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 8.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {deviceTypeLabel}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 9.5, fontWeight: 700, color: 'text.secondary', opacity: 0.6, letterSpacing: '0.05em' }}>
                  EUI: {device.device_id}
                </Typography>
              </Box>
              
              {getStatusBadge(device)}
            </Box>

            {/* 2. Main Split Content (Bins.tsx style) */}
            <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'stretch' }}>
              
              {/* Left Side: Parameters & Data */}
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {/* Name and Location */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.25, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={device.name}>
                    {device.name && device.name.trim() !== '' ? device.name : (isGateway ? 'Gateway Concentrador' : 'Nodo LoRa P2P')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.6 }}>
                    <MapPin size={11} style={{ flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {locationName}
                    </Typography>
                  </Box>
                </Box>

                {/* Battery progress gauge (mirrors Llenado gauge in Bins.tsx) */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 22, fontFamily: 'monospace', color: getBatteryColorHex(currentBattery || 0), lineHeight: 1 }}>
                      {currentBattery || 0}%
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.03em', textTransform: 'uppercase', opacity: 0.5 }}>
                      Batería
                    </Typography>
                  </Box>

                  {/* Minimalist Progress Bar */}
                  <Box sx={{ height: 6, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                    <Box sx={{ 
                      height: '100%', 
                      borderRadius: '4px', 
                      bgcolor: getBatteryColorHex(currentBattery || 0), 
                      width: `${currentBattery || 0}%`, 
                      transition: 'width 0.6s ease-in-out',
                    }} />
                  </Box>
                               {/* 3. Sleek Industrial Parameters Grid */}
                {/* 3. Sleek Industrial Parameters Grid */}
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  mt: 1.5,
                  pt: 1.5,
                  borderTop: '1px solid',
                  borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
                }}>
                  {/* Row 1, Col 1: MAC */}
                  <Box sx={{ 
                    pr: 1.5, 
                    pb: 1.25, 
                    borderRight: '1px solid', 
                    borderBottom: '1px solid',
                    borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                      <Cpu size={11} style={{ opacity: 0.6, color: '#818cf8' }} />
                      <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                        Dirección MAC
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: 'text.primary', pl: 2 }}>
                      {device.mac_address ? device.mac_address.slice(-8).toUpperCase() : 'A1:B2:C3:D4'}
                    </Typography>
                  </Box>

                  {/* Row 1, Col 2: Frecuencia */}
                  <Box sx={{ 
                    pl: 1.5, 
                    pb: 1.25,
                    borderBottom: '1px solid',
                    borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                      <Radio size={11} style={{ opacity: 0.6, color: '#38bdf8' }} />
                      <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                        Frecuencia
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: 'text.primary', pl: 2 }}>
                      {isGateway ? '433.0 MHz' : '433.2 MHz'}
                    </Typography>
                  </Box>

                  {/* Row 2, Col 1: SNR */}
                  <Box sx={{ 
                    pr: 1.5, 
                    py: 1.25, 
                    borderRight: '1px solid', 
                    borderBottom: '1px solid',
                    borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                      <Zap size={11} style={{ opacity: 0.6, color: '#fbbf24' }} />
                      <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                        Ruido SNR (LoRa)
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: '#818cf8', pl: 2 }}>
                      +{deviceTelemetry.snr !== undefined ? Number(deviceTelemetry.snr).toFixed(1) : '8.5'} dB
                    </Typography>
                  </Box>

                  {/* Row 2, Col 2: Gateway / Logical Red */}
                  <Box sx={{ 
                    pl: 1.5, 
                    py: 1.25,
                    borderBottom: '1px solid',
                    borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                      <Router size={11} style={{ opacity: 0.6, color: '#60a5fa' }} />
                      <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                        {isGateway ? 'Red Lógica' : 'Gateway Vinculado'}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 800, textTransform: 'none', color: isGateway ? 'primary.main' : 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pl: 2 }} title={isGateway ? 'Estación Base' : gatewayName}>
                      {isGateway ? 'Estación Base' : gatewayName}
                    </Typography>
                  </Box>

                  {/* Row 3: Telemetry parameters */}
                  {isGateway ? (
                    <>
                      {/* Row 3, Col 1: Uptime */}
                      <Box sx={{ 
                        pr: 1.5, 
                        pt: 1.25, 
                        borderRight: '1px solid', 
                        borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Clock size={11} style={{ opacity: 0.7, color: '#34d399' }} />
                          <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                            Uptime Sistema
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: '#34d399', pl: 2 }}>
                          {deviceTelemetry.uptime !== undefined ? `${deviceTelemetry.uptime}s` : '---'}
                        </Typography>
                      </Box>

                      {/* Row 3, Col 2: Memory */}
                      <Box sx={{ pl: 1.5, pt: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Layers size={11} style={{ opacity: 0.7, color: '#a78bfa' }} />
                          <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                            Memoria Libre
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: '#a78bfa', pl: 2 }}>
                          {deviceTelemetry.heap !== undefined ? `${(deviceTelemetry.heap / 1024).toFixed(1)} KB` : '---'}
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      {/* Row 3, Col 1: Temp */}
                      <Box sx={{ 
                        pr: 1.5, 
                        pt: 1.25, 
                        borderRight: '1px solid', 
                        borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Thermometer size={11} style={{ opacity: 0.7, color: '#fb923c' }} />
                          <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                            Temperatura
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: '#fb923c', pl: 2 }}>
                          {temp !== undefined ? `${Number(temp).toFixed(1)} °C` : '--.- °C'}
                        </Typography>
                      </Box>

                      {/* Row 3, Col 2: Humedad */}
                      <Box sx={{ pl: 1.5, pt: 1.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                          <Droplets size={11} style={{ opacity: 0.7, color: '#38bdf8' }} />
                          <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                            Humedad
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'monospace', color: '#38bdf8', pl: 2 }}>
                          {hum !== undefined ? `${Number(hum).toFixed(0)} %` : '-- %'}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>        </Box>
              </Box>

              {/* Right Side: Clean Transparent Cabinet Image - Borderless & mirrors Contenedor in Bins.tsx */}
              <Box sx={{
                width: { xs: 80, sm: 95, md: 100 },
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <Box
                  component="img"
                  src="https://onemind.mx/wp-content/uploads/2022/06/gabinete-caja-iot-768x768.png"
                  alt="Gabinete IoT"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '90px',
                    objectFit: 'contain',
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': { 
                      transform: 'scale(1.05)',
                    }
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Bottom Info Row & Action Button (Unified Bins.tsx Style) */}
          <Box sx={{ mt: 2, pt: 1.25 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              {/* Battery status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: currentBattery < 20 ? 'rgba(239,68,68,0.08)' : 'transparent', px: 1, py: 0.25, borderRadius: '8px' }}>
                <Battery size={13} color={currentBattery < 20 ? '#EF5350' : undefined} style={{ opacity: currentBattery < 20 ? 1 : 0.6 }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: currentBattery < 20 ? '#EF5350' : 'text.secondary', fontSize: 10.5 }}>
                  {currentBattery}%
                </Typography>
              </Box>

              {/* Signal Status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Wifi size={12} color={signalColor} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: signalColor, textTransform: 'none', fontSize: 9.5 }}>
                  {currentRssi || '--'} dBm
                </Typography>
              </Box>
              
              {/* Last seen time */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Clock size={11} style={{ opacity: 0.4 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: 10 }}>
                  {formatLastSeen(device.last_seen)}
                </Typography>
              </Box>
            </Box>

            {/* Action buttons row */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              {device.registered === false ? (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleOpenRegisterDialog(device)}
                  sx={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'none',
                    borderRadius: '24px',
                    height: '32px',
                    bgcolor: 'warning.main',
                    color: 'warning.contrastText',
                    '&:hover': { bgcolor: 'warning.dark' }
                  }}
                >
                  <Plus size={14} style={{ marginRight: 6 }} /> Dar de Alta / Registrar
                </Button>
              ) : (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/analisis?device=${device.device_id}`)}
                    sx={{
                      flex: 1,
                      fontSize: 10.5, fontWeight: 700, textTransform: 'none',
                      borderColor: 'divider',
                      borderRadius: '24px', height: '32px',
                      color: 'text.primary',
                      bgcolor: 'transparent',
                      '&:hover': { borderColor: 'text.primary', bgcolor: 'text.primary', color: 'background.paper' }
                    }}
                  >
                    <LineChart size={12} style={{ marginRight: 6 }} /> Ver Análisis
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/mapa`)}
                    sx={{
                      flex: 1,
                      fontSize: 10.5, fontWeight: 700, textTransform: 'none',
                      borderColor: 'divider',
                      borderRadius: '24px', height: '32px',
                      color: 'primary.main',
                      bgcolor: 'transparent',
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.main', color: 'primary.contrastText' }
                    }}
                  >
                    <MapPin size={12} style={{ marginRight: 6 }} /> Ver en Mapa
                  </Button>
                </>
              )}
              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, device.device_id)}
                sx={{
                  width: '32px', height: '32px',
                  borderRadius: '24px',
                  border: 'none',
                  color: 'text.primary',
                  bgcolor: 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                }}
                title="Más Opciones"
              >
                <MoreVertical size={16} />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  };

  const renderGroupedTopology = () => {
    const allGateways = devices.filter(d => d.type?.toLowerCase() === 'gateway');
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {allGateways.map((gw) => {
          const nodesForGw = filteredDevices.filter(d => 
            d.type?.toLowerCase() !== 'gateway' && 
            d.gateway_id?.toLowerCase() === gw.device_id.toLowerCase()
          );
          
          const gwMatchesSearch = filteredDevices.some(d => d.device_id === gw.device_id);
          if (!gwMatchesSearch && nodesForGw.length === 0) return null;
          
          const isG1 = gw.device_id.toLowerCase() === 'gateway_01';
          const themeColor = isG1 ? '#0071c5' : '#5f6f81';
          const gwLabel = isG1 ? 'Gateway 01 - Principal (Hardware Real)' : 'Gateway 02 - Virtual (Python)';

          return (
            <Box 
              key={gw.device_id} 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2.5,
                p: 3,
                borderRadius: '16px',
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.005)',
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', md: 'row' }, 
                justifyContent: 'space-between', 
                alignItems: { md: 'center' }, 
                gap: 2,
                pb: 2,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: themeColor,
                  }}>
                    <Router size={24} />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: 16, color: 'text.primary' }}>
                        {gw.name}
                      </Typography>
                      {getStatusBadge(gw)}
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mt: 0.25, display: 'block' }}>
                      {gwLabel} • EUI: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{gw.device_id}</span>
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Box sx={{ px: 1.5, py: 0.5, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Cpu size={12} style={{ opacity: 0.6 }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      Nodos Enlazados: {nodesForGw.length}
                    </Typography>
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.5, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Wifi size={12} color={gw.status?.toLowerCase() === 'online' ? '#2dd4bf' : '#ef4444'} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      Señal: {gw.signal_strength} dBm
                    </Typography>
                  </Box>
                  <Box sx={{ px: 1.5, py: 0.5, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Clock size={12} style={{ opacity: 0.6 }} />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      Visto: {formatLastSeen(gw.last_seen)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {nodesForGw.length === 0 ? (
                <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.01)', borderRadius: '12px' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', opacity: 0.6 }}>
                    No hay nodos activos o que coincidan con la búsqueda para este gateway.
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} sx={{ 
                  boxShadow: 'none', 
                  bgcolor: 'transparent',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <Table size="small" sx={{
                    tableLayout: 'fixed',
                    width: '100%',
                    '& .MuiTableCell-root': {
                      borderBottom: (t) => t.palette.mode === 'dark' 
                        ? '1px solid rgba(255, 255, 255, 0.04)' 
                        : '1px solid rgba(0, 0, 0, 0.04)',
                    },
                    '& .MuiTableRow-root:last-child .MuiTableCell-root': {
                      borderBottom: 'none',
                    }
                  }}>
                    <TableHead sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                      <TableRow>
                        <TableCell sx={{ width: '18%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dispositivo (EUI)</TableCell>
                        <TableCell sx={{ width: '12%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</TableCell>
                        <TableCell sx={{ width: '12%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batería / Voltaje</TableCell>
                        <TableCell sx={{ width: '20%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telemetría Sensores</TableCell>
                        <TableCell sx={{ width: '14%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Radio (LoRa)</TableCell>
                        <TableCell sx={{ width: '10%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Último Reporte</TableCell>
                        <TableCell align="right" sx={{ width: '14%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {nodesForGw.map((device) => {
                        const deviceTelemetry = telemetry[device.device_id] || {};
                        const bat = deviceTelemetry.battery ?? deviceTelemetry.bateria ?? deviceTelemetry.batt ?? deviceTelemetry.bat;
                        const temp = deviceTelemetry.temperature ?? deviceTelemetry.temperatura ?? deviceTelemetry.temp;
                        const hum = deviceTelemetry.humidity ?? deviceTelemetry.humedad ?? deviceTelemetry.hum;
                        const aq = deviceTelemetry.air_quality ?? '--';
                        const currentRssi = deviceTelemetry.rssi !== undefined ? deviceTelemetry.rssi : device.signal_strength;
                        const currentBattery = bat !== undefined ? bat : device.battery_level;
                        const currentSnr = deviceTelemetry.snr !== undefined ? Number(deviceTelemetry.snr).toFixed(1) : '8.5';
                        const linkedPoint = mapPoints.find(p => p.id === device.map_point_id);
                        const locationName = linkedPoint ? linkedPoint.name : 'Sin Ubicación';

                        return (
                          <TableRow 
                            key={device.id} 
                            hover 
                          >
                            <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {device.name || 'Nodo Sensor'}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.6, mt: 0.25, overflow: 'hidden' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.device_id}</span>
                                  <span>•</span>
                                  <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {locationName}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>

                            <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getStatusBadge(device)}
                            </TableCell>

                            <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{ flexShrink: 0 }}>
                                  <Typography sx={{ fontWeight: 800, fontSize: 12, fontFamily: 'monospace', color: getBatteryColorHex(currentBattery) }}>
                                    {currentBattery}%
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontSize: 9.5, opacity: 0.5, fontWeight: 700, display: 'block' }}>
                                    {(currentBattery * 0.012 + 3.0).toFixed(2)} V
                                  </Typography>
                                </Box>
                                <Box sx={{ flexShrink: 0, height: 4, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: '2px', width: 35, overflow: 'hidden' }}>
                                  <Box sx={{ height: '100%', bgcolor: getBatteryColorHex(currentBattery), width: `${currentBattery}%` }} />
                                </Box>
                              </Box>
                            </TableCell>

                            <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'nowrap', overflow: 'hidden' }}>
                                {temp !== undefined && (
                                  <Chip 
                                    size="small"
                                    icon={<Thermometer size={10} style={{ color: '#fb923c' }} />} 
                                    label={`${Number(temp).toFixed(1)}°C`} 
                                    sx={{ height: 20, fontSize: 9.5, fontWeight: 700, fontFamily: 'monospace', bgcolor: 'rgba(251,146,60,0.08)', color: '#fb923c', border: 'none', flexShrink: 0 }} 
                                  />
                                )}
                                {hum !== undefined && (
                                  <Chip 
                                    size="small"
                                    icon={<Droplets size={10} style={{ color: '#60a5fa' }} />} 
                                    label={`${Number(hum).toFixed(0)}%`} 
                                    sx={{ height: 20, fontSize: 9.5, fontWeight: 700, fontFamily: 'monospace', bgcolor: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: 'none', flexShrink: 0 }} 
                                  />
                                )}
                                <Chip 
                                  size="small"
                                  icon={<Wind size={10} style={{ opacity: 0.6 }} />} 
                                  label={`AQ: ${aq}`} 
                                  sx={{ height: 20, fontSize: 9.5, fontWeight: 700, fontFamily: 'monospace', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: 'none', color: 'text.secondary', flexShrink: 0 }} 
                                />
                              </Box>
                            </TableCell>

                            <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'nowrap', overflow: 'hidden' }}>
                                <Chip 
                                  size="small"
                                  icon={<Wifi size={10} />} 
                                  label={`${currentRssi} dBm`} 
                                  sx={{ height: 20, fontSize: 9.5, fontWeight: 800, fontFamily: 'monospace', bgcolor: 'rgba(129,140,248,0.08)', color: '#818cf8', border: 'none', flexShrink: 0 }} 
                                />
                                <Chip 
                                  size="small"
                                  label={`SNR: +${currentSnr} dB`} 
                                  sx={{ height: 20, fontSize: 9.5, fontWeight: 800, fontFamily: 'monospace', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: 'none', color: 'text.secondary', flexShrink: 0 }} 
                                />
                              </Box>
                            </TableCell>

                            <TableCell sx={{ fontSize: 12, fontWeight: 650, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {formatLastSeen(device.last_seen)}
                            </TableCell>

                            <TableCell align="right" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                                {device.registered === false ? (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => handleOpenRegisterDialog(device)}
                                    sx={{
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      px: 1.5,
                                      py: 0.25,
                                      height: 26,
                                      textTransform: 'none',
                                      borderRadius: '24px',
                                      bgcolor: 'warning.main',
                                      color: 'warning.contrastText',
                                      '&:hover': { bgcolor: 'warning.dark' },
                                      flexShrink: 0
                                    }}
                                  >
                                    Dar de Alta
                                  </Button>
                                ) : (
                                  <>
                                    <Button 
                                      size="small" 
                                      variant="outlined" 
                                      onClick={() => navigate(`/analisis?device=${device.device_id}`)}
                                      sx={{ 
                                        fontSize: 9.5, fontWeight: 700, px: 1.5, py: 0.25, height: 26, minWidth: 0, textTransform: 'none', 
                                        borderRadius: '24px', flexShrink: 0, borderColor: 'divider', color: 'text.primary',
                                        '&:hover': { borderColor: 'text.primary', bgcolor: 'text.primary', color: 'background.paper' }
                                      }}
                                    >
                                      Análisis
                                    </Button>
                                    <Button 
                                      size="small" 
                                      variant="outlined" 
                                      onClick={() => navigate(`/mapa`)}
                                      sx={{ 
                                        fontSize: 9.5, fontWeight: 700, px: 1.5, py: 0.25, height: 26, minWidth: 0, textTransform: 'none', 
                                        borderRadius: '24px', flexShrink: 0, borderColor: 'divider', color: 'primary.main',
                                        '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.main', color: 'primary.contrastText' }
                                      }}
                                    >
                                      Mapa
                                    </Button>
                                  </>
                                )}
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleMenuOpen(e, device.device_id)}
                                  sx={{ 
                                    width: 26, height: 26, borderRadius: '24px', color: 'text.primary', flexShrink: 0,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                  }}
                                  title="Más Opciones"
                                >
                                  <MoreVertical size={14} />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          );
        })}

        {(() => {
          const independentNodes = filteredDevices.filter(d => 
            d.type?.toLowerCase() !== 'gateway' && 
            (!d.gateway_id || !allGateways.some(gw => gw.device_id.toLowerCase() === d.gateway_id?.toLowerCase()))
          );
          
          if (independentNodes.length === 0) return null;

          return (
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2.5,
                p: 3,
                borderRadius: '16px',
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.005)',
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                pb: 2,
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: '#ec4899',
                }}>
                  <Layers size={24} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: 16, color: 'text.primary' }}>
                    Dispositivos Independientes / Sin Pasarela
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mt: 0.25, display: 'block' }}>
                    Nodos sensores sin gateway concentrador activo asignado
                  </Typography>
                </Box>
              </Box>

              <TableContainer component={Paper} sx={{ 
                boxShadow: 'none', 
                bgcolor: 'transparent',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <Table size="small" sx={{
                  tableLayout: 'fixed',
                  width: '100%',
                  '& .MuiTableCell-root': {
                    borderBottom: (t) => t.palette.mode === 'dark' 
                      ? '1px solid rgba(255, 255, 255, 0.04)' 
                      : '1px solid rgba(0, 0, 0, 0.04)',
                  },
                  '& .MuiTableRow-root:last-child .MuiTableCell-root': {
                    borderBottom: 'none',
                  }
                }}>
                  <TableHead sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                    <TableRow>
                      <TableCell sx={{ width: '18%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dispositivo (EUI)</TableCell>
                      <TableCell sx={{ width: '12%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</TableCell>
                      <TableCell sx={{ width: '12%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Batería / Voltaje</TableCell>
                      <TableCell sx={{ width: '20%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telemetría Sensores</TableCell>
                      <TableCell sx={{ width: '14%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Radio (LoRa)</TableCell>
                      <TableCell sx={{ width: '10%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Último Reporte</TableCell>
                      <TableCell align="right" sx={{ width: '14%', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {independentNodes.map((device) => {
                      const deviceTelemetry = telemetry[device.device_id] || {};
                      const bat = deviceTelemetry.battery ?? deviceTelemetry.bateria ?? deviceTelemetry.batt ?? deviceTelemetry.bat;
                      const temp = deviceTelemetry.temperature ?? deviceTelemetry.temperatura ?? deviceTelemetry.temp;
                      const hum = deviceTelemetry.humidity ?? deviceTelemetry.humedad ?? deviceTelemetry.hum;
                      const aq = deviceTelemetry.air_quality ?? '--';
                      const currentRssi = deviceTelemetry.rssi !== undefined ? deviceTelemetry.rssi : device.signal_strength;
                      const currentBattery = bat !== undefined ? bat : device.battery_level;
                      const currentSnr = deviceTelemetry.snr !== undefined ? Number(deviceTelemetry.snr).toFixed(1) : '8.5';
                      const linkedPoint = mapPoints.find(p => p.id === device.map_point_id);
                      const locationName = linkedPoint ? linkedPoint.name : 'Sin Ubicación';

                      return (
                        <TableRow key={device.id} hover>
                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {device.name || 'Nodo Sensor'}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.6, mt: 0.25, overflow: 'hidden' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.device_id}</span>
                                <span>•</span>
                                <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {locationName}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getStatusBadge(device)}
                          </TableCell>

                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{ flexShrink: 0 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 12, fontFamily: 'monospace', color: getBatteryColorHex(currentBattery) }}>
                                  {currentBattery}%
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: 9.5, opacity: 0.5, fontWeight: 700, display: 'block' }}>
                                  {(currentBattery * 0.012 + 3.0).toFixed(2)} V
                                </Typography>
                              </Box>
                              <Box sx={{ flexShrink: 0, height: 4, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: '2px', width: 35, overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', bgcolor: getBatteryColorHex(currentBattery), width: `${currentBattery}%` }} />
                              </Box>
                            </Box>
                          </TableCell>

                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'nowrap', overflow: 'hidden' }}>
                              {temp !== undefined && (
                                <Chip 
                                  size="small"
                                  icon={<Thermometer size={10} style={{ color: '#fb923c' }} />} 
                                  label={`${Number(temp).toFixed(1)}°C`} 
                                  sx={{ height: 20, fontSize: 9.5, fontWeight: 700, fontFamily: 'monospace', bgcolor: 'rgba(251,146,60,0.08)', color: '#fb923c', border: 'none', flexShrink: 0 }} 
                                />
                              )}
                              {hum !== undefined && (
                                <Chip 
                                  size="small"
                                  icon={<Droplets size={10} style={{ color: '#60a5fa' }} />} 
                                  label={`${Number(hum).toFixed(0)}%`} 
                                  sx={{ height: 20, fontSize: 9.5, fontWeight: 700, fontFamily: 'monospace', bgcolor: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: 'none', flexShrink: 0 }} 
                                />
                              )}
                              <Chip 
                                size="small"
                                icon={<Wind size={10} style={{ opacity: 0.6 }} />} 
                                label={`AQ: ${aq}`} 
                                sx={{ height: 20, fontSize: 9.5, fontWeight: 700, fontFamily: 'monospace', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: 'none', color: 'text.secondary', flexShrink: 0 }} 
                              />
                            </Box>
                          </TableCell>

                          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'nowrap', overflow: 'hidden' }}>
                              <Chip 
                                size="small"
                                icon={<Wifi size={10} />} 
                                  label={`${currentRssi} dBm`} 
                                  sx={{ height: 20, fontSize: 9.5, fontWeight: 800, fontFamily: 'monospace', bgcolor: 'rgba(129,140,248,0.08)', color: '#818cf8', border: 'none', flexShrink: 0 }} 
                              />
                              <Chip 
                                size="small"
                                label={`SNR: +${currentSnr} dB`} 
                                sx={{ height: 20, fontSize: 9.5, fontWeight: 800, fontFamily: 'monospace', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: 'none', color: 'text.secondary', flexShrink: 0 }} 
                              />
                            </Box>
                          </TableCell>

                          <TableCell sx={{ fontSize: 12, fontWeight: 650, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {formatLastSeen(device.last_seen)}
                          </TableCell>

                           <TableCell align="right" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                             <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                               {device.registered === false ? (
                                 <Button
                                   size="small"
                                   variant="contained"
                                   onClick={() => handleOpenRegisterDialog(device)}
                                   sx={{
                                     fontSize: 9.5,
                                     fontWeight: 800,
                                     px: 1.5,
                                     py: 0.25,
                                     height: 26,
                                     textTransform: 'none',
                                     borderRadius: '24px',
                                     bgcolor: 'warning.main',
                                     color: 'warning.contrastText',
                                     '&:hover': { bgcolor: 'warning.dark' },
                                     flexShrink: 0
                                   }}
                                 >
                                   Dar de Alta
                                 </Button>
                               ) : (
                                 <>
                                   <Button 
                                     size="small" 
                                     variant="outlined" 
                                     onClick={() => navigate(`/analisis?device=${device.device_id}`)}
                                     sx={{ 
                                       fontSize: 9.5, fontWeight: 700, px: 1.5, py: 0.25, height: 26, minWidth: 0, textTransform: 'none', 
                                       borderRadius: '24px', flexShrink: 0, borderColor: 'divider', color: 'text.primary',
                                       '&:hover': { borderColor: 'text.primary', bgcolor: 'text.primary', color: 'background.paper' }
                                     }}
                                   >
                                     Análisis
                                   </Button>
                                   <Button 
                                     size="small" 
                                     variant="outlined" 
                                     onClick={() => navigate(`/mapa`)}
                                     sx={{ 
                                       fontSize: 9.5, fontWeight: 700, px: 1.5, py: 0.25, height: 26, minWidth: 0, textTransform: 'none', 
                                       borderRadius: '24px', flexShrink: 0, borderColor: 'divider', color: 'primary.main',
                                       '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.main', color: 'primary.contrastText' }
                                     }}
                                   >
                                     Mapa
                                   </Button>
                                 </>
                               )}
                               <IconButton
                                 size="small"
                                 onClick={(e) => handleMenuOpen(e, device.device_id)}
                                 sx={{ 
                                   width: 26, height: 26, borderRadius: '24px', color: 'text.primary', flexShrink: 0,
                                   border: 'none',
                                   '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                                 }}
                                 title="Más Opciones"
                               >
                                 <MoreVertical size={14} />
                               </IconButton>
                             </Box>
                           </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          );
        })()}
      </Box>
    );
  };

  const renderFlatTopology = () => {
    return (
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { 
          xs: '1fr', 
          sm: 'repeat(2, 1fr)', 
          md: 'repeat(3, 1fr)', 
          lg: 'repeat(4, 1fr)' 
        },
        gap: 2.5,
      }}>
        {filteredDevices.map((device) => renderDeviceCard(device))}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 0.5 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
            Dispositivos IoT
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {onlineDevices === totalDevices ? 'Todos los dispositivos en línea' : `${onlineDevices}/${totalDevices} dispositivos en línea`}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<Search size={16} />}
            onClick={handleScanDevices}
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              fontSize: 12,
              letterSpacing: '0.05em',
              borderRadius: '24px',
              px: 2.5,
              py: 1,
              borderColor: 'divider',
              color: 'primary.main',
              bgcolor: 'transparent',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(138, 180, 248, 0.08)' }
            }}
          >
            Buscar en Broker MQTT
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={16} />}
            onClick={handleOpenAddDialog}
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              fontSize: 12,
              letterSpacing: '0.05em',
              borderRadius: '24px',
              px: 2.5,
              py: 1,
              boxShadow: 'none',
              bgcolor: 'primary.main',
              color: (t) => t.palette.mode === 'dark' ? '#131314' : '#ffffff',
              '&:hover': { bgcolor: 'primary.dark', boxShadow: 'none' }
            }}
          >
            Añadir Dispositivo
          </Button>
        </Box>
      </Box>

      {/* Banner for Unregistered/Pending Devices */}
      {devices.some(d => d.registered === false) && (
        <Paper
          sx={{
            p: 2,
            borderRadius: '16px',
            bgcolor: 'rgba(253, 214, 99, 0.08)',
            border: 'none',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { md: 'center' },
            gap: 2,
            mb: 0.5
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ color: 'warning.main', display: 'flex' }}>
              <TriangleAlert size={20} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: 'warning.main', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Dispositivos Pendientes de Registro Detectados
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Hay {devices.filter(d => d.registered === false).length} dispositivo(s) transmitiendo telemetría en la red que no han sido registrados formalmente.
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {devices.filter(d => d.registered === false).map(dev => (
              <Button
                key={dev.device_id}
                size="small"
                variant="contained"
                onClick={() => handleOpenRegisterDialog(dev)}
                sx={{
                  bgcolor: 'warning.main',
                  color: 'warning.contrastText',
                  fontWeight: 800,
                  fontSize: 10.5,
                  textTransform: 'none',
                  borderRadius: '24px',
                  '&:hover': { bgcolor: 'warning.dark' }
                }}
              >
                Registrar {dev.device_id.toUpperCase()}
              </Button>
            ))}
          </Box>
        </Paper>
      )}

      {/* Primary Stats Grid */}
      <Box component={motion.div} variants={containerStagger} initial="hidden" animate="show" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2.5 }}>
        {stats.map((stat, i) => (
          <motion.div key={stat.label} variants={fadeSlideUp}>
            <Paper sx={(t) => ({
              bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
              border: 'none',
              borderRadius: '16px',
              boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
              p: 2.5,
              position: 'relative',
              overflow: 'hidden',
              transition: 'background-color 0.2s ease-in-out',
              '&:hover': {
                bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.8)' : '#f8fafd',
              },
            })}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'text.secondary', opacity: 0.6, fontSize: 10, display: 'block', mb: 1 }}>
                    {stat.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 32, fontFamily: 'monospace', color: 'text.primary', lineHeight: 1.1 }}>
                    {stat.value}
                  </Typography>
                </Box>
                <Box sx={{ color: 'text.secondary', opacity: 0.45, mt: 0.25 }}>
                  {stat.icon}
                </Box>
              </Box>
            </Paper>
          </motion.div>
        ))}
      </Box>

      {/* Cisco Enterprise Network Controller Navigation Bar */}
      <Paper 
        sx={(t) => ({ 
          bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
          border: 'none',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'stretch',
          boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
        })}
      >
        {tabOptions.map((opt, idx) => {
          const active = filterType === opt.value;
          return (
            <Box
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              sx={(theme) => ({
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 3,
                py: 2.25,
                cursor: 'pointer',
                bgcolor: active 
                  ? (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)') 
                  : 'transparent',
                borderBottom: { 
                  xs: idx < tabOptions.length - 1 
                    ? `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` 
                    : 'none', 
                  md: 'none' 
                },
                borderRight: { 
                  md: idx < tabOptions.length - 1 
                    ? `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` 
                    : 'none' 
                },
                position: 'relative',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.01)'
                }
              })}
            >
              {/* Active flat clean indicator strip */}
              {active && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    top: { xs: 0, md: 'auto' },
                    width: { xs: '4px', md: '100%' },
                    height: { xs: '100%', md: '3px' },
                    bgcolor: opt.color,
                  }}
                />
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: active ? opt.color : 'text.secondary',
                  flexShrink: 0,
                  transition: 'all 0.2s ease'
                }}>
                  {opt.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ 
                    fontWeight: 800, 
                    fontSize: 12.5, 
                    letterSpacing: '-0.01em',
                    color: active ? 'text.primary' : 'text.secondary',
                    transition: 'color 0.2s'
                  }}>
                    {opt.label}
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    fontWeight: 600, 
                    fontSize: 9.5, 
                    color: 'text.secondary', 
                    opacity: active ? 0.75 : 0.45,
                    display: 'block',
                    mt: 0.1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'opacity 0.2s'
                  }}>
                    {opt.desc}
                  </Typography>
                </Box>
              </Box>

              {/* Dynamic numeric pill badge */}
              <Box sx={{ 
                minWidth: 26,
                height: 20,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 1,
                bgcolor: active ? opt.color : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
                color: active ? '#ffffff' : 'text.secondary',
                fontSize: 10,
                fontWeight: 850,
                fontFamily: 'monospace',
                flexShrink: 0,
                border: 'none',
                transition: 'all 0.2s ease'
              }}>
                {opt.count}
              </Box>
            </Box>
          );
        })}
      </Paper>

      {/* Streamlined Search and Breadcrumb Status Bar */}
      <Paper sx={(t) => ({
        ...glassPaper(t),
        px: 3, py: 1.5,
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        justifyContent: 'space-between',
        alignItems: { lg: 'center' },
        gap: 2,
      })}>
        <Paper sx={(t) => ({
          display: 'flex', alignItems: 'center', px: 2, py: 0.5, borderRadius: '24px', width: { lg: 400 },
          bgcolor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          border: 'none',
          boxShadow: 'none',
        })}>
          <Search size={18} style={{ opacity: 0.4 }} />
          <InputBase
            sx={{ ml: 1, flex: 1, fontSize: 14 }}
            placeholder="Buscar por ID, nombre, tipo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Paper>

        {/* Elegant Active Filter Status breadcrumb */}
        {currentActiveTab && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            px: 2, 
            py: 0.5, 
            borderRadius: '20px', 
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.08)' : 'rgba(26, 115, 232, 0.08)',
            border: 'none',
            color: 'primary.main',
          }}>
            <Box sx={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              bgcolor: 'primary.main', 
            }} />
            <Typography variant="caption" sx={{ 
              fontWeight: 800, 
              fontSize: 9.5, 
              letterSpacing: '0.05em', 
              color: 'primary.main', 
              textTransform: 'uppercase' 
            }}>
              Filtro Activo: {currentActiveTab.label}
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.4 }}>
          Resultados: {filteredDevices.length} de {totalDevices}
        </Typography>
      </Paper>

      {filterType === 'all' ? renderGroupedTopology() : renderFlatTopology()}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} slotProps={{ paper: { sx: (t) => ({ ...glassPaper(t), borderRadius: '12px', minWidth: 200, mt: 1 }) } }}>
        <MenuItem onClick={() => { navigate(`/analisis?device=${selectedDevice}`); handleMenuClose(); }}>
          <ListItemIcon><LineChart size={16} /></ListItemIcon>
          <ListItemText>Ver Análisis</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { navigate(`/mapa`); handleMenuClose(); }}>
          <ListItemIcon><MapPin size={16} /></ListItemIcon>
          <ListItemText>Ver en Mapa</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenEditDialog}>
          <ListItemIcon><Pen size={16} /></ListItemIcon>
          <ListItemText>Editar Dispositivo</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenDeleteConfirm} sx={{ color: 'error.main' }}>
          <ListItemIcon><Trash2 size={16} color="#ef4444" /></ListItemIcon>
          <ListItemText>Eliminar Dispositivo</ListItemText>
        </MenuItem>
      </Menu>

      {/* Diálogo de Creación / Edición */}
      <StyledDialog 
        open={deviceDialogOpen} 
        onClose={() => { setDeviceDialogOpen(false); setSelectedDevice(null); }}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: (t: any) => ({
              ...glassPaper(t),
              borderRadius: '28px',
              p: 1.5,
            })
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isEditMode 
            ? 'Editar Dispositivo' 
            : (isDiscoveryRegistration ? 'Dar de Alta Dispositivo' : 'Registrar Nuevo Dispositivo')}
          <IconButton onClick={() => setDeviceDialogOpen(false)} size="small" sx={{ borderRadius: '8px' }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <form onSubmit={handleSaveDevice}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            
            {/* Warning when registering auto-detected device */}
            {(isEditMode || isDiscoveryRegistration) && selectedDeviceData.registered === false && (
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(253, 214, 99, 0.08)', border: 'none', color: 'warning.main', display: 'flex', gap: 1, alignItems: 'center' }}>
                <TriangleAlert size={16} />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Este dispositivo fue auto-detectado por la red LoRa P2P. Al guardarlo se le dará de alta formalmente en el sistema.
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <StyledTextField
                label="Identificador de Red (EUI)"
                required
                disabled={isEditMode || isDiscoveryRegistration}
                placeholder="ej: nodo_05"
                value={selectedDeviceData.device_id || ''}
                onChange={(e: any) => setSelectedDeviceData(prev => ({ ...prev, device_id: e.target.value.toLowerCase().trim() }))}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' }
                }}
                helperText={isEditMode ? "El identificador del hardware no se puede modificar una vez registrado." : "Debe ser un identificador único en minúsculas."}
              />
              <StyledTextField
                label="Nombre Comercial / Etiqueta"
                required
                placeholder="ej: Contenedor Principal Yanahuara"
                value={selectedDeviceData.name || ''}
                onChange={(e: any) => setSelectedDeviceData(prev => ({ ...prev, name: e.target.value }))}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' }
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                <InputLabel id="device-type-label">Tipo de Dispositivo</InputLabel>
                <Select
                  labelId="device-type-label"
                  label="Tipo de Dispositivo"
                  value={selectedDeviceData.type || 'Nodo Sensor'}
                  disabled={isEditMode && ['gateway_01', 'n1', 'n2'].includes(selectedDeviceData.device_id?.toLowerCase() || '')}
                  onChange={(e) => setSelectedDeviceData(prev => ({ ...prev, type: e.target.value as string }))}
                >
                  <MenuItem value="Nodo Sensor">Nodo Sensor (Buzón inteligente)</MenuItem>
                  <MenuItem value="Gateway">Gateway Concentrador (Base LoRa)</MenuItem>
                </Select>
              </FormControl>

              <StyledTextField
                label="Dirección MAC / EUI Hardware"
                placeholder="ej: 00:80:00:00:00:00:99:AA"
                value={selectedDeviceData.mac_address || ''}
                onChange={(e: any) => setSelectedDeviceData(prev => ({ ...prev, mac_address: e.target.value.toUpperCase() }))}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' }
                }}
              />
            </Box>

            {/* Gateway association selection: Only show for Sensor Nodes */}
            {selectedDeviceData.type !== 'Gateway' && (
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                <InputLabel id="gateway-select-label">Pasarela Gateway Asociada</InputLabel>
                <Select
                  labelId="gateway-select-label"
                  label="Pasarela Gateway Asociada"
                  value={selectedDeviceData.gateway_id || ''}
                  onChange={(e) => setSelectedDeviceData(prev => ({ ...prev, gateway_id: e.target.value as string }))}
                >
                  <MenuItem value=""><em>Ninguna (Nodo Independiente)</em></MenuItem>
                  {devices.filter(d => d.type?.toLowerCase() === 'gateway' && d.registered).map(gw => (
                    <MenuItem key={gw.device_id} value={gw.device_id}>
                      {gw.name} ({gw.device_id.toUpperCase()})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Contenedor physical association select: Only show for Sensor Nodes */}
            {selectedDeviceData.type !== 'Gateway' && (
              <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
                <InputLabel id="point-select-label">Vincular con Contenedor / Recipiente</InputLabel>
                <Select
                  labelId="point-select-label"
                  label="Vincular con Contenedor / Recipiente"
                  value={selectedDeviceData.map_point_id || ''}
                  onChange={(e) => {
                    const ptId = e.target.value ? Number(e.target.value) : undefined;
                    const linkedPoint = mapPoints.find(p => p.id === ptId);
                    setSelectedDeviceData(prev => ({
                      ...prev,
                      map_point_id: ptId,
                      latitude: linkedPoint ? linkedPoint.latitude : prev.latitude,
                      longitude: linkedPoint ? linkedPoint.longitude : prev.longitude
                    }));
                  }}
                >
                  <MenuItem value=""><em>Ninguno (Sin Contenedor Asignado)</em></MenuItem>
                  {mapPoints.map(point => (
                    <MenuItem key={point.id} value={point.id || ''}>
                      {point.name} ({point.type === 'recipiente' ? 'Buzón / Contenedor' : point.type})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <StyledTextField
                label="Latitud de Ubicación"
                type="number"
                inputProps={{ step: "any" } as any}
                required
                value={selectedDeviceData.latitude ?? -16.3988}
                onChange={(e: any) => setSelectedDeviceData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' }
                }}
              />
              <StyledTextField
                label="Longitud de Ubicación"
                type="number"
                inputProps={{ step: "any" } as any}
                required
                value={selectedDeviceData.longitude ?? -71.5368}
                onChange={(e: any) => setSelectedDeviceData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                fullWidth
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' }
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
            <Button 
              onClick={() => { setDeviceDialogOpen(false); setSelectedDevice(null); }} 
              variant="outlined"
              sx={{ borderRadius: '24px', textTransform: 'none', fontWeight: 700, borderColor: 'divider', color: 'text.primary', '&:hover': { borderColor: 'text.primary', bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              variant="contained"
              sx={{ 
                borderRadius: '24px', 
                textTransform: 'none', 
                fontWeight: 800,
                bgcolor: 'primary.main',
                color: (t) => t.palette.mode === 'dark' ? '#131314' : '#ffffff',
                '&:hover': { bgcolor: 'primary.dark' }
              }}
            >
              {isEditMode 
                ? (selectedDeviceData.registered === false ? 'Confirmar Alta / Registrar' : 'Guardar Cambios') 
                : 'Crear Dispositivo'}
            </Button>
          </DialogActions>
        </form>
      </StyledDialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <StyledDialog 
        open={deleteConfirmOpen} 
        onClose={() => { setDeleteConfirmOpen(false); setSelectedDevice(null); }}
        slotProps={{
          paper: {
            sx: (t: any) => ({
              ...glassPaper(t),
              borderRadius: '28px',
              maxWidth: '450px',
              p: 1.5,
            })
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <TriangleAlert size={20} />
          ¿Confirmar Baja?
        </DialogTitle>
        <DialogContent>
          {selectedDevice && ['gateway_01', 'n1', 'n2'].includes(selectedDevice.toLowerCase()) ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                El dispositivo <strong style={{ color: '#ef4444' }}>{selectedDevice.toUpperCase()}</strong> forma parte de la red de **Hardware Real Físico** (Yanahuara).
              </Typography>
              <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.18)', color: '#EF5350' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5 }}>
                  [REGLA DE SEGURIDAD CRÍTICA]
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  No está permitido eliminar o desvincular hardware real activo del sistema de producción desde la interfaz de usuario para proteger el flujo continuo de Yanahuara.
                </Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
              ¿Estás seguro de que deseas eliminar permanentemente el dispositivo <strong>{selectedDevice?.toUpperCase()}</strong> del sistema? Esta acción no se puede deshacer y borrará toda la información del inventario.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button 
            onClick={() => { setDeleteConfirmOpen(false); setSelectedDevice(null); }} 
            variant="outlined"
            sx={{ borderRadius: '24px', textTransform: 'none', fontWeight: 700, borderColor: 'divider', color: 'text.primary', '&:hover': { borderColor: 'text.primary', bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleDeleteDevice} 
            variant="contained"
            color="error"
            disabled={selectedDevice ? ['gateway_01', 'n1', 'n2'].includes(selectedDevice.toLowerCase()) : false}
            sx={{ borderRadius: '24px', textTransform: 'none', fontWeight: 800 }}
          >
            Dar de Baja / Eliminar
          </Button>
        </DialogActions>
      </StyledDialog>

      {/* Diálogo de Búsqueda de Dispositivos MQTT */}
      <StyledDialog
        open={discoverDialogOpen}
        onClose={() => setDiscoverDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: (t: any) => ({
              ...glassPaper(t),
              borderRadius: '28px',
              p: 1.5,
            })
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Radio size={20} color="primary.main" style={{ color: 'var(--primary)' }} />
            <Typography sx={{ fontWeight: 900, fontSize: 16 }}>Buscador de Dispositivos MQTT</Typography>
          </Box>
          <IconButton onClick={() => setDiscoverDialogOpen(false)} size="small" sx={{ borderRadius: '8px' }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ minHeight: 180, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {scanning ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, py: 6 }}>
              <Box sx={{
                width: 48, height: 48, borderRadius: '50%',
                border: (t) => `3px solid ${t.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.1)' : 'rgba(26, 115, 232, 0.1)'}`,
                borderTopColor: 'primary.main',
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'primary.main', mb: 0.5 }}>
                  Escaneando Broker MQTT en tiempo real...
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Escuchando anuncios de pasarelas y telemetría de nodos activos...
                </Typography>
              </Box>
            </Box>
          ) : discoveredDevices.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6, opacity: 0.85 }}>
              <Radio size={40} style={{ opacity: 0.3, color: '#0071C5' }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 800, fontSize: 13.5, textTransform: 'uppercase', color: 'text.secondary', mb: 0.5 }}>
                  No se detectaron nuevas transmisiones
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2 }}>
                  Todas las pasarelas o nodos sensores transmitiendo en el broker ya se encuentran registrados en la base de datos de producción.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={handleScanDevices}
                sx={{ mt: 1, textTransform: 'none', fontWeight: 800, borderRadius: '6px', fontSize: 11 }}
              >
                Volver a Escanear
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary' }}>
                Dispositivos Descubiertos en la Red ({discoveredDevices.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 280, overflowY: 'auto', pr: 0.5 }}>
                {discoveredDevices.map(dev => (
                  <Paper
                    key={dev.device_id}
                    sx={{
                      p: 2,
                      borderRadius: '10px',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                      border: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        color: dev.type === 'Gateway' ? 'primary.main' : 'text.secondary',
                        display: 'flex'
                      }}>
                        {dev.type === 'Gateway' ? <Router size={20} /> : <Cpu size={20} />}
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 850, fontSize: 13, color: 'text.primary', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                          {dev.device_id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 650, mt: 0.1 }}>
                          {dev.type === 'Gateway' ? 'Gateway Concentrador' : 'Nodo Sensor (Buzón)'} • Señal: {dev.signal_strength || '-50'} dBm
                        </Typography>
                      </Box>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setDiscoverDialogOpen(false);
                        handleOpenRegisterDialog(dev as Device);
                      }}
                      sx={{
                        bgcolor: 'primary.main',
                        color: (t) => t.palette.mode === 'dark' ? '#131314' : '#ffffff',
                        fontWeight: 800,
                        fontSize: 10.5,
                        textTransform: 'none',
                        borderRadius: '24px',
                        '&:hover': { bgcolor: 'primary.dark' }
                      }}
                    >
                      Registrar
                    </Button>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setDiscoverDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: '24px', textTransform: 'none', fontWeight: 700, ml: 'auto', borderColor: 'divider', color: 'text.primary', '&:hover': { borderColor: 'text.primary', bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            Cerrar Buscador
          </Button>
        </DialogActions>
      </StyledDialog>
    </Box>
  );
};

export default Devices;
