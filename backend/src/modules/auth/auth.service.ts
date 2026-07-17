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
    const { email, password, name } = data;
    const hashedPassword = await bcrypt.hash(password, 10);

    if (config.db.mode === 'prisma') {
      const existing = await fastify.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error('El correo electrónico ya está registrado.');
      }
      const user = await fastify.prisma.user.create({
        data: { email, password: hashedPassword, name }
      });
      return { id: user.id, email: user.email, name: user.name };
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
        name
      }).select().single();
      
      if (error) throw error;
      return { id: user.id, email: user.email, name: user.name };
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
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      this.writeLocalUsers(users);
      return { id: newUser.id, email: newUser.email, name: newUser.name };
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
      name: foundUser.name
    };

    // Sign JWT token
    const token = fastify.jwt.sign(userPayload);

    return {
      user: userPayload,
      token
    };
  }
};
