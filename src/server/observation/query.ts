import { z } from 'zod';

import { getEarthState, getSolarPointInfo } from '@/simulation/astronomy';
import {
  getBodyMetadata,
  getBodyState,
  getDefaultBodyIds,
  getSolarSystemCatalog,
  getSystemSnapshot
} from '@/server/observation/solarSystem';
import { getSatelliteFeed, satelliteCategorySchema } from '@/server/satellites';
import type { ObservationQueryRequest, ObservationQueryResponse } from '@/types/observation';

const requestSchema = z.object({
  kind: z.enum([
    'weather_current',
    'earthquakes_recent',
    'satellites_snapshot',
    'solar_at_location',
    'moon_ephemeris',
    'body_catalog',
    'body_metadata',
    'body_state',
    'system_snapshot',
    'space_weather_current',
    'small_body_events'
  ]),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180)
    })
    .optional(),
  satelliteCategory: satelliteCategorySchema.optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
  bodyId: z.string().trim().min(1).max(40).optional(),
  bodyIds: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  epochIso: z.string().datetime().optional()
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

const horizonsResponseSchema = z.object({
  result: z.string().optional(),
  error: z.string().optional()
});

const cneosCadSchema = z.object({
  signature: z.object({
    source: z.string().optional()
  }),
  fields: z.array(z.string()),
  data: z.array(z.array(z.union([z.string(), z.number(), z.null()])))
});

const cneosFireballSchema = z.object({
  fields: z.array(z.string()),
  data: z.array(z.array(z.union([z.string(), z.number(), z.null()])))
});

