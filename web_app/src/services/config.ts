const getApiUrl = (): string => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    // If accessed via non-localhost IP (e.g. physical phone connecting to PC),
    // rewrite the API URL dynamically to target port 3001 of that same IP.
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `${protocol}//${host}:3001/api/v1`;
    }
  }
  return envUrl || 'http://localhost:3001/api/v1';
};

export const API_URL = getApiUrl();
