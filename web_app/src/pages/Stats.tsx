import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Box, Paper, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress,
  Alert, Button, IconButton, ToggleButton, ToggleButtonGroup, alpha
} from '@mui/material';
import {
  Activity, Thermometer, Droplets, Wind, Rss,
  Gauge, Clock, RefreshCw, TrendingUp, TrendingDown,
  AlertTriangle, Download, ArrowLeft, Minus, Wifi, Signal,
  ChevronDown, ChevronUp, Zap, History, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { deviceService } from '../services/deviceService';
import { calculateFillPercentage } from '../utils/fillCalculator';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, Area, AreaChart, ReferenceLine
} from 'recharts';
import contenedorImg from '../assets/contenedor.png';

const ROW_LIMIT = 200;

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

const fillColor = (v: number | null) => {
  if (v === null) return '#94a3b8';
  if (v >= 90) return '#ef4444';
  if (v >= 75) return '#f59e0b';
  if (v >= 30) return '#eab308';
  return '#22c55e';
};

const METRICS = [
  { key: 'fill', label: 'Carga', unit: '%', color: '#2dd4bf', domain: [0, 100] as [number, number] },
  { key: 'temperature', label: 'Temperatura', unit: '°C', color: '#ef4444', domain: 'auto' as const },
  { key: 'humidity', label: 'Humedad', unit: '%', color: '#3b82f6', domain: [0, 100] as [number, number] },
  { key: 'air_quality', label: 'Calidad Aire', unit: '', color: '#a855f7', domain: 'auto' as const },
  { key: 'ultrasonic_cm', label: 'Ultrasónico', unit: 'cm', color: '#f97316', domain: 'auto' as const },
  { key: 'tof_cm', label: 'ToF', unit: 'cm', color: '#22c55e', domain: 'auto' as const },
  { key: 'rssi', label: 'RSSI', unit: 'dBm', color: '#ec4899', domain: 'auto' as const },
  { key: 'snr', label: 'SNR', unit: 'dB', color: '#06b6d4', domain: 'auto' as const },
];

const RANGES = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hora' },
  { value: '6h', label: '6 horas' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 días' },
];

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
  const c = trend > 0 ? '#ef4444' : trend < 0 ? '#22c55e' : '#94a3b8';
  const t = trend > 0 ? 'Subiendo' : trend < 0 ? 'Bajando' : 'Estable';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: '6px', bgcolor: alpha(c, 0.1) }}>
      <Icon size={12} color={c} />
      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, color: c }}>{t}</Typography>
    </Box>
  );
};

