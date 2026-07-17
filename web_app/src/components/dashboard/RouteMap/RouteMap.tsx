import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { 
  Trash2, 
  Navigation, 
  Plus,
  Play
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box } from '@mui/material';
import { RouteData } from '../../../services/routeService';
import { mapService, MapPoint } from '../../../services/mapService';
import { deviceService, Device } from '../../../services/deviceService';

interface RouteMapProps {
  onRouteCreated: (data: any) => void;
  activeRoute?: RouteData | null;
  selectedColor?: string;
  drawingMode?: boolean;
  onDrawingModeChange?: (mode: boolean) => void;
  onClear?: () => void;
  mapStyle?: string;
  pitch?: number;
}

const center: [number, number] = [-71.537, -16.409]; // Arequipa default

const RouteMap = forwardRef<any, RouteMapProps>(({ 
  onRouteCreated, 
  activeRoute, 
  selectedColor = '#3b82f6',
  drawingMode = false,
  onDrawingModeChange,
  onClear,
  mapStyle = 'dark',
  pitch = 45
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [routeData, setRouteData] = useState<any>(null);
  const [dbPoints, setDbPoints] = useState<MapPoint[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, any>>({});
  const markersCache = useRef<Map<string, { marker: maplibregl.Marker, element: HTMLDivElement }>>(new Map());
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('dark');




  // Initialize Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const currentTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
    const mapStyle = currentTheme === 'light' ? 'bright' : 'dark';

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://tiles.openfreemap.org/styles/${mapStyle}`,
      center: center,
      zoom: 14,
      pitch: 45,
      bearing: -17,
      attributionControl: false
    });

    map.current.on('load', () => {
      if (!map.current) return;
      
      // Add Satellite Source
      map.current.addSource('arcgis-satellite', {
        'type': 'raster',
        'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        'tileSize': 256,
        'attribution': 'Esri'
      });

      // Add 3D buildings
      const layers = map.current.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
      )?.id;

      map.current.addLayer({
        'id': '3d-buildings',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': currentTheme === 'light' ? '#cbd5e1' : '#1e293b',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'render_min_height']],
          'fill-extrusion-opacity': currentTheme === 'light' ? 0.7 : 0.5
        }
      }, labelLayerId);
    });

    const initialTheme = (localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark') as 'light' | 'dark';
    setCurrentTheme(initialTheme);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Theme Observer
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
          setCurrentTheme(newTheme || 'dark');
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // Fetch IoT Data
  const loadData = useCallback(async () => {
    try {
      const [pts, devs, tel] = await Promise.all([
        mapService.getPoints(),
        deviceService.getDevices(),
        deviceService.getLatestTelemetry()
      ]);
      setDbPoints(pts);
      setDevices(devs);
      setTelemetry(tel);
    } catch (err) {
      console.error('Error loading route map data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Sync Map Style with prop
  useEffect(() => {
    if (!map.current) return;
    
    if (mapStyle === 'satellite' || mapStyle === 'hybrid') {
      if (!map.current.getLayer('satellite-layer')) {
        const firstLayerId = map.current.getStyle().layers?.[0]?.id;
        map.current.addLayer({
          id: 'satellite-layer',
          type: 'raster',
          source: 'arcgis-satellite',
          paint: { 'raster-opacity': 1 }
        }, firstLayerId);
      }
      
      map.current.setLayoutProperty('satellite-layer', 'visibility', 'visible');
      
      // Toggle labels for hybrid
      map.current.getStyle().layers?.forEach(layer => {
        if (layer.id !== 'satellite-layer') {
          const isLabelOrRoad = layer.id.includes('label') || layer.id.includes('road') || layer.id.includes('place') || layer.id.includes('border') || layer.id === '3d-buildings';
          const shouldShow = mapStyle === 'hybrid' ? isLabelOrRoad : false;
          try {
            map.current?.setLayoutProperty(layer.id, 'visibility', shouldShow ? 'visible' : 'none');
          } catch (e) {}
        }
      });
    } else {
      if (map.current.getLayer('satellite-layer')) {
        map.current.setLayoutProperty('satellite-layer', 'visibility', 'none');
      }
      
      const targetStyle = `https://tiles.openfreemap.org/styles/${mapStyle}`;
      if ((map.current as any)._currentStyleUrl !== targetStyle) {
        (map.current as any)._currentStyleUrl = targetStyle;
        map.current.setStyle(targetStyle);
      } else {
        map.current.getStyle().layers?.forEach(layer => {
          if (layer.id !== 'satellite-layer') {
            try {
              map.current?.setLayoutProperty(layer.id, 'visibility', 'visible');
            } catch (e) {}
          }
        });
      }
    }
  }, [mapStyle]);

  // Sync Pitch with prop
  useEffect(() => {
    if (!map.current) return;
    map.current.easeTo({
      pitch: pitch,
      duration: 1000
    });
  }, [pitch]);

  // Handle map click for routing
  const handleMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
    if (!drawingMode) return;
    
    const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    setPoints(prev => [...prev, newPoint]);
  }, [drawingMode]);

  useEffect(() => {
    if (!map.current) return;
    map.current.off('click', handleMapClick);
    map.current.on('click', handleMapClick);
  }, [handleMapClick]);

  // Calculate OSRM Route
  const calculateRoute = useCallback(async (pts: [number, number][]) => {
    if (pts.length < 2) return;
    try {
      const coordsString = pts.map(p => `${p[0]},${p[1]}`).join(';');
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.code === 'Ok') {
        const route = data.routes[0];
        setRouteData({
          distance: (route.distance / 1000).toFixed(2),
          duration: Math.round(route.duration / 60),
          geometry: route.geometry
        });
        onRouteCreated({
          points: pts, // Cambiado de path a points
          distance: parseFloat((route.distance / 1000).toFixed(2)),
          duration: Math.round(route.duration / 60)
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  }, [onRouteCreated]);

  useEffect(() => {
    if (points.length >= 2) {
      calculateRoute(points);
    }
  }, [points, calculateRoute]);

  // Show active route from props
  useEffect(() => {
    if (activeRoute && map.current) {
      setPoints(activeRoute.points); // Cambiado de path a points
      map.current.flyTo({
        center: activeRoute.points[0],
        zoom: 15,
        essential: true
      });
      calculateRoute(activeRoute.points);
    }
  }, [activeRoute, calculateRoute]);

  // Add Bin/Point Markers (Same as 3D Map)
  useEffect(() => {
    if (!map.current) return;

    const isDark = currentTheme === 'dark';
    const bgColor = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const mutedTextColor = isDark ? 'rgba(148, 163, 184, 0.8)' : 'rgba(71, 85, 105, 0.8)';
    const borderColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.1)';

    const currentMarkerIds = new Set<string>();

    dbPoints.forEach(point => {
      const markerId = `iot-point-${point.id}`;
      currentMarkerIds.add(markerId);
      
      const linkedDevice = devices.find(d => (d as any).map_point_id === point.id);
      const deviceTelemetry = linkedDevice ? telemetry[linkedDevice.device_id] : null;
      const isOnline = linkedDevice?.status?.toLowerCase() === 'online';
      const bat = deviceTelemetry?.battery ?? deviceTelemetry?.bateria;
      const isFull = deviceTelemetry?.is_full === 1 || deviceTelemetry?.status_text === 'FULL';
      const level = isFull ? 100 : (deviceTelemetry?.fill_level || 24);
      const color = isFull ? '#ef4444' : (isOnline ? '#10b981' : (isDark ? '#334155' : '#94a3b8'));

      const cached = markersCache.current.get(markerId);
      const markerEl = cached ? cached.element : document.createElement('div');
      
      if (!cached) markerEl.className = 'iot-marker';

      // Icon logic
      let iconSvg = '';
      if (point.type === 'gateway') {
        iconSvg = '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-2-4-2.2c-.5.2-2 .6-4 2.2s-3 3.5-3 5.5a7 7 0 0 0 7 7z"/><path d="M12 18V12"/><path d="M12 12s2-2 2-4-2-4-2-4-2 2-2 4 2 4 2 4z"/>';
      } else if (point.type === 'bin') {
        iconSvg = '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>';
      } else {
        iconSvg = '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9zM15 2v2M9 2v2M15 20v2M9 20v2M20 15h2M20 9h2M2 15h2M2 9h2"/>';
      }

      markerEl.innerHTML = `
        <div class="${isFull ? 'pulse-critical' : ''}" 
             style="background: ${color}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 12px ${color}60; position: relative; cursor: pointer;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${iconSvg}
          </svg>
          ${isOnline && !isFull ? '<div style="position: absolute; top: -1px; right: -1px; width: 9px; height: 9px; background: #10b981; border: 2px solid white; border-radius: 50%; animation: pulse 2s infinite;"></div>' : ''}
        </div>`;

      const popupContent = `
        <div style="background: ${bgColor}; backdrop-filter: blur(25px); border: 1px solid ${borderColor}; border-radius: 28px; padding: 24px; color: ${textColor}; min-width: 320px; font-family: 'Outfit', 'Inter', sans-serif; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); overflow: hidden; position: relative;">
          <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: ${color}; opacity: 0.05; border-radius: 50%; filter: blur(40px);"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="padding: 4px 10px; border-radius: 8px; background: ${color}20; display: flex; align-items: center; gap: 6px;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: ${color}; box-shadow: 0 0 10px ${color};"></div>
              <span style="font-size: 10px; font-weight: 900; color: ${color}; text-transform: uppercase; letter-spacing: 0.05em;">${isFull ? 'Crítico' : (isOnline ? 'Online' : 'Offline')}</span>
            </div>
            <span style="font-size: 10px; font-weight: 800; color: ${mutedTextColor}; opacity: 0.5; font-family: monospace;">#${point.id}</span>
          </div>
          
          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0; font-size: 22px; font-weight: 900; color: ${textColor}; letter-spacing: -0.03em; line-height: 1.1;">${point.name}</h4>
            <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 600; color: ${mutedTextColor}; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.1em;">${point.type === 'bin' ? 'Contenedor Inteligente' : 'Punto de Infraestructura'}</p>
          </div>

          ${point.type === 'bin' ? `
            <div style="background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}; padding: 20px; border-radius: 22px; border: 1px solid ${borderColor};">
              <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
                <span style="font-size: 11px; font-weight: 800; color: ${mutedTextColor}; text-transform: uppercase; letter-spacing: 0.05em;">Llenado</span>
                <span style="font-size: 32px; font-weight: 900; color: ${color}; line-height: 1; letter-spacing: -0.04em;">${level}<span style="font-size: 16px; opacity: 0.6; margin-left: 2px;">%</span></span>
              </div>
              <div style="height: 12px; background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}; border-radius: 20px; overflow: hidden; position: relative;">
                <div style="width: ${level}%; height: 100%; background: linear-gradient(90deg, ${color}, ${color}dd); border-radius: 20px;"></div>
              </div>
            </div>
          ` : ''}
        </div>
      `;

      if (!cached) {
        const marker = new maplibregl.Marker({ element: markerEl })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(new maplibregl.Popup({ offset: 30, maxWidth: 'none' }).setHTML(popupContent))
          .addTo(map.current!);
        markersCache.current.set(markerId, { marker, element: markerEl });
      } else {
        cached.marker.setLngLat([point.longitude, point.latitude]);
        if (cached.marker.getPopup().isOpen()) {
          cached.marker.getPopup().setHTML(popupContent);
        }
      }
    });

    // Cleanup markers
    markersCache.current.forEach((value, id) => {
      if (!currentMarkerIds.has(id)) {
        value.marker.remove();
        markersCache.current.delete(id);
      }
    });
  }, [dbPoints, devices, telemetry, currentTheme]);

  // Update Route Layers
  useEffect(() => {
    if (!map.current || !map.current.loaded()) return;

    const currentColor = activeRoute?.color || selectedColor;

    // Update Points Markers
    const existingMarkers = document.querySelectorAll('.route-marker');
    existingMarkers.forEach(m => m.remove());

    points.forEach((pt, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === points.length - 1;
      const isCurrent = idx === points.length - 1 && drawingMode;
      const color = isStart ? '#10b981' : (isEnd ? '#ef4444' : currentColor);
      
      const el = document.createElement('div');
      el.className = 'route-marker group cursor-pointer';
      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));">
          <!-- Pulse Effect for Start/Current -->
          ${(isStart || isCurrent) ? `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 32px; height: 32px; background: ${color}; border-radius: 50%; opacity: 0.2; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          ` : ''}
          
          <!-- Marker Body -->
          <div style="
            width: ${isStart || isEnd ? '24px' : '18px'}; 
            height: ${isStart || isEnd ? '24px' : '18px'}; 
            background: ${color}; 
            border: 3px solid white; 
            border-radius: 50% 50% 50% 0; 
            transform: rotate(-45deg); 
            display: flex; 
            align-items: center; 
            justify-content: center;
            transition: all 0.3s ease;
          " class="marker-body">
            <div style="transform: rotate(45deg); font-size: 8px; font-weight: 900; color: white; letter-spacing: -1px;">
              ${isStart ? 'A' : (isEnd ? 'B' : idx + 1)}
            </div>
          </div>
          
          <!-- Technical Label on Hover -->
          <div style="
            position: absolute; 
            bottom: -24px; 
            background: black; 
            color: white; 
            font-size: 8px; 
            font-weight: 900; 
            padding: 2px 6px; 
            border-radius: 4px; 
            white-space: nowrap; 
            opacity: 0; 
            transition: opacity 0.2s ease;
            pointer-events: none;
            text-transform: uppercase;
            letter-spacing: 0.1em;
          " class="marker-label">
            ${isStart ? 'Inicio' : (isEnd ? 'Destino' : `Punto ${idx + 1}`)}
          </div>
        </div>
        <style>
          .route-marker:hover .marker-body { transform: rotate(-45deg) scale(1.2) translateY(-2px); }
          .route-marker:hover .marker-label { opacity: 1; bottom: -28px; }
          
          @keyframes ping {
            75%, 100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
          }
          @keyframes pulse-red {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .pulse-critical {
            animation: pulse-red 2s infinite;
          }
        </style>
      `;
      new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map.current!);
    });

    // Update Route Line
    if (routeData) {
      if (map.current.getSource('route')) {
        (map.current.getSource('route') as any).setData(routeData.geometry);
        map.current.setPaintProperty('route-glow', 'line-color', currentColor);
        map.current.setPaintProperty('route-line', 'line-color', currentColor);
      } else {
        map.current.addSource('route', {
          type: 'geojson',
          data: routeData.geometry
        });
        map.current.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': currentColor,
            'line-width': 10,
            'line-opacity': 0.2,
            'line-blur': 5
          }
        });
        map.current.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': currentColor,
            'line-width': 4,
            'line-opacity': 0.8
          }
        });
      }
    } else {
      if (map.current.getLayer('route-line')) map.current.removeLayer('route-line');
      if (map.current.getLayer('route-glow')) map.current.removeLayer('route-glow');
      if (map.current.getSource('route')) map.current.removeSource('route');
    }
  }, [points, routeData, selectedColor, activeRoute]);

  const clearRoute = () => {
    setPoints([]);
    setRouteData(null);
    onRouteCreated(null);
    if (onClear) onClear();
  };

  useImperativeHandle(ref, () => ({
    clearRoute
  }));

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', boxShadow: 8 }}>
      <Box ref={mapContainer} sx={{ width: '100%', height: '100%' }} />
      
      {/* Internal Overlay Controls removed - handled by parent toolbar */}

      {/* Hint */}
      {drawingMode && points.length === 0 && (
      <Box sx={{ position: 'absolute', top: 96, left: '50%', transform: 'translateX(-50%)', bgcolor: 'primary.main', opacity: 0.2, color: 'primary.main', px: 6, py: 1.5, borderRadius: '50px', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', backdropFilter: 'blur(16px)', pointerEvents: 'none' }}>
          Haz clic en el mapa para iniciar la ruta
        </Box>
      )}
    </Box>
  );
});

export default RouteMap;
