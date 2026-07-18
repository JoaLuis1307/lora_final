import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Box, Paper, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress,
  Alert, Button, IconButton, ToggleButton, ToggleButtonGroup, alpha, TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import {
  Activity, Clock, RefreshCw, TrendingUp, TrendingDown,
  Download, ArrowLeft, Minus, ChevronDown, ChevronUp, Zap, History, Cpu, Search, MapPin, Filter
} from 'lucide-react';
import { deviceService, Device } from '../services/deviceService';
import { mapService, MapPoint } from '../services/mapService';
import { calculateFillPercentage } from '../utils/fillCalculator';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';

const ROW_LIMIT = 100;

const formatTime = (ts: string) => {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
};

const formatFull = (ts: string) => {
  const d = new Date(ts);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const calcFill = (e: any) => {
  const d = e.tof_cm ?? e.ultrasonic_cm;
  if (d === undefined || d === null) return null;
  return calculateFillPercentage(d);
};

const RANGES = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hora' },
  { value: '6h', label: '6 horas' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 días' },
];

// Clean Google-style color constants
const GOOGLE_BLUE_DARK = '#8ab4f8';
const GOOGLE_BLUE_LIGHT = '#1a73e8';

const getMetrics = (isDark: boolean) => [
  { key: 'fill', label: 'Nivel Llenado', unit: '%', color: isDark ? '#81c995' : '#188038' },
  { key: 'ultrasonic_cm', label: 'Ultrasonido', unit: 'cm', color: isDark ? '#fde293' : '#b06000' },
  { key: 'tof_cm', label: 'Sensor ToF', unit: 'cm', color: isDark ? '#a1f1f9' : '#007b83' },
  { key: 'rssi', label: 'Señal RSSI', unit: 'dBm', color: isDark ? GOOGLE_BLUE_DARK : GOOGLE_BLUE_LIGHT },
  { key: 'snr', label: 'Ruido SNR', unit: 'dB', color: isDark ? '#d7aefb' : '#8430c5' },
];

const fillColor = (v: number | null) => {
  if (v === null) return '#94a3b8';
  if (v >= 90) return '#d93025'; // Google Red
  if (v >= 75) return '#f59e0b'; // Google Orange
  if (v >= 30) return '#eab308'; // Yellow
  return '#188038'; // Google Green
};

function calcStats(arr: number[]) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const l = arr[arr.length - 1];
  const f = arr[0];
  return {
    min: s[0], max: s[s.length - 1],
    avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10,
    p50: s[Math.floor(s.length * 0.5)],
    p95: s[Math.floor(s.length * 0.95)],
    latest: l, first: f,
    trend: Math.abs(l - f) < 0.01 ? 0 : l > f ? 1 : -1,
  };
}

const Trend: React.FC<{ trend: number | null }> = ({ trend }) => {
  if (trend === null) return null;
  const Icon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const c = trend > 0 ? '#d93025' : trend < 0 ? '#188038' : '#94a3b8';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Icon size={12} color={c} />
    </Box>
  );
};

const SparkStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 8.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>{label}</Typography>
    <Typography sx={{ fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
  </Box>
);

const googlePaper = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  borderRadius: '16px',
  border: 'none',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
});

