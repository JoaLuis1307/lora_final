import { API_URL } from './config';

export interface RouteData {
  id?: number;
  name: string;
  district: string;
  points: [number, number][];
  distance: number;
  duration: number;
  color?: string;
  created_at?: string;
}

export const routeService = {
  getRoutes: async (): Promise<RouteData[]> => {
    const response = await fetch(`${API_URL}/routes`);
    if (!response.ok) throw new Error('Failed to fetch routes');
    return response.json();
  },

  saveRoute: async (route: RouteData): Promise<RouteData> => {
    const response = await fetch(`${API_URL}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route)
    });
    if (!response.ok) throw new Error('Failed to save route');
    return response.json();
  },

  deleteRoute: async (id: number): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_URL}/routes/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete route');
    return response.json();
  }
};
