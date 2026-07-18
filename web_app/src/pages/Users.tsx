import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, Trash2, Edit, Mail, UserPlus, 
  RefreshCw, CheckCircle2, User as UserIcon
} from 'lucide-react';
import { 
  Box, Paper, Typography, IconButton, Button, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Chip, Dialog, 
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, 
  CircularProgress, Alert
} from '@mui/material';
import { userService, User } from '../services/userService';

const googleCardSx = (t: any) => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)',
  border: 'none',
  boxShadow: 'none',
  borderRadius: '16px',
  transition: 'all 0.2s',
  '&:hover': {
    bgcolor: t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'
  }
});

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form states
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('Operador');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError('No se pudieron cargar los usuarios. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail || !formPassword) return;
    setSubmitting(true);
    try {
      await userService.createUser({
        email: formEmail,
        password: formPassword,
        name: formName,
        role: formRole
      });
      setCreateModalOpen(false);
      // Clean form
      setFormEmail('');
      setFormPassword('');
      setFormName('');
      setFormRole('Operador');
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Error al crear el usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await userService.updateUserRole(selectedUser.id, formRole);
      setEditModalOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar el rol');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: number, email: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar al usuario ${email}?`)) {
      try {
        await userService.deleteUser(id);
        loadUsers();
      } catch (err: any) {
        alert(err.message || 'Error al eliminar el usuario');
      }
    }
  };

  // Stats calculation
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'Administrador').length;
  const plannerCount = users.filter(u => u.role === 'Planificador').length;
  const operatorCount = users.filter(u => u.role === 'Operador' || !u.role).length;

  const getRoleChipColor = (role: string) => {
    switch (role) {
      case 'Administrador':
        return {
          bgcolor: 'rgba(26,115,232,0.08)',
          color: '#1a73e8',
        };
      case 'Planificador':
        return {
          bgcolor: 'rgba(52,168,83,0.08)',
          color: '#34a853',
        };
      default:
        return {
          bgcolor: 'rgba(128,128,128,0.08)',
          color: 'text.secondary',
        };
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, p: 0.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
            Roles y Accesos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mt: 0.5, opacity: 0.8 }}>
            Administra las credenciales, roles y permisos de acceso para los operadores y planificadores.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <IconButton onClick={loadUsers} sx={{ bgcolor: 'action.hover', color: 'text.secondary' }}>
            <RefreshCw size={16} />
          </IconButton>
          <Button
            onClick={() => setCreateModalOpen(true)}
            startIcon={<UserPlus size={16} />}
            sx={{
              fontSize: 11.5,
              fontWeight: 700,
              borderRadius: '24px',
              px: 2.5, py: 0.75,
              border: 'none',
              textTransform: 'none',
              bgcolor: '#1a73e8',
              color: '#ffffff',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: '#1557b0',
                boxShadow: 'none'
              }
            }}
          >
            Nuevo Usuario
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.5fr repeat(3, 1fr)' }, gap: 3 }}>
        {[
          { label: 'Total Cuentas', value: totalUsers, sub: 'Usuarios registrados', icon: <UserIcon size={20} /> },
          { label: 'Administradores', value: adminCount, sub: 'Control total del sistema', icon: <ShieldCheck size={20} /> },
          { label: 'Planificadores', value: plannerCount, sub: 'Logística de rutas', icon: <CheckCircle2 size={20} /> },
          { label: 'Operadores', value: operatorCount, sub: 'Lectura de telemetría', icon: <UserIcon size={20} /> },
        ].map((kpi, idx) => (
          <Paper key={idx} sx={(t) => ({ ...googleCardSx(t), p: 2.5 })}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary', fontSize: 10, display: 'block', mb: 0.75 }}>
                  {kpi.label}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: 30, color: 'text.primary', lineHeight: 1.1 }}>
                  {kpi.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: 9.5, opacity: 0.6, mt: 0.5, display: 'block' }}>
                  {kpi.sub}
                </Typography>
              </Box>
              <Box sx={{ color: 'text.secondary', opacity: 0.5 }}>
                {kpi.icon}
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Error Alert */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Users Table */}
      <TableContainer component={Paper} sx={(t) => ({ ...googleCardSx(t), overflow: 'hidden', p: 1 })}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, flexDirection: 'column', gap: 2 }}>
            <CircularProgress size={32} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Cargando usuarios...</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ '&:hover': { bgcolor: 'transparent' } }}>
                <TableCell>Nombre</TableCell>
                <TableCell>Correo electrónico</TableCell>
                <TableCell>Rol de Acceso</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const colors = getRoleChipColor(u.role || 'Operador');
                return (
                  <TableRow key={u.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                      {u.name || 'Sin Nombre'}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12.5 }}>
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={u.role || 'Operador'} 
                        size="small" 
                        sx={{ 
                          fontWeight: 800, 
                          fontSize: 9.5, 
                          bgcolor: colors.bgcolor, 
                          color: colors.color,
                          border: 'none',
                          height: 22,
                          textTransform: 'uppercase'
                        }} 
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <IconButton 
                          size="small" 
                          onClick={() => {
                            setSelectedUser(u);
                            setFormRole(u.role || 'Operador');
                            setEditModalOpen(true);
                          }}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}
                        >
                          <Edit size={14} />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'error.main' + '14' } }}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', fontStyle: 'italic' }}>
                      No se encontraron usuarios registrados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      {/* Modal: Create User */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
            Registrar Nuevo Usuario
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Credenciales de Acceso
          </Typography>
        </DialogTitle>
        <form onSubmit={handleCreateUser}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField 
              label="Nombre Completo" 
              placeholder="Ej: Ing. Juan Pérez" 
              fullWidth 
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <TextField 
              label="Correo Electrónico" 
              type="email" 
              placeholder="Ej: jperez@ecosmart.com" 
              fullWidth 
              required
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />
            <TextField 
              label="Contraseña Temporal" 
              type="password" 
              placeholder="Clave de primer ingreso" 
              fullWidth 
              required
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
            />
            <TextField
              select
              label="Rol del Usuario"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value)}
              fullWidth
            >
              <MenuItem value="Administrador">Administrador</MenuItem>
              <MenuItem value="Planificador">Planificador de Rutas</MenuItem>
              <MenuItem value="Operador">Operador de Telemetría</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={() => setCreateModalOpen(false)} variant="outlined" color="inherit" fullWidth sx={{ textTransform: 'none', borderRadius: '24px' }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" color="primary" fullWidth disabled={submitting} sx={{ textTransform: 'none', borderRadius: '24px', boxShadow: 'none' }}>
              {submitting ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Modal: Edit User Role */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
            Editar Rol de Acceso
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {selectedUser?.email}
          </Typography>
        </DialogTitle>
        <form onSubmit={handleUpdateRole}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              select
              label="Seleccionar Nuevo Rol"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value)}
              fullWidth
            >
              <MenuItem value="Administrador">Administrador</MenuItem>
              <MenuItem value="Planificador">Planificador de Rutas</MenuItem>
              <MenuItem value="Operador">Operador de Telemetría</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={() => setEditModalOpen(false)} variant="outlined" color="inherit" fullWidth sx={{ textTransform: 'none', borderRadius: '24px' }}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" color="primary" fullWidth disabled={submitting} sx={{ textTransform: 'none', borderRadius: '24px', boxShadow: 'none' }}>
              {submitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Users;
