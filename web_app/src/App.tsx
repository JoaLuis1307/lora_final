import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import Layout from './components/layout/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import './styles/global.css';

const Overview = lazy(() => import('./pages/Overview'));
const Mapa = lazy(() => import('./pages/Mapa'));
const Bins = lazy(() => import('./pages/Bins'));
const Devices = lazy(() => import('./pages/Devices'));
const Analysis = lazy(() => import('./pages/Analysis'));
const Settings = lazy(() => import('./pages/Settings'));
const RoutesPage = lazy(() => import('./pages/Routes'));
const Login = lazy(() => import('./pages/Login'));
const Alerts = lazy(() => import('./pages/Alerts'));
const StatsPage = lazy(() => import('./pages/Stats'));

const LoadingScreen = () => (
  <Box sx={{ minHeight: '100vh', bgcolor: '#131314', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Box sx={{ width: 48, height: 48, border: '4px solid', borderColor: 'rgba(138,180,248,0.2)', borderTopColor: 'primary.main', borderRadius: '50%' }} className="spin" />
  </Box>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#131314', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ width: 48, height: 48, border: '4px solid', borderColor: 'rgba(138,180,248,0.2)', borderTopColor: 'primary.main', borderRadius: '50%' }} className="spin" />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

function AppContent() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark';
    const initial = saved || 'dark';
    document.documentElement.setAttribute('data-theme', initial);
    return initial;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('theme', mode);
  }, [mode]);

  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            primary: { main: '#8ab4f8', dark: '#669df6', light: '#d2e3fc', contrastText: '#131314' },
            secondary: { main: '#c2e7ff', contrastText: '#131314' },
            error: { main: '#f28b82' },
            warning: { main: '#fdd663' },
            success: { main: '#81c995' },
            background: { default: '#131314', paper: '#1e1f20' },
            text: { primary: '#e3e3e3', secondary: '#9aa0a6' },
            divider: '#3c4043',
          }
        : {
            primary: { main: '#0b57d0', dark: '#0842a0', light: '#7cacf8', contrastText: '#ffffff' },
            secondary: { main: '#12b5cb', contrastText: '#ffffff' },
            error: { main: '#b3261e' },
            warning: { main: '#b06000' },
            success: { main: '#146c2e' },
            background: { default: '#f8fafd', paper: '#ffffff' },
            text: { primary: '#1f1f1f', secondary: '#5e5e5e' },
            divider: 'rgba(0,0,0,0.12)',
          }),
    },
    typography: {
      fontFamily: '"Outfit", "Roboto", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      button: { fontWeight: 700, textTransform: 'none', letterSpacing: '0' },
    },
    shape: { borderRadius: 4 },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { backgroundColor: mode === 'dark' ? '#131314' : '#f8fafd' } },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            ...(mode === 'dark'
              ? { boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }
              : { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }),
          },
        },
      },
      MuiButton: {
        styleOverrides: { root: { borderRadius: 4, fontSize: '0.75rem', fontWeight: 700, padding: '8px 16px' } },
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 4 } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { padding: '12px 16px' },
          head: { fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: mode === 'dark' ? '#9aa0a6' : '#5e5e5e' },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(138,180,248,0.03)' : 'rgba(0,0,0,0.04)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600, fontSize: '0.65rem' } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRadius: 4,
            ...(mode === 'dark' ? { boxShadow: '0 25px 50px rgba(0,0,0,0.5)' } : {}),
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiOutlinedInput-root': {
              borderRadius: 4,
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              '&:focus-within': {
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                boxShadow: `0 0 0 1px ${mode === 'dark' ? 'rgba(138,180,248,0.3)' : 'rgba(11,87,208,0.2)'}`,
              },
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 2, height: 4 } },
      },
      MuiToggleButton: {
        styleOverrides: { root: { fontWeight: 700, fontSize: '0.7rem', textTransform: 'none', border: 'none' } },
      },
      MuiToggleButtonGroup: {
        styleOverrides: { root: { border: 'none' } },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 4 } },
      },
      MuiDrawer: {
        styleOverrides: { paper: { backgroundImage: 'none' } },
      },
      MuiMenu: {
        styleOverrides: { paper: { backgroundImage: 'none', borderRadius: 4 } },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            ...(mode === 'dark' ? { borderColor: 'rgba(255,255,255,0.04)' } : { borderColor: 'rgba(0,0,0,0.06)' }),
          },
        },
      },
    },
  }), [mode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/mapa-publico" element={<Mapa />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout mode={mode} setMode={setMode} />
                </ProtectedRoute>
              }>
                <Route index element={<Overview />} />
                <Route path="mapa" element={<Mapa />} />
                <Route path="contenedores" element={<Bins />} />
                <Route path="dispositivos" element={<Devices />} />
                <Route path="analisis" element={<Analysis />} />
                <Route path="ajustes" element={<Settings />} />
                <Route path="rutas" element={<RoutesPage />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="alertas" element={<Alerts />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

function App() {
  return <AppContent />;
}

export default App;
