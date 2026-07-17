import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import fastifyWebSocket from '@fastify/websocket';

declare module 'fastify' {
  interface FastifyInstance {
    websocketConnections: Set<any>;
    broadcast: (data: any) => void;
  }
}

const websocketPlugin: FastifyPluginAsync = fp(async (fastify, opts) => {
  // Register the base @fastify/websocket plugin
  await fastify.register(fastifyWebSocket);

  const connections = new Set<any>();

  // Helper to broadcast JSON data to all active WebSocket clients
  const broadcast = (data: any) => {
    const payload = JSON.stringify(data);
    connections.forEach((conn) => {
      const socket = conn.socket || conn;
      if (socket && socket.readyState === 1) { // 1 means OPEN in WebSocket standard
        socket.send(payload);
      }
    });
  };

  // Expose connections set and broadcast function
  fastify.decorate('websocketConnections', connections);
  fastify.decorate('broadcast', broadcast);

  // Define the route where clients connect (e.g. ws://localhost:3001/ws)
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const conn = connection as any;
    connections.add(conn);
    
    const socket = conn.socket || conn;
    fastify.log.info(`[WEBSOCKET] Nuevo cliente conectado. Total conectados: ${connections.size}`);

    socket.on('message', (message: any) => {
      try {
        const parsed = JSON.parse(message.toString());
        // Handle incoming client messages if needed
        fastify.log.info('[WEBSOCKET] Mensaje de cliente recibido:', parsed);
        socket.send(JSON.stringify({ event: 'ack', data: 'Mensaje recibido correctamente' }));
      } catch (err) {
        fastify.log.error(`[WEBSOCKET] Error procesando mensaje de cliente: ${err}`);
      }
    });

    socket.on('close', () => {
      connections.delete(conn);
      fastify.log.info(`[WEBSOCKET] Cliente desconectado. Total conectados: ${connections.size}`);
    });

    socket.on('error', (err: any) => {
      fastify.log.error(`[WEBSOCKET] Error en socket: ${err}`);
      connections.delete(conn);
    });
  });
});

export default websocketPlugin;
export { websocketPlugin };
