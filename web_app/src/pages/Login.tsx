import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { Loader2, ShieldCheck, Cpu, Eye, EyeOff, ShieldAlert, X } from 'lucide-react';
import {
  Box, Paper, Typography, TextField, Button, IconButton, Divider, InputAdornment
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import MapPreview from '../components/dashboard/MapPreview/MapPreview';

const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  // Sync theme with page HTML attribute so other parts/css sync correctly
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem('theme', themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isRegister && password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    const { error } = isRegister
      ? await authService.signUp(email, password, fullName)
      : await authService.login(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      if (isRegister) {
        setMessage('Registro exitoso. Revisa tu correo para confirmar la cuenta.');
        setLoading(false);
      } else {
        navigate('/');
      }
    }
  };

  const handleGuestLogin = () => {
    setLoading(true);
    const guestUser = {
      id: 'guest-id-' + Math.random().toString(36).substring(2, 9),
      email: 'guest@ecolora.com',
      user_metadata: { full_name: 'Invitado Operador' },
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString()
    };
    localStorage.setItem('guest_user', JSON.stringify(guestUser));
    window.location.href = '/';
  };

  return (
    <Box sx={{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: '"Outfit", "Roboto", "Inter", sans-serif',
    }}>
      {/* 3D Map Background (Public View for Citizens) */}
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MapPreview 
          isPage={true} 
          showSignInButton={true} 
          onSignInClick={() => setShowForm(true)}
          currentThemeProp={themeMode}
          onToggleThemeProp={toggleTheme}
        />
      </Box>

      {/* Centered Google Accounts Style Login Dialog */}
      {showForm && (
        <Box sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          bgcolor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          animation: 'fadeIn 0.2s ease-out',
          '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 }
          }
        }}>
          <Paper elevation={0} sx={{
            width: '100%',
            maxWidth: 450,
            borderRadius: '28px', // Large Material You / MD3 rounded corners
            bgcolor: themeMode === 'dark' ? '#1e1f20' : '#ffffff', // Google account dark & light colors
            border: '1px solid',
            borderColor: themeMode === 'dark' ? '#3c4043' : '#dadce0',
            p: { xs: 4, sm: 5 },
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '@keyframes scaleIn': {
              from: { transform: 'scale(0.92)', opacity: 0 },
              to: { transform: 'scale(1)', opacity: 1 }
            }
          }}>
            {/* Close Button X */}
            <IconButton 
              onClick={() => { setShowForm(false); setError(null); setMessage(null); }} 
              sx={{
                position: 'absolute',
                top: 18,
                right: 18,
                color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368',
                '&:hover': {
                  bgcolor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                }
              }}
            >
              <X size={18} />
            </IconButton>

            {/* Google Accounts Style Brand Header */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3.5, gap: 1 }}>
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: themeMode === 'dark' ? '#2d2e30' : '#f1f3f4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: themeMode === 'dark' ? '#8ab4f8' : '#1a73e8',
                mb: 1
              }}>
                <Cpu size={24} />
              </Box>
              <Typography variant="h5" sx={{ 
                fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                fontWeight: 400, 
                color: themeMode === 'dark' ? '#e3e3e3' : '#202124',
                fontSize: '24px',
                letterSpacing: '-0.01em',
                textAlign: 'center'
              }}>
                {isRegister ? 'Crear tu cuenta' : 'Iniciar sesión'}
              </Typography>
              <Typography sx={{ 
                fontFamily: 'Roboto, Arial, sans-serif',
                color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368', 
                fontWeight: 400, 
                fontSize: '16px',
                textAlign: 'center'
              }}>
                {isRegister ? 'para registrarte como operador' : 'para continuar en EcoLoRa'}
              </Typography>
            </Box>

            {/* Form */}
            <Box component="form" onSubmit={handleAuth} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {isRegister && (
                <TextField
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  fullWidth
                  required={isRegister}
                  label="Nombre completo"
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      '& fieldset': { border: '1px solid', borderColor: themeMode === 'dark' ? '#8e918f' : '#747775' },
                      '&:hover fieldset': { borderColor: themeMode === 'dark' ? '#c4c7c5' : '#1f1f1f' },
                      '&.Mui-focused fieldset': { borderColor: themeMode === 'dark' ? '#a8c7fa' : '#0b57d0', borderWidth: '2px' }
                    },
                    '& .MuiInputLabel-root': { color: themeMode === 'dark' ? '#c4c7c5' : '#444746' },
                    '& .MuiInputLabel-root.Mui-focused': { color: themeMode === 'dark' ? '#a8c7fa' : '#0b57d0' },
                    '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#e3e3e3' : '#1f1f1f', py: 2, fontSize: 16 }
                  }}
                />
              )}

              <TextField
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                label="Correo electrónico"
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    '& fieldset': { border: '1px solid', borderColor: themeMode === 'dark' ? '#8e918f' : '#747775' },
                    '&:hover fieldset': { borderColor: themeMode === 'dark' ? '#c4c7c5' : '#1f1f1f' },
                    '&.Mui-focused fieldset': { borderColor: themeMode === 'dark' ? '#a8c7fa' : '#0b57d0', borderWidth: '2px' }
                  },
                  '& .MuiInputLabel-root': { color: themeMode === 'dark' ? '#c4c7c5' : '#444746' },
                  '& .MuiInputLabel-root.Mui-focused': { color: themeMode === 'dark' ? '#a8c7fa' : '#0b57d0' },
                  '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#e3e3e3' : '#1f1f1f', py: 2, fontSize: 16 }
                }}
              />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  required
                  label="Contraseña"
                  variant="outlined"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} size="small" edge="end" sx={{ color: themeMode === 'dark' ? '#c4c7c5' : '#444746' }}>
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      '& fieldset': { border: '1px solid', borderColor: themeMode === 'dark' ? '#8e918f' : '#747775' },
                      '&:hover fieldset': { borderColor: themeMode === 'dark' ? '#c4c7c5' : '#1f1f1f' },
                      '&.Mui-focused fieldset': { borderColor: themeMode === 'dark' ? '#a8c7fa' : '#0b57d0', borderWidth: '2px' }
                    },
                    '& .MuiInputLabel-root': { color: themeMode === 'dark' ? '#c4c7c5' : '#444746' },
                    '& .MuiInputLabel-root.Mui-focused': { color: themeMode === 'dark' ? '#a8c7fa' : '#0b57d0' },
                    '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#e3e3e3' : '#1f1f1f', py: 2, fontSize: 16 }
                  }}
                />
                
                {!isRegister && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 0.5 }}>
                    <Button variant="text" size="small" sx={{
                      textTransform: 'none',
                      fontSize: 14,
                      fontWeight: 500,
                      p: 0,
                      minWidth: 0,
                      color: themeMode === 'dark' ? '#8ab4f8' : '#1a73e8',
                      fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
                    }}>
                      ¿Olvidaste tu contraseña?
                    </Button>
                  </Box>
                )}
              </Box>

              {isRegister && (
                <TextField
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  required={isRegister}
                  label="Confirmar contraseña"
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      '& fieldset': { border: '1px solid', borderColor: themeMode === 'dark' ? '#8e918f' : '#747775' },
                      '&:hover fieldset': { borderColor: themeMode === 'dark' ? '#c4c7c5' : '#1f1f1f' },
                      '&.Mui-focused fieldset': { borderColor: themeMode === 'dark' ? '#a8c7fa' : '#0b57d0', borderWidth: '2px' }
                    },
                    '& .MuiInputLabel-root': { color: themeMode === 'dark' ? '#c4c7c5' : '#444746' },
                    '& .MuiInputLabel-root.Mui-focused': { color: themeMode === 'dark' ? '#a8c7fa' : '#0b57d0' },
                    '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#e3e3e3' : '#1f1f1f', py: 2, fontSize: 16 }
                  }}
                />
              )}

              {/* Error/Success message Panel */}
              {error && (
                <Paper sx={{
                  p: 1.8,
                  bgcolor: themeMode === 'dark' ? 'rgba(242, 139, 130, 0.12)' : 'rgba(179, 38, 30, 0.05)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  border: '1px solid rgba(242, 139, 130, 0.24)'
                }}>
                  <ShieldAlert size={18} color={themeMode === 'dark' ? '#f28b82' : '#b3261e'} />
                  <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 13, color: themeMode === 'dark' ? '#f28b82' : '#b3261e' }}>{error}</Typography>
                </Paper>
              )}

              {message && (
                <Paper sx={{
                  p: 1.8,
                  bgcolor: themeMode === 'dark' ? 'rgba(129, 201, 149, 0.12)' : 'rgba(20, 108, 46, 0.05)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  border: '1px solid rgba(129, 201, 149, 0.24)'
                }}>
                  <ShieldCheck size={18} color={themeMode === 'dark' ? '#81c995' : '#146c2e'} />
                  <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 13, color: themeMode === 'dark' ? '#81c995' : '#146c2e' }}>{message}</Typography>
                </Paper>
              )}

              {/* Google style footer buttons (Left: Create account, Right: Next) */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, minHeight: 48 }}>
                <Button
                  variant="text"
                  onClick={() => { setIsRegister(!isRegister); setError(null); setMessage(null); }}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: 14,
                    color: themeMode === 'dark' ? '#8ab4f8' : '#1a73e8',
                    fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                    '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
                  }}
                >
                  {isRegister ? 'Iniciar sesión en su lugar' : 'Crear cuenta'}
                </Button>
                
                <Button
                  type="submit"
                  disabled={loading}
                  variant="contained"
                  startIcon={loading ? <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : undefined}
                  sx={{
                    borderRadius: '20px',
                    textTransform: 'none',
                    fontWeight: 550,
                    px: 3.5,
                    py: 1.2,
                    fontSize: 14,
                    bgcolor: themeMode === 'dark' ? '#8ab4f8' : '#1a73e8',
                    color: themeMode === 'dark' ? '#131314' : '#ffffff',
                    fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                    '&:hover': {
                      bgcolor: themeMode === 'dark' ? '#aecbfa' : '#1557b0',
                    }
                  }}
                >
                  {isRegister ? 'Registrarse' : 'Siguiente'}
                </Button>
              </Box>

            </Box>

            {/* Social logins & Guest login section */}
            {!isRegister && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 3.5 }}>
                  <Divider sx={{ flex: 1, borderColor: themeMode === 'dark' ? '#3c4043' : '#dadce0' }} />
                  <Typography variant="caption" sx={{
                    fontWeight: 400,
                    color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368',
                    fontSize: 12,
                    fontFamily: 'Roboto, Arial, sans-serif',
                    userSelect: 'none'
                  }}>
                    o acceder con
                  </Typography>
                  <Divider sx={{ flex: 1, borderColor: themeMode === 'dark' ? '#3c4043' : '#dadce0' }} />
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {[
                      { Icon: GoogleIcon, label: 'Google' },
                      { Icon: GitHubIcon, label: 'GitHub' }
                    ].map(({ Icon, label }, i) => (
                      <Button
                        key={i}
                        fullWidth
                        startIcon={<Icon sx={{ fontSize: 18 }} />}
                        sx={{
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: themeMode === 'dark' ? '#3c4043' : '#dadce0',
                          bgcolor: 'transparent',
                          color: themeMode === 'dark' ? '#e3e3e3' : '#202124',
                          fontWeight: 500,
                          fontSize: 13,
                          py: 1.2,
                          textTransform: 'none',
                          fontFamily: 'Roboto, Arial, sans-serif',
                          '&:hover': {
                            borderColor: themeMode === 'dark' ? '#5f6368' : '#18181b',
                            bgcolor: themeMode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                          }
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Box>

                  <Button
                    variant="text"
                    fullWidth
                    disabled={loading}
                    onClick={handleGuestLogin}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: 13,
                      color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368',
                      fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                      '&:hover': { 
                        bgcolor: 'transparent', 
                        color: themeMode === 'dark' ? '#8ab4f8' : '#1a73e8',
                        textDecoration: 'underline' 
                      }
                    }}
                  >
                    Entrar como Invitado Operador
                  </Button>
                </Box>
              </>
            )}

          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default Login;
