import { supabase } from './supabase';
import { AuthError, User } from '@supabase/supabase-js';

export const authService = {
  /**
   * Sign up with email, password and full name
   */
  async signUp(email: string, password: string, fullName: string): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });
      return { user: data.user, error };
    } catch (err: any) {
      return { user: null, error: err as AuthError };
    }
  },

  /**
   * Log in with email and password
   */
  async login(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { user: data.user, error };
    } catch (err: any) {
      return { user: null, error: err as AuthError };
    }
  },

  /**
   * Sign out the current user
   */
  async logout(): Promise<{ error: AuthError | null }> {
    try {
      localStorage.removeItem('guest_user');
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        return { error };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err as AuthError };
    }
  },

  /**
   * Get current session user
   */
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabase.auth.onAuthStateChange((event: string, session: any) => {
      callback(event, session);
    });
  }
};
