const DEV_PORTS = new Set(['3000', '3002']);
const DEV_API_PORT = '3001';

const getApiUrl = (): string => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;

    // CRA dev server (localhost or LAN IP): the API always runs on :3001.
    if (DEV_PORTS.has(port)) {
      return `${protocol}//${host}:${DEV_API_PORT}/api/v1`;
    }

    // Production served through Nginx: use the relative proxy path.
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `/api/v1`;
    }
  }
  return envUrl || '/api/v1';
};

export const getWsUrl = (): string => {
  const envWs = process.env.REACT_APP_WS_URL;
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // CRA dev server (localhost or LAN IP): the API always runs on :3001.
    if (DEV_PORTS.has(port)) {
      return `${protocol}//${host}:${DEV_API_PORT}/ws`;
    }

    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${protocol}//${window.location.host}/ws`;
    }
  }
  return envWs || 'ws://localhost:3001/ws';
};

export const API_URL = getApiUrl();