const sbdbResponseSchema = z.object({
  orbit: z
    .object({
      epoch: z.union([z.string(), z.number()]).optional(),
      elements: z
        .array(
          z.object({
            name: z.string(),
            value: z.union([z.string(), z.number()]).optional()
          })
        )
        .optional()
    })
    .optional()
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

function fallbackMoonEphemeris(now: Date) {
  const daysSinceJ2000 = (now.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
  const orbitalPeriodDays = 27.321661;
  const inclinationDeg = 5.145;
  const angle = ((daysSinceJ2000 % orbitalPeriodDays) / orbitalPeriodDays) * Math.PI * 2;
  const radiusKm = 384400;
  const inclinationRad = (inclinationDeg * Math.PI) / 180;

  const x = radiusKm * Math.cos(angle);
  const y = radiusKm * Math.sin(angle) * Math.cos(inclinationRad);
  const z = radiusKm * Math.sin(angle) * Math.sin(inclinationRad);
  const angularRate = (2 * Math.PI) / (orbitalPeriodDays * 86400);
  const vx = -radiusKm * angularRate * Math.sin(angle);
  const vy = radiusKm * angularRate * Math.cos(angle) * Math.cos(inclinationRad);
  const vz = radiusKm * angularRate * Math.cos(angle) * Math.sin(inclinationRad);

  return {
    source: 'fallback_model',
    epochIso: now.toISOString(),
    positionKm: { x, y, z },
    velocityKmS: { x: vx, y: vy, z: vz },
    distanceKm: Math.sqrt(x * x + y * y + z * z)
  };
}

function parseHorizonsCsvLine(result: string) {
  const start = result.indexOf('$$SOE');
  const end = result.indexOf('$$EOE');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Invalid Horizons response envelope');
  }

  const lines = result
    .slice(start + 5, end)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines[0]) {
    throw new Error('Horizons response is empty');
  }

  const parts = lines[0].split(',').map((item) => item.trim());
  const numericValues = parts
    .map((part) => Number(part))
    .filter((value) => Number.isFinite(value));

  if (numericValues.length < 7) {
    throw new Error('Horizons data line does not contain expected vector values');
  }

  const [julianDate, x, y, z, vx, vy, vz] = numericValues;
  return {
    julianDate,
    x,
    y,
    z,
    vx,
    vy,
    vz
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
  const events = parsed.features.slice(0, maxResults).map((feature) => ({
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

async function queryMoonEphemeris(): Promise<ObservationQueryResponse> {
  const now = new Date();
  const start = now.toISOString().slice(0, 16).replace('T', ' ');
  const stop = new Date(now.getTime() + 60000).toISOString().slice(0, 16).replace('T', ' ');

  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  url.searchParams.set('format', 'json');
  url.searchParams.set('COMMAND', '301');
  url.searchParams.set('OBJ_DATA', 'NO');
  url.searchParams.set('MAKE_EPHEM', 'YES');
  url.searchParams.set('EPHEM_TYPE', 'VECTORS');
  url.searchParams.set('CENTER', '500@399');
  url.searchParams.set('START_TIME', start);
  url.searchParams.set('STOP_TIME', stop);
  url.searchParams.set('STEP_SIZE', '1 m');
  url.searchParams.set('VEC_TABLE', '2');
  url.searchParams.set('REF_SYSTEM', 'ICRF');
  url.searchParams.set('OUT_UNITS', 'KM-S');
  url.searchParams.set('CSV_FORMAT', 'YES');

  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5500) });
    if (!response.ok) {
      throw new Error(`Horizons request failed with status ${response.status}`);
    }

    const raw = horizonsResponseSchema.parse(await response.json());
    if (raw.error) {
      throw new Error(raw.error);
    }
    if (!raw.result) {
      throw new Error('Horizons returned no ephemeris content');
    }

    const parsed = parseHorizonsCsvLine(raw.result);
    const distanceKm = Math.sqrt(parsed.x * parsed.x + parsed.y * parsed.y + parsed.z * parsed.z);

    return {
      kind: 'moon_ephemeris',
      providerId: 'jplHorizons',
      generatedAtIso: now.toISOString(),
      data: {
        source: 'jpl_horizons',
        epochIso: now.toISOString(),
        julianDateTdb: parsed.julianDate,
        positionKm: { x: parsed.x, y: parsed.y, z: parsed.z },
        velocityKmS: { x: parsed.vx, y: parsed.vy, z: parsed.vz },
        distanceKm
      },
      citations: [citation('jplHorizons', 'JPL Horizons System API', 'https://ssd-api.jpl.nasa.gov/doc/horizons.html')]
    };
  } catch (error) {
    const fallback = fallbackMoonEphemeris(now);
    const message = error instanceof Error ? error.message : 'JPL Horizons unavailable';
    return {
      kind: 'moon_ephemeris',
      providerId: 'jplHorizons',
      generatedAtIso: now.toISOString(),
      data: {
        ...fallback,
        fallbackReason: message
      },
      citations: [
        citation('jplHorizons', 'JPL Horizons System API', 'https://ssd-api.jpl.nasa.gov/doc/horizons.html'),
        citation('nasaGibs', 'Fallback circular lunar model (server-side)', 'https://earthdata.nasa.gov/gibs')
      ]
    };
  }
}

function latestSpaceWeatherValue(payload: unknown) {
  if (!Array.isArray(payload)) {
    return null;
  }

  const reversed = [...payload].reverse();
  const latest = reversed.find((item) => item && typeof item === 'object');
  if (!latest || typeof latest !== 'object') {
    return null;
  }

  const record = latest as Record<string, unknown>;
  return {
    timeTag:
      (typeof record.time_tag === 'string' && record.time_tag) ||
      (typeof record.observed_time === 'string' && record.observed_time) ||
      null,
    kpIndex:
      (typeof record.kp_index === 'number' && record.kp_index) ||
      (typeof record.estimated_kp === 'number' && record.estimated_kp) ||
      null
  };
}

async function querySpaceWeatherCurrent(): Promise<ObservationQueryResponse> {
  const [kpResponse, solarProbabilitiesResponse] = await Promise.all([
    fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', {
      next: { revalidate: 300 }
    }),
    fetch('https://services.swpc.noaa.gov/json/solar_probabilities.json', {
      next: { revalidate: 300 }
    })
  ]);

  if (!kpResponse.ok || !solarProbabilitiesResponse.ok) {
    throw new Error('NOAA SWPC request failed');
  }

  const [kpPayload, solarProbabilitiesPayload] = await Promise.all([kpResponse.json(), solarProbabilitiesResponse.json()]);
  const latestKp = latestSpaceWeatherValue(kpPayload);

  return {
    kind: 'space_weather_current',
    providerId: 'noaaSwpc',
    generatedAtIso: new Date().toISOString(),
    data: {
      latestKp,
      solarProbabilities: solarProbabilitiesPayload
    },
    citations: [
      citation('noaaSwpc', 'NOAA SWPC Data Access', 'https://www.swpc.noaa.gov/content/data-access'),
      citation('noaaSwpc', 'NOAA SWPC JSON Data Service', 'https://services.swpc.noaa.gov/json/')
    ]
  };
}

