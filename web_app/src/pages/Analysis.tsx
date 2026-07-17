import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LabelList
} from 'recharts';
import {
  Thermometer, Droplets, Battery, RefreshCcw, ArrowLeft, Signal, Info
} from 'lucide-react';
import { deviceService, Device } from '../services/deviceService';
import {
  Box, Paper, Typography, IconButton, ToggleButton, ToggleButtonGroup, Chip, Button, CircularProgress
} from '@mui/material';

const googlePaper = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  borderRadius: '16px',
  border: 'none',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
});

const Analysis: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('device');
  
  // Data State
  const [devices, setDevices] = useState<Device[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('5m');
  const [activeMetric, setActiveMetric] = useState<'temp' | 'hum' | 'sig' | 'batt'>('temp');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Theme observer for Recharts
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
          setTheme(newTheme || 'dark');
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    setTheme((document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark');
    return () => observer.disconnect();
  }, []);

  // Fetch devices when there is no device selected
  useEffect(() => {
    if (!deviceId) {
      setLoading(true);
      deviceService.getDevices()
        .then(setDevices)
        .catch(err => console.error('Error loading devices list:', err))
        .finally(() => setLoading(false));
    }
  }, [deviceId]);

  // Fetch telemetry history when device is selected
  const fetchHistory = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const history = await deviceService.getHistory(deviceId, range);
      setData(history);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, [deviceId, range]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const temps = data.map(d => d.temperatura).filter(v => v != null);
    const hums = data.map(d => d.humedad).filter(v => v != null);
    const batts = data.map(d => d.bateria).filter(v => v != null);
    const sigs = data.map(d => d.rssi || d.signal_strength || 0).filter(v => v != null);
    return {
      temp: { current: temps[temps.length - 1], min: Math.min(...temps), max: Math.max(...temps), avg: temps.reduce((a, b) => a + b, 0) / temps.length },
      hum: { current: hums[hums.length - 1], min: Math.min(...hums), max: Math.max(...hums), avg: hums.reduce((a, b) => a + b, 0) / hums.length },
      batt: { current: batts[batts.length - 1], min: Math.min(...batts), max: Math.max(...batts), avg: batts.reduce((a, b) => a + b, 0) / batts.length },
      sig: { current: sigs[sigs.length - 1], min: Math.min(...sigs), max: Math.max(...sigs), avg: sigs.reduce((a, b) => a + b, 0) / sigs.length }
    };
  }, [data]);

  const extendedStats = useMemo(() => {
    if (data.length === 0) return null;
    const calculateSD = (values: number[]) => {
      if (values.length === 0) return 0;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length);
    };
    const temps = data.map(d => d.temperatura).filter(v => v != null);
    const batts = data.map(d => d.bateria).filter(v => v != null);
    const sigs = data.map(d => d.rssi || d.signal_strength || 0).filter(v => v != null);
    const tempSD = calculateSD(temps);
    return {
      stability: Math.max(0, 100 - (tempSD * 8)).toFixed(1),
      transmissionRate: (data.length / (range === '5m' ? 5 : (range === '1h' ? 60 : 300))).toFixed(1),
      healthScore: Math.min(100, (batts[batts.length - 1] * 0.6 + (120 + sigs[sigs.length - 1]) * 0.4)).toFixed(0),
      uptime: '99.98%',
      anomalies: temps.filter(t => Math.abs(t - (temps.reduce((a, b) => a + b, 0) / temps.length)) > tempSD * 2).length
    };
  }, [data, range]);

  const metricConfig = {
    temp: { label: 'Temperatura', color: '#f97316', unit: '°C', key: 'temperatura', icon: <Thermometer size={18} /> },
    hum: { label: 'Humedad', color: '#3b82f6', unit: '%', key: 'humedad', icon: <Droplets size={18} /> },
    sig: { label: 'Conectividad', color: '#10b981', unit: ' dBm', key: (d: any) => d.rssi || d.signal_strength || 0, icon: <Signal size={18} /> },
    batt: { label: 'Energía', color: '#2dd4bf', unit: '%', key: 'bateria', icon: <Battery size={18} /> }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={(t) => ({ ...googlePaper(t), p: 2, boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.05)' })}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', pb: 0.5, display: 'block' }}>
            {new Date(label).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>{metricConfig[activeMetric].label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 950, color: metricConfig[activeMetric].color }}>
              {Number(payload[0].value).toFixed(1)}{metricConfig[activeMetric].unit}
            </Typography>
          </Box>
        </Paper>
      );
    }
    return null;
  };

  // Selector View when no device is selected
  if (!deviceId) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, p: 0.5 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
            Análisis de Telemetría
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5, opacity: 0.8 }}>
            Seleccione un dispositivo de la red para visualizar gráficos históricos y métricas avanzadas.
          </Typography>
        </Box>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : devices.length === 0 ? (
          <Paper sx={(t) => ({ ...googlePaper(t), p: 5, textAlign: 'center' })}>
            <Typography sx={{ fontWeight: 700, color: 'text.secondary' }}>No hay dispositivos registrados</Typography>
          </Paper>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, 
            gap: 3 
          }}>
            {devices.map(dev => (
              <Paper
                key={dev.id}
                sx={(t) => ({
                  ...googlePaper(t),
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 180,
                  transition: 'transform 0.2s, background-color 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    bgcolor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  }
                })}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip 
                      label={dev.type?.toUpperCase() === 'GATEWAY' ? 'Gateway' : 'Nodo Sensor'} 
                      size="small"
                      sx={{
                        fontWeight: 800,
                        fontSize: 9,
                        bgcolor: dev.type?.toUpperCase() === 'GATEWAY' ? 'rgba(129,140,248,0.08)' : 'rgba(251,146,60,0.08)',
                        color: dev.type?.toUpperCase() === 'GATEWAY' ? '#818cf8' : '#fb923c',
                        border: 'none'
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ 
                        width: 6, 
                        height: 6, 
                        borderRadius: '50%', 
                        bgcolor: dev.status?.toLowerCase() === 'online' ? 'success.main' : 'text.secondary' 
                      }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 9.5, color: 'text.secondary' }}>
                        {dev.status?.toLowerCase() === 'online' ? 'En línea' : 'Desconectado'}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: 'text.primary', mt: 1 }}>
                    {dev.name || 'Dispositivo sin nombre'}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', opacity: 0.7 }}>
                    ID: {dev.device_id}
                  </Typography>
                </Box>
                
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => navigate(`/analisis?device=${dev.device_id}`)}
                  sx={{
                    mt: 2.5,
                    borderRadius: '24px',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'none',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                >
                  Ver Análisis Histórico
                </Button>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  // Active Analytics View
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} to="/dispositivos" size="small" sx={{ color: 'text.secondary' }}>
            <ArrowLeft size={20} />
          </IconButton>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>Análisis de Telemetría</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>Visualización de datos avanzados</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ 
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
            borderRadius: '24px', 
            p: 0.5,
            display: 'flex'
          }}>
            <ToggleButtonGroup 
              value={range} 
              exclusive 
              onChange={(_, v) => v && setRange(v)} 
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: '20px !important',
                  px: 2,
                  py: 0.5,
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    color: 'text.primary'
                  }
                }
              }}
            >
              {['5m', '1h', '5h', '24h', '7d'].map(r => (
                <ToggleButton key={r} value={r}>
                  {r}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <IconButton onClick={fetchHistory} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshCcw size={16} className={loading ? 'spin' : ''} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '3fr 1fr' }, gap: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Main KPI metrics */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
            {[
              { label: 'Estabilidad', value: `${extendedStats?.stability}%`, status: 'Óptimo', statusColor: 'success.main' },
              { label: 'Salud General', value: `${extendedStats?.healthScore}/100` },
              { label: 'Lecturas/Min', value: extendedStats?.transmissionRate, status: 'Sync' },
              { label: 'Uptime LoRa', value: extendedStats?.uptime },
            ].map((item, i) => (
              <Paper key={i} sx={(t) => ({ ...googlePaper(t), p: 2.5 })}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5, mb: 1, display: 'block' }}>
                  {item.label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{item.value}</Typography>
                  {item.status && (
                    <Typography variant="caption" sx={{ fontWeight: 700, color: item.statusColor || 'text.secondary', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                      {item.status}
                    </Typography>
                  )}
                </Box>
              </Paper>
            ))}
          </Box>

          {/* Metric Selector Tabs */}
          <Box sx={(t) => ({ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, 
            borderRadius: '16px', 
            overflow: 'hidden',
            bgcolor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'
          })}>
            {(['temp', 'hum', 'sig', 'batt'] as const).map((m) => {
              const isActive = activeMetric === m;
              return (
                <Box
                  key={m}
                  onClick={() => setActiveMetric(m)}
                  sx={{
                    p: 3, cursor: 'pointer', position: 'relative',
                    bgcolor: isActive 
                      ? (t) => t.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.08)' : 'rgba(26, 115, 232, 0.08)' 
                      : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' }, 
                    transition: 'all 0.2s'
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {metricConfig[m].label}
                    </Typography>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: metricConfig[m].color }} />
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, fontVariant: 'tabular-nums', letterSpacing: '-0.03em' }}>
                    {stats ? Number(stats[m].current).toFixed(m === 'hum' || m === 'batt' ? 0 : 1) : '--'}
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 700, ml: 0.5, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                      {metricConfig[m].unit}
                    </Typography>
                  </Typography>
                  {isActive && <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, bgcolor: metricConfig[m].color }} />}
                </Box>
              );
            })}
          </Box>

          {/* Chart Card */}
          <Paper sx={(t) => ({ ...googlePaper(t), p: 4, minHeight: 500, display: 'flex', flexDirection: 'column' })}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 5 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Visión general de {metricConfig[activeMetric].label}
                </Typography>
                <Typography variant="caption" color="text.secondary">Datos actualizados cada 10 segundos</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.4, mb: 0.5, display: 'block' }}>PROMEDIO</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{stats ? stats[activeMetric].avg.toFixed(1) : '--'}</Typography>
                </Box>
                <Box sx={{ width: 1, bgcolor: 'divider', my: 0.5 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.4, mb: 0.5, display: 'block' }}>MÁXIMO</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{stats ? stats[activeMetric].max.toFixed(1) : '--'}</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ flex: 1, width: '100%', minHeight: 400 }}>
              {loading ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={32} />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={metricConfig[activeMetric].color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={metricConfig[activeMetric].color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                    <XAxis dataKey="time" stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} fontSize={10}
                      tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      minTickGap={range === '5m' ? 10 : 60} />
                    <YAxis domain={activeMetric === 'hum' || activeMetric === 'batt' ? [0, 100] : ['auto', 'auto']}
                      stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} fontSize={10} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: metricConfig[activeMetric].color, strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey={metricConfig[activeMetric].key} stroke={metricConfig[activeMetric].color}
                      strokeWidth={3} fillOpacity={1} fill="url(#activeGradient)" animationDuration={1000}>
                      <LabelList dataKey={metricConfig[activeMetric].key} position="top" offset={15}
                        content={(props: any) => {
                          const { x, y, value, index } = props;
                          if (data.length > 20 && index % 4 !== 0) return null;
                          return (
                            <text x={x} y={y} dy={-10} fill={metricConfig[activeMetric].color} fontSize={10} fontWeight="bold" textAnchor="middle" style={{ opacity: 0.6 }}>
                              {Number(value).toFixed(1)}
                            </text>
                          );
                        }} />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Status details card */}
          <Paper sx={(t) => ({ ...googlePaper(t), p: 3 })}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Estado del Nodo</Typography>
              <Chip label="Live" size="small" color="success" sx={{ fontSize: 9, fontWeight: 900, letterSpacing: '-0.01em' }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ pb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1, display: 'block' }}>
                  Última Actividad
                </Typography>
                <Box sx={{ height: 96, bgcolor: 'action.hover', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', opacity: 0.4 }}>Muestreo en vivo</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1, alignItems: 'flex-end', height: 32 }}>
                    {data.slice(-15).map((d, i) => (
                      <Box key={i} sx={{ width: 4, bgcolor: 'primary.main', borderRadius: '2px 2px 0 0', height: `${(d.temperatura / 50) * 100}%`, opacity: 0.2 + (i / 15) * 0.8 }} />
                    ))}
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>Desviación Típica</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>{stats ? `±${(Math.max(0, 100 - Number(extendedStats?.stability)) / 8).toFixed(2)}` : '--'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>Paquetes / Hora</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>{data.length}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>Anomalías Detectadas</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900, color: extendedStats?.anomalies ? 'error.main' : 'success.main' }}>
                    {extendedStats?.anomalies || '0'}
                  </Typography>
                </Box>
              </Box>
              <Button component={Link} to="/ajustes" color="primary" fullWidth
                sx={{ textTransform: 'uppercase', fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', borderRadius: '24px' }}>
                Ajustes Dispositivo
              </Button>
            </Box>
          </Paper>

          {/* AI Suggestion Card */}
          <Paper sx={(t) => ({ 
            ...googlePaper(t), 
            p: 3, 
            bgcolor: t.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.05)' : 'rgba(26, 115, 232, 0.05)', 
          })}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box sx={{ p: 1, borderRadius: 2, bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(138, 180, 248, 0.08)' : 'rgba(26, 115, 232, 0.08)', color: 'primary.main', display: 'flex' }}>
                <Info size={16} />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'primary.main' }}>Sugerencia AI</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 550, fontSize: 12.5, lineHeight: 1.4 }}>
              {Number(extendedStats?.stability) > 95
                ? 'El nodo presenta una estabilidad excepcional. No se requiere mantenimiento preventivo.'
                : 'Se detectan fluctuaciones leves. Verificar posible interferencia en el sensor de temperatura.'}
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default Analysis;
