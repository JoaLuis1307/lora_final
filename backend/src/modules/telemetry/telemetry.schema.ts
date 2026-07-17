export const getHistorySchema = {
  querystring: {
    type: 'object',
    required: ['device_id'],
    properties: {
      device_id: { type: 'string', minLength: 1 },
      range: { type: 'string', enum: ['1h', '6h', '24h', '7d'], default: '24h' }
    }
  }
};
