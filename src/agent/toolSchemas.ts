import { z } from 'zod';

import type { AgentAction, InterfaceMode, SolarViewPresetId, ViewerLayerId } from '@/types/agent';

const layerIds = [
  'dayNight',
  'atmosphere',
  'cityMarkers',
  'moon',
  'satellites',
  'earthquakes',
  'weatherClouds',
  'weatherTemperature',
  'planetOrbits',
  'planetLabels',
  'majorMoons',
  'spaceWeather',
  'surfaceOverlays',
  'smallBodies'
] as const satisfies readonly ViewerLayerId[];

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
  layerId: z.enum(layerIds),
  visible: z.boolean()
});

export const addAnnotationSchema = z.object({
  text: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  color: z.string().optional()
});

export const clearAnnotationsSchema = z.object({});

const routeEndpointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  label: z.string().trim().min(1).max(120)
});

export const showRouteSchema = z.object({
  from: routeEndpointSchema,
  to: routeEndpointSchema,
  color: z.string().optional()
});

export const queryWeatherSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180)
});

export const queryEarthquakesSchema = z.object({
  maxResults: z.number().int().min(1).max(20).optional()
});

export const queryMoonEphemerisSchema = z.object({});

export const focusBodySchema = z.object({
  bodyId: z.string().trim().min(1).max(40)
});

export const setViewPresetSchema = z.object({
  presetId: z.enum(['inner', 'outer', 'full', 'earthMoon'] as const satisfies readonly SolarViewPresetId[])
});

export const setInterfaceModeSchema = z.object({
  mode: z.enum(['explore', 'analysis'] as const satisfies readonly InterfaceMode[])
});

export const listBodiesSchema = z.object({});

export const queryBodyStateSchema = z.object({
  bodyId: z.string().trim().min(1).max(40),
  epochIso: z.string().datetime().optional()
});

export const querySystemSnapshotSchema = z.object({
  bodyIds: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  epochIso: z.string().datetime().optional()
});

export const querySpaceWeatherSchema = z.object({});

export const querySmallBodiesSchema = z.object({
  maxResults: z.number().int().min(1).max(30).optional()
});

export const completeTaskSchema = z.object({
  summary: z.string().min(1).max(280)
});

