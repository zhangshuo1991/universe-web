import { z } from 'zod';

import { getEarthState, getSolarPointInfo } from '@/simulation/astronomy';
import { getSatelliteFeed, satelliteCategorySchema } from '@/server/satellites';
import type { ObservationQueryRequest, ObservationQueryResponse } from '@/types/observation';

const requestSchema = z.object({
  kind: z.enum(['weather_current', 'earthquakes_recent', 'satellites_snapshot', 'solar_at_location']),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180)
    })
    .optional(),
  satelliteCategory: satelliteCategorySchema.optional(),
  maxResults: z.number().int().min(1).max(50).optional()
});

const openMeteoCurrentSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  generationtime_ms: z.number().optional(),
  current: z
    .object({
      time: z.string(),
      temperature_2m: z.number().optional(),
      relative_humidity_2m: z.number().optional(),
      apparent_temperature: z.number().optional(),
      is_day: z.number().optional(),
      precipitation: z.number().optional(),
      wind_speed_10m: z.number().optional(),
      wind_direction_10m: z.number().optional()
    })
    .optional()
});

const earthquakeFeedSchema = z.object({
  metadata: z.object({
    generated: z.number(),
    title: z.string().optional()
  }),
  features: z.array(
    z.object({
      id: z.string(),
      properties: z.object({
        mag: z.number().nullable().optional(),
        place: z.string().nullable().optional(),
        time: z.number().optional(),
        url: z.string().optional(),
        title: z.string().optional()
      }),
      geometry: z
        .object({
          coordinates: z.array(z.number())
        })
        .optional()
    })
  )
});

export type ObservationQueryParsed = z.infer<typeof requestSchema>;

export function parseObservationQueryRequest(payload: unknown): ObservationQueryParsed {
  return requestSchema.parse(payload);
}

function citation(providerId: ObservationQueryResponse['providerId'], title: string, url: string) {
  return {
    providerId,
    title,
    url,
    retrievedAtIso: new Date().toISOString()
  };
}

async function queryWeatherCurrent(
  location: NonNullable<ObservationQueryRequest['location']>
): Promise<ObservationQueryResponse> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.lat));
  url.searchParams.set('longitude', String(location.lon));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,wind_speed_10m,wind_direction_10m'
  );
  url.searchParams.set('timezone', 'UTC');

  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const parsed = openMeteoCurrentSchema.parse(await response.json());

  return {
    kind: 'weather_current',
    providerId: 'openMeteo',
    generatedAtIso: new Date().toISOString(),
    data: parsed,
    citations: [citation('openMeteo', 'Open-Meteo Forecast API', 'https://open-meteo.com/en/docs')]
  };
}

async function queryEarthquakesRecent(maxResults: number): Promise<ObservationQueryResponse> {
  const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', {
    next: { revalidate: 300 }
  });
  if (!response.ok) {
    throw new Error(`USGS request failed with status ${response.status}`);
  }

  const parsed = earthquakeFeedSchema.parse(await response.json());
  const events = parsed.features
    .slice(0, maxResults)
    .map((feature) => ({
      id: feature.id,
      magnitude: feature.properties.mag ?? null,
      place: feature.properties.place ?? 'Unknown',
      timeIso: feature.properties.time ? new Date(feature.properties.time).toISOString() : null,
      url: feature.properties.url,
      title: feature.properties.title,
      coordinates: feature.geometry?.coordinates ?? []
    }));

  return {
    kind: 'earthquakes_recent',
    providerId: 'usgs',
    generatedAtIso: new Date(parsed.metadata.generated).toISOString(),
    data: {
      title: parsed.metadata.title ?? 'USGS Earthquake Feed',
      total: parsed.features.length,
      events
    },
    citations: [
      citation(
        'usgs',
        'USGS Earthquake GeoJSON Summary Feed',
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php'
      )
    ]
  };
}

async function querySatellitesSnapshot(
  category: NonNullable<ObservationQueryRequest['satelliteCategory']>
): Promise<ObservationQueryResponse> {
  const feed = await getSatelliteFeed(category);
  return {
    kind: 'satellites_snapshot',
    providerId: 'celestrak',
    generatedAtIso: new Date().toISOString(),
    data: {
      activeCategory: feed.activeCategory,
      failedCount: feed.failedCount,
      satellites: feed.satellites.map((item) => ({
        catnr: item.catnr,
        label: item.label,
        color: item.color,
        epoch: item.omm.EPOCH
      }))
    },
    citations: [
      citation(
        'celestrak',
        'CelesTrak GP/TLE Element Sets',
        'https://celestrak.org/NORAD/documentation/gp-data-formats.php'
      )
    ]
  };
}

function querySolarAtLocation(
  location: NonNullable<ObservationQueryRequest['location']>
): ObservationQueryResponse {
  const now = new Date();
  const earthState = getEarthState(now);
  const solar = getSolarPointInfo(location.lat, location.lon, earthState);
  return {
    kind: 'solar_at_location',
    providerId: 'nasaGibs',
    generatedAtIso: now.toISOString(),
    data: {
      location,
      solar,
      subsolarLatitude: earthState.subsolarLatitude,
      subsolarLongitude: earthState.subsolarLongitude
    },
    citations: [citation('nasaGibs', 'Internal deterministic astronomy model', 'https://earthdata.nasa.gov/gibs')]
  };
}

export async function runObservationQuery(payload: unknown): Promise<ObservationQueryResponse> {
  const parsed = parseObservationQueryRequest(payload);
  const maxResults = parsed.maxResults ?? 10;

  switch (parsed.kind) {
    case 'weather_current':
      return queryWeatherCurrent(
        parsed.location ?? {
          lat: 31.2304,
          lon: 121.4737
        }
      );
    case 'earthquakes_recent':
      return queryEarthquakesRecent(maxResults);
    case 'satellites_snapshot':
      return querySatellitesSnapshot(parsed.satelliteCategory ?? 'all');
    case 'solar_at_location':
      return querySolarAtLocation(
        parsed.location ?? {
          lat: 31.2304,
          lon: 121.4737
        }
      );
  }
}
