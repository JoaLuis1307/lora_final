export const getHistorySchema = {
  querystring: {
    type: 'object',
    required: ['device_id'],
    properties: {
      device_id: { type: 'string', minLength: 1 },
      range: { type: 'string', enum: ['5m', '15m', '1h', '5h', '6h', '24h', '7d'], default: '24h' }
    }
  }
};