// -----------------------------------------------------------------------
// CHART (shared) — Optimized for high performance and clean UI
// -----------------------------------------------------------------------
const TelemetryChart: React.FC<{
  data: any[];
  selectedVars: string[];
  height?: number;
  showAvg?: boolean;
  avgs?: Record<string, number>;
}> = memo(({ data, selectedVars, height = 300, showAvg, avgs }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const metrics = getMetrics(isDark);
  const others = selectedVars.filter(v => v !== 'fill');
  const hasFill = selectedVars.includes('fill');

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} vertical={false} />
          <XAxis dataKey="t" fontSize={10} tick={{ fill: isDark ? '#8899b4' : '#64748b' }} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} axisLine={false} tickLine={false} minTickGap={50} />
          {hasFill && (
            <YAxis yAxisId="fill" domain={[0, 100]} fontSize={10} tick={{ fill: isDark ? '#8899b4' : '#64748b' }} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} axisLine={false} tickLine={false} width={35} />
          )}
          {others.length > 0 && (
            <YAxis yAxisId="others" orientation="right" fontSize={10} tick={{ fill: isDark ? '#8899b4' : '#64748b' }} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} axisLine={false} tickLine={false} width={35} />
          )}
          <RechartsTooltip
            isAnimationActive={false}
            contentStyle={{
              backgroundColor: isDark ? 'rgba(30, 31, 32, 0.95)' : 'rgba(255,255,255,0.95)',
              border: 'none',
              borderRadius: '8px', 
              fontSize: 11,
              boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
            }}
            labelFormatter={(_, p) => p?.[0]?.payload?.fullDate || ''}
          />
          <Legend wrapperStyle={{ fontSize: 10, marginTop: 4 }} />
          {hasFill && (() => {
            const m = metrics.find(m => m.key === 'fill')!;
            return (
              <Line yAxisId="fill" type="monotone" dataKey="fill" stroke={m.color} strokeWidth={2.5} name={m.label} dot={false} connectNulls isAnimationActive={false} />
            );
          })()}
          {others.map(vk => {
            const m = metrics.find(m => m.key === vk)!;
            return (
              <React.Fragment key={vk}>
                <Line yAxisId="others" type="monotone" dataKey={vk} stroke={m.color} strokeWidth={2} name={m.label} dot={false} connectNulls isAnimationActive={false} />
                {showAvg && avgs?.[vk] !== undefined && (
                  <ReferenceLine yAxisId="others" y={avgs[vk]} stroke={m.color} strokeOpacity={0.2} strokeDasharray="3 3" />
                )}
              </React.Fragment>
            );
          })}
          {hasFill && showAvg && avgs?.fill !== undefined && (
            <ReferenceLine yAxisId="fill" y={avgs.fill} stroke={isDark ? '#81c995' : '#188038'} strokeOpacity={0.2} strokeDasharray="3 3" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}, (prev, next) => prev.data === next.data && prev.selectedVars === next.selectedVars && prev.height === next.height && prev.showAvg === next.showAvg && prev.avgs === next.avgs);

// -----------------------------------------------------------------------
// DETAIL VIEW (Real-time and History dashboard for single device)
// -----------------------------------------------------------------------
interface DetailViewProps {
  devId: string;
  entries: any[];
  isRealtime: boolean;
  range: string;
}

