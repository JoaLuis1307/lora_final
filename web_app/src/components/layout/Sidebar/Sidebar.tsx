import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, Truck, Map as MapIcon, BarChart3, Settings, LogOut,
  Bell, ShieldCheck, Cpu, Route, Menu, Sun, Moon, Trash2, Activity
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { authService } from '../../../services/authService';
import {
  Box, Typography, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Divider, Tooltip,
} from '@mui/material';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, theme, onToggleTheme }) => {
  const { user } = useAuth();

  const handleLogout = async () => {
    await authService.logout();
  };

  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Operador';
  const userInitial = fullName.charAt(0).toUpperCase();
  const drawerWidth = isCollapsed ? 70 : 240;

  interface SidebarItem {
    icon: React.ReactNode;
    label: string;
    path: string;
    badge?: number;
  }

  interface SidebarSection {
    title: string;
    items: SidebarItem[];
  }

  const sections: SidebarSection[] = [
    {
      title: 'Comando',
      items: [
        { icon: <Home size={20} strokeWidth={1.8} />, label: 'Panel', path: '/' },
        { icon: <MapIcon size={20} strokeWidth={1.8} />, label: 'Mapa 3D', path: '/mapa' },
        { icon: <Trash2 size={20} strokeWidth={1.8} />, label: 'Contenedor', path: '/contenedores' },
        { icon: <Route size={20} strokeWidth={1.8} />, label: 'Rutas', path: '/rutas' },
        { icon: <Activity size={20} strokeWidth={1.8} />, label: 'Stats', path: '/stats' },
      ],
    },
    {
      title: 'Infra',
      items: [
        { icon: <Cpu size={20} strokeWidth={1.8} />, label: 'IoT', path: '/dispositivos' },
      ],
    },
    {
      title: 'IA',
      items: [
        { icon: <BarChart3 size={20} strokeWidth={1.8} />, label: 'Análisis', path: '/analisis' },
        { icon: <Bell size={20} strokeWidth={1.8} />, label: 'Notificaciones', path: '/alertas' },
      ],
    },
    {
      title: 'Admin',
      items: [
        { icon: <ShieldCheck size={20} strokeWidth={1.8} />, label: 'Roles', path: '/usuarios' },
      ],
    },
  ];

  return (
    <Box
      sx={{
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 120,
        width: drawerWidth,
        bgcolor: 'var(--bg-sidebar)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 0 24px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          flexDirection: isCollapsed ? 'column' : 'row',
          gap: isCollapsed ? 2 : 0,
          px: isCollapsed ? 1 : 1.5,
          py: 1.5,
          minHeight: 56,
        }}
      >
        {!isCollapsed && (
          <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.03em', ml: 1, color: 'text.primary' }}>
            EcoSmart<span style={{ color: 'var(--primary)' }}>IoT</span>
          </Typography>
        )}
        <IconButton
          onClick={onToggle}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <Menu size={20} />
        </IconButton>
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
        {sections.map((section, idx) => (
          <Box key={section.title} sx={{ mt: idx > 0 && !isCollapsed ? 1.5 : 0 }}>
            {!isCollapsed && (
              <Typography
                variant="caption"
                sx={{
                  px: 2.5, mb: 0.5, mt: 1.5, display: 'block',
                  fontWeight: 700, letterSpacing: '0.25em', color: 'text.secondary',
                  fontSize: '0.55rem', textTransform: 'uppercase', opacity: 0.5,
                }}
              >
                {section.title}
              </Typography>
            )}
            <List dense disablePadding>
              {section.items.map((item) => (
                <ListItem key={item.path} disablePadding sx={{ px: isCollapsed ? 0.5 : 0.5 }}>
                  <ListItemButton
                    component={NavLink}
                    to={item.path}
                      sx={{
                        flexDirection: isCollapsed ? 'column' : 'row',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: isCollapsed ? 0.3 : 1.5,
                        py: isCollapsed ? 1.5 : 1,
                        minHeight: isCollapsed ? 64 : 44,
                        px: isCollapsed ? 0 : 1.5,
                        borderRadius: 2,
                        color: 'text.secondary',
                        position: 'relative',
                        '&.active': {
                          color: 'primary.main',
                          '& .MuiListItemIcon-root': { color: 'primary.main' },
                          '&::before': !isCollapsed ? {
                            content: '""',
                            position: 'absolute',
                            left: 0, top: '50%', transform: 'translateY(-50%)',
                            width: 2, height: 12,
                            bgcolor: 'primary.main',
                            borderRadius: 1,
                          } : {},
                        },
                      }}
                  >
                    <ListItemIcon sx={{ minWidth: isCollapsed ? 20 : 36, justifyContent: 'center', color: 'inherit' }}>
                      {item.icon}
                    </ListItemIcon>
                    {!isCollapsed && (
                      <ListItemText primary={item.label} sx={{ '& .MuiListItemText-primary': { fontSize: '0.8rem', fontWeight: 600, color: 'inherit' } }} />
                    )}
                    {isCollapsed && (
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.55rem', color: 'inherit', lineHeight: 1 }}>
                        {item.label}
                      </Typography>
                    )}
                    {!isCollapsed && item.badge && (
                      <Box sx={{ ml: 'auto', bgcolor: 'error.main', color: '#fff', fontSize: '0.5rem', fontWeight: 700, px: 0.75, py: 0.15, borderRadius: '999px' }}>
                        {item.badge}
                      </Box>
                    )}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Box>

      {/* Bottom Section */}
      <Box sx={{ bgcolor: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
        <Box sx={{ px: isCollapsed ? 1 : 1.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* User Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: isCollapsed ? 0.5 : 1, borderRadius: 2, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
            <Avatar sx={{ width: isCollapsed ? 32 : 36, height: isCollapsed ? 32 : 36, fontSize: '0.75rem', bgcolor: 'primary.main', fontWeight: 900 }}>
              {userInitial}
            </Avatar>
            {!isCollapsed && (
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.75rem', lineHeight: 1.2 }}>
                  {fullName}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary', fontSize: '0.55rem', textTransform: 'uppercase' }}>
                  Operador
                </Typography>
              </Box>
            )}
          </Box>

          {/* Quick Actions */}
          {!isCollapsed ? (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton onClick={onToggleTheme} size="small" sx={{ flex: 1, borderRadius: 2, color: 'text.secondary' }}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </IconButton>
              <IconButton size="small" sx={{ flex: 1, borderRadius: 2, color: 'text.secondary', position: 'relative' }}>
                <Bell size={16} />
                <Box sx={{ position: 'absolute', top: 6, right: 8, width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main' }} />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Tooltip title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} placement="right" arrow>
                <IconButton onClick={onToggleTheme} size="small" sx={{ width: 36, height: 36, borderRadius: 2, color: 'text.secondary' }}>
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Notificaciones" placement="right" arrow>
                <IconButton size="small" sx={{ width: 36, height: 36, borderRadius: 2, color: 'text.secondary', position: 'relative' }}>
                  <Bell size={16} />
                  <Box sx={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main' }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Settings */}
          <ListItemButton
            component={NavLink}
            to="/ajustes"
            sx={{
              borderRadius: 2,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              flexDirection: isCollapsed ? 'column' : 'row',
              gap: isCollapsed ? 0.3 : 1.5,
              py: isCollapsed ? 1.2 : 1,
              minHeight: isCollapsed ? 48 : 40,
              color: 'text.secondary',
              '&.active': { color: 'primary.main' },
            }}
          >
            <ListItemIcon sx={{ minWidth: isCollapsed ? 20 : 36, justifyContent: 'center', color: 'inherit' }}>
              <Settings size={20} strokeWidth={1.8} />
            </ListItemIcon>
            {!isCollapsed && <ListItemText primary="Ajustes" sx={{ '& .MuiListItemText-primary': { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: 'inherit' } }} />}
            {isCollapsed && (
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.5rem', color: 'inherit', lineHeight: 1 }}>
                Ajustes
              </Typography>
            )}
          </ListItemButton>

          <Divider sx={{ mx: 1 }} />

          {/* Logout */}
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              flexDirection: isCollapsed ? 'column' : 'row',
              gap: isCollapsed ? 0.3 : 1.5,
              py: isCollapsed ? 1.2 : 1,
              minHeight: isCollapsed ? 48 : 40,
              bgcolor: 'rgba(251,113,133,0.06)',
            }}
          >
            <ListItemIcon sx={{ minWidth: isCollapsed ? 20 : 36, justifyContent: 'center', color: 'error.main', opacity: 0.7 }}>
              <LogOut size={20} strokeWidth={1.8} />
            </ListItemIcon>
            {!isCollapsed && (
              <ListItemText primary="Salir" sx={{ '& .MuiListItemText-primary': { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: 'error.main', opacity: 0.7 } }} />
            )}
            {isCollapsed && (
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.5rem', color: 'error.main', lineHeight: 1, opacity: 0.7 }}>
                Salir
              </Typography>
            )}
          </ListItemButton>
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(Sidebar);
