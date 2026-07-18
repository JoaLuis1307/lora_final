import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Box, Paper, Typography, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress,
  Alert, Button, IconButton, ToggleButton, ToggleButtonGroup, alpha
} from '@mui/material';
import {
  Activity, Clock, RefreshCw, TrendingUp, TrendingDown,
  Download, ArrowLeft, Minus, ChevronDown, ChevronUp, Zap, History
} from 'lucide-react';
import { deviceService } from '../services/deviceService';
import { calculateFillPercentage } from '../utils/fillCalculator';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine, Line
} from 'recharts';

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
  if (v >= 90) return '#d93025'; // Google Red
  if (v >= 75) return '#f59e0b'; // Google Orange
  if (v >= 30) return '#eab308'; // Yellow
  return '#188038'; // Google Green
};

const RANGES = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hora' },
  { value: '6h', label: '6 horas' },
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 días' },
];

const getMetrics = (isDark: boolean) => [
  { key: 'fill', label: 'Carga', unit: '%', color: isDark ? '#81c995' : '#188038', domain: [0, 100] as [number, number] },
  { key: 'ultrasonic_cm', label: 'Ultrasonido', unit: 'cm', color: isDark ? '#fde293' : '#b06000', domain: 'auto' as const },
  { key: 'tof_cm', label: 'Distancia ToF', unit: 'cm', color: isDark ? '#a1f1f9' : '#007b83', domain: 'auto' as const },
  { key: 'rssi', label: 'Señal RSSI', unit: 'dBm', color: isDark ? '#8ab4f8' : '#1a73e8', domain: 'auto' as const },
  { key: 'snr', label: 'Ruido SNR', unit: 'dB', color: isDark ? '#d7aefb' : '#8430c5', domain: 'auto' as const },
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
  const c = trend > 0 ? '#d93025' : trend < 0 ? '#188038' : '#94a3b8';
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
    <Typography variant="caption" sx={{ fontWeight: 650, fontSize: 9, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</Typography>
    <Typography sx={{ fontWeight: 800, fontSize: 14, fontFamily: 'monospace', color: color || 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
  </Box>
);

const googlePaper = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  borderRadius: '16px',
  border: 'none',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
});

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
  const metrics = getMetrics(isDark);
  const hasFill = selectedVars.includes('fill');
  const others = selectedVars.filter(v => v !== 'fill');

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            {metrics.map(m => (
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
            const m = metrics.find(m => m.key === 'fill')!;
            return (
              <Area key="fill" yAxisId="fill" type="monotone" dataKey="fill" stroke={m.color} strokeWidth={3} fill={`url(#g-${id}-fill)`} name={`${m.label} (${m.unit})`} dot={false} connectNulls />
            );
          })()}
          {others.map(vk => {
            const m = metrics.find(m => m.key === vk)!;
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
            <ReferenceLine yAxisId="fill" y={avgs.fill} stroke={isDark ? '#81c995' : '#188038'} strokeOpacity={0.25} strokeDasharray="5 5" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}, (prev, next) => prev.data === next.data && prev.selectedVars === next.selectedVars && prev.height === next.height && prev.id === next.id && prev.showAvg === next.showAvg && prev.avgs === next.avgs);

// -----------------------------------------------------------------------
// REAL-TIME — memoized, clean structure
// -----------------------------------------------------------------------
const RealtimeCard: React.FC<{ devId: string; entries: any[] }> = memo(({ devId, entries }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const metrics = getMetrics(isDark);
  const [vars, setVars] = useState<string[]>(['fill']);
  const latest = entries[entries.length - 1] || {};
  const fill = calcFill(latest);

  const glassSx = useMemo(() => googlePaper(theme), [theme]);

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
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#188038', boxShadow: '0 0 12px rgba(24,128,86,0.4)', animation: 'pulse 1.5s infinite' }} />
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: 'text.primary', letterSpacing: '-0.02em' }}>{devId}</Typography>
            <Chip label="TELEMETRÍA EN VIVO (LoRa P2P)" size="small" sx={{ fontWeight: 700, fontSize: 9, bgcolor: alpha('#188038', 0.08), color: isDark ? '#81c995' : '#188038', borderRadius: '4px', height: 20 }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, opacity: 0.4, fontFamily: 'monospace' }}>Último paquete: {latest.timestamp ? formatTime(latest.timestamp) : ''}</Typography>
          </Box>
        </Box>
      </Paper>

      {fill !== null && (
        <Paper sx={glassSx}>
          <Box sx={{ px: 2.5, py: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: fillColor(fill), opacity: 0.8 }}>Nivel de llenado</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 20, fontFamily: 'monospace', color: fillColor(fill) }}>{fill}%</Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: '6px', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <Box style={{ height: '100%', borderRadius: '6px', backgroundColor: fillColor(fill), width: `${fill}%`, transition: 'width 0.4s ease-out' }} />
            </Box>
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(5,1fr)' }, gap: 1.5 }}>
        {metrics.map(m => {
          const val = latest[m.key];
          return (
            <Paper key={m.key} sx={subCardSx}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: m.color, opacity: 0.7, display: 'block', mb: 0.25 }}>{m.label}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 22, fontFamily: 'monospace', color: 'text.primary', lineHeight: 1.2 }}>
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
              <Zap size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Muestras en Vivo (Canal de Radio)
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={vars}
            onChange={handleVarsChange}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1, '& .MuiToggleButton-root': { border: 'none', borderRadius: '8px !important', px: 1.25, py: 0.4, fontSize: 10, fontWeight: 700, textTransform: 'none' } }}
          >
            {metrics.map(m => (
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
  const metrics = getMetrics(isDark);
  const [vars, setVars] = useState<string[]>(['fill', 'rssi']);
  const [showTable, setShowTable] = useState(false);
  const [tableRows, setTableRows] = useState(ROW_LIMIT);

  const latest = entries[entries.length - 1] || {};
  const fill = calcFill(latest);
  const rangeLabel = RANGES.find(r => r.value === range)?.label || range;

  const glassSx = useMemo(() => googlePaper(theme), [theme]);

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={glassSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, px: 2.5, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: fillColor(fill), boxShadow: `0 0 10px ${alpha(fillColor(fill), 0.3)}` }} />
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: 'text.primary', letterSpacing: '-0.02em' }}>{devId}</Typography>
            <Chip label={`${entries.length} paquetes LoRa P2P`} size="small" sx={{ fontWeight: 600, fontSize: 9, bgcolor: alpha('#1a73e8', 0.08), color: isDark ? '#8ab4f8' : '#1a73e8', borderRadius: '4px', height: 20 }} />
            <Chip label={rangeLabel} size="small" sx={{ fontWeight: 600, fontSize: 9, bgcolor: alpha('#8430c5', 0.08), color: isDark ? '#d7aefb' : '#8430c5', borderRadius: '4px', height: 20 }} />
          </Box>
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
                <SparkStat label="Máx" value={`${allStats.fill.max}%`} color="#d93025" />
                <SparkStat label="Prom" value={`${allStats.fill.avg}%`} color="#188038" />
                <SparkStat label="P50" value={`${allStats.fill.p50}%`} color="#64748b" />
                <SparkStat label="P95" value={`${allStats.fill.p95}%`} color="#8430c5" />
                <Trend trend={allStats.fill.trend} />
              </Box>
            )}
          </Box>
          <Box sx={{ mt: 1.5, height: 8, borderRadius: '6px', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', borderRadius: '6px', width: `${fill ?? 0}%`, bgcolor: fillColor(fill), transition: 'width 0.5s ease' }} />
          </Box>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(5,1fr)' }, gap: 1.5 }}>
        {metrics.map(m => {
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
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace', color: '#188038' }}>{s.avg.toFixed(1)}</Typography>
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
              <History size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Historial de Variables
            </Typography>
            <Chip label="Promedios de canal" size="small" sx={{ fontWeight: 600, fontSize: 8, bgcolor: alpha('#64748b', 0.08), color: '#64748b', borderRadius: '4px', height: 18 }} />
          </Box>
          <ToggleButtonGroup
            value={vars}
            onChange={handleVarsChange}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1, '& .MuiToggleButton-root': { border: 'none', borderRadius: '8px !important', px: 1.25, py: 0.4, fontSize: 10, fontWeight: 700, textTransform: 'none' } }}
          >
            {metrics.map(m => (
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
            <Clock size={13} /> Registros de Enlace de Radio ({entries.length} lecturas)
          </Typography>
          {showTable ? <ChevronUp size={16} style={{ opacity: 0.25 }} /> : <ChevronDown size={16} style={{ opacity: 0.25 }} />}
        </Box>
        
        {showTable && (
          <Box>
            <TableContainer sx={{ maxHeight: 340 }}>
              <Table size="small" sx={{ '& .MuiTableCell-root': { borderColor: alpha('#fff', 0.03), fontSize: 11, fontFamily: 'monospace', py: 0.75, px: 1.5 } }}>
                <TableHead>
                  <TableRow>
                    {['Hora', 'Carga%', 'Ultrasonido (cm)', 'Distancia ToF (cm)', 'Señal RSSI (dBm)', 'Ruido SNR (dB)', 'Altitud GPS', 'Satélites'].map(h => (
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
                <Button size="small" onClick={handleShowMore} sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', color: '#1a73e8', '&:hover': { bgcolor: alpha('#1a73e8', 0.08) } }}>
                  Ver más ({entries.length - displayedEntries.length} restantes)
                </Button>
              </Box>
            )}
          </Box>
        )}
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
      
      // Clean and ensure valid telemetry fields exist
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

  const glassSx = useMemo(() => googlePaper(theme), [theme]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: { xs: 0.25, sm: 0.5 } }}>
      <Box>
        <Paper sx={glassSx}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1.5, px: { xs: 2, sm: 2.5 }, py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {filterDevice && <IconButton onClick={() => navigate('/contenedores')} size="small" sx={{ color: 'text.secondary', opacity: 0.4 }}><ArrowLeft size={18} /></IconButton>}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em', color: 'text.primary', fontSize: { xs: '1.15rem', sm: '1.4rem' } }}>
                    {filterDevice ? `Dispositivo ${filterDevice}` : 'Estadísticas Generales'}
                  </Typography>
                  {isRealtime && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1.25, py: 0.25, borderRadius: '5px', bgcolor: alpha('#188038', 0.1) }}>
                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#188038', animation: 'pulse 1.5s infinite' }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 9, color: isDark ? '#81c995' : '#188038', letterSpacing: '0.05em' }}>EN VIVO</Typography>
                    </Box>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, opacity: 0.5, fontSize: 11, mt: 0.15, display: 'block' }}>
                  {ids.length} sensores activos · {total} muestras recibidas por LoRa P2P · {rangeLabel}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              <ToggleButtonGroup value={mode} onChange={(_, v) => v && upd('mode', v)} size="small" exclusive sx={{ mr: 1, '& .MuiToggleButton-root': { border: 'none', borderRadius: '8px !important', px: 1.25, py: 0.4, fontSize: 10, fontWeight: 700, textTransform: 'none', gap: 0.4 } }}>
                <ToggleButton value="realtime" sx={{ color: isRealtime ? '#188038' : 'text.secondary', bgcolor: isRealtime ? alpha('#188038', 0.1) : 'transparent', '&.Mui-selected': { bgcolor: `${alpha('#188038', 0.12)} !important`, color: '#188038 !important' } }}>
                  <Zap size={13} /> Tiempo Real
                </ToggleButton>
                <ToggleButton value="history" sx={{ color: !isRealtime ? '#8430c5' : 'text.secondary', bgcolor: !isRealtime ? alpha('#8430c5', 0.1) : 'transparent', '&.Mui-selected': { bgcolor: `${alpha('#8430c5', 0.12)} !important`, color: '#8430c5 !important' } }}>
                  <History size={13} /> Historial
                </ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup value={effectiveRange} onChange={(_, v) => v && (isRealtime ? setLiveRange(v) : upd('range', v))} size="small" exclusive sx={{ '& .MuiToggleButton-root': { border: 'none', borderRadius: '8px !important', px: 0.75, py: 0.35, fontSize: 9, fontWeight: 700, textTransform: 'none' } }}>
                {RANGES.map(r => (
                  <ToggleButton key={r.value} value={r.value} sx={{
                    color: effectiveRange === r.value ? '#1a73e8' : 'text.secondary',
                    bgcolor: effectiveRange === r.value ? alpha('#1a73e8', 0.1) : 'transparent',
                    '&.Mui-selected': { bgcolor: `${alpha('#1a73e8', 0.12)} !important`, color: '#1a73e8 !important' },
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
      </Box>

      {loading && Object.keys(data).length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress size={22} sx={{ color: '#1a73e8' }} /></Box>
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius: '10px', bgcolor: alpha('#d93025', 0.06), color: '#d93025', border: `1px solid ${alpha('#d93025', 0.1)}`, fontSize: 12 }}>{error}</Alert>
      ) : ids.length === 0 ? (
        <Paper sx={glassSx}>
          <Box sx={{ p: 6, textAlign: 'center' }}><Activity size={32} style={{ opacity: 0.06, marginBottom: 10 }} /><Typography variant="body1" sx={{ fontWeight: 700, opacity: 0.2 }}>Sin datos en este rango</Typography></Box>
        </Paper>
      ) : ids.map(id => isRealtime ? <RealtimeCard key={id} devId={id} entries={displayData[id]} /> : <HistoryCard key={id} devId={id} entries={displayData[id]} range={effectiveRange} />)}
    </Box>
  );
};

export default Stats;
