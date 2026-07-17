import React from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import MapPreview from '../components/dashboard/MapPreview/MapPreview';

const Mapa: React.FC = () => {
  const location = useLocation();
  const state = location.state as { focusVehicleId?: string } | null;
  const queryParams = new URLSearchParams(location.search);
  const focusVehicleId = state?.focusVehicleId || queryParams.get('vehicleId') || null;

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <MapPreview isPage={true} focusVehicleId={focusVehicleId} />
    </Box>
  );
};

export default Mapa;
