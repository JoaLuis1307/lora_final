import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { authService } from './auth.service';

export async function authRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  
  // 1. POST /api/v1/auth/register - Register a new system admin/user
  fastify.post('/auth/register', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.email || !body.password) {
        return reply.status(400).send({ error: 'Bad Request', message: 'email and password are required' });
      }

      const user = await authService.register(fastify, body);
      return reply.status(201).send({ success: true, user });
    } catch (error: any) {
      request.log.error('Error during registration:', error);
      return reply.status(400).send({ error: 'Registration Failed', message: error.message });
    }
  });

  // 2. POST /api/v1/auth/login - Login and obtain JWT
  fastify.post('/auth/login', async (request, reply) => {
    try {
      const body = request.body as any;
      if (!body.email || !body.password) {
        return reply.status(400).send({ error: 'Bad Request', message: 'email and password are required' });
      }

      const result = await authService.login(fastify, body);
      return reply.send(result);
    } catch (error: any) {
      request.log.error('Error during login:', error);
      return reply.status(401).send({ error: 'Unauthorized', message: error.message });
    }
  });

  // 3. GET /api/v1/auth/me - Protected route to verify JWT and fetch user profile
  fastify.get('/auth/me', {
    onRequest: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    }]
  }, async (request, reply) => {
    return { user: request.user };
  });
}
