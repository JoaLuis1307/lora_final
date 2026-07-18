import { FastifyInstance } from 'fastify';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config/env';

const USERS_FILE = path.join(__dirname, '../../../data/users.json');

// Interface representing the user structure
export interface UserPayload {
  id: number;
  email: string;
  name?: string | null;
  role?: string;
}

export const authService = {
  // Helper to read local users
  readLocalUsers(): any[] {
    if (!fs.existsSync(USERS_FILE)) {
      // Ensure data directory exists
      fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    try {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    } catch {
      return [];
    }
  },

  // Helper to save local users
  writeLocalUsers(users: any[]) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  },

  /**
   * Register a new user in the system
   */
  async register(fastify: FastifyInstance, data: any): Promise<UserPayload> {
    const { email, password, name, role } = data;
    const hashedPassword = await bcrypt.hash(password, 10);

    if (config.db.mode === 'prisma') {
      const existing = await fastify.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error('El correo electrónico ya está registrado.');
      }
      const user = await fastify.prisma.user.create({
        data: { email, password: hashedPassword, name }
      });
      return { id: user.id, email: user.email, name: user.name, role: 'Operador' };
    } 
    
    else if (config.db.mode === 'supabase') {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(config.db.supabaseUrl, config.db.supabaseKey);
      
      // Check if user exists
      const { data: existing } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      if (existing) {
        throw new Error('El correo electrónico ya está registrado.');
      }
      
      const { data: user, error } = await supabase.from('users').insert({
        email,
        password: hashedPassword,
        name,
        role: role || 'Operador'
      }).select().single();
      
      if (error) throw error;
      return { id: user.id, email: user.email, name: user.name, role: user.role };
    } 
    
    else {
      // Fallback LOCAL JSON file
      const users = this.readLocalUsers();
      const existing = users.find(u => u.email === email);
      if (existing) {
        throw new Error('El correo electrónico ya está registrado.');
      }
      const newUser = {
        id: users.length > 0 ? Math.max(...users.map((u: any) => u.id)) + 1 : 1,
        email,
        password: hashedPassword,
        name,
        role: role || 'Operador',
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      this.writeLocalUsers(users);
      return { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role };
    }
  },

  /**
   * Login user and generate a JWT token
   */
  async login(fastify: FastifyInstance, data: any): Promise<{ user: UserPayload; token: string }> {
    const { email, password } = data;
    let foundUser: any = null;

    if (config.db.mode === 'prisma') {
      foundUser = await fastify.prisma.user.findUnique({ where: { email } });
    } 
    
    else if (config.db.mode === 'supabase') {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(config.db.supabaseUrl, config.db.supabaseKey);
      const { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      foundUser = user;
    } 
    
    else {
      const users = this.readLocalUsers();
      foundUser = users.find(u => u.email === email);
    }

    if (!foundUser) {
      throw new Error('Credenciales inválidas.');
    }

    const isValid = await bcrypt.compare(password, foundUser.password);
    if (!isValid) {
      throw new Error('Credenciales inválidas.');
    }

    const userPayload: UserPayload = {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: foundUser.role || 'Operador'
    };

    // Sign JWT token
    const token = fastify.jwt.sign(userPayload);

    return {
      user: userPayload,
      token
    };
  },

  /**
   * Retrieve all users in the system
   */
  async getUsers(fastify: FastifyInstance): Promise<UserPayload[]> {
    if (config.db.mode === 'prisma') {
      const users = await fastify.prisma.user.findMany();
      return users.map((u: any) => ({ id: u.id, email: u.email, name: u.name, role: 'Operador' }));
    } else if (config.db.mode === 'supabase') {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(config.db.supabaseUrl, config.db.supabaseKey);
      const { data: users } = await supabase.from('users').select('*');
      return (users || []).map((u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role || 'Operador' }));
    } else {
      const users = this.readLocalUsers();
      return users.map((u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role || 'Operador' }));
    }
  },

  /**
   * Update a user's role
   */
  async updateUserRole(fastify: FastifyInstance, id: number, role: string): Promise<boolean> {
    if (config.db.mode === 'prisma') {
      // Prisma user doesn't have role column by default, so we mock success.
      return true;
    } else if (config.db.mode === 'supabase') {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(config.db.supabaseUrl, config.db.supabaseKey);
      await supabase.from('users').update({ role }).eq('id', id);
      return true;
    } else {
      const users = this.readLocalUsers();
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return false;
      users[idx].role = role;
      this.writeLocalUsers(users);
      return true;
    }
  },

  /**
   * Delete a user
   */
  async deleteUser(fastify: FastifyInstance, id: number): Promise<boolean> {
    if (config.db.mode === 'prisma') {
      await fastify.prisma.user.delete({ where: { id } });
      return true;
    } else if (config.db.mode === 'supabase') {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(config.db.supabaseUrl, config.db.supabaseKey);
      await supabase.from('users').delete().eq('id', id);
      return true;
    } else {
      const users = this.readLocalUsers();
      const filtered = users.filter(u => u.id !== id);
      if (users.length === filtered.length) return false;
      this.writeLocalUsers(filtered);
      return true;
    }
  }
};
