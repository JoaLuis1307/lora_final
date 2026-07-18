import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Divider, Chip, CircularProgress, List, ListItem, ListItemText, alpha
} from '@mui/material';
import {
  Trash2, Cpu, AlertTriangle, Activity, MapPin, ArrowUpRight, Signal
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
  const binsList = useMemo(() => points.filter(p => p.type === 'bin'), [points]);
  
  // Calculate average fill level of bins using latest telemetry
  const { avgFill, filledBinsCount, criticalBinsCount } = useMemo(() => {
    let totalFill = 0;
    let filledCount = 0;
    let criticalCount = 0;

    binsList.forEach(bin => {
      // Find associated device
      const associatedDevice = devices.find(d => d.map_point_id === bin.id && d.registered);
      if (associatedDevice) {
        const dt = telemetry[associatedDevice.device_id] || {};
        const fillDistance = dt.tof_cm ?? dt.ultrasonic_cm;
        if (fillDistance !== undefined) {
          const fill = calculateFillPercentage(fillDistance);
          totalFill += fill;
          filledCount++;
          if (fill >= 90) {
            criticalCount++;
          }
        }
      }
    });

    const avg = filledCount > 0 ? Math.round(totalFill / filledCount) : 48; // fallback
    return { avgFill: avg, filledBinsCount: filledCount, criticalBinsCount: criticalCount };
  }, [binsList, devices, telemetry]);

  // IoT stats
  const onlineDevices = useMemo(() => devices.filter(d => d.status?.toLowerCase() === 'online').length, [devices]);
  const totalDevices = devices.length;

  // Real-time network RF link calculations from database telemetry
  const avgRssi = useMemo(() => {
    const rssiValues = Object.values(telemetry)
      .map(t => t.rssi ?? t.signal_strength)
      .filter(v => typeof v === 'number');
    
    return rssiValues.length > 0 ? Math.round(rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length) : -76;
  }, [telemetry]);

  // Alertas de contenedores críticos (con nivel >= 75%)
  const criticalBins = useMemo(() => {
    return binsList.map(bin => {
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
        severity: fill >= 90 ? 'error' : 'warning' as 'error' | 'warning'
      };
    }).filter(b => b.fill >= 75)
      .sort((a, b) => b.fill - a.fill)
      .slice(0, 5);
  }, [binsList, devices, telemetry]);

  // Theme-aware Google Brand colors
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const googleColors = {
    green: isDark ? '#81c995' : '#188038',
    blue: isDark ? '#8ab4f8' : '#1a73e8',
    red: isDark ? '#f28b82' : '#d93025'
  };

  const kpis = [
    {
      label: 'Contenedores de Residuos',
      value: `${binsList.length} Puntos`,
      sub: `${avgFill}% Ocupación Promedio`,
      icon: <Trash2 size={22} />,
      color: googleColors.green,
      path: '/contenedores'
    },
    {
      label: 'Nodos Sensores LoRa P2P',
      value: `${onlineDevices} / ${totalDevices} Activos`,
      sub: `${totalDevices - onlineDevices} Nodos desconectados`,
      icon: <Cpu size={22} />,
      color: googleColors.blue,
      path: '/dispositivos'
    },
    {
      label: 'Incidentes de Capacidad',
      value: `${criticalBinsCount} Alertas`,
      sub: 'Llenado mayor al 90%',
      icon: <AlertTriangle size={22} />,
      color: googleColors.red,
      path: '/alertas'
    }
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, p: 0.5 }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.02em', color: 'text.primary' }}>
            Consola de Operaciones
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 550, mt: 0.5, opacity: 0.8 }}>
            Red Sensorizada LoRa P2P · Gestión e Indicadores de Residuos Urbanos
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={loadData}
          startIcon={loading ? <CircularProgress size={12} color="inherit" /> : <RefreshCw size={14} className={loading ? 'spin' : ''} />}
          sx={{
            borderRadius: '24px',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'none',
            color: 'text.secondary',
            borderColor: 'divider',
            px: 2.5
          }}
        >
          {loading ? 'Sincronizando...' : 'Actualizar'}
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
              p: 3,
              cursor: 'pointer',
              borderLeft: `5px solid ${kpi.color}`,
              transition: 'transform 0.15s, background-color 0.15s',
              '&:hover': {
                transform: 'translateY(-2px)',
                bgcolor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              }
            })}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', color: 'text.secondary', textTransform: 'uppercase' }}>
                  {kpi.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: kpi.color, mt: 0.5 }}>
                  {loading ? '...' : kpi.value}
                </Typography>
              </Box>
              <Box sx={{ color: 'text.secondary', opacity: 0.5 }}>
                {kpi.icon}
              </Box>
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', opacity: 0.8 }}>
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
              <Typography sx={{ fontWeight: 850, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mapa de Distribución Geográfica
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.7 }}>
                Ubicación georreferenciada de contenedores y gateways
              </Typography>
            </Box>
            <Button
              size="small"
              variant="text"
              onClick={() => navigate('/mapa')}
              endIcon={<ArrowUpRight size={14} />}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 11.5, borderRadius: '24px' }}
            >
              Ver Mapa
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
          <Paper sx={(t) => ({ ...googlePaper(t), p: 3 })}>
            <Typography sx={{ fontWeight: 850, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
              Red y Canal LoRa P2P
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Gateways Concentradors</Typography>
                <Chip label="OPERATIVO" size="small" sx={{ height: 18, fontSize: 8.5, fontWeight: 900, bgcolor: 'rgba(34,197,94,0.08)', color: googleColors.green, border: 'none' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Canal MQTT</Typography>
                <Chip label="ESTABLE" size="small" sx={{ height: 18, fontSize: 8.5, fontWeight: 900, bgcolor: 'rgba(34,197,94,0.08)', color: googleColors.green, border: 'none' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Sensibilidad RSSI</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Signal size={12} color={googleColors.blue} />
                  <Typography sx={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace' }}>{avgRssi} dBm (Prom.)</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Recent Alerts Feed */}
          <Paper sx={(t) => ({ ...googlePaper(t), p: 3, flex: 1, minHeight: 280, display: 'flex', flexDirection: 'column' })}>
            <Typography sx={{ fontWeight: 850, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
              Alertas Recientes
            </Typography>

            {loading ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={20} color="primary" />
              </Box>
            ) : criticalBins.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4, gap: 1 }}>
                <Activity size={28} style={{ opacity: 0.2 }} />
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 700 }}>
                  Todos los niveles están estables.
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {criticalBins.map((bin, i) => (
                  <ListItem 
                    key={i} 
                    disablePadding
                    onClick={() => navigate('/alertas')}
                    sx={{
                      p: 1.5,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                      borderLeft: '4px solid',
                      borderLeftColor: bin.severity === 'error' ? googleColors.red : googleColors.green,
                      transition: 'background-color 0.15s',
                      '&:hover': {
                        bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                      }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                          <MapPin size={11} color="text.secondary" />
                          <Typography sx={{ fontWeight: 800, fontSize: 12, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bin.name}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ fontSize: 10.5, color: 'text.secondary', fontWeight: 650, display: 'block' }}>
                          Nivel de Llenado: <Typography component="span" sx={{ fontWeight: 900, color: bin.severity === 'error' ? googleColors.red : '#eab308' }}>{bin.fill}%</Typography>
                        </Typography>
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
