import { SxProps, Theme } from '@mui/material';

export const glassSx = (t: Theme): SxProps<Theme> => ({
  bgcolor: t.palette.mode === 'dark' ? 'rgba(17,28,46,0.6)' : 'rgba(255,255,255,0.85)',
  backdropFilter: t.palette.mode === 'dark' ? 'blur(20px)' : 'none',
  border: '1px solid',
  borderColor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
  borderRadius: 2,
});

export const hoverCardSx: SxProps<Theme> = {
  transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    borderColor: 'rgba(79,195,247,0.15)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
  },
};
