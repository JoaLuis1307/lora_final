import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { Loader2, ShieldCheck, Cpu, Eye, EyeOff, Mail, Lock, User as UserIcon, ShieldAlert, Sun, Moon } from 'lucide-react';
import {
  Box, Paper, Typography, TextField, Button, IconButton, Checkbox, FormControlLabel, Divider, InputAdornment
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import XIcon from '@mui/icons-material/X';
import AppleIcon from '@mui/icons-material/Apple';

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
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: themeMode === 'dark' ? '#09090b' : '#fafafa', // Clean solid neutral background
      position: 'relative',
      p: { xs: 2, sm: 3 },
      fontFamily: '"Outfit", "Roboto", "Inter", sans-serif',
      transition: 'background-color 0.3s ease'
    }}>
      
      {/* Theme Toggle Button (Top-Right Corner, subtle, borderless outline) */}
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 100 }}>
        <IconButton onClick={toggleTheme} sx={{
          border: '1px solid',
          borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7',
          color: themeMode === 'dark' ? '#f4f4f5' : '#18181b',
          bgcolor: themeMode === 'dark' ? '#18181b' : '#ffffff',
          borderRadius: '8px',
          p: 1.2,
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: themeMode === 'dark' ? '#27272a' : '#f4f4f5',
          }
        }}>
          {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
      </Box>

      {/* Centered Login Card */}
      <Paper elevation={0} sx={{
        width: '100%',
        maxWidth: 420,
        borderRadius: '12px',
        bgcolor: themeMode === 'dark' ? '#18181b' : '#ffffff',
        border: '1px solid',
        borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7',
        p: { xs: 4, sm: 5 },
        boxShadow: themeMode === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1,
        transition: 'all 0.3s ease'
      }}>
        
        {/* Brand Header */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, gap: 1.5 }}>
          <Box sx={{
            width: 40,
            height: 40,
            borderRadius: '8px',
            bgcolor: themeMode === 'dark' ? '#ffffff' : '#09090b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: themeMode === 'dark' ? '#09090b' : '#ffffff'
          }}>
            <Cpu size={20} />
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: themeMode === 'dark' ? '#ffffff' : '#09090b', letterSpacing: '-0.02em' }}>
              EcoLoRa
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 13 }}>
              {isRegister ? 'Crea una cuenta de operador' : 'Inicia sesión en tu panel de control'}
            </Typography>
          </Box>
        </Box>

        {/* Form */}
        <Box component="form" onSubmit={handleAuth} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          
          {isRegister && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.8, display: 'block' }}>
                Nombre Completo
              </Typography>
              <TextField
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                fullWidth
                required={isRegister}
                placeholder="Nombre Completo"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <UserIcon size={16} style={{ color: themeMode === 'dark' ? '#71717a' : '#a1a1aa' }} />
                      </InputAdornment>
                    )
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: themeMode === 'dark' ? '#09090b' : '#ffffff',
                    border: '1px solid',
                    borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7',
                    transition: 'border-color 0.2s ease',
                    '& fieldset': { border: 'none' },
                    '&:hover': { borderColor: themeMode === 'dark' ? '#3f3f46' : '#cbd5e1' },
                    '&.Mui-focused': { borderColor: 'primary.main', boxShadow: themeMode === 'dark' ? '0 0 0 2px rgba(138, 180, 248, 0.15)' : '0 0 0 2px rgba(11, 87, 208, 0.15)' }
                  },
                  '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#f4f4f5' : '#18181b', py: 1.4, fontSize: 14 }
                }}
              />
            </Box>
          )}

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.8, display: 'block' }}>
              Correo Electrónico
            </Typography>
            <TextField
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              placeholder="nombre@empresa.com"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail size={16} style={{ color: themeMode === 'dark' ? '#71717a' : '#a1a1aa' }} />
                    </InputAdornment>
                  )
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  bgcolor: themeMode === 'dark' ? '#09090b' : '#ffffff',
                  border: '1px solid',
                  borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7',
                  transition: 'border-color 0.2s ease',
                  '& fieldset': { border: 'none' },
                  '&:hover': { borderColor: themeMode === 'dark' ? '#3f3f46' : '#cbd5e1' },
                  '&.Mui-focused': { borderColor: 'primary.main', boxShadow: themeMode === 'dark' ? '0 0 0 2px rgba(138, 180, 248, 0.15)' : '0 0 0 2px rgba(11, 87, 208, 0.15)' }
                },
                '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#f4f4f5' : '#18181b', py: 1.4, fontSize: 14 }
              }}
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', mb: 0.8 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Contraseña
              </Typography>
              {!isRegister && (
                <Button variant="text" size="small" sx={{
                  textTransform: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  p: 0,
                  minWidth: 0,
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
                }}>
                  ¿Olvidaste tu contraseña?
                </Button>
              )}
            </Box>
            <TextField
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              placeholder="••••••••"
              required
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock size={16} style={{ color: themeMode === 'dark' ? '#71717a' : '#a1a1aa' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} size="small" edge="end" sx={{ color: themeMode === 'dark' ? '#71717a' : '#a1a1aa' }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  bgcolor: themeMode === 'dark' ? '#09090b' : '#ffffff',
                  border: '1px solid',
                  borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7',
                  transition: 'border-color 0.2s ease',
                  '& fieldset': { border: 'none' },
                  '&:hover': { borderColor: themeMode === 'dark' ? '#3f3f46' : '#cbd5e1' },
                  '&.Mui-focused': { borderColor: 'primary.main', boxShadow: themeMode === 'dark' ? '0 0 0 2px rgba(138, 180, 248, 0.15)' : '0 0 0 2px rgba(11, 87, 208, 0.15)' }
                },
                '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#f4f4f5' : '#18181b', py: 1.4, fontSize: 14 }
              }}
            />
          </Box>

          {isRegister && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.8, display: 'block' }}>
                Confirmar Contraseña
              </Typography>
              <TextField
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                required={isRegister}
                placeholder="••••••••"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock size={16} style={{ color: themeMode === 'dark' ? '#71717a' : '#a1a1aa' }} />
                      </InputAdornment>
                    )
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    bgcolor: themeMode === 'dark' ? '#09090b' : '#ffffff',
                    border: '1px solid',
                    borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7',
                    transition: 'border-color 0.2s ease',
                    '& fieldset': { border: 'none' },
                    '&:hover': { borderColor: themeMode === 'dark' ? '#3f3f46' : '#cbd5e1' },
                    '&.Mui-focused': { borderColor: 'primary.main', boxShadow: themeMode === 'dark' ? '0 0 0 2px rgba(138, 180, 248, 0.15)' : '0 0 0 2px rgba(11, 87, 208, 0.15)' }
                  },
                  '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#f4f4f5' : '#18181b', py: 1.4, fontSize: 14 }
                }}
              />
            </Box>
          )}

          {!isRegister && (
            <FormControlLabel
              control={<Checkbox size="small" sx={{ color: themeMode === 'dark' ? '#27272a' : '#cbd5e1', '&.Mui-checked': { color: 'primary.main' } }} />}
              label={<Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', userSelect: 'none' }}>Mantener sesión activa</Typography>}
            />
          )}

          {/* Error message Panel */}
          {error && (
            <Paper sx={{
              p: 1.5,
              bgcolor: themeMode === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <ShieldAlert size={16} color="#ef4444" />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#ef4444' }}>{error}</Typography>
            </Paper>
          )}

          {/* Success message Panel */}
          {message && (
            <Paper sx={{
              p: 1.5,
              bgcolor: themeMode === 'dark' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              border: '1px solid rgba(34, 197, 94, 0.2)'
            }}>
              <ShieldCheck size={16} color="#22c55e" />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#22c55e' }}>{message}</Typography>
            </Paper>
          )}

          {/* High-Contrast Action Button */}
          <Button
            type="submit"
            disabled={loading}
            fullWidth
            size="large"
            startIcon={loading ? <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : undefined}
            sx={{
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              py: 1.5,
              fontSize: 14,
              bgcolor: themeMode === 'dark' ? '#ffffff' : '#18181b',
              color: themeMode === 'dark' ? '#09090b' : '#ffffff',
              border: '1px solid transparent',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: themeMode === 'dark' ? '#e4e4e7' : '#27272a',
              },
              '&:active': {
                transform: 'scale(0.99)'
              }
            }}
          >
            {loading ? (isRegister ? 'Registrando...' : 'Ingresando...') : (isRegister ? 'Registrarse' : 'Ingresar')}
          </Button>

          {!isRegister && (
            <Button
              variant="outlined"
              fullWidth
              size="large"
              disabled={loading}
              onClick={handleGuestLogin}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                py: 1.5,
                fontSize: 14,
                borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7',
                color: 'text.primary',
                bgcolor: 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: themeMode === 'dark' ? '#3f3f46' : '#cbd5e1',
                  bgcolor: themeMode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                },
                '&:active': {
                  transform: 'scale(0.99)'
                }
              }}
            >
              Entrar como Invitado
            </Button>
          )}
        </Box>

        {/* Divider */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 3.5 }}>
          <Divider sx={{ flex: 1, borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7' }} />
          <Typography variant="caption" sx={{
            fontWeight: 500,
            color: 'text.secondary',
            fontSize: 12,
            userSelect: 'none'
          }}>
            o continuar con
          </Typography>
          <Divider sx={{ flex: 1, borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7' }} />
        </Box>

        {/* Clean Outlined Social Login Buttons */}
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
                borderColor: themeMode === 'dark' ? '#27272a' : '#e4e4e7',
                bgcolor: 'transparent',
                color: 'text.primary',
                fontWeight: 500,
                fontSize: 13,
                py: 1.2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: themeMode === 'dark' ? '#3f3f46' : '#cbd5e1',
                  bgcolor: themeMode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                }
              }}
            >
              {label}
            </Button>
          ))}
        </Box>

        {/* Switch Register/Login */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            {isRegister ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}{' '}
            <Button
              variant="text"
              onClick={() => { setIsRegister(!isRegister); setError(null); setMessage(null); }}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                verticalAlign: 'baseline',
                p: 0,
                minWidth: 0,
                fontSize: 'inherit',
                color: 'primary.main',
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
              }}
            >
              {isRegister ? 'Iniciar Sesión' : 'Registrarse'}
            </Button>
          </Typography>
        </Box>

      </Paper>
    </Box>
  );
};

export default Login;
