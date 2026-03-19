import { z } from 'zod';

import type { AgentAction } from '@/types/agent';

export const flyToSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  altitude: z.number().min(1_000).max(50_000_000).optional(),
  heading: z.number().min(0).max(360).optional(),
  pitch: z.number().min(-90).max(0).optional(),
  label: z.string().min(1).max(80).optional()
});

export const searchPlaceSchema = z.object({
  query: z.string().trim().min(2).max(120),
  maxResults: z.number().int().min(1).max(8).optional()
});

export const setTimeSchema = z.object({
  iso: z.string().datetime()
});

export const playTimeSchema = z.object({
  speed: z.number().min(1).max(1_000_000)
});

export const pauseTimeSchema = z.object({});

export const setInertialModeSchema = z.object({
  enabled: z.boolean()
});

export const toggleLayerSchema = z.object({
  layerId: z.enum([
    'dayNight',
    'atmosphere',
    'cityMarkers',
    'moon',
    'satellites',
    'weatherClouds',
    'weatherTemperature'
  ]),
  visible: z.boolean()
});

export const addAnnotationSchema = z.object({
  text: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  color: z.string().optional()
});

export const clearAnnotationsSchema = z.object({});

export const toolSchemas = {
  search_place: searchPlaceSchema,
  fly_to: flyToSchema,
  set_time: setTimeSchema,
  play_time: playTimeSchema,
  pause_time: pauseTimeSchema,
  set_inertial_mode: setInertialModeSchema,
  toggle_layer: toggleLayerSchema,
  add_annotation: addAnnotationSchema,
  clear_annotations: clearAnnotationsSchema
} as const;

export function getToolDefinitions() {
  return [
    {
      type: 'function',
      name: 'search_place',
      description: 'Resolve a named place into candidate latitude/longitude pairs. Use this before fly_to when the user names a city, country, landmark, or region.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 2, maxLength: 120 },
          maxResults: { type: 'integer', minimum: 1, maximum: 8 }
        },
        required: ['query'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'fly_to',
      description: 'Move the camera to a location on Earth.',
      parameters: {
        type: 'object',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lon: { type: 'number', minimum: -180, maximum: 180 },
          altitude: { type: 'number', minimum: 1000, maximum: 50000000 },
          heading: { type: 'number', minimum: 0, maximum: 360 },
          pitch: { type: 'number', minimum: -90, maximum: 0 },
          label: { type: 'string' }
        },
        required: ['lat', 'lon'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'set_time',
      description: 'Set the simulation clock to a specific ISO-8601 timestamp.',
      parameters: {
        type: 'object',
        properties: {
          iso: { type: 'string', format: 'date-time' }
        },
        required: ['iso'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'play_time',
      description: 'Start time playback at a specified speed multiplier.',
      parameters: {
        type: 'object',
        properties: {
          speed: { type: 'number', minimum: 1, maximum: 1000000 }
        },
        required: ['speed'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'pause_time',
      description: 'Pause the simulation clock.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'set_inertial_mode',
      description: 'Enable or disable the inertial camera reference frame.',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' }
        },
        required: ['enabled'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'toggle_layer',
      description: 'Show or hide a visual layer.',
      parameters: {
        type: 'object',
        properties: {
          layerId: {
            type: 'string',
            enum: ['dayNight', 'atmosphere', 'cityMarkers', 'moon', 'satellites', 'weatherClouds', 'weatherTemperature']
          },
          visible: { type: 'boolean' }
        },
        required: ['layerId', 'visible'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'add_annotation',
      description: 'Attach a textual annotation to a geographic location.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lon: { type: 'number', minimum: -180, maximum: 180 },
          color: { type: 'string' }
        },
        required: ['text', 'lat', 'lon'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'clear_annotations',
      description: 'Remove all active annotations.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  ] as const;
}

export function toAction(name: keyof typeof toolSchemas, payload: unknown): AgentAction {
  switch (name) {
    case 'search_place':
      throw new Error('search_place does not map directly to a viewer action');
    case 'fly_to':
      return { type: 'fly_to', payload: flyToSchema.parse(payload) };
    case 'set_time':
      return { type: 'set_time', payload: setTimeSchema.parse(payload) };
    case 'play_time':
      return { type: 'play_time', payload: playTimeSchema.parse(payload) };
    case 'pause_time':
      return { type: 'pause_time', payload: pauseTimeSchema.parse(payload) };
    case 'set_inertial_mode':
      return { type: 'set_inertial_mode', payload: setInertialModeSchema.parse(payload) };
    case 'toggle_layer':
      return { type: 'toggle_layer', payload: toggleLayerSchema.parse(payload) };
    case 'add_annotation':
      return { type: 'add_annotation', payload: addAnnotationSchema.parse(payload) };
    case 'clear_annotations':
      return { type: 'clear_annotations', payload: clearAnnotationsSchema.parse(payload) };
  }
}
