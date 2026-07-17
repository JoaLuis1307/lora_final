export const createDeviceSchema = {
  body: {
    type: 'object',
    required: ['device_id'],
    properties: {
      device_id: { type: 'string', minLength: 1 },
      name: { type: 'string' },
      type: { type: 'string', enum: ['Gateway', 'Nodo Sensor'] },
      status: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      battery_level: { type: 'integer', minimum: 0, maximum: 100 },
      signal_strength: { type: 'integer' },
      mac_address: { type: 'string' },
      registered: { type: 'boolean' },
      map_point_id: { type: ['integer', 'null'] }
    }
  }
};

export const updateDeviceSchema = {
  params: {
    type: 'object',
    required: ['deviceId'],
    properties: {
      deviceId: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['Gateway', 'Nodo Sensor'] },
      status: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      battery_level: { type: 'integer', minimum: 0, maximum: 100 },
      signal_strength: { type: 'integer' },
      mac_address: { type: 'string' },
      registered: { type: 'boolean' },
      map_point_id: { type: ['integer', 'null'] }
    }
  }
};

export const createMapPointSchema = {
  body: {
    type: 'object',
    required: ['name', 'latitude', 'longitude', 'type'],
    properties: {
      name: { type: 'string', minLength: 1 },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      type: { type: 'string', minLength: 1 },
      description: { type: 'string' }
    }
  }
};

export const updateMapPointSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    }
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      latitude: { type: 'number' },
      longitude: { type: 'number' },
      type: { type: 'string' },
      description: { type: 'string' }
    }
  }
};

export const createRouteSchema = {
  body: {
    type: 'object',
    required: ['name', 'district', 'points', 'distance', 'duration'],
    properties: {
      name: { type: 'string', minLength: 1 },
      district: { type: 'string', minLength: 1 },
      points: {
        type: 'array',
        minItems: 2,
        items: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { type: 'number' }
        }
      },
      distance: { type: 'number', minimum: 0 },
      duration: { type: 'integer', minimum: 0 },
      color: { type: 'string' }
    }
  }
};
