import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  Snackbar, Alert, IconButton, Collapse
} from '@mui/material';
import {
  Truck, MapPin, Fuel, User, Clock, Activity, AlertTriangle, Gauge, Navigation,
  Plus, Trash2, Wifi, WifiOff, Map as MapIcon, Lock, Unlock
} from 'lucide-react';
// Animations removed — values update instantly via WebSocket
import { fleetService, VehicleData, MaintenanceLogData } from '../services/fleetService';
import camion from '../assets/camion.png';

const glassSx = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  borderRadius: '16px',
  border: 'none',
  boxShadow: 'none',
});

const Fleet: React.FC = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceLogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Dialog & Notification Form State
  const [openDialog, setOpenDialog] = useState(false);
  const [formId, setFormId] = useState('');
  const [formPlate, setFormPlate] = useState('');
  const [formDriver, setFormDriver] = useState('');
  const [formStatus, setFormStatus] = useState<'In Route' | 'Maintenance' | 'Available' | 'Low Fuel'>('Available');
  const [formFuel, setFormFuel] = useState(100);
  const [formCapacity, setFormCapacity] = useState(0);
  const [formLocation, setFormLocation] = useState('Base Central');
  const [formSpeed, setFormSpeed] = useState(0);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load vehicles and maintenance alerts from backend
  const loadData = async () => {
    try {
      setLoading(true);
      const [vehicleList, logList] = await Promise.all([
        fleetService.getVehicles(),
        fleetService.getLogs()
      ]);
      setVehicles(vehicleList);
      setAlerts(logList);
    } catch (err: any) {
      console.error('[FLEET] Error loading initial fleet data:', err);
      setSnackbar({
        open: true,
        message: 'No se pudo conectar con la API de flota. Cargando datos de respaldo...',
        severity: 'warning'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const wsHost = window.location.hostname;
    const wsUrl = process.env.REACT_APP_WS_URL || `ws://${wsHost}:3001/ws`;
    let socket: WebSocket;
    let reconnectTimer: any;

    function connectWS() {
      console.log(`[WEBSOCKET] Conectando a ${wsUrl}...`);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[WEBSOCKET] ¡Conectado al stream de telemetría viva!');
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          // When a real-time truck update is received
          if (parsed.event === 'fleet_update' && parsed.data) {
            const updatedVehicle = parsed.data as VehicleData;
            console.log('[WEBSOCKET] Telemetría viva de camión recibida:', updatedVehicle);
            
            setVehicles((prev) => {
              const exists = prev.some(v => v.id === updatedVehicle.id);
              if (exists) {
                return prev.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v));
              } else {
                return [...prev, updatedVehicle];
              }
            });


          }
        } catch (err) {
          console.error('[WEBSOCKET] Error decodificando payload de telemetría:', err);
        }
      };

      socket.onclose = () => {
        console.log('[WEBSOCKET] Conexión cerrada. Intentando reconectar en 3s...');
        setIsConnected(false);
        reconnectTimer = setTimeout(connectWS, 3000);
      };

      socket.onerror = (err) => {
        console.error('[WEBSOCKET] Error de socket:', err);
        socket.close();
      };
    }

    connectWS();

    return () => {
      if (socket) socket.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim()) {
      setSnackbar({ open: true, message: 'El ID del vehículo es obligatorio (ej. T-101)', severity: 'error' });
      return;
    }
    if (!formPlate.trim()) {
      setSnackbar({ open: true, message: 'La placa del vehículo es obligatoria (ej. BC-1234)', severity: 'error' });
      return;
    }

    try {
      const payload: Partial<VehicleData> = {
        id: formId.trim().toUpperCase(),
        plate: formPlate.trim().toUpperCase(),
        driver: formDriver.trim() || 'N/A',
        status: formStatus,
        fuel: Number(formFuel),
        capacity: Number(formCapacity),
        location: formLocation.trim() || 'Base Central',
        speed: Number(formSpeed),
        last_update: 'Justo ahora'
      };

      const created = await fleetService.saveVehicle(payload);
      
      setVehicles((prev) => {
        const index = prev.findIndex(v => v.id === created.id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = created;
          return updated;
        }
        return [...prev, created];
      });

      setOpenDialog(false);
      setSnackbar({ open: true, message: `Vehículo ${created.id} registrado exitosamente en la base de datos`, severity: 'success' });
      
      // Reset form fields
      setFormId('');
      setFormPlate('');
      setFormDriver('');
      setFormStatus('Available');
      setFormFuel(100);
      setFormCapacity(0);
      setFormLocation('Base Central');
      setFormSpeed(0);

    } catch (err: any) {
      console.error('[FLEET] Error saving vehicle:', err);
      setSnackbar({ open: true, message: `Error registrando vehículo: ${err.message || err}`, severity: 'error' });
    }
  };

  // Delete handler
  const handleDelete = async (vehicleId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm(`¿Está seguro de que desea eliminar el vehículo ${vehicleId} de la flota?`)) return;

    try {
      await fleetService.deleteVehicle(vehicleId);
      setVehicles((prev) => prev.filter(v => v.id !== vehicleId));
      setSnackbar({ open: true, message: `Vehículo ${vehicleId} eliminado de la base de datos`, severity: 'success' });
    } catch (err: any) {
      console.error('[FLEET] Error deleting vehicle:', err);
      setSnackbar({ open: true, message: `Error al eliminar el vehículo: ${err.message || err}`, severity: 'error' });
    }
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { dot: string; label: string; color: string }> = {
      'In Route': { dot: 'primary.main', label: 'En Ruta', color: 'primary.main' },
      'Available': { dot: 'success.main', label: 'Disponible', color: 'success.main' },
      'Maintenance': { dot: 'warning.main', label: 'Mantenimiento', color: 'warning.main' },
      'Low Fuel': { dot: 'error.main', label: 'Combustible Crítico', color: 'error.main' },
    };
    const c = config[status] || { dot: 'text.secondary', label: status, color: 'text.secondary' };
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: c.color, textTransform: 'uppercase' }}>{c.label}</Typography>
      </Box>
    );
  };

  const getFuelColor = (fuel: number) => {
    if (fuel < 20) return 'error.main';
    if (fuel < 40) return 'warning.main';
    return 'success.main';
  };


  // Dynamic KPIs calculations
  const totalVehiclesCount = vehicles.length;
  const activeVehiclesCount = vehicles.filter(v => v.status === 'In Route' || v.status === 'Available').length;
  const lowFuelCount = vehicles.filter(v => v.status === 'Low Fuel').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'Maintenance').length;
  const inRouteCount = vehicles.filter(v => v.status === 'In Route').length;

  const kpis = [
    {
      label: 'Unidades Activas',
      value: `${activeVehiclesCount} / ${totalVehiclesCount}`,
      icon: <Truck size={22} />,
      color: '#4FC3F7',
      sub: `${totalVehiclesCount > 0 ? Math.round((activeVehiclesCount / totalVehiclesCount) * 100) : 0}% operativo`
    },
    {
      label: 'Consumo Promedio',
      value: '8.4 L/km',
      icon: <Fuel size={22} />,
      color: '#FFA726',
      sub: '-3.2% vs ayer'
    },
    {
      label: 'Personal en Ruta',
      value: `${inRouteCount}`,
      icon: <User size={22} />,
      color: '#66BB6A',
      sub: `${vehicles.filter(v => v.status === 'Available').length} disponibles`
    },
    {
      label: 'Alertas de Flota',
      value: `${lowFuelCount + maintenanceCount}`,
      icon: <AlertTriangle size={22} />,
      color: '#EF5350',
      sub: `${lowFuelCount} comb. crítico`
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, p: 0.5 }}>
      {/* Header */}
      <Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 1.5, fontFamily: '"Outfit", sans-serif' }}>
                <Truck size={32} style={{ color: 'var(--primary)' }} /> Gestión de Flota
              </Typography>
              
              {/* Telemetry Live Indicator Badge */}
              {isConnected ? (
                <Chip
                  icon={<Wifi size={14} style={{ color: 'var(--success)' }} />}
                  label="LIVE MQTT CONECTADO"
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: 10,
                    bgcolor: 'rgba(129,201,149,0.1)',
                    color: 'success.main',
                    borderRadius: '4px',
                    border: 'none'
                  }}
                />
              ) : (
                <Chip
                  icon={<WifiOff size={14} style={{ color: 'var(--danger)' }} />}
                  label="MQTT DESCONECTADO"
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: 10,
                    bgcolor: 'rgba(242,139,130,0.1)',
                    color: 'error.main',
                    borderRadius: '4px',
                    border: 'none'
                  }}
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5, opacity: 0.7 }}>
              Monitoreo en tiempo real de unidades de recolección y sincronización con simuladores MQTT.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button 
              variant={editMode ? "contained" : "outlined"}
              color={editMode ? "error" : "inherit"}
              onClick={() => setEditMode(!editMode)}
              startIcon={editMode ? <Unlock size={16} /> : <Lock size={16} />}
              sx={{ 
                fontSize: 11.5, 
                fontWeight: 700, 
                borderRadius: '24px', 
                borderColor: editMode ? 'transparent' : 'divider', 
                color: editMode ? '#fff' : 'text.primary',
                px: 2
              }}
            >
              {editMode ? "Edición activa" : "Modo edición"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Navigation size={16} />}
              sx={{
                fontSize: 11.5, fontWeight: 700,
                borderColor: 'divider',
                color: 'text.primary',
                borderRadius: '24px'
              }}
            >
              Reportes
            </Button>
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => setOpenDialog(true)}
              sx={{
                fontSize: 11.5, fontWeight: 700,
                bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' },
                color: 'primary.contrastText',
                borderRadius: '24px'
              }}
            >
              Añadir Unidad
            </Button>
          </Box>
        </Box>
      </Box>

      {/* KPI Stats Row */}
      <Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2.5 }}>
          {kpis.map((kpi, i) => (
            <Box key={i}>
              <Paper sx={(t) => ({ ...glassSx(t), p: 2.5, position: 'relative', overflow: 'hidden' })}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', color: 'text.secondary', textTransform: 'uppercase' }}>
                    {kpi.label}
                  </Typography>
                  <Box sx={{ color: 'text.secondary', opacity: 0.8 }}>
                    {kpi.icon}
                  </Box>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '1.75rem', fontFamily: '"Outfit", sans-serif', mb: 0.5, color: 'text.primary' }}>
                  {loading ? '...' : kpi.value}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 11, color: 'text.secondary', display: 'block' }}>
                  {kpi.sub}
                </Typography>
              </Paper>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Main Content: Vehicle Grid + Alerts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 340px' }, gap: 3 }}>
        {/* Vehicle Grid */}
        <Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Truck size={18} style={{ color: 'var(--primary)' }} /> Unidades Activas
              </Typography>
              <Chip label={`${vehicles.length} vehículos`} size="small" sx={{ fontWeight: 700, fontSize: 10, bgcolor: 'rgba(138, 180, 248, 0.12)', color: 'primary.main', borderRadius: '4px' }} />
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 250 }}>
                <Typography color="text.secondary" sx={{ fontWeight: 600 }}>Cargando unidades de flota...</Typography>
              </Box>
            ) : vehicles.length === 0 ? (
              <Paper sx={(t) => ({ ...glassSx(t), p: 5, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 })}>
                <Truck size={48} color="rgba(255,255,255,0.15)" />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>No hay camiones en la base de datos</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto', opacity: 0.7 }}>
                    Registra tu primera unidad de recolección para iniciar la visualización en el dashboard e interactuar con el simulador de telemetría MQTT.
                  </Typography>
                </Box>
                <Button variant="contained" onClick={() => setOpenDialog(true)} sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' }, color: 'primary.contrastText', fontWeight: 700, borderRadius: '24px' }}>
                  Registrar Primer Camión
                </Button>
              </Paper>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 2.5 }}>
                {vehicles.map((v) => {
                  return (
                    <Box key={v.id}>
                      <Paper
                        sx={(t) => ({
                          ...glassSx(t),
                          p: 2.5,
                          position: 'relative',
                          overflow: 'hidden',
                          '&:hover': {
                            bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.8)' : '#f8fafd',
                          }
                        })}
                      >


                        {/* Top row: vehicle id + status */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                              <Truck size={20} />
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2, color: 'text.primary' }}>{v.id}</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, opacity: 0.5, letterSpacing: '0.05em' }}>{v.plate}</Typography>
                            </Box>
                          </Box>
                          {statusBadge(v.status)}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            {/* Driver */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                              <User size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                              <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.7, fontSize: 12 }}>{v.driver}</Typography>
                            </Box>

                            {/* Speed */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                              <Gauge size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <Typography sx={{ fontWeight: 700, fontSize: 18, fontFamily: '"Outfit", sans-serif', color: 'text.primary', lineHeight: 1 }}>
                                {v.speed}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 11, color: 'text.secondary' }}>km/h</Typography>
                            </Box>

                            {/* Fuel bar */}
                            <Box sx={{ mb: 1.5 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Fuel size={12} style={{ opacity: 0.6 }} /> Combustible
                                </Typography>
                                <Typography sx={{ fontWeight: 700, fontSize: 11, color: getFuelColor(v.fuel) }}>
                                  {v.fuel}%
                                </Typography>
                              </Box>
                              <Box sx={{ height: 4, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', borderRadius: 2, bgcolor: getFuelColor(v.fuel), width: `${Math.min(v.fuel, 100)}%`, transition: 'width 0.4s ease' }} />
                              </Box>
                            </Box>

                            {/* Location */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
                              <MapPin size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <Box sx={{ overflow: 'hidden' }}>
                                <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {v.location}
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 9, color: 'text.secondary', opacity: 0.6, display: 'block' }}>{v.last_update}</Typography>
                              </Box>
                            </Box>

                            {/* Actions Row */}
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                fullWidth
                                size="small"
                                variant="text"
                                onClick={() => navigate('/mapa', { state: { focusVehicleId: v.id } })}
                                sx={{
                                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                  color: 'primary.main',
                                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.08)' : 'rgba(11, 87, 208, 0.08)',
                                  borderRadius: '24px',
                                  '&:hover': { bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.15)' : 'rgba(11, 87, 208, 0.15)' }
                                }}
                              >
                                <MapIcon size={12} style={{ marginRight: 6 }} /> Ver Mapa
                              </Button>
                              {editMode && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleDelete(v.id, e)}
                                  sx={{
                                    borderRadius: '24px',
                                    border: 'none',
                                    color: 'error.main',
                                    bgcolor: 'transparent',
                                    '&:hover': { bgcolor: 'rgba(242,139,130,0.1)' }
                                  }}
                                >
                                  <Trash2 size={14} />
                                </IconButton>
                              )}
                            </Box>
                          </Box>

                          {/* Truck image on the right */}
                          <Box sx={{
                            width: 110, flexShrink: 0, display: { xs: 'none', sm: 'flex' }, alignItems: 'flex-end',
                            position: 'relative', overflow: 'hidden', borderRadius: 1.5,
                          }}>
                            <Box
                              component="img"
                              src={camion}
                              alt=""
                              sx={{
                                width: '100%', height: 'auto', objectFit: 'contain',
                                borderRadius: 1.5,
                              }}
                            />
                          </Box>
                        </Box>
                      </Paper>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* Inline Fleet Truck Map removed — navigation is now handled globally via the 3D Map */}
          </Box>
        </Box>

        {/* Alerts & Sidebar */}
        <Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Alerts */}
            <Paper sx={(t) => ({ ...glassSx(t), p: 2.5 })}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.primary' }}>
                <AlertTriangle size={16} style={{ color: 'var(--warning)' }} /> Alertas Recientes
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {alerts.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.5, fontStyle: 'italic', display: 'block', py: 1 }}>
                    Ninguna anomalía detectada.
                  </Typography>
                ) : (
                  alerts.slice(0, 4).map((a, i) => (
                    <Box key={i} sx={{ p: 1.5, borderRadius: '8px', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: a.severity === 'error' ? 'error.main' : a.severity === 'warning' ? 'warning.main' : 'primary.main', mt: 0.6, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11, display: 'block', mb: 0.2, color: 'text.primary' }}>
                          {a.vehicle_id} — {a.description}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 9, color: 'text.secondary', opacity: 0.7 }}>{a.date ? new Date(a.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ahora'}</Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </Paper>

            {/* Fleet Efficiency */}
            <Paper sx={(t) => ({ ...glassSx(t), p: 2.5, position: 'relative', overflow: 'hidden' })}>
              <Activity size={120} style={{ position: 'absolute', right: -16, bottom: -16, opacity: 0.04, pointerEvents: 'none', color: 'var(--text-muted)' }} />
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', mb: 1.5, color: 'text.primary' }}>
                Eficiencia de Flota
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 12, color: 'text.secondary', mb: 2 }}>
                Rendimiento mejoró un <Typography component="span" sx={{ color: 'success.main', fontWeight: 700 }}>12.4%</Typography> con optimización por IA.
              </Typography>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase', color: 'text.secondary' }}>Optimización de Rutas</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: 'success.main' }}>Excelente</Typography>
                </Box>
                <Box sx={{ height: 4, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', borderRadius: 2, bgcolor: 'success.main', width: '88%' }} />
                </Box>
              </Box>
            </Paper>

            {/* Upcoming Services */}
            <Paper sx={(t) => ({ ...glassSx(t), p: 2.5 })}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: 'text.primary' }}>
                <Clock size={16} style={{ color: 'var(--warning)' }} /> Próximos Servicios
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[
                  { id: 'T-102', task: 'Cambio de Aceite', date: 'En 3 días' },
                  { id: 'T-105', task: 'Revisión Frenos', date: '12 de Mayo' },
                ].map((m, i) => (
                  <Box key={i} sx={{ p: 1.5, borderRadius: '8px', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 12, color: 'text.primary' }}>{m.id}</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 10, color: 'text.secondary', display: 'block' }}>{m.task}</Typography>
                    </Box>
                    <Chip label={m.date} size="small" sx={{ fontWeight: 700, fontSize: 9, bgcolor: 'rgba(253,214,99,0.12)', color: 'warning.main', borderRadius: '4px' }} />
                  </Box>
                ))}
              </Box>
              <Button fullWidth sx={{ mt: 2, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'primary.main', opacity: 0.8, '&:hover': { opacity: 1 } }}>
                Ver Calendario Completo
              </Button>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Google M3 Style Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        slotProps={{
          paper: {
            sx: (t: any) => ({
              bgcolor: 'background.paper',
              borderRadius: '16px',
              border: 'none',
              p: 1.5,
              maxWidth: 550,
              width: '100%',
              boxShadow: t.palette.mode === 'dark' ? '0 24px 64px rgba(0,0,0,0.5)' : '0 16px 48px rgba(0,0,0,0.08)'
            })
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 20, color: 'text.primary', pb: 1, display: 'flex', alignItems: 'center', gap: 1.5, fontFamily: '"Outfit", sans-serif' }}>
          <Truck size={24} style={{ color: 'var(--primary)' }} /> Registrar Unidad de Flota
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.2, pt: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="ID Vehículo"
                placeholder="Ej. T-106"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                variant="outlined"
                fullWidth
                required
              />
              <TextField
                label="Placa / Patente"
                placeholder="Ej. BC-5678"
                value={formPlate}
                onChange={(e) => setFormPlate(e.target.value)}
                variant="outlined"
                fullWidth
                required
              />
            </Box>

            <TextField
              label="Nombre del Chofer"
              placeholder="Ej. Carlos Mendoza"
              value={formDriver}
              onChange={(e) => setFormDriver(e.target.value)}
              variant="outlined"
              fullWidth
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormControl fullWidth variant="outlined" sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 4,
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  '&:focus-within': {
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  }
                }
              }}>
                <InputLabel id="status-label">Estado Inicial</InputLabel>
                <Select
                  labelId="status-label"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  label="Estado Inicial"
                >
                  <MenuItem value="Available">Disponible (Online)</MenuItem>
                  <MenuItem value="In Route">En Ruta (Online)</MenuItem>
                  <MenuItem value="Maintenance">Mantenimiento</MenuItem>
                  <MenuItem value="Low Fuel">Bajo Combustible (Offline)</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Ubicación Inicial"
                placeholder="Ej. Base Central"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                variant="outlined"
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              <TextField
                label="Combustible (%)"
                type="number"
                value={formFuel}
                onChange={(e) => setFormFuel(Math.max(0, Math.min(100, Number(e.target.value))))}
                variant="outlined"
                fullWidth
              />
              <TextField
                label="Carga Contenedor (%)"
                type="number"
                value={formCapacity}
                onChange={(e) => setFormCapacity(Math.max(0, Math.min(100, Number(e.target.value))))}
                variant="outlined"
                fullWidth
              />
              <TextField
                label="Velocidad (km/h)"
                type="number"
                value={formSpeed}
                onChange={(e) => setFormSpeed(Math.max(0, Number(e.target.value)))}
                variant="outlined"
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1.5 }}>
            <Button
              onClick={() => setOpenDialog(false)}
              sx={{
                fontWeight: 700, color: 'text.secondary',
                borderRadius: '24px',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText',
                borderRadius: '24px',
                '&:hover': { bgcolor: 'primary.dark' }
              }}
            >
              Guardar Camión
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Global Notifications Snackbars */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%', fontWeight: 700, borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>


    </Box>
  );
};

export default Fleet;