async function queryBodyCatalog(): Promise<ObservationQueryResponse> {
  return {
    kind: 'body_catalog',
    providerId: 'nasaPds',
    generatedAtIso: new Date().toISOString(),
    data: {
      bodies: getSolarSystemCatalog(),
      defaultBodyIds: getDefaultBodyIds()
    },
    citations: [
      citation('nasaPds', 'NASA PDS APIs', 'https://nasa-pds.github.io/pds-api/'),
      citation('nasaTreks', 'NASA Solar System Treks', 'https://trek.nasa.gov/')
    ]
  };
}

async function queryBodyMetadata(bodyId: string): Promise<ObservationQueryResponse> {
  return {
    kind: 'body_metadata',
    providerId: 'nasaTreks',
    generatedAtIso: new Date().toISOString(),
    data: getBodyMetadata(bodyId),
    citations: [
      citation('nasaTreks', 'NASA Solar System Treks', 'https://trek.nasa.gov/'),
      citation('nasaPds', 'NASA PDS APIs', 'https://nasa-pds.github.io/pds-api/')
    ]
  };
}

async function queryBodyState(bodyId: string, epochIso?: string): Promise<ObservationQueryResponse> {
  const state = await getBodyState(bodyId, epochIso);
  return {
    kind: 'body_state',
    providerId: 'jplHorizons',
    generatedAtIso: new Date().toISOString(),
    data: state,
    citations: [
      citation('jplHorizons', 'JPL Horizons System API', 'https://ssd-api.jpl.nasa.gov/doc/horizons.html')
    ]
  };
}

async function querySystemSnapshot(bodyIds?: string[], epochIso?: string): Promise<ObservationQueryResponse> {
  const snapshot = await getSystemSnapshot(bodyIds, epochIso);
  return {
    kind: 'system_snapshot',
    providerId: 'jplHorizons',
    generatedAtIso: new Date().toISOString(),
    data: snapshot,
    citations: [
      citation('jplHorizons', 'JPL Horizons System API', 'https://ssd-api.jpl.nasa.gov/doc/horizons.html')
    ]
  };
}

const AU_IN_KM = 149_597_870.7;
const EARTH_OBLIQUITY_RAD = (23.4392911 * Math.PI) / 180;

type SbdbOrbitElements = {
  epochJd: number;
  e: number;
  a: number;
  iDeg: number;
  omDeg: number;
  wDeg: number;
  maDeg: number;
  nDegPerDay: number;
};

type SmallBodyApproachEvent = {
  designation: unknown;
  closeApproachTimeUtc: unknown;
  missDistanceAu: unknown;
  relativeVelocityKmS: unknown;
  objectDiameterKm: {
    min: unknown;
    max: unknown;
  };
  orbitUncertainty: unknown;
};

function asNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCneosDate(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const direct = Date.parse(trimmed);
  if (Number.isFinite(direct)) {
    return new Date(direct).toISOString();
  }

  const match = trimmed.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const monthMap: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12'
  };
  const [, year, monthToken, day, hour, minute] = match;
  const month = monthMap[monthToken.toLowerCase()];
  if (!month) {
    return null;
  }
  return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
}

function jdFromIso(iso: string) {
  return Date.parse(iso) / 86400000 + 2440587.5;
}

function normalizeRadians(value: number) {
  const tau = Math.PI * 2;
  const normalized = value % tau;
  return normalized >= 0 ? normalized : normalized + tau;
}

function solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number) {
  let estimate = meanAnomalyRad;
  for (let i = 0; i < 12; i += 1) {
    const delta =
      (estimate - eccentricity * Math.sin(estimate) - meanAnomalyRad) / (1 - eccentricity * Math.cos(estimate));
    estimate -= delta;
    if (Math.abs(delta) < 1e-10) {
      break;
    }
  }
  return estimate;
}

function heliocentricEquatorialPositionAu(elements: SbdbOrbitElements, targetJd: number) {
  const dtDays = targetJd - elements.epochJd;
  const meanAnomalyRad = normalizeRadians(((elements.maDeg + elements.nDegPerDay * dtDays) * Math.PI) / 180);
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomalyRad, elements.e);
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + elements.e) * Math.sin(eccentricAnomaly / 2),
    Math.sqrt(1 - elements.e) * Math.cos(eccentricAnomaly / 2)
  );
  const radiusAu = elements.a * (1 - elements.e * Math.cos(eccentricAnomaly));
  const inclination = (elements.iDeg * Math.PI) / 180;
  const ascNode = (elements.omDeg * Math.PI) / 180;
  const argPeri = (elements.wDeg * Math.PI) / 180;
  const argLat = argPeri + trueAnomaly;

  const xEcl = radiusAu * (Math.cos(ascNode) * Math.cos(argLat) - Math.sin(ascNode) * Math.sin(argLat) * Math.cos(inclination));
  const yEcl = radiusAu * (Math.sin(ascNode) * Math.cos(argLat) + Math.cos(ascNode) * Math.sin(argLat) * Math.cos(inclination));
  const zEcl = radiusAu * Math.sin(argLat) * Math.sin(inclination);

  // Rotate ecliptic J2000 to equatorial J2000 for compatibility with ICRF-like vectors.
  const x = xEcl;
  const y = yEcl * Math.cos(EARTH_OBLIQUITY_RAD) - zEcl * Math.sin(EARTH_OBLIQUITY_RAD);
  const z = yEcl * Math.sin(EARTH_OBLIQUITY_RAD) + zEcl * Math.cos(EARTH_OBLIQUITY_RAD);

  return { x, y, z };
}

