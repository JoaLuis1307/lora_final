// ============================================================
//  Proveedores de mapas públicos (sin API key)
//  - Tiles vectoriales: OpenFreeMap (https://openfreemap.org)
//  - Satélite: Esri World Imagery (público, sin key)
//  - Ruteo: OSRM público con servidor de respaldo (FOSSGIS)
// ============================================================

export type MapLayer = 'dark' | 'bright' | 'liberty' | 'satellite' | 'hybrid';

// OpenFreeMap: estilos vectoriales gratuitos e ilimitados basados en OSM.
export const OPENFREEMAP_STYLES: Record<string, string> = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const ESRI_SATELLITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

/**
 * Devuelve el estilo de MapLibre para la capa solicitada.
 * Las capas base usan estilos vectoriales de OpenFreeMap (sin API key);
 * el satélite usa Esri World Imagery (también público y sin key).
 */
export const getMapStyle = (layer: string, theme: 'light' | 'dark'): any => {
  if (layer === 'satellite' || layer === 'hybrid') {
    const sources: any = {
      'satellite-tiles': {
        type: 'raster',
        tiles: [ESRI_SATELLITE],
        tileSize: 256,
        attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics',
      },
    };

    const layers: any[] = [
      { id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', minzoom: 0, maxzoom: 19 },
    ];

    if (layer === 'hybrid') {
      sources['esri-labels'] = {
        type: 'raster',
        tiles: [ESRI_LABELS],
        tileSize: 256,
        attribution: 'Etiquetas © Esri',
      };
      layers.push({ id: 'labels-layer', type: 'raster', source: 'esri-labels', minzoom: 0, maxzoom: 19 });
    }

    return { version: 8, sources, layers };
  }

  if (layer === 'liberty') return OPENFREEMAP_STYLES.liberty;
  if (layer === 'bright') return OPENFREEMAP_STYLES.bright;

  // Capa normal: oscura o clara según el tema
  return theme === 'light' ? OPENFREEMAP_STYLES.positron : OPENFREEMAP_STYLES.dark;
};

// Servidores públicos de ruteo OSRM (el segundo es el respaldo de FOSSGIS)
const OSRM_ENDPOINTS = [
  'https://router.project-osrm.org',
  'https://routing.openstreetmap.de/routed-car',
];

/**
 * Calcula una ruta por carretera con OSRM, probando varios servidores
 * públicos hasta obtener una respuesta válida. Devuelve null si todos fallan.
 */
export const fetchOsrmRoute = async (points: [number, number][]): Promise<any | null> => {
  if (points.length < 2) return null;

  const coords = points.map((p) => `${p[0]},${p[1]}`).join(';');

  for (const base of OSRM_ENDPOINTS) {
    try {
      const res = await fetch(
        `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson`
      );
      if (!res.ok) continue;

      const data = await res.json();
      if (data?.code === 'Ok' && data.routes?.[0]) {
        return data.routes[0];
      }
    } catch (err) {
      // Servidor caído o bloqueado: probar el siguiente
      console.warn(`[OSRM] Falló ${base}, probando respaldo...`, err);
    }
  }

  return null;
};

export interface GeoResult {
  place_id: string | number;
  display_name: string;
  lat: number;
  lng: number;
}

/**
 * Búsqueda de lugares con Nominatim y respaldo en Photon (ambos públicos, sin key).
 */
export const searchPlaces = async (query: string): Promise<GeoResult[]> => {
  const q = query.trim();
  if (q.length < 3) return [];

  // 1) Nominatim (OpenStreetMap)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&accept-language=es&limit=5&q=${encodeURIComponent(q)}`
    );
    if (res.ok) {
      const rows: any[] = await res.json();
      const results = rows.map((r) => ({
        place_id: r.place_id,
        display_name: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      }));
      if (results.length > 0) return results;
    }
  } catch (err) {
    console.warn('[GEO] Nominatim no disponible, usando Photon...', err);
  }

  // 2) Photon (Komoot) como respaldo
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?lang=es&limit=5&q=${encodeURIComponent(q)}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    return (data.features || []).map((f: any) => ({
      place_id: f.properties?.osm_id ?? Math.random(),
      display_name: [
        f.properties?.name,
        f.properties?.street,
        f.properties?.city,
        f.properties?.state,
        f.properties?.country,
      ]
        .filter(Boolean)
        .join(', '),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
  } catch (err) {
    console.warn('[GEO] Photon tampoco está disponible:', err);
    return [];
  }
};
