import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box, Paper, Typography, Button, TextField, Tabs, Tab, Chip, IconButton, Switch, Select, MenuItem,
} from '@mui/material';
import {
  User, Shield, Bell, Monitor, Save, Camera, Mail, ShieldCheck, Clock, Loader2
} from 'lucide-react';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('perfil');
  const [name, setName] = useState(user?.user_metadata?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const tabs = [
    { id: 'perfil', label: 'Mi Perfil', icon: <User size={18} /> },
    { id: 'seguridad', label: 'Seguridad', icon: <Shield size={18} /> },
    { id: 'notificaciones', label: 'Notificaciones', icon: <Bell size={18} /> },
    { id: 'sistema', label: 'Sistema', icon: <Monitor size={18} /> },
  ];

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaveStatus('Configuración actualizada con éxito');
      setTimeout(() => setSaveStatus(null), 3000);
    }, 1000);
  };

  return (
    <Box sx={{ maxWidth: 1152, mx: 'auto', py: 3, animation: 'fadeIn 0.5s ease' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>Configuración</Typography>
          <Typography variant="body2" color="text.secondary">Gestiona tu perfil, seguridad y preferencias del sistema EcoLoRa.</Typography>
        </Box>
        {saveStatus && (
          <Chip label={saveStatus} color="success" sx={{ fontWeight: 700 }} />
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 3fr' }, gap: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'row', lg: 'column' }, gap: 1, overflow: 'auto' }}>
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              startIcon={tab.icon}
              variant={activeTab === tab.id ? 'contained' : 'text'}
              sx={{
                justifyContent: 'flex-start', textTransform: 'none', fontWeight: activeTab === tab.id ? 900 : 600,
                px: 2, py: 1.5, fontSize: 14, minWidth: { xs: 'auto', lg: 200 },
                ...(activeTab !== tab.id && { color: 'text.secondary' }),
              }}
            >
              {tab.label}
            </Button>
          ))}
        </Box>

        <Box>
          {activeTab === 'perfil' && (
            <Paper sx={{ borderRadius: 3, overflow: 'hidden', animation: 'fadeIn 0.5s ease' }}>
              <Box sx={{ height: 128, background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}33, ${t.palette.primary.dark}33)`, position: 'relative' }}>
                <Box sx={{ position: 'absolute', bottom: -48, left: 4, display: 'flex', '&:hover .avatar-overlay': { opacity: 1 } }}>
                  <Box sx={{ width: 96, height: 96, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', boxShadow: 8,
                    background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})` }}>
                    <Typography variant="h3" color="white" sx={{ fontWeight: 900 }}>{name.charAt(0).toUpperCase() || 'O'}</Typography>
                    <IconButton size="small"
                      sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', opacity: 0, transition: 'opacity 0.2s', borderRadius: 0, color: 'white', '&:hover': { opacity: 1 } }}>
                      <Camera size={20} />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ pt: 14, pb: 6, px: 6 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2, mb: 6 }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{name || 'Operador EcoLoRa'}</Typography>
                    <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
                  </Box>
                  <Chip icon={<ShieldCheck size={14} />} label="Cuenta Verificada" color="success" sx={{ fontWeight: 900, fontSize: 10, letterSpacing: '0.15em' }} />
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, opacity: 0.4 }}>Información Personal</Typography>
                    <TextField label="Nombre Completo" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
                    <TextField label="Email Corporativo" value={user?.email} disabled fullWidth size="small" slotProps={{ input: { startAdornment: <Mail size={16} style={{ marginRight: 8, opacity: 0.3 }} /> } }} />
                    <Button variant="contained" startIcon={saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                      onClick={handleSave} disabled={saving}
                      sx={{ textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.15em', alignSelf: 'flex-start' }}>
                      GUARDAR CAMBIOS
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, opacity: 0.4 }}>Detalles de Cuenta</Typography>
                    <Paper sx={{ p: 3, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'primary.main' + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main' }}>
                          <Clock size={20} />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Último Acceso</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{new Date(user?.last_sign_in_at || '').toLocaleString()}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'success.main' + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'success.main' }}>
                          <Shield size={20} />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Rol de Sistema</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Ingeniero de Infraestructura</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Box>
                </Box>
              </Box>
            </Paper>
          )}

          {activeTab === 'seguridad' && (
            <Paper sx={{ p: 6, borderRadius: 3, animation: 'fadeIn 0.5s ease' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>Seguridad de la Cuenta</Typography>
                  <Typography variant="body2" color="text.secondary">Protege tu acceso y configura la autenticación.</Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: 'primary.main' + '14', borderRadius: 2, color: 'primary.main' }}>
                  <ShieldCheck size={24} />
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, opacity: 0.4 }}>Cambiar Contraseña</Typography>
                  <TextField type="password" label="Contraseña actual" fullWidth size="small" />
                  <TextField type="password" label="Nueva contraseña" fullWidth size="small" />
                  <TextField type="password" label="Confirmar nueva contraseña" fullWidth size="small" />
                  <Button fullWidth onClick={handleSave} sx={{ textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.15em' }}>
                    ACTUALIZAR CREDENCIALES
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, opacity: 0.4 }}>Autenticación en Dos Pasos (2FA)</Typography>
                  <Paper sx={{ p: 3, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Doble Factor</Typography>
                        <Typography variant="caption" color="text.secondary">Añade una capa extra de seguridad usando una app de autenticación.</Typography>
                      </Box>
                      <Switch defaultChecked color="primary" />
                    </Box>
                  </Paper>
                </Box>
              </Box>
            </Paper>
          )}

          {activeTab === 'notificaciones' && (
            <Paper sx={{ p: 6, borderRadius: 3, animation: 'fadeIn 0.5s ease' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 4 }}>Preferencias de Alerta</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { title: 'Alertas Críticas', desc: 'Contenedores al 100% o fallos de sensor.', color: 'error.main' },
                  { title: 'Mantenimiento de Flota', desc: 'Avisos de revisiones programadas.', color: 'warning.main' },
                  { title: 'Reportes Diarios', desc: 'Resumen de recolección al final del día.', color: 'primary.main' },
                  { title: 'Seguridad IoT', desc: 'Intentos de acceso no autorizados a gateways.', color: 'success.main' },
                ].map((item, idx) => (
                  <Paper key={idx} sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: item.color }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                      <Chip label="Email" size="small" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.15em' }} />
                      <Chip label="Push" size="small" color="primary" sx={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.15em' }} />
                    </Box>
                  </Paper>
                ))}
              </Box>
              <Button variant="contained" onClick={handleSave} sx={{ mt: 4, textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.15em' }}>
                GUARDAR PREFERENCIAS
              </Button>
            </Paper>
          )}

          {activeTab === 'sistema' && (
            <Paper sx={{ p: 6, borderRadius: 3, animation: 'fadeIn 0.5s ease' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 4 }}>Parámetros del Sistema</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, opacity: 0.4, mb: 2, display: 'block' }}>Apariencia</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Paper sx={{ p: 2, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                      <Box sx={{ width: '100%', height: 48, bgcolor: 'grey.900', borderRadius: 1 }} />
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>Obsidian Dark</Typography>
                    </Paper>
                    <Paper sx={{ p: 2, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer', opacity: 0.5 }}>
                      <Box sx={{ width: '100%', height: 48, bgcolor: 'white', borderRadius: 1 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Light Mode (Próximamente)</Typography>
                    </Paper>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, opacity: 0.4, mb: 2, display: 'block' }}>Frecuencia de Datos</Typography>
                  <Select defaultValue="Tiempo Real (5s)" fullWidth size="small">
                    <MenuItem value="Tiempo Real (5s)">Tiempo Real (5s)</MenuItem>
                    <MenuItem value="Estándar (30s)">Estándar (30s)</MenuItem>
                    <MenuItem value="Ahorro de Energía (5min)">Ahorro de Energía (5min)</MenuItem>
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                    Afecta el consumo de datos de los Gateways LoRaWAN.
                  </Typography>
                </Box>

              </Box>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Settings;
