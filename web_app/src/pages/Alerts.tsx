import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ShieldAlert, CheckCircle, Search, RefreshCcw, ExternalLink, Map, Check
} from 'lucide-react';
import { deviceService, Device } from '../services/deviceService';
import { calculateFillPercentage } from '../utils/fillCalculator';
import {
  Box, Paper, Typography, IconButton, InputAdornment, TextField, Chip, Button, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';

const googlePaper = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(30, 31, 32, 0.55)' : '#ffffff',
  borderRadius: '16px',
  border: 'none',
  boxShadow: t.palette.mode === 'dark' ? 'none' : '0 4px 12px rgba(0,0,0,0.02)',
});

interface Incident {
  id: string;
  deviceId: string;
  sourceName: string;
  type: 'Capacidad' | 'Conectividad' | 'Energía' | 'Sensor';
  severity: 'critical' | 'warning';
  condition: string;
  timestamp: string;
  lat: number;
  lng: number;
}

const Alerts: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning'>('all');
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const devList = await deviceService.getDevices();
      setDevices(devList);
      
      const latestTel = await deviceService.getLatestTelemetry();
      setTelemetry(latestTel);
    } catch (err) {
      console.error('Error loading alert resources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 15 seconds
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Dynamically compile active incidents based on device states and latest telemetry
  const incidents = useMemo(() => {
    const list: Incident[] = [];

    devices.forEach(dev => {
      const isOnline = dev.status?.toLowerCase() === 'online';
      const dt = telemetry[dev.device_id];

      // 1. Connectivity Alert (Offline)
      if (!isOnline) {
        list.push({
          id: `INC-${dev.device_id}-OFFLINE`,
          deviceId: dev.device_id,
          sourceName: dev.name,
          type: 'Conectividad',
          severity: 'warning',
          condition: 'Dispositivo desconectado de la red LoRa P2P',
          timestamp: dev.last_seen || new Date().toISOString(),
          lat: dev.latitude,
          lng: dev.longitude
        });
      }

      if (dt) {
        // 2. Battery Alert (< 20%)
        const batt = dt.battery ?? dt.battery_level ?? dt.bateria ?? 100;
        if (batt < 20) {
          list.push({
            id: `INC-${dev.device_id}-BATTERY`,
            deviceId: dev.device_id,
            sourceName: dev.name,
            type: 'Energía',
            severity: batt < 10 ? 'critical' : 'warning',
            condition: `Voltaje de batería crítico (${batt}%)`,
            timestamp: dt.timestamp || new Date().toISOString(),
            lat: dev.latitude,
            lng: dev.longitude
          });
        }

        // 3. High Fill Level (>= 75%)
        const fillDistance = dt.tof_cm ?? dt.ultrasonic_cm;
        if (fillDistance !== undefined) {
          const fillPct = calculateFillPercentage(fillDistance);
          if (fillPct >= 75) {
            list.push({
              id: `INC-${dev.device_id}-FILL`,
              deviceId: dev.device_id,
              sourceName: dev.name,
              type: 'Capacidad',
              severity: fillPct >= 90 ? 'critical' : 'warning',
              condition: `Contenedor al límite de capacidad (${fillPct}% lleno)`,
              timestamp: dt.timestamp || new Date().toISOString(),
              lat: dev.latitude,
              lng: dev.longitude
            });
          }
        }

        // 4. Sensor Obstacle / Blockage
        if (dt.obstacle === 1) {
          list.push({
            id: `INC-${dev.device_id}-OBSTRUCTED`,
            deviceId: dev.device_id,
            sourceName: dev.name,
            type: 'Sensor',
            severity: 'critical',
            condition: 'Sensor ultrasónico/TOF reporta obstrucción o bloqueo constante',
            timestamp: dt.timestamp || new Date().toISOString(),
            lat: dev.latitude,
            lng: dev.longitude
          });
        }
      }
    });

    return list;
  }, [devices, telemetry]);

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const matchesSearch = inc.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            inc.deviceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            inc.condition.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSeverity = severityFilter === 'all' || inc.severity === severityFilter;
      
      return matchesSearch && matchesSeverity;
    });
  }, [incidents, searchQuery, severityFilter]);

  // Count summaries
  const criticalCount = useMemo(() => incidents.filter(i => i.severity === 'critical' && !acknowledged.has(i.id)).length, [incidents, acknowledged]);
  const warningCount = useMemo(() => incidents.filter(i => i.severity === 'warning' && !acknowledged.has(i.id)).length, [incidents, acknowledged]);

  const handleAcknowledge = (id: string) => {
    setAcknowledged(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, p: 0.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
            Consola de Incidentes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5, opacity: 0.8 }}>
            Monitoreo en tiempo real de anomalías de red, sensores y capacidad de contenedores.
          </Typography>
        </Box>
        <Button 
          onClick={loadData} 
          variant="outlined" 
          startIcon={<RefreshCcw size={14} className={loading ? 'spin' : ''} />}
          sx={{ borderRadius: '24px', fontWeight: 800, textTransform: 'none' }}
        >
          Sincronizar
        </Button>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3 }}>
        <Paper sx={(t) => ({ 
          ...googlePaper(t), 
          p: 3, 
          borderLeft: '4px solid #ef4444', 
          bgcolor: criticalCount > 0 ? (t.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.02)') : 'transparent'
        })}>
          <Typography variant="caption" color="error" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Incidentes Críticos
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 900, mt: 1, color: criticalCount > 0 ? 'error.main' : 'text.primary' }}>
            {criticalCount}
          </Typography>
        </Paper>

        <Paper sx={(t) => ({ 
          ...googlePaper(t), 
          p: 3, 
          borderLeft: '4px solid #f59e0b',
          bgcolor: warningCount > 0 ? (t.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.02)') : 'transparent'
        })}>
          <Typography variant="caption" color="warning" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Advertencias Activas
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 900, mt: 1, color: warningCount > 0 ? 'warning.main' : 'text.primary' }}>
            {warningCount}
          </Typography>
        </Paper>

        <Paper sx={(t) => ({ ...googlePaper(t), p: 3, borderLeft: '4px solid #10b981' })}>
          <Typography variant="caption" color="success" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            MTTR (Resolución)
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 900, mt: 1 }}>
            8.2 <Typography component="span" variant="body1" color="text.secondary" sx={{ fontWeight: 800 }}>min</Typography>
          </Typography>
        </Paper>
      </Box>

      {/* Filter and Table Card */}
      <Paper sx={(t) => ({ ...googlePaper(t), p: 3 })}>
        {/* Filters bar */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' }}>
          <TextField
            placeholder="Buscar por contenedor, ID o condición..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>
              }
            }}
            sx={{ flex: 1, minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: '24px' } }}
          />
          
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="severity-label">Severidad</InputLabel>
            <Select
              labelId="severity-label"
              value={severityFilter}
              label="Severidad"
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              sx={{ borderRadius: '24px' }}
            >
              <MenuItem value="all">Todas las severidades</MenuItem>
              <MenuItem value="critical">Crítica</MenuItem>
              <MenuItem value="warning">Advertencia</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Incidents Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : filteredIncidents.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CheckCircle size={48} color="#10b981" />
            <Typography variant="body1" sx={{ fontWeight: 800 }}>
              ¡Todos los sistemas en orden!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No se registran incidentes activos que cumplan con los filtros de búsqueda.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }}>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>ID Incidente</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Severidad</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Origen</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Categoría</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Detalle del Incidente</TableCell>
                  <TableCell sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Iniciado</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredIncidents.map(inc => {
                  const isAck = acknowledged.has(inc.id);
                  return (
                    <TableRow 
                      key={inc.id} 
                      hover 
                      sx={{ 
                        opacity: isAck ? 0.5 : 1,
                        transition: 'opacity 0.2s',
                        '&:last-child td, &:last-child th': { border: 0 }
                      }}
                    >
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 11.5 }}>
                        {inc.id}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={inc.severity === 'critical' ? <ShieldAlert size={12} /> : <AlertTriangle size={12} />}
                          label={inc.severity === 'critical' ? 'CRÍTICA' : 'ADVERTENCIA'}
                          size="small"
                          color={inc.severity === 'critical' ? 'error' : 'warning'}
                          sx={{ fontWeight: 900, fontSize: 9.5, letterSpacing: '0.02em' }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>
                        {inc.sourceName}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12.5 }}>
                          {inc.type}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 550, fontSize: 13 }}>
                        {inc.condition}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {new Date(inc.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <IconButton
                            onClick={() => handleAcknowledge(inc.id)}
                            color={isAck ? 'success' : 'default'}
                            size="small"
                            title={isAck ? "Marcar como no reconocido" : "Reconocer incidente"}
                            sx={{ bgcolor: isAck ? 'rgba(16,185,129,0.1)' : 'transparent' }}
                          >
                            <Check size={16} />
                          </IconButton>
                          <IconButton
                            onClick={() => navigate(`/analisis?device=${inc.deviceId}`)}
                            color="primary"
                            size="small"
                            title="Monitorear telemetría"
                          >
                            <ExternalLink size={16} />
                          </IconButton>
                          <IconButton
                            onClick={() => navigate(`/mapa?lat=${inc.lat}&lng=${inc.lng}&zoom=17.5`)}
                            color="secondary"
                            size="small"
                            title="Ver en Mapa 3D"
                          >
                            <Map size={16} />
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
      </Paper>
    </Box>
  );
};

export default Alerts;
