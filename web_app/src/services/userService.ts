import { supabase } from './supabase';
import { API_URL } from './config';

export interface User {
  id: number;
  email: string;
  name?: string | null;
  role: string;
}

const getHeaders = async () => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  // 1. Try to get Supabase session token
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        return headers;
      }
    } catch (e) {
      console.warn('Error reading Supabase session:', e);
    }
  }
  
  // 2. Fallback to guest user token
  const localGuest = localStorage.getItem('guest_user');
  if (localGuest) {
    headers['Authorization'] = `Bearer guest-token`;
  }
  
  return headers;
};

export const userService = {
  async getUsers(): Promise<User[]> {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/auth/users`, {
      method: 'GET',
      headers
    });
    if (!response.ok) throw new Error('Error al obtener los usuarios');
    const data = await response.json();
    return data.users || [];
  },

  async updateUserRole(id: number, role: string): Promise<void> {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/auth/users/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ role }),
    });
    if (!response.ok) throw new Error('Error al actualizar el rol de usuario');
  },

  async deleteUser(id: number): Promise<void> {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/auth/users/${id}`, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) throw new Error('Error al eliminar el usuario');
  },

  async createUser(user: Partial<User> & { password?: string }): Promise<void> {
    const headers = await getHeaders();
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: user.email,
        password: user.password || 'admin123',
        name: user.name,
        role: user.role || 'Operador'
      })
    });
    if (!response.ok) throw new Error('Error al registrar el usuario');
  }
};