const SparkStat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.1 }}>
    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 9, opacity: 0.3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
    <Typography sx={{ fontWeight: 700, fontSize: 14, fontFamily: 'monospace', color: color || 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
  </Box>
);

// -----------------------------------------------------------------------
// CHART (shared) — memoized + theme-aware
// -----------------------------------------------------------------------
const TelemetryChart: React.FC<{
  data: any[];
  selectedVars: string[];
  height?: number;
  id: string;
  showAvg?: boolean;
  avgs?: Record<string, number>;
}> = memo(({ data, selectedVars, height = 320, id, showAvg, avgs }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hasFill = selectedVars.includes('fill');
  const others = selectedVars.filter(v => v !== 'fill');

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {METRICS.map(m => (
              <linearGradient key={m.key} id={`g-${id}-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity={0.15} />
                <stop offset="100%" stopColor={m.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} />
          <XAxis dataKey="t" fontSize={10} tick={{ fill: isDark ? '#8899b4' : '#64748b' }} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} axisLine={false} tickLine={false} minTickGap={40} />
          {hasFill && (
            <YAxis yAxisId="fill" domain={[0, 100]} fontSize={10} tick={{ fill: isDark ? '#8899b4' : '#64748b' }} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} axisLine={false} tickLine={false} width={35} />
          )}
          {others.length > 0 && (
            <YAxis yAxisId="others" orientation="right" fontSize={10} tick={{ fill: isDark ? '#8899b4' : '#64748b' }} stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'} axisLine={false} tickLine={false} width={35} />
          )}
          <RechartsTooltip
            contentStyle={{
              backgroundColor: isDark ? 'rgba(30, 31, 32, 0.95)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(12px)',
              border: 'none',
              borderRadius: '10px', fontSize: 12,
              boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.08)',
            }}
            labelFormatter={(_, p) => p?.[0]?.payload?.fullDate || ''}
          />
          <Legend wrapperStyle={{ fontSize: 11, marginTop: 6 }} />
          {hasFill && (() => {
            const m = METRICS.find(m => m.key === 'fill')!;
            return (
              <Area key="fill" yAxisId="fill" type="monotone" dataKey="fill" stroke={m.color} strokeWidth={3} fill={`url(#g-${id}-fill)`} name={`${m.label} (${m.unit})`} dot={false} connectNulls />
            );
          })()}
          {others.map(vk => {
            const m = METRICS.find(m => m.key === vk)!;
            return (
              <React.Fragment key={vk}>
                <Line yAxisId="others" type="monotone" dataKey={vk} stroke={m.color} strokeWidth={2} name={`${m.label} (${m.unit})`} dot={false} connectNulls />
                {showAvg && avgs?.[vk] !== undefined && (
                  <ReferenceLine yAxisId="others" y={avgs[vk]} stroke={m.color} strokeOpacity={0.25} strokeDasharray="5 5" />
                )}
              </React.Fragment>
            );
          })}
          {hasFill && showAvg && avgs?.fill !== undefined && (
            <ReferenceLine yAxisId="fill" y={avgs.fill} stroke="#2dd4bf" strokeOpacity={0.25} strokeDasharray="5 5" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}, (prev, next) => prev.data === next.data && prev.selectedVars === next.selectedVars && prev.height === next.height && prev.id === next.id && prev.showAvg === next.showAvg && prev.avgs === next.avgs);

// -----------------------------------------------------------------------
// REAL-TIME — memoized, no AnimatePresence on values
// -----------------------------------------------------------------------
const RealtimeCard: React.FC<{ devId: string; entries: any[] }> = memo(({ devId, entries }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [vars, setVars] = useState<string[]>(['fill']);
  const latest = entries[entries.length - 1] || {};
  const fill = calcFill(latest);

  const glassSx = useMemo(() => ({
    bgcolor: isDark ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
    backdropFilter: 'blur(24px)',
    border: 'none',
    borderRadius: '16px',
    boxShadow: isDark
      ? 'none'
      : '0 4px 12px rgba(0,0,0,0.02)',
  }), [isDark]);

  const chartData = useMemo(() => entries.map((e, i) => ({
    idx: i, t: formatTime(e.timestamp), fullDate: formatFull(e.timestamp), ...e, fill: calcFill(e),
  })), [entries]);

  const subCardSx = useMemo(() => ({
    p: 2, borderRadius: '12px',
    bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    border: 'none',
  }), [isDark]);

  const handleVarsChange = useCallback((_: any, v: string[]) => { if (v?.length) setVars(v); }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={glassSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, px: 2.5, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e', boxShadow: '0 0 12px rgba(34,197,94,0.5)', animation: 'pulse 1.5s infinite' }} />
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: 'text.primary', letterSpacing: '-0.02em' }}>{devId}</Typography>
            <Chip label="EN VIVO" size="small" sx={{ fontWeight: 700, fontSize: 9, bgcolor: alpha('#22c55e', 0.12), color: '#22c55e', borderRadius: '4px', height: 20 }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, opacity: 0.4, fontFamily: 'monospace' }}>{latest.timestamp ? formatTime(latest.timestamp) : ''}</Typography>
            <Box component="img" src={contenedorImg} alt="" sx={{ width: 32, height: 'auto', opacity: 0.45 }} />
          </Box>
        </Box>
      </Paper>

      {fill !== null && (
        <Paper sx={glassSx}>
          <Box sx={{ px: 2.5, py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: fillColor(fill), opacity: 0.8 }}>Carga</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 20, fontFamily: 'monospace', color: fillColor(fill) }}>{fill}%</Typography>
            </Box>
            <Box sx={{ height: 10, borderRadius: '6px', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${fill}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} style={{ height: '100%', borderRadius: '6px', backgroundColor: fillColor(fill) }} />
            </Box>
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' }, gap: 1.5 }}>
        {METRICS.map(m => {
          const val = latest[m.key];
          return (
            <Paper key={m.key} sx={subCardSx}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: m.color, opacity: 0.7, display: 'block', mb: 0.25 }}>{m.label}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 22, fontFamily: 'monospace', color: 'text.primary', lineHeight: 1.2, transition: 'color 0.15s ease' }}>
                {val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(1) : val) : '--'}
                {val !== undefined && val !== null && m.unit && (
                  <Typography component="span" sx={{ fontWeight: 500, fontSize: 11, opacity: 0.3, ml: 0.5 }}>{m.unit}</Typography>
                )}
              </Typography>
            </Paper>
          );
        })}
      </Box>

      <Paper sx={{ ...glassSx, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', opacity: 0.5 }}>
              <Zap size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Trazado en Vivo
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={vars}
            onChange={handleVarsChange}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1, '& .MuiToggleButton-root': { border: 'none', borderRadius: '8px !important', px: 1.25, py: 0.4, fontSize: 10, fontWeight: 700, textTransform: 'none' } }}
          >
            {METRICS.map(m => (
              <ToggleButton key={m.key} value={m.key} sx={{
                color: vars.includes(m.key) ? m.color : 'text.secondary',
                bgcolor: vars.includes(m.key) ? alpha(m.color, 0.1) : 'transparent',
                '&.Mui-selected': { bgcolor: `${alpha(m.color, 0.12)} !important`, color: `${m.color} !important` },
              }}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <TelemetryChart data={chartData} selectedVars={vars} height={280} id={`rt-${devId}`} />
      </Paper>
    </Box>
  );
}, (prev, next) => prev.devId === next.devId && prev.entries === next.entries);

// -----------------------------------------------------------------------
// HISTORY — memoized, table capped at ROW_LIMIT
// -----------------------------------------------------------------------
const HistoryCard: React.FC<{ devId: string; entries: any[]; range: string }> = memo(({ devId, entries, range }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [vars, setVars] = useState<string[]>(['fill', 'temperature']);
  const [showTable, setShowTable] = useState(false);
  const [tableRows, setTableRows] = useState(ROW_LIMIT);

  const latest = entries[entries.length - 1] || {};
  const fill = calcFill(latest);
  const rangeLabel = RANGES.find(r => r.value === range)?.label || range;

  const glassSx = useMemo(() => ({
    bgcolor: isDark ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
    backdropFilter: 'blur(24px)',
    border: 'none',
    borderRadius: '16px',
    boxShadow: isDark
      ? 'none'
      : '0 4px 12px rgba(0,0,0,0.02)',
  }), [isDark]);

  const subCardSx = useMemo(() => ({
    p: 2, borderRadius: '12px',
    bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    border: 'none',
  }), [isDark]);

  const chartData = useMemo(() => entries.map((e, i) => ({
    idx: i, t: formatTime(e.timestamp), fullDate: formatFull(e.timestamp), ...e, fill: calcFill(e),
  })), [entries]);

  const allStats = useMemo(() => {
    const res: Record<string, any> = {};
    for (const m of METRICS) {
      const vals = entries.map(e => e[m.key]).filter((v: any) => v !== undefined && v !== null && !isNaN(Number(v))).map(Number);
      res[m.key] = calcStats(vals);
    }
    const fv = entries.map(e => calcFill(e)).filter(v => v !== null) as number[];
    res.fill = calcStats(fv);
    return res;
  }, [entries]);

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={glassSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, px: 2.5, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: fillColor(fill), boxShadow: `0 0 10px ${alpha(fillColor(fill), 0.3)}` }} />
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: 'text.primary', letterSpacing: '-0.02em' }}>{devId}</Typography>
            <Chip label={`${entries.length} lecturas`} size="small" sx={{ fontWeight: 600, fontSize: 9, bgcolor: alpha('#2dd4bf', 0.08), color: '#2dd4bf', borderRadius: '4px', height: 20 }} />
            <Chip label={rangeLabel} size="small" sx={{ fontWeight: 600, fontSize: 9, bgcolor: alpha('#a855f7', 0.08), color: '#a855f7', borderRadius: '4px', height: 20 }} />
          </Box>
          <Box component="img" src={contenedorImg} alt="" sx={{ width: 32, height: 'auto', opacity: 0.45 }} />
        </Box>
      </Paper>

      <Paper sx={glassSx}>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 38, fontFamily: 'monospace', color: fillColor(fill), lineHeight: 1 }}>{fill !== null ? fill : '--'}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 14, color: fillColor(fill), opacity: 0.5 }}>%</Typography>
            </Box>
            {allStats.fill && (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <SparkStat label="Mín" value={`${allStats.fill.min}%`} color="#94a3b8" />
                <SparkStat label="Máx" value={`${allStats.fill.max}%`} color="#f59e0b" />
                <SparkStat label="Prom" value={`${allStats.fill.avg}%`} color="#2dd4bf" />
                <SparkStat label="P50" value={`${allStats.fill.p50}%`} color="#64748b" />
                <SparkStat label="P95" value={`${allStats.fill.p95}%`} color="#a855f7" />
                <Trend trend={allStats.fill.trend} />
              </Box>
            )}
          </Box>
          <Box sx={{ mt: 1.5, height: 8, borderRadius: '6px', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', borderRadius: '6px', width: `${fill ?? 0}%`, bgcolor: fillColor(fill), transition: 'width 0.5s ease' }} />
          </Box>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' }, gap: 1.5 }}>
        {METRICS.map(m => {
          const s = allStats[m.key];
          if (!s) return null;
          return (
            <Paper key={m.key} sx={subCardSx}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Box sx={{ width: 3, height: 18, borderRadius: '2px', bgcolor: m.color, opacity: 0.6 }} />
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: m.color }}>{m.label}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 22, fontFamily: 'monospace', color: 'text.primary', lineHeight: 1.2 }}>
                  {s.latest.toFixed(1)}
                </Typography>
                {m.unit && <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 11, opacity: 0.3 }}>{m.unit}</Typography>}
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 8, opacity: 0.25, textTransform: 'uppercase' }}>Min</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace', opacity: 0.5 }}>{s.min.toFixed(1)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 8, opacity: 0.25, textTransform: 'uppercase' }}>Máx</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace', color: '#f59e0b' }}>{s.max.toFixed(1)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.3 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 8, opacity: 0.25, textTransform: 'uppercase' }}>Prom</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace', color: '#2dd4bf' }}>{s.avg.toFixed(1)}</Typography>
                </Box>
                <Trend trend={s.trend} />
              </Box>
            </Paper>
          );
        })}
      </Box>

      <Paper sx={{ ...glassSx, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', opacity: 0.5 }}>
              <History size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Historial · {rangeLabel}
            </Typography>
            <Chip label="Promedios punteados" size="small" sx={{ fontWeight: 600, fontSize: 8, bgcolor: alpha('#64748b', 0.08), color: '#64748b', borderRadius: '4px', height: 18 }} />
          </Box>
          <ToggleButtonGroup
            value={vars}
            onChange={handleVarsChange}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1, '& .MuiToggleButton-root': { border: 'none', borderRadius: '8px !important', px: 1.25, py: 0.4, fontSize: 10, fontWeight: 700, textTransform: 'none' } }}
          >
            {METRICS.map(m => (
              <ToggleButton key={m.key} value={m.key} sx={{
                color: vars.includes(m.key) ? m.color : 'text.secondary',
                bgcolor: vars.includes(m.key) ? alpha(m.color, 0.1) : 'transparent',
                '&.Mui-selected': { bgcolor: `${alpha(m.color, 0.12)} !important`, color: `${m.color} !important` },
              }}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <TelemetryChart data={chartData} selectedVars={vars} height={300} id={`hist-${devId}`} showAvg avgs={avgs} />
      </Paper>

      <Paper sx={{ ...glassSx, overflow: 'hidden' }}>
        <Box onClick={handleToggleTable} sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', '&:hover': { bgcolor: alpha('#fff', 0.01) } }}>
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', opacity: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Clock size={13} /> Datos Crudos ({entries.length} registros)
          </Typography>
          {showTable ? <ChevronUp size={16} style={{ opacity: 0.25 }} /> : <ChevronDown size={16} style={{ opacity: 0.25 }} />}
        </Box>
        <AnimatePresence>
          {showTable && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
              <TableContainer sx={{ maxHeight: 340 }}>
                <Table size="small" sx={{ '& .MuiTableCell-root': { borderColor: alpha('#fff', 0.03), fontSize: 11, fontFamily: 'monospace', py: 0.75, px: 1.5 } }}>
                  <TableHead>
                    <TableRow>
                      {['Hora', 'Carga%', 'Temp', 'Hum', 'Aire', 'Ultra', 'ToF', 'RSSI', 'SNR', 'Alt'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedEntries.map((e: any, i: number) => {
                      const f = calcFill(e);
                      return (
                        <TableRow key={i} hover sx={{ '&:hover': { bgcolor: alpha('#2dd4bf', 0.02) } }}>
                          <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: 10 }}>{formatTime(e.timestamp)}</TableCell>
                          <TableCell sx={{ color: fillColor(f), fontWeight: 800 }}>{f !== null ? `${f}%` : '--'}</TableCell>
                          <TableCell>{e.temperature?.toFixed(1) ?? '--'}</TableCell>
                          <TableCell>{e.humidity?.toFixed(1) ?? '--'}</TableCell>
                          <TableCell>{e.air_quality ?? '--'}</TableCell>
                          <TableCell>{e.ultrasonic_cm?.toFixed(1) ?? '--'}</TableCell>
                          <TableCell>{e.tof_cm?.toFixed(1) ?? '--'}</TableCell>
                          <TableCell>{e.rssi ?? '--'}</TableCell>
                          <TableCell>{e.snr?.toFixed(1) ?? '--'}</TableCell>
                          <TableCell>{e.altitude?.toFixed(0) ?? '--'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {hasMore && (
                <Box sx={{ textAlign: 'center', py: 1.5 }}>
                  <Button size="small" onClick={handleShowMore} sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', color: '#2dd4bf', '&:hover': { bgcolor: alpha('#2dd4bf', 0.08) } }}>
                    Ver más ({entries.length - displayedEntries.length} restantes)
                  </Button>
                </Box>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>
    </Box>
  );
}, (prev, next) => prev.devId === next.devId && prev.entries === next.entries && prev.range === next.range);

// -----------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------
const Stats: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const filterDevice = sp.get('device');
  const currentRange = sp.get('range') || '15m';
  const mode = sp.get('mode') || 'realtime';
  const isRealtime = mode === 'realtime';

  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveRange, setLiveRange] = useState('15m');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveRange = isRealtime ? liveRange : currentRange;
  const rangeLabel = RANGES.find(r => r.value === effectiveRange)?.label || effectiveRange;

  const fetchStats = useCallback(async (r: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await deviceService.getTelemetryStats(r);
      setData(res);
    } catch (err: any) {
      setError((err as Error).message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(effectiveRange);
    if (isRealtime) {
      intervalRef.current = setInterval(() => fetchStats(effectiveRange), 10000);
    }
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [mode, effectiveRange, fetchStats]);

  const displayData = filterDevice && data[filterDevice] ? { [filterDevice]: data[filterDevice] } : data;
  const ids = Object.keys(displayData);
  const total = Object.values(displayData).reduce((s, a) => s + a.length, 0);

  const upd = useCallback((key: string, val: string) => setSp(prev => { prev.set(key, val); return prev; }), [setSp]);
  const handleRefresh = useCallback(() => fetchStats(effectiveRange), [fetchStats, effectiveRange]);

  const handleExport = useCallback(() => {
    const b = new Blob([JSON.stringify(displayData, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u;
    a.download = `telemetry-${filterDevice || 'all'}-${mode}-${effectiveRange}.json`;
    a.click(); URL.revokeObjectURL(u);
  }, [displayData, filterDevice, mode, effectiveRange]);

  const glassSx = useMemo(() => ({
    bgcolor: isDark ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
    backdropFilter: 'blur(24px)',
    border: 'none',
    borderRadius: '16px',
    boxShadow: isDark
      ? 'none'
      : '0 4px 12px rgba(0,0,0,0.02)',
  }), [isDark]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: { xs: 0.25, sm: 0.5 } }}>
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <Paper sx={glassSx}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1.5, px: { xs: 2, sm: 2.5 }, py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {filterDevice && <IconButton onClick={() => navigate('/contenedores')} size="small" sx={{ color: 'text.secondary', opacity: 0.4 }}><ArrowLeft size={18} /></IconButton>}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: 'text.primary', fontSize: { xs: '1.15rem', sm: '1.4rem' } }}>
                    {filterDevice ? `Contenedor ${filterDevice}` : 'Analytics'}
                  </Typography>
                  {isRealtime && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1.25, py: 0.25, borderRadius: '5px', bgcolor: alpha('#22c55e', 0.1) }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#22c55e', animation: 'pulse 1.5s infinite' }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 9, color: '#22c55e', letterSpacing: '0.05em' }}>REAL</Typography>
                    </Box>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, opacity: 0.4, fontSize: 11, mt: 0.15, display: 'block' }}>
                  {ids.length} disp · {total} lecturas · {rangeLabel}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              <ToggleButtonGroup value={mode} onChange={(_, v) => v && upd('mode', v)} size="small" exclusive sx={{ mr: 1, '& .MuiToggleButton-root': { border: 'none', borderRadius: '8px !important', px: 1.25, py: 0.4, fontSize: 10, fontWeight: 700, textTransform: 'none', gap: 0.4 } }}>
                <ToggleButton value="realtime" sx={{ color: isRealtime ? '#22c55e' : 'text.secondary', bgcolor: isRealtime ? alpha('#22c55e', 0.1) : 'transparent', '&.Mui-selected': { bgcolor: `${alpha('#22c55e', 0.12)} !important`, color: '#22c55e !important' } }}>
                  <Zap size={13} /> Real-time
                </ToggleButton>
                <ToggleButton value="history" sx={{ color: !isRealtime ? '#a855f7' : 'text.secondary', bgcolor: !isRealtime ? alpha('#a855f7', 0.1) : 'transparent', '&.Mui-selected': { bgcolor: `${alpha('#a855f7', 0.12)} !important`, color: '#a855f7 !important' } }}>
                  <History size={13} /> Historial
                </ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup value={effectiveRange} onChange={(_, v) => v && (isRealtime ? setLiveRange(v) : upd('range', v))} size="small" exclusive sx={{ '& .MuiToggleButton-root': { border: 'none', borderRadius: '8px !important', px: 0.75, py: 0.35, fontSize: 9, fontWeight: 700, textTransform: 'none' } }}>
                {RANGES.map(r => (
                  <ToggleButton key={r.value} value={r.value} sx={{
                    color: effectiveRange === r.value ? '#2dd4bf' : 'text.secondary',
                    bgcolor: effectiveRange === r.value ? alpha('#2dd4bf', 0.1) : 'transparent',
                    '&.Mui-selected': { bgcolor: `${alpha('#2dd4bf', 0.12)} !important`, color: '#2dd4bf !important' },
                    display: isRealtime && r.value !== '15m' && r.value !== '1h' ? 'none' : undefined,
                  }}>
                    {r.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <IconButton size="small" onClick={handleRefresh} disabled={loading} sx={{ color: 'text.secondary', opacity: 0.35 }}><RefreshCw size={13} className={loading ? 'spin' : ''} /></IconButton>
              <IconButton size="small" onClick={handleExport} sx={{ color: 'text.secondary', opacity: 0.35 }}><Download size={13} /></IconButton>
            </Box>
          </Box>
        </Paper>
      </motion.div>

      {loading && Object.keys(data).length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress size={22} sx={{ color: '#2dd4bf' }} /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius: '10px', bgcolor: alpha('#ef4444', 0.06), color: '#ef4444', border: `1px solid ${alpha('#ef4444', 0.1)}`, fontSize: 12 }}>{error}</Alert>
      ) : ids.length === 0 ? (
        <Paper sx={glassSx}>
          <Box sx={{ p: 6, textAlign: 'center' }}><Activity size={32} style={{ opacity: 0.06, marginBottom: 10 }} /><Typography variant="body1" sx={{ fontWeight: 700, opacity: 0.2 }}>Sin datos en este rango</Typography></Box>
        </Paper>
      ) : ids.map(id => isRealtime ? <RealtimeCard key={id} devId={id} entries={displayData[id]} /> : <HistoryCard key={id} devId={id} entries={displayData[id]} range={effectiveRange} />)}
    </Box>
  );
};

export default Stats;