function heliocentricEquatorialVelocityKmS(elements: SbdbOrbitElements, targetJd: number) {
  const delta = 1 / 1440; // 1 minute
  const before = heliocentricEquatorialPositionAu(elements, targetJd - delta);
  const after = heliocentricEquatorialPositionAu(elements, targetJd + delta);
  const seconds = delta * 2 * 86400;
  return {
    x: ((after.x - before.x) * AU_IN_KM) / seconds,
    y: ((after.y - before.y) * AU_IN_KM) / seconds,
    z: ((after.z - before.z) * AU_IN_KM) / seconds
  };
}

function parseSbdbOrbitElements(payload: unknown): SbdbOrbitElements | null {
  const parsed = sbdbResponseSchema.parse(payload);
  const epochJd = asNumber(parsed.orbit?.epoch);
  if (!epochJd || !parsed.orbit?.elements?.length) {
    return null;
  }

  const byName = new Map(parsed.orbit.elements.map((item) => [item.name, asNumber(item.value)]));
  const e = byName.get('e');
  const a = byName.get('a');
  const iDeg = byName.get('i');
  const omDeg = byName.get('om');
  const wDeg = byName.get('w');
  const maDeg = byName.get('ma');
  const nDegPerDay = byName.get('n');

  if (
    e === null ||
    e === undefined ||
    a === null ||
    a === undefined ||
    iDeg === null ||
    iDeg === undefined ||
    omDeg === null ||
    omDeg === undefined ||
    wDeg === null ||
    wDeg === undefined ||
    maDeg === null ||
    maDeg === undefined ||
    nDegPerDay === null ||
    nDegPerDay === undefined
  ) {
    return null;
  }

  return {
    epochJd,
    e,
    a,
    iDeg,
    omDeg,
    wDeg,
    maDeg,
    nDegPerDay
  };
}

async function fetchSbdbOrbitElements(designation: string): Promise<SbdbOrbitElements | null> {
  const url = new URL('https://ssd-api.jpl.nasa.gov/sbdb.api');
  url.searchParams.set('sstr', designation);
  url.searchParams.set('full-prec', 'true');

  try {
    const response = await fetch(url, { next: { revalidate: 6 * 60 * 60 }, signal: AbortSignal.timeout(4500) });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return parseSbdbOrbitElements(payload);
  } catch {
    return null;
  }
}

async function augmentSmallBodyApproach(event: SmallBodyApproachEvent) {
  const closeApproachTimeIso = normalizeCneosDate(event.closeApproachTimeUtc);
  const designation = typeof event.designation === 'string' ? event.designation : null;
  if (!closeApproachTimeIso || !designation) {
    return {
      ...event,
      closeApproachTimeIso: closeApproachTimeIso ?? null,
      vectorSource: 'proxy'
    };
  }

  const elements = await fetchSbdbOrbitElements(designation);
  if (!elements) {
    return {
      ...event,
      closeApproachTimeIso,
      vectorSource: 'proxy'
    };
  }

  try {
    const jd = jdFromIso(closeApproachTimeIso);
    const smallBodyHelioAu = heliocentricEquatorialPositionAu(elements, jd);
    const smallBodyHelioKm = {
      x: smallBodyHelioAu.x * AU_IN_KM,
      y: smallBodyHelioAu.y * AU_IN_KM,
      z: smallBodyHelioAu.z * AU_IN_KM
    };
    const smallBodyVelocityKmS = heliocentricEquatorialVelocityKmS(elements, jd);
    const earthState = await getBodyState('earth', closeApproachTimeIso);

    return {
      ...event,
      closeApproachTimeIso,
      vectorSource: 'sbdb_kepler',
      vectorEpochIso: closeApproachTimeIso,
      vectorKm: {
        x: smallBodyHelioKm.x - earthState.positionKm.x,
        y: smallBodyHelioKm.y - earthState.positionKm.y,
        z: smallBodyHelioKm.z - earthState.positionKm.z
      },
      velocityKmS: {
        x: smallBodyVelocityKmS.x - earthState.velocityKmS.x,
        y: smallBodyVelocityKmS.y - earthState.velocityKmS.y,
        z: smallBodyVelocityKmS.z - earthState.velocityKmS.z
      }
    };
  } catch {
    return {
      ...event,
      closeApproachTimeIso,
      vectorSource: 'proxy'
    };
  }
}

