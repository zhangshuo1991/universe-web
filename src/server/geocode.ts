import { z } from 'zod';

export const geocodeQuerySchema = z.string().trim().min(2).max(120);

const nominatimItemSchema = z.object({
  place_id: z.number(),
  display_name: z.string(),
  lat: z.string(),
  lon: z.string(),
  type: z.string().optional(),
  class: z.string().optional(),
  importance: z.number().optional()
});

const photonItemSchema = z.object({
  geometry: z.object({
    coordinates: z.tuple([z.number(), z.number()])
  }),
  properties: z.object({
    osm_id: z.number().optional(),
    name: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    osm_value: z.string().optional(),
    osm_key: z.string().optional()
  })
});

const defaultLanguage = 'zh-CN,zh;q=0.9,en;q=0.8';
const userAgent = 'universe-web-earth-observer/0.1 (interactive geocoder)';
const FETCH_TIMEOUT_MS = 5_000;

export type GeocodeResult = {
  id: number;
  label: string;
  lat: number;
  lon: number;
  kind: string;
  importance: number;
};

function fetchWithTimeout(url: URL | string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

async function searchNominatim(
  query: string,
  language: string,
  limit: number
): Promise<GeocodeResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('q', query);

  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept-Language': language,
      'User-Agent': userAgent
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  const payload = z.array(nominatimItemSchema).safeParse(await response.json());
  if (!payload.success) {
    throw new Error('Nominatim response shape was invalid');
  }

  return payload.data.map((item) => ({
    id: item.place_id,
    label: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
    kind: item.type ?? item.class ?? 'place',
    importance: item.importance ?? 0
  }));
}

async function searchPhoton(
  query: string,
  language: string,
  limit: number
): Promise<GeocodeResult[]> {
  const lang = language.startsWith('zh') ? 'default' : language.slice(0, 2);
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  if (lang !== 'default') url.searchParams.set('lang', lang);

  const response = await fetchWithTimeout(url, {
    headers: { 'User-Agent': userAgent },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Photon returned ${response.status}`);
  }

  const body = await response.json();
  const features = z.array(photonItemSchema).safeParse(body.features ?? []);
  if (!features.success) {
    throw new Error('Photon response shape was invalid');
  }

  return features.data.map((feature, index) => {
    const props = feature.properties;
    const parts = [props.name, props.city, props.state, props.country].filter(Boolean);
    return {
      id: props.osm_id ?? index + 1,
      label: parts.join(', ') || 'Unknown',
      lat: feature.geometry.coordinates[1],
      lon: feature.geometry.coordinates[0],
      kind: props.osm_value ?? props.osm_key ?? 'place',
      importance: 1 - index * 0.1
    };
  });
}

export async function searchPlaces(
  rawQuery: string,
  options?: {
    language?: string;
    limit?: number;
  }
): Promise<GeocodeResult[]> {
  const query = geocodeQuerySchema.parse(rawQuery);
  const language = options?.language ?? defaultLanguage;
  const limit = Math.min(Math.max(options?.limit ?? 5, 1), 8);

  // Try Nominatim first, fall back to Photon on timeout/error
  try {
    return await searchNominatim(query, language, limit);
  } catch {
    // Nominatim failed (likely timeout), try Photon
  }

  return searchPhoton(query, language, limit);
}

const reverseGeocodeSchema = z.object({
  place_id: z.number().optional(),
  display_name: z.string(),
  address: z
    .object({
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      county: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      country_code: z.string().optional()
    })
    .optional()
});

export type ReverseGeocodeResult = {
  displayName: string;
  name: string;
  country: string | null;
  region: string | null;
};

export async function reverseGeocode(
  lat: number,
  lon: number,
  language?: string | null
): Promise<ReverseGeocodeResult> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('zoom', '10');
  url.searchParams.set('addressdetails', '1');

  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept-Language': language ?? defaultLanguage,
      'User-Agent': userAgent
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  const data = await response.json();

  // Nominatim returns { error: "..." } for ocean/empty areas
  if (data.error) {
    return {
      displayName: formatCoordinate(lat, lon),
      name: formatCoordinate(lat, lon),
      country: null,
      region: null
    };
  }

  const parsed = reverseGeocodeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      displayName: formatCoordinate(lat, lon),
      name: formatCoordinate(lat, lon),
      country: null,
      region: null
    };
  }

  const addr = parsed.data.address;
  const city = addr?.city ?? addr?.town ?? addr?.village ?? addr?.county ?? null;
  const name = city
    ? addr?.country
      ? `${city}, ${addr.country}`
      : city
    : parsed.data.display_name.split(',').slice(0, 2).join(',').trim();

  return {
    displayName: parsed.data.display_name,
    name,
    country: addr?.country ?? null,
    region: addr?.state ?? null
  };
}

function formatCoordinate(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}
