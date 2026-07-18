import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Divider, Chip, CircularProgress, List, ListItem, ListItemText
} from '@mui/material';
import {
  Trash2, Cpu, AlertTriangle, Activity, Clock,
  ShieldAlert, ArrowUpRight
} from 'lucide-react';
import { deviceService, Device } from '../services/deviceService';
import { mapService, MapPoint } from '../services/mapService';
import MapPreview from '../components/dashboard/MapPreview/MapPreview';
import { calculateFillPercentage } from '../utils/fillCalculator';

const googlePaper = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  borderRadius: '16px',
  border: 'none',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
});

const Overview: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [devices, setDevices] = useState<Device[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [deviceList, pointList, telemetryData] = await Promise.all([
        deviceService.getDevices(),
        mapService.getPoints(),
        deviceService.getLatestTelemetry()
      ]);
      
      setDevices(deviceList);
      setPoints(pointList);
      setTelemetry(telemetryData);
    } catch (err) {
      console.error("[OVERVIEW] Error loading dashboard stats: ", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // 1. Calculations
  const binsList = points.filter(p => p.type === 'bin');
  
  // Calculate average fill level of bins using latest telemetry
  let totalFill = 0;
  let filledBinsCount = 0;
  let criticalBinsCount = 0;

  binsList.forEach(bin => {
    // Find associated device
    const associatedDevice = devices.find(d => d.map_point_id === bin.id && d.registered);
    if (associatedDevice) {
      const dt = telemetry[associatedDevice.device_id] || {};
      const fillDistance = dt.tof_cm ?? dt.ultrasonic_cm;
      let fill = 0;
      if (fillDistance !== undefined) {
        fill = calculateFillPercentage(fillDistance);
        totalFill += fill;
        filledBinsCount++;
        if (fill >= 90) {
          criticalBinsCount++;
        }
      }
    }
  });

  const avgFill = filledBinsCount > 0 ? Math.round(totalFill / filledBinsCount) : 48; // fallback to 48% if no telemetries

  // IoT stats
  const onlineDevices = devices.filter(d => d.status?.toLowerCase() === 'online').length;
  const totalDevices = devices.length;

  // Alertas de contenedores críticos (con nivel >= 75%)
  const criticalBins = binsList.map(bin => {
    const associatedDevice = devices.find(d => d.map_point_id === bin.id && d.registered);
    let fill = 0;
    if (associatedDevice) {
      const dt = telemetry[associatedDevice.device_id] || {};
      const fillDistance = dt.tof_cm ?? dt.ultrasonic_cm;
      if (fillDistance !== undefined) {
        fill = calculateFillPercentage(fillDistance);
      }
    }
    return {
      id: bin.id,
      name: bin.name,
      fill,
      severity: fill >= 90 ? 'error' : 'warning'
    };
  }).filter(b => b.fill >= 75).slice(0, 5);

  const kpis = [
    {
      label: 'Contenedores',
      value: `${binsList.length} Activos`,
      sub: `${avgFill}% Ocupación Promedio`,
      icon: <Trash2 size={24} />,
      color: 'warning.main',
      path: '/contenedores'
    },
    {
      label: 'Sensores IoT',
      value: `${onlineDevices} / ${totalDevices} En Línea`,
      sub: `${totalDevices - onlineDevices} Fuera de línea`,
      icon: <Cpu size={24} />,
      color: 'primary.main',
      path: '/dispositivos'
    },
    {
      label: 'Alertas Críticas',
      value: `${criticalBinsCount} Pendientes`,
      sub: 'Llenado mayor a 90%',
      icon: <AlertTriangle size={24} />,
      color: 'error.main',
      path: '/contenedores'
    }
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, p: 0.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
            Panel de Control Principal
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5, opacity: 0.8 }}>
            EcoSmart IoT • Gestión Inteligente de Residuos Urbanos
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={loadData}
          startIcon={loading ? <CircularProgress size={12} color="inherit" /> : <Activity size={14} />}
          sx={{
            borderRadius: '24px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'none',
            color: 'text.secondary',
            borderColor: 'divider'
          }}
        >
          {loading ? 'Sincronizando...' : 'Actualizar Datos'}
        </Button>
      </Box>

      {/* KPIs Grid */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, 
        gap: 3 
      }}>
        {kpis.map((kpi, index) => (
          <Paper
            key={index}
            onClick={() => navigate(kpi.path)}
            sx={(t) => ({
              ...googlePaper(t),
              p: 2.5,
              cursor: 'pointer',
              transition: 'transform 0.2s, background-color 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                bgcolor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              }
            })}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', color: 'text.secondary', textTransform: 'uppercase', opacity: 0.6 }}>
                  {kpi.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif', color: 'text.primary', mt: 0.5 }}>
                  {loading ? '...' : kpi.value}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', color: 'text.secondary', opacity: 0.7 }}>
                {kpi.icon}
              </Box>
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary', opacity: 0.8 }}>
              {loading ? 'Cargando...' : kpi.sub}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Main Split Grid */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' }, 
        gap: 3 
      }}>
        {/* Left Side: Map Preview */}
        <Paper sx={(t) => ({ ...googlePaper(t), p: 0, overflow: 'hidden', height: 'calc(100vh - 21.5rem)', minHeight: 450, display: 'flex', flexDirection: 'column' })}>
          <Box sx={{ px: 2.5, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mapa Operativo en Tiempo Real
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
                Visualización de contenedores y puntos de red IoT
              </Typography>
            </Box>
            <Button
              size="small"
              variant="text"
              onClick={() => navigate('/mapa')}
              endIcon={<ArrowUpRight size={14} />}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: '24px' }}
            >
              Pantalla Completa
            </Button>
          </Box>
          <Divider />
          <Box sx={{ flex: 1, position: 'relative', width: '100%' }}>
            <MapPreview />
          </Box>
        </Paper>

        {/* Right Side: Sidebar Activity Feed & Quick Actions */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* System Status / Summary Card */}
          <Paper sx={(t) => ({ ...googlePaper(t), p: 2.5 })}>
            <Typography sx={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
              Salud del Sistema
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Servidor de Telemetría</Typography>
                <Chip label="OPERATIVO" size="small" sx={{ height: 18, fontSize: 8.5, fontWeight: 900, bgcolor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'none' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Simulador MQTT</Typography>
                <Chip label="CONECTADO" size="small" sx={{ height: 18, fontSize: 8.5, fontWeight: 900, bgcolor: 'rgba(34,197,94,0.1)', color: '#22c55e', border: 'none' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Tasa de Red (RSSI)</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>-54 dBm (Promedio)</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Recent Alerts Feed */}
          <Paper sx={(t) => ({ ...googlePaper(t), p: 2.5, minHeight: 280, display: 'flex', flexDirection: 'column' })}>
            <Typography sx={{ fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
              Alertas Recientes
            </Typography>

            {loading ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={20} color="primary" />
              </Box>
            ) : criticalBins.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4, gap: 1 }}>
                <ShieldAlert size={28} style={{ opacity: 0.3 }} />
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600 }}>
                  No se registran alertas activas en el sistema.
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {criticalBins.map((bin, i) => (
                  <ListItem 
                    key={i} 
                    disablePadding
                    sx={{
                      p: 1.25,
                      borderRadius: '8px',
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                      borderLeft: '4px solid',
                      borderLeftColor: bin.severity === 'error' ? 'error.main' : 'warning.main'
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography sx={{ fontWeight: 800, fontSize: 11.5, color: 'text.primary', display: 'block' }}>
                          Contenedor {bin.name}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', flexDirection: 'column', mt: 0.25 }}>
                          <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 650, display: 'block' }}>
                            Nivel de llenado crítico: {bin.fill}%
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default Overview;
