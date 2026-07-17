import { API_URL } from './config';

export interface MapPoint {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  description?: string;
  created_at?: string;
}

export const mapService = {
  async getPoints(): Promise<MapPoint[]> {
    const response = await fetch(`${API_URL}/map-points`);
    if (!response.ok) throw new Error('Failed to fetch map points');
    return response.json();
  },

  async savePoint(point: Omit<MapPoint, 'id' | 'created_at'>): Promise<MapPoint> {
    const response = await fetch(`${API_URL}/map-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(point),
    });
    if (!response.ok) throw new Error('Failed to save map point');
    return response.json();
  },

  async deletePoint(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/map-points/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete map point');
  },

  async updatePoint(id: number, point: Partial<MapPoint>): Promise<MapPoint> {
    const response = await fetch(`${API_URL}/map-points/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(point),
    });
    if (!response.ok) throw new Error('Failed to update map point');
    return response.json();
  },
};
