const getApiUrl = (): string => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;

    // If accessed via non-localhost IP
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      // In development mode or phone testing, target port 3001 of that IP
      if (port === '3000' || port === '3002') {
        return `${protocol}//${host}:3001/api/v1`;
      } else {
        // In production (port 80), use relative path to route through Nginx proxy
        return `/api/v1`;
      }
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

    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      if (port === '3000' || port === '3002') {
        return `${protocol}//${host}:3001/ws`;
      } else {
        return `${protocol}//${window.location.host}/ws`;
      }
    }
  }
  return envWs || 'ws://localhost:3001/ws';
};

export const API_URL = getApiUrl();