const DeviceDetails: React.FC<DetailViewProps> = memo(({ devId, entries, isRealtime, range }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const metrics = getMetrics(isDark);
  const [vars, setVars] = useState<string[]>(['fill', 'rssi']);
  const [showTable, setShowTable] = useState(false);
  const [tableRows, setTableRows] = useState(ROW_LIMIT);

  const latest = entries[entries.length - 1] || {};
  const fill = calcFill(latest);

  const chartData = useMemo(() => entries.map((e, i) => ({
    idx: i, t: formatTime(e.timestamp), fullDate: formatFull(e.timestamp), ...e, fill: calcFill(e),
  })), [entries]);

  const allStats = useMemo(() => {
    const res: Record<string, any> = {};
    for (const m of metrics) {
      const vals = entries.map(e => e[m.key]).filter((v: any) => v !== undefined && v !== null && !isNaN(Number(v))).map(Number);
      res[m.key] = calcStats(vals);
    }
    const fv = entries.map(e => calcFill(e)).filter(v => v !== null) as number[];
    res.fill = calcStats(fv);
    return res;
  }, [entries, metrics]);

  const avgs = useMemo(() => {
    const a: Record<string, number> = {};
    for (const [k, s] of Object.entries(allStats)) {
      if (s) a[k] = s.avg;
    }
    return a;
  }, [allStats]);

  const handleVarsChange = useCallback((_: any, v: string[]) => { if (v?.length) setVars(v); }, []);
  const handleToggleTable = useCallback(() => setShowTable(p => !p), []);
  const handleShowMore = useCallback(() => setTableRows(p => p + ROW_LIMIT), []);

  const displayedEntries = useMemo(() => entries.slice(-tableRows), [entries, tableRows]);
  const hasMore = entries.length > displayedEntries.length;

  const glassSx = useMemo(() => googlePaper(theme), [theme]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      
      {/* Target Resource Header */}
      <Paper sx={{ ...glassSx, p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
              <Cpu size={18} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{devId}</Typography>
              <Typography variant="caption" color="text.secondary">Nodo Sensor · Enlace LoRa P2P</Typography>
            </Box>
          </Box>
          <Box>
            {isRealtime ? (
              <Chip label="Transmisión en Vivo" size="small" color="success" variant="outlined" sx={{ fontWeight: 700, fontSize: 10 }} />
            ) : (
              <Chip label="Datos de Historial" size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: 10 }} />
            )}
          </Box>
        </Box>
      </Paper>

      {/* Grid: Capacity & Technical Metrics */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' }, gap: 3 }}>
        
        {/* Capacity status card */}
        <Paper sx={{ ...glassSx, p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nivel de Contenedor</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', mt: 1.5, mb: 1 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 48, lineHeight: 1, fontFamily: 'monospace' }}>{fill !== null ? fill : '--'}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: 'text.secondary', ml: 0.5 }}>%</Typography>
            </Box>
          </Box>
          <Box>
            <Box sx={{ height: 6, borderRadius: 100, bgcolor: 'action.hover', overflow: 'hidden', mb: 2 }}>
              <Box sx={{ height: '100%', width: `${fill ?? 0}%`, bgcolor: fillColor(fill), borderRadius: 100 }} />
            </Box>
            {allStats.fill && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <SparkStat label="Promedio" value={`${allStats.fill.avg}%`} />
                <SparkStat label="Máximo" value={`${allStats.fill.max}%`} />
                <SparkStat label="Mínimo" value={`${allStats.fill.min}%`} />
              </Box>
            )}
          </Box>
        </Paper>

        {/* Technical metrics cards grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
          {metrics.map(m => {
            const s = allStats[m.key];
            if (!s) return null;
            return (
              <Paper key={m.key} sx={{ ...glassSx, p: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: '0.06em' }}>
                  {m.label}
                </Typography>
                <Box sx={{ my: 1.5 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: 22, fontFamily: 'monospace' }}>
                    {s.latest.toFixed(1)}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontWeight: 700 }}>{m.unit}</Typography>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', pt: 1, opacity: 0.8 }}>
                  <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'text.secondary' }}>P: {s.avg.toFixed(0)}</Typography>
                  <Trend trend={s.trend} />
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Box>

      {/* Chart Panel */}
      <Paper sx={{ ...glassSx, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trazado de Señal & Telemetría</Typography>
            <Typography variant="caption" color="text.secondary">Visualización instantánea de variables de enlace LoRa P2P</Typography>
          </Box>
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <ToggleButtonGroup
            value={vars}
            onChange={handleVarsChange}
            size="small"
            sx={{
              flexWrap: 'wrap', gap: 0.75,
              '& .MuiToggleButton-root': {
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '24px !important',
                px: 2.5, py: 0.5, fontSize: 10, fontWeight: 800, textTransform: 'none',
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  color: 'text.primary',
                  borderColor: 'text.primary'
                }
              }
            }}
          >
            {metrics.map(m => (
              <ToggleButton key={m.key} value={m.key}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <TelemetryChart data={chartData} selectedVars={vars} showAvg avgs={avgs} />
      </Paper>

      {/* Raw Data Table */}
      <Paper sx={{ ...glassSx, overflow: 'hidden' }}>
        <Box onClick={handleToggleTable} sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
          <Typography variant="caption" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Clock size={13} /> Registros de Enlace ({entries.length} muestras)
          </Typography>
          {showTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Box>
        
        {showTable && (
          <Box>
            <TableContainer sx={{ maxHeight: 340 }}>
              <Table size="small" sx={{ '& .MuiTableCell-root': { borderColor: 'divider', fontSize: 11, fontFamily: 'monospace', py: 1 } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    {['Hora', 'Llenado %', 'Ultrasonido (cm)', 'Distancia ToF (cm)', 'Señal RSSI (dBm)', 'Ruido SNR (dB)', 'Altitud GPS', 'Satélites'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 800, color: 'text.secondary' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedEntries.map((e: any, i: number) => {
                    const f = calcFill(e);
                    return (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{formatTime(e.timestamp)}</TableCell>
                        <TableCell sx={{ color: fillColor(f), fontWeight: 800 }}>{f !== null ? `${f}%` : '--'}</TableCell>
                        <TableCell>{e.ultrasonic_cm?.toFixed(1) ?? '--'}</TableCell>
                        <TableCell>{e.tof_cm?.toFixed(1) ?? '--'}</TableCell>
                        <TableCell>{e.rssi ?? '--'}</TableCell>
                        <TableCell>{e.snr?.toFixed(1) ?? '--'}</TableCell>
                        <TableCell>{e.altitude?.toFixed(0) ?? '--'}</TableCell>
                        <TableCell>{e.satellites ?? '--'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {hasMore && (
              <Box sx={{ textAlign: 'center', py: 1.5 }}>
                <Button size="small" onClick={handleShowMore} sx={{ fontSize: 11, fontWeight: 800, textTransform: 'none' }}>
                  Cargar más registros
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>

    </Box>
  );
});

// -----------------------------------------------------------------------
// MAIN PAGE COMPONENT
// -----------------------------------------------------------------------
const Stats: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  
  // URL params
  const filterDevice = sp.get('device');
  const currentRange = sp.get('range') || '15m';
  const mode = sp.get('mode') || 'realtime';
  const isRealtime = mode === 'realtime';

  // Filters & Sorting States (lightweight)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'normal' | 'offline'>('all');
  const [sortBy, setSortBy] = useState<'fill' | 'name' | 'signal'>('fill');

  // State
  const [data, setData] = useState<Record<string, any[]>>({});
  const [devices, setDevices] = useState<Device[]>([]);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveRange, setLiveRange] = useState('15m');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveRange = isRealtime ? liveRange : currentRange;
  const rangeLabel = RANGES.find(r => r.value === effectiveRange)?.label || effectiveRange;

  // Map representation
  const pointMap = useMemo(() => {
    const m = new Map<number, MapPoint>();
    mapPoints.forEach(p => {
      if (p.id !== undefined) m.set(p.id, p);
    });
    return m;
  }, [mapPoints]);

  // Load resources once
  useEffect(() => {
    Promise.all([
      deviceService.getDevices(),
      mapService.getPoints()
    ]).then(([devs, pts]) => {
      setDevices(devs);
      setMapPoints(pts);
    }).catch(err => {
      console.error('Error loading stats resources:', err);
    });
  }, []);

  // Fetch telemetry stats
  const fetchStats = useCallback(async (r: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await deviceService.getTelemetryStats(r);
      const processed: Record<string, any[]> = {};
      Object.keys(res).forEach(devId => {
        processed[devId] = res[devId].map((e: any) => ({
          ...e,
          rssi: e.rssi ?? e.signal_strength ?? -75,
          snr: e.snr ?? 8.0,
          battery: e.battery ?? e.battery_level ?? e.bateria ?? 100,
          ultrasonic_cm: e.ultrasonic_cm ?? 80,
          tof_cm: e.tof_cm ?? 80
        }));
      });
      setData(processed);
    } catch (err: any) {
      setError((err as Error).message || 'Error al obtener estadísticas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(effectiveRange);
    if (isRealtime) {
      intervalRef.current = setInterval(() => fetchStats(effectiveRange), 12000); // 12s live interval
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [mode, effectiveRange, fetchStats]);

  // Top level summary calculation
  const summary = useMemo(() => {
    let total = devices.length;
    let critical = 0;
    let warning = 0;
    let offline = 0;

    devices.forEach(dev => {
      const isOnline = dev.status?.toLowerCase() === 'online';
      if (!isOnline) {
        offline++;
      }
      
      const devData = data[dev.device_id] || [];
      const latestEntry = devData[devData.length - 1] || {};
      const fillVal = calcFill(latestEntry);

      if (fillVal !== null && isOnline) {
        if (fillVal >= 90) {
          critical++;
        } else if (fillVal >= 75) {
          warning++;
        }
      }
    });

    return { total, critical, warning, offline };
  }, [devices, data]);

  // Filtering & Sorting logic
  const processedDevices = useMemo(() => {
    return devices.map(dev => {
      const devData = data[dev.device_id] || [];
      const latestEntry = devData[devData.length - 1] || {};
      const fillVal = calcFill(latestEntry);
      const rssiVal = latestEntry.rssi ?? -85;
      const snrVal = latestEntry.snr ?? 8.5;
      const battVal = dev.battery_level ?? latestEntry.battery ?? 100;
      
      const point = dev.map_point_id ? pointMap.get(dev.map_point_id) : null;
      const locationLabel = point ? point.name : 'Ubicación sin asignar';
      const isOnline = dev.status?.toLowerCase() === 'online';

      let statusGroup: 'critical' | 'warning' | 'normal' | 'offline' = 'normal';
      if (!isOnline) {
        statusGroup = 'offline';
      } else if (fillVal !== null) {
        if (fillVal >= 90) statusGroup = 'critical';
        else if (fillVal >= 75) statusGroup = 'warning';
      }

      return {
        ...dev,
        fill: fillVal,
        rssi: rssiVal,
        snr: snrVal,
        battery: battVal,
        locationLabel,
        statusGroup,
        latestEntry
      };
    }).filter(dev => {
      // 1. Search Query
      const matchesSearch = dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            dev.device_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            dev.locationLabel.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 2. Status Group Filter
      const matchesStatus = statusFilter === 'all' || dev.statusGroup === statusFilter;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      // 3. Sorting logic
      if (sortBy === 'fill') {
        const fillA = a.fill ?? -1;
        const fillB = b.fill ?? -1;
        return fillB - fillA; // Descending (highest fill capacity first!)
      }
      if (sortBy === 'signal') {
        return b.rssi - a.rssi; // Best signal (dBm) first
      }
      return a.name.localeCompare(b.name); // Alphabetical
    });
  }, [devices, data, pointMap, searchQuery, statusFilter, sortBy]);

  const selectDevice = (deviceId: string) => {
    setSp(prev => {
      prev.set('device', deviceId);
      return prev;
    });
  };

  const clearDeviceFilter = () => {
    setSp(prev => {
      prev.delete('device');
      return prev;
    });
  };

  const upd = useCallback((key: string, val: string) => setSp(prev => { prev.set(key, val); return prev; }), [setSp]);
  const handleRefresh = useCallback(() => fetchStats(effectiveRange), [fetchStats, effectiveRange]);

  const handleExport = useCallback(() => {
    const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u;
    a.download = `reporte-telemetria-${mode}-${effectiveRange}.json`;
    a.click(); URL.revokeObjectURL(u);
  }, [data, mode, effectiveRange]);

  const glassSx = useMemo(() => googlePaper(theme), [theme]);

  // Render main dashboard
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 0.5 }}>
      
      {/* Control panel header */}
      <Paper sx={glassSx}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2, px: 2.5, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {filterDevice && (
              <IconButton onClick={clearDeviceFilter} size="small" sx={{ color: 'text.secondary', bgcolor: 'action.hover' }}>
                <ArrowLeft size={16} />
              </IconButton>
            )}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: '-0.02em' }}>
                {filterDevice ? `Estadísticas de Nodo` : 'Historial de Señal LoRa P2P'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {filterDevice ? `Visualizando ${filterDevice} · Rango: ${rangeLabel}` : `${devices.length} dispositivos en red · Datos consolidados`}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <ToggleButtonGroup 
              value={mode} 
              onChange={(_, v) => v && upd('mode', v)} 
              size="small" 
              exclusive 
              sx={{ 
                '& .MuiToggleButton-root': { 
                  border: 'none', 
                  borderRadius: '24px !important', 
                  px: 2, py: 0.5, fontSize: 10, fontWeight: 800, textTransform: 'none',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    color: 'text.primary'
                  }
                } 
              }}
            >
              <ToggleButton value="realtime">Tiempo Real</ToggleButton>
              <ToggleButton value="history">Historial</ToggleButton>
            </ToggleButtonGroup>

            <ToggleButtonGroup 
              value={effectiveRange} 
              onChange={(_, v) => v && (isRealtime ? setLiveRange(v) : upd('range', v))} 
              size="small" 
              exclusive 
              sx={{ 
                '& .MuiToggleButton-root': { 
                  border: 'none', 
                  borderRadius: '24px !important', 
                  px: 1.5, py: 0.5, fontSize: 9.5, fontWeight: 800, textTransform: 'none',
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    color: 'text.primary'
                  }
                } 
              }}
            >
              {RANGES.map(r => (
                <ToggleButton key={r.value} value={r.value} sx={{ display: isRealtime && r.value !== '15m' && r.value !== '1h' ? 'none' : undefined }}>
                  {r.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <IconButton size="small" onClick={handleRefresh} disabled={loading} sx={{ color: 'text.secondary' }}>
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </IconButton>
            <IconButton size="small" onClick={handleExport} sx={{ color: 'text.secondary' }}>
              <Download size={15} />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Main content conditional display */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: '12px' }}>{error}</Alert>
      )}

      {loading && Object.keys(data).length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : filterDevice ? (
        // Detailed Device Dashboard
        data[filterDevice] ? (
          <DeviceDetails devId={filterDevice} entries={data[filterDevice]} isRealtime={isRealtime} range={effectiveRange} />
        ) : (
          <Paper sx={{ ...glassSx, p: 5, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">No hay datos de telemetría disponibles para este dispositivo.</Typography>
          </Paper>
        )
      ) : (
        // Resource Manager (Lightweight Overview list with filters + sorting)
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Summary counters bar */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.5 }}>
            {[
              { label: 'Total Contenedores', value: summary.total, color: 'text.primary', border: 'rgba(255,255,255,0.08)' },
              { label: 'Críticos (>= 90%)', value: summary.critical, color: 'error.main', border: '#d93025' },
              { label: 'Advertencias (75%-90%)', value: summary.warning, color: 'warning.main', border: '#f59e0b' },
              { label: 'Sensores Inactivos', value: summary.offline, color: 'text.secondary', border: '#5f6368' }
            ].map((card, idx) => (
              <Paper key={idx} sx={{ ...glassSx, p: 2.5, borderLeft: `4px solid ${card.border}` }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {card.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 1, color: card.color }}>
                  {card.value}
                </Typography>
              </Paper>
            ))}
          </Box>

          {/* Filtering, Search and Sort Panel */}
          <Paper sx={{ ...glassSx, p: 2.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              
              {/* Search bar */}
              <TextField
                placeholder="Buscar por nombre, ID o dirección..."
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>
                  }
                }}
                sx={{ flex: 2, minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: '24px' } }}
              />

              {/* Status Filter */}
              <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
                <InputLabel id="status-filter-label">Filtrar por Estado</InputLabel>
                <Select
                  labelId="status-filter-label"
                  value={statusFilter}
                  label="Filtrar por Estado"
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  sx={{ borderRadius: '24px' }}
                >
                  <MenuItem value="all">Todos los estados</MenuItem>
                  <MenuItem value="critical">Crítico (>= 90%)</MenuItem>
                  <MenuItem value="warning">Advertencia (75%-90%)</MenuItem>
                  <MenuItem value="normal">Normal (&lt; 75%)</MenuItem>
                  <MenuItem value="offline">Offline</MenuItem>
                </Select>
              </FormControl>

              {/* Sorting Filter */}
              <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
                <InputLabel id="sort-filter-label">Ordenar por</InputLabel>
                <Select
                  labelId="sort-filter-label"
                  value={sortBy}
                  label="Ordenar por"
                  onChange={(e) => setSortBy(e.target.value as any)}
                  sx={{ borderRadius: '24px' }}
                >
                  <MenuItem value="fill">Capacidad (Mayor a Menor)</MenuItem>
                  <MenuItem value="signal">Intensidad de Señal</MenuItem>
                  <MenuItem value="name">Nombre Alfabético</MenuItem>
                </Select>
              </FormControl>

            </Box>
          </Paper>

          {/* Table Container */}
          <TableContainer component={Paper} sx={glassSx}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Contenedor</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>ID EUI</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Dirección / Ubicación</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Nivel de Llenado</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Señal LoRa</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Batería</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processedDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>No se encontraron dispositivos que coincidan con la búsqueda.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  processedDevices.map(dev => (
                    <TableRow key={dev.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      
                      {/* Name */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                            <Cpu size={16} />
                          </Box>
                          <Typography sx={{ fontWeight: 800, fontSize: 13.5 }}>{dev.name || 'Sin nombre'}</Typography>
                        </Box>
                      </TableCell>

                      {/* EUI */}
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>
                        {dev.device_id}
                      </TableCell>

                      {/* Address */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                          <MapPin size={13} style={{ flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ fontWeight: 550, fontSize: 12.5 }}>
                            {dev.locationLabel}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Fill Progress */}
                      <TableCell>
                        {dev.fill !== null ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 13, fontFamily: 'monospace', color: fillColor(dev.fill) }}>{dev.fill}%</Typography>
                            <Box sx={{ width: 60, height: 5, bgcolor: 'action.hover', borderRadius: 10, overflow: 'hidden' }}>
                              <Box sx={{ height: '100%', width: `${dev.fill}%`, bgcolor: fillColor(dev.fill) }} />
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">--</Typography>
                        )}
                      </TableCell>

                      {/* RSSI & SNR */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5 }}>
                          {dev.rssi} dBm
                          <Typography component="span" sx={{ fontSize: 10, opacity: 0.6, ml: 0.5, fontWeight: 550 }}>({Number(dev.snr).toFixed(1)} dB)</Typography>
                        </Typography>
                      </TableCell>

                      {/* Battery */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 750, color: dev.battery < 20 ? 'error.main' : 'text.primary', fontSize: 12.5 }}>
                          {dev.battery}%
                        </Typography>
                      </TableCell>

                      {/* Action */}
                      <TableCell align="right">
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => selectDevice(dev.device_id)}
                          sx={{
                            borderRadius: '24px',
                            fontSize: 10.5,
                            fontWeight: 800,
                            textTransform: 'none',
                            px: 2.5,
                            boxShadow: 'none',
                            '&:hover': { boxShadow: 'none' }
                          }}
                        >
                          Ver Gráficos
                        </Button>
                      </TableCell>

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

    </Box>
  );
};

export default Stats;