export const toolSchemas = {
  search_place: searchPlaceSchema,
  fly_to: flyToSchema,
  set_time: setTimeSchema,
  play_time: playTimeSchema,
  pause_time: pauseTimeSchema,
  set_inertial_mode: setInertialModeSchema,
  focus_body: focusBodySchema,
  set_view_preset: setViewPresetSchema,
  set_interface_mode: setInterfaceModeSchema,
  toggle_layer: toggleLayerSchema,
  add_annotation: addAnnotationSchema,
  clear_annotations: clearAnnotationsSchema,
  show_route: showRouteSchema,
  query_weather: queryWeatherSchema,
  query_earthquakes: queryEarthquakesSchema,
  query_moon_ephemeris: queryMoonEphemerisSchema,
  list_bodies: listBodiesSchema,
  query_body_state: queryBodyStateSchema,
  query_system_snapshot: querySystemSnapshotSchema,
  query_space_weather: querySpaceWeatherSchema,
  query_small_bodies: querySmallBodiesSchema,
  complete_task: completeTaskSchema
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
      name: 'focus_body',
      description: 'Focus the viewer on a Solar System body by id, for example earth, mars, jupiter, moon, or titan.',
      parameters: {
        type: 'object',
        properties: {
          bodyId: { type: 'string', minLength: 1, maxLength: 40 }
        },
        required: ['bodyId'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'set_view_preset',
      description: 'Switch the Solar System camera preset between inner, outer, full, and earthMoon.',
      parameters: {
        type: 'object',
        properties: {
          presetId: { type: 'string', enum: ['inner', 'outer', 'full', 'earthMoon'] }
        },
        required: ['presetId'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'set_interface_mode',
      description: 'Switch the UI mode between explore and analysis.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['explore', 'analysis'] }
        },
        required: ['mode'],
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
            enum: layerIds
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
    },
    {
      type: 'function',
      name: 'show_route',
      description: 'Draw a route preview between two Earth locations after you have resolved both endpoints. Use for flight paths, travel corridors, or route comparisons.',
      parameters: {
        type: 'object',
        properties: {
          from: {
            type: 'object',
            properties: {
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lon: { type: 'number', minimum: -180, maximum: 180 },
              label: { type: 'string', minLength: 1, maxLength: 120 }
            },
            required: ['lat', 'lon', 'label'],
            additionalProperties: false
          },
          to: {
            type: 'object',
            properties: {
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lon: { type: 'number', minimum: -180, maximum: 180 },
              label: { type: 'string', minLength: 1, maxLength: 120 }
            },
            required: ['lat', 'lon', 'label'],
            additionalProperties: false
          },
          color: { type: 'string' }
        },
        required: ['from', 'to'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'query_weather',
      description: 'Query current weather at a specific latitude/longitude from Open-Meteo.',
      parameters: {
        type: 'object',
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lon: { type: 'number', minimum: -180, maximum: 180 }
        },
        required: ['lat', 'lon'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'query_earthquakes',
      description: 'Query recent earthquake events from the USGS feed.',
      parameters: {
        type: 'object',
        properties: {
          maxResults: { type: 'integer', minimum: 1, maximum: 20 }
        },
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'query_moon_ephemeris',
      description: 'Query current Moon ephemeris from JPL Horizons with server fallback.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'list_bodies',
      description: 'List the supported Solar System bodies and their metadata.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'query_body_state',
      description: 'Query the state vector of a Solar System body at the current or specified ISO timestamp.',
      parameters: {
        type: 'object',
        properties: {
          bodyId: { type: 'string', minLength: 1, maxLength: 40 },
          epochIso: { type: 'string', format: 'date-time' }
        },
        required: ['bodyId'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'query_system_snapshot',
      description: 'Query a multi-body Solar System snapshot, optionally restricted to a specific list of body ids.',
      parameters: {
        type: 'object',
        properties: {
          bodyIds: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 20
          },
          epochIso: { type: 'string', format: 'date-time' }
        },
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'query_space_weather',
      description: 'Query current space-weather indicators such as Kp index and solar probabilities from NOAA SWPC.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'query_small_bodies',
      description: 'Query near-Earth close approaches and fireball events from JPL CNEOS APIs.',
      parameters: {
        type: 'object',
        properties: {
          maxResults: { type: 'integer', minimum: 1, maximum: 30 }
        },
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'complete_task',
      description: 'Signal that all necessary steps were completed for this turn.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', minLength: 1, maxLength: 280 }
        },
        required: ['summary'],
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
    case 'focus_body':
      return { type: 'focus_body', payload: focusBodySchema.parse(payload) };
    case 'set_view_preset':
      return { type: 'set_view_preset', payload: setViewPresetSchema.parse(payload) };
    case 'set_interface_mode':
      return { type: 'set_interface_mode', payload: setInterfaceModeSchema.parse(payload) };
    case 'toggle_layer':
      return { type: 'toggle_layer', payload: toggleLayerSchema.parse(payload) };
    case 'add_annotation':
      return { type: 'add_annotation', payload: addAnnotationSchema.parse(payload) };
    case 'clear_annotations':
      return { type: 'clear_annotations', payload: clearAnnotationsSchema.parse(payload) };
    case 'show_route':
      return { type: 'show_route', payload: showRouteSchema.parse(payload) };
    case 'query_weather':
      throw new Error('query_weather does not map directly to a viewer action');
    case 'query_earthquakes':
      throw new Error('query_earthquakes does not map directly to a viewer action');
    case 'query_moon_ephemeris':
      throw new Error('query_moon_ephemeris does not map directly to a viewer action');
    case 'list_bodies':
      throw new Error('list_bodies does not map directly to a viewer action');
    case 'query_body_state':
      throw new Error('query_body_state does not map directly to a viewer action');
    case 'query_system_snapshot':
      throw new Error('query_system_snapshot does not map directly to a viewer action');
    case 'query_space_weather':
      throw new Error('query_space_weather does not map directly to a viewer action');
    case 'query_small_bodies':
      throw new Error('query_small_bodies does not map directly to a viewer action');
    case 'complete_task':
      return { type: 'complete_task', payload: completeTaskSchema.parse(payload) };
  }
}
