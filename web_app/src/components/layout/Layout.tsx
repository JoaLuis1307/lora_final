import React, { useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './Sidebar/Sidebar';

interface LayoutProps {
  mode: 'light' | 'dark';
  setMode: (mode: 'light' | 'dark') => void;
}

const Layout: React.FC<LayoutProps> = ({ mode, setMode }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const location = useLocation();
  const isMapRoute = location.pathname === '/mapa' || location.pathname === '/rutas';

  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const handleToggle = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={handleToggle}
        theme={mode}
        onToggleTheme={toggleTheme}
      />

      {!isCollapsed && (
        <Box
          onClick={() => setIsCollapsed(true)}
          sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 95, display: { lg: 'none' } }}
        />
      )}

      <Box component="main" sx={{
        flex: 1, display: 'flex', flexDirection: 'column', width: '100%',
        overflowY: 'auto', overflowX: 'hidden',
        ml: isCollapsed ? '70px' : '240px',
        transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <Box sx={{
          p: isMapRoute ? 0 : { xs: 2, md: 3 },
          width: '100%', flex: 1, display: 'flex', flexDirection: 'column',
        }}>
          <Outlet context={{ theme: mode }} />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