async function querySmallBodyEvents(maxResults: number): Promise<ObservationQueryResponse> {
  const start = new Date();
  const stop = new Date(start.getTime() + 45 * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString().slice(0, 10);
  const stopIso = stop.toISOString().slice(0, 10);

  const cadUrl = new URL('https://ssd-api.jpl.nasa.gov/cad.api');
  cadUrl.searchParams.set('date-min', startIso);
  cadUrl.searchParams.set('date-max', stopIso);
  cadUrl.searchParams.set('dist-max', '0.2');
  cadUrl.searchParams.set('sort', 'date');

  const fireballUrl = new URL('https://ssd-api.jpl.nasa.gov/fireball.api');
  fireballUrl.searchParams.set('req-loc', 'true');
  fireballUrl.searchParams.set('limit', String(Math.max(20, maxResults)));

  const [cadResponse, fireballResponse] = await Promise.all([
    fetch(cadUrl, { next: { revalidate: 900 } }),
    fetch(fireballUrl, { next: { revalidate: 900 } })
  ]);

  if (!cadResponse.ok || !fireballResponse.ok) {
    throw new Error('JPL CNEOS request failed');
  }

  const cadPayload = cneosCadSchema.parse(await cadResponse.json());
  const fireballPayload = cneosFireballSchema.parse(await fireballResponse.json());

  const cadFieldIndex = new Map(cadPayload.fields.map((field, index) => [field, index]));
  const closeApproachesRaw = cadPayload.data.slice(0, maxResults).map((row) => {
    const value = (field: string) => row[cadFieldIndex.get(field) ?? -1] ?? null;
    return {
      designation: value('des') ?? value('fullname'),
      closeApproachTimeUtc: value('cd'),
      missDistanceAu: value('dist'),
      relativeVelocityKmS: value('v_rel'),
      objectDiameterKm: {
        min: value('diameter'),
        max: value('diameter')
      },
      orbitUncertainty: value('orbit_id')
    };
  });
  const closeApproaches = await Promise.all(closeApproachesRaw.map((event) => augmentSmallBodyApproach(event)));

  const fireballFieldIndex = new Map(fireballPayload.fields.map((field, index) => [field, index]));
  const fireballs = fireballPayload.data.slice(0, maxResults).map((row) => {
    const value = (field: string) => row[fireballFieldIndex.get(field) ?? -1] ?? null;
    return {
      peakBrightnessDateUtc: value('date'),
      energyJouleScale: value('energy'),
      latitude: value('lat'),
      longitude: value('lon'),
      altitudeKm: value('alt'),
      velocityKmS: value('vel')
    };
  });

  return {
    kind: 'small_body_events',
    providerId: 'jplCneos',
    generatedAtIso: new Date().toISOString(),
    data: {
      window: {
        startIso,
        stopIso
      },
      closeApproaches,
      fireballs
    },
    citations: [
      citation('jplCneos', 'JPL CAD API', 'https://ssd-api.jpl.nasa.gov/doc/cad.html'),
      citation('jplCneos', 'JPL Fireball API', 'https://ssd-api.jpl.nasa.gov/doc/fireball.html'),
      citation('jplCneos', 'JPL SBDB API', 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html')
    ]
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
    case 'moon_ephemeris':
      return queryMoonEphemeris();
    case 'body_catalog':
      return queryBodyCatalog();
    case 'body_metadata':
      return queryBodyMetadata(parsed.bodyId ?? 'earth');
    case 'body_state':
      return queryBodyState(parsed.bodyId ?? 'earth', parsed.epochIso);
    case 'system_snapshot':
      return querySystemSnapshot(parsed.bodyIds, parsed.epochIso);
    case 'space_weather_current':
      return querySpaceWeatherCurrent();
    case 'small_body_events':
      return querySmallBodyEvents(maxResults);
  }
}
