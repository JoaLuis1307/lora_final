// MapLibre se expone como un script global (public/vendor/maplibre-gl.js) en
// public/index.html. NO se debe importar el paquete 'maplibre-gl' mediante un
// `import` de módulo: webpack/terser vuelven a minificar el UMD generado y eso
// rompe el worker de MapLibre, que se construye serializando funciones a string
// (`var sharedModule = {}; (fn)(sharedModule);`). Tras la re-minificacion los
// nombres internos se renombran y el worker falla con "a is not defined",
// dejando el mapa sin renderizar (negro) en produccion.
import 'maplibre-gl/dist/maplibre-gl.css';

type MapLibreNamespace = typeof import('maplibre-gl');

const maplibregl: MapLibreNamespace = (window as any).maplibregl;

export default maplibregl;
