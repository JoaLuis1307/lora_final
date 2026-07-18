import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { Loader2, ShieldCheck, Cpu, Eye, EyeOff, ShieldAlert, X, User, Mail, Lock } from 'lucide-react';
import {
  Box, Paper, Typography, TextField, Button, IconButton, Divider, InputAdornment
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import MapPreview from '../components/dashboard/MapPreview/MapPreview';

// =========================================================================
// CONFIGURACIÓN DE LAS IMÁGENES DEL PANEL DE INICIO DE SESIÓN
// =========================================================================
// Imagen mostrada al INICIAR SESIÓN (Vista de Login - Paisaje de Arequipa)
const LOGIN_IMAGE_URL = 'https://media.vogue.mx/photos/5e5c5b1f25623100081c437c/master/w_1600%2Cc_limit/Arequipa--paisaje.jpg';

// Imagen mostrada al REGISTRARSE (Vista de Registro - Municipalidad de Arequipa)
const REGISTER_IMAGE_URL = 'https://www.muniarequipa.gob.pe/wp-content/uploads/2025/10/WhatsApp-Image-2025-10-02-at-15.47.58.jpeg';

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
            maxWidth: { xs: 450, md: 800 },
            borderRadius: '28px', // Large Material You / MD3 rounded corners
            bgcolor: themeMode === 'dark' ? '#1e1f20' : '#ffffff', // Google account dark & light colors
            border: 'none', // Borderless as requested!
            boxShadow: themeMode === 'dark' ? '0 16px 40px rgba(0,0,0,0.5)' : '0 16px 40px rgba(0,0,0,0.12)',
            p: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            position: 'relative',
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
                zIndex: 10,
                color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368',
                bgcolor: themeMode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                '&:hover': {
                  bgcolor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  color: themeMode === 'dark' ? '#ffffff' : '#000000',
                  transform: 'scale(1.08)'
                },
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <X size={20} />
            </IconButton>

            {/* Left Column: Branding and System Info */}
            <Box sx={{
              width: { xs: '100%', md: '45%' },
              p: { xs: 4, sm: 5 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              position: 'relative',
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.8)), url(${isRegister ? REGISTER_IMAGE_URL : LOGIN_IMAGE_URL})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: '#ffffff',
              borderRight: 'none',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              {/* Logo / Brand */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}>
                  <Cpu size={20} />
                </Box>
                <Typography sx={{
                  fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                  fontWeight: 600,
                  fontSize: 20,
                  letterSpacing: '-0.02em',
                  color: '#ffffff'
                }}>
                  EcoLoRa
                </Typography>
              </Box>

              {/* Title & Subtitle */}
              <Typography variant="h5" sx={{ 
                fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                fontWeight: 500, 
                color: '#ffffff',
                fontSize: '24px',
                lineHeight: 1.25,
                mb: 2
              }}>
                {isRegister ? 'Crear tu cuenta' : 'Iniciar sesión'}
              </Typography>

              <Typography sx={{ 
                fontFamily: 'Roboto, Arial, sans-serif',
                color: 'rgba(255,255,255,0.85)', 
                fontWeight: 400, 
                fontSize: '14.5px',
                lineHeight: 1.6,
                pr: { md: 2 }
              }}>
                {isRegister 
                  ? 'Regístrate para obtener acceso al panel de control de EcoLoRa como operador de red municipal.' 
                  : 'Para continuar al panel de administración y control.'}
              </Typography>

              {/* IoT System Description requested by the user */}
              <Box sx={{ mt: 'auto', pt: 4 }}>
                <Typography sx={{
                  fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                  fontWeight: 500,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  mb: 1
                }}>
                  Descripción del Sistema
                </Typography>
                <Typography sx={{
                  fontFamily: 'Roboto, Arial, sans-serif',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.7)',
                  fontStyle: 'italic'
                }}>
                  Sistema IoT para contenedores municipales utilizando tecnología LoRa P2P en la manzana del Mercado San Camilo.
                </Typography>
              </Box>
            </Box>

            {/* Right Column: Actions / Form */}
            <Box sx={{
              width: { xs: '100%', md: '55%' },
              p: { xs: 4, sm: 5 },
              pt: { xs: 4, sm: 5, md: 8 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              {/* Form */}
              <Box component="form" onSubmit={handleAuth} sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: { xs: 2, md: 3 } }}>
                
                {isRegister && (
                  <TextField
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    fullWidth
                    required={isRegister}
                    placeholder="Nombre completo"
                    variant="outlined"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start" sx={{ color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368', mr: 1.5 }}>
                            <User size={18} />
                          </InputAdornment>
                        )
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
                        '& fieldset': { border: 'none' },
                        '&:hover': {
                          backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                        },
                        '&.Mui-focused': {
                          backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.04)' : '#ffffff',
                          boxShadow: `0 0 0 2px ${themeMode === 'dark' ? '#8ab4f8' : '#1a73e8'}`
                        }
                      },
                      '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#e3e3e3' : '#1f1f1f', py: 1.8, fontSize: 15 }
                    }}
                  />
                )}

                <TextField
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  placeholder="Correo electrónico"
                  variant="outlined"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start" sx={{ color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368', mr: 1.5 }}>
                          <Mail size={18} />
                        </InputAdornment>
                      )
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
                      '& fieldset': { border: 'none' },
                      '&:hover': {
                        backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                      },
                      '&.Mui-focused': {
                        backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.04)' : '#ffffff',
                        boxShadow: `0 0 0 2px ${themeMode === 'dark' ? '#8ab4f8' : '#1a73e8'}`
                      }
                    },
                    '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#e3e3e3' : '#1f1f1f', py: 1.8, fontSize: 15 }
                  }}
                />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TextField
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    required
                    placeholder="Contraseña"
                    variant="outlined"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start" sx={{ color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368', mr: 1.5 }}>
                            <Lock size={18} />
                          </InputAdornment>
                        ),
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
                        borderRadius: '12px',
                        backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
                        '& fieldset': { border: 'none' },
                        '&:hover': {
                          backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                        },
                        '&.Mui-focused': {
                          backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.04)' : '#ffffff',
                          boxShadow: `0 0 0 2px ${themeMode === 'dark' ? '#8ab4f8' : '#1a73e8'}`
                        }
                      },
                      '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#e3e3e3' : '#1f1f1f', py: 1.8, fontSize: 15 }
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
                    placeholder="Confirmar contraseña"
                    variant="outlined"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start" sx={{ color: themeMode === 'dark' ? '#9aa0a6' : '#5f6368', mr: 1.5 }}>
                            <Lock size={18} />
                          </InputAdornment>
                        )
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
                        '& fieldset': { border: 'none' },
                        '&:hover': {
                          backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                        },
                        '&.Mui-focused': {
                          backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.04)' : '#ffffff',
                          boxShadow: `0 0 0 2px ${themeMode === 'dark' ? '#8ab4f8' : '#1a73e8'}`
                        }
                      },
                      '& .MuiInputBase-input': { color: themeMode === 'dark' ? '#e3e3e3' : '#1f1f1f', py: 1.8, fontSize: 15 }
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

                {/* Google style footer buttons */}
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
                            borderRadius: '24px', // pill shape!
                            border: 'none', // Borderless!
                            bgcolor: themeMode === 'dark' ? '#2d2e30' : '#f1f3f4',
                            color: themeMode === 'dark' ? '#e3e3e3' : '#202124',
                            fontWeight: 550,
                            fontSize: 13,
                            py: 1.2,
                            textTransform: 'none',
                            fontFamily: 'Roboto, Arial, sans-serif',
                            '&:hover': {
                              bgcolor: themeMode === 'dark' ? '#3c4043' : '#e8eaed',
                            }
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default Login;
