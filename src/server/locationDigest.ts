import { getLandmarkById } from '@/data/landmarks';
import { reverseGeocode } from '@/server/geocode';
import { buildLocationIntel } from '@/server/locationIntel/buildLocationIntel';
import { findNearbyGeoHubs } from '@/server/locationIntel/geoHub';
import { getEarthState, getSolarPointInfo } from '@/simulation/astronomy';
import type { LocationDigest } from '@/types/explorer';
import type { ObservationCitation } from '@/types/observation';

type LocationDigestArgs = {
  lat: number;
  lon: number;
  landmarkId?: string | null;
  placeName?: string | null;
};

export async function buildLocationDigest({
  lat,
  lon,
  landmarkId,
  placeName
}: LocationDigestArgs): Promise<LocationDigest> {
  const landmark = getLandmarkById(landmarkId);
  const reverse = await safeReverseGeocode(lat, lon);
  const nearbyGeoHub = reverse?.country ? null : findNearbyGeoHubs(lat, lon, 80, 1)[0] ?? null;
  const weather = await safeFetchWeather(lat, lon);
  const earthState = getEarthState(new Date());
  const solar = getSolarPointInfo(lat, lon, earthState);

  const locationName =
    landmark?.name ??
    placeName?.trim() ??
    reverse?.name ??
    formatGeoHubLabel(nearbyGeoHub?.name, nearbyGeoHub?.country) ??
    formatCoordinate(lat, lon);

  const displayName =
    landmark?.description
      ? `${landmark.name} · ${landmark.regionName}, ${landmark.country}`
      : reverse?.displayName ?? formatGeoHubDisplayName(nearbyGeoHub) ?? locationName;

  const country = landmark?.country ?? reverse?.country ?? nearbyGeoHub?.country ?? null;
  const region = landmark?.regionName ?? reverse?.region ?? nearbyGeoHub?.region ?? null;
  const weatherSummary = weather
    ? `${weather.description ?? '天气数据可用'}，气温 ${weather.temperature?.toFixed(1) ?? '--'}°C`
    : null;
  const solarSummary = `当前为${solar.daylight ? '白天' : '夜晚'}，太阳高度角 ${solar.altitudeDegrees.toFixed(1)}°`;

  const intel = await buildLocationIntel({
    lat,
    lon,
    locationName: landmark?.regionName ?? reverse?.name ?? nearbyGeoHub?.name ?? locationName,
    region,
    country,
    weatherSummary,
    solarSummary
  });

  const citations: ObservationCitation[] = [
    {
      providerId: 'openMeteo',
      title: 'Open-Meteo current weather',
      url: 'https://open-meteo.com/',
      retrievedAtIso: new Date().toISOString()
    },
    {
      providerId: 'nasaGibs',
      title: 'Internal deterministic solar model',
      url: 'https://earthdata.nasa.gov/gibs',
      retrievedAtIso: new Date().toISOString()
    },
    ...intel.citations
  ];

  return {
    location: {
      name: locationName,
      displayName,
      country,
      region,
      lat,
      lon,
      kind: landmark ? 'landmark' : reverse?.country || nearbyGeoHub ? 'region' : 'coordinate',
      landmarkId: landmark?.id ?? null,
      description: landmark?.description ?? null
    },
    weather,
    solar,
    newsItems: intel.newsItems,
    geoHubMatches: intel.geoHubMatches,
    sourceBreakdown: intel.sourceBreakdown,
    hotspotScore: intel.hotspotScore,
    freshnessScore: intel.freshnessScore,
    sourceStatus: {
      ...intel.sourceStatus,
      weather: weather ? 'ok' : intel.sourceStatus.weather
    },
    summary: intel.summary,
    citations
  };
}

async function safeReverseGeocode(lat: number, lon: number) {
  try {
    return await reverseGeocode(lat, lon);
  } catch {
    return null;
  }
}

async function safeFetchWeather(lat: number, lon: number) {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m,is_day');

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        is_day?: number;
      };
    };

    const current = payload.current;
    if (!current) {
      return null;
    }

    return {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      description: current.is_day === 1 ? '白天晴朗时段' : '夜间时段'
    };
  } catch {
    return null;
  }
}

function formatCoordinate(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

function formatGeoHubLabel(name?: string | null, country?: string | null) {
  if (!name) return null;
  return country ? `${name}, ${country}` : name;
}

function formatGeoHubDisplayName(
  geoHub?: {
    name: string;
    region: string;
    country: string;
  } | null
) {
  if (!geoHub) return null;
  return [geoHub.name, geoHub.region, geoHub.country].filter(Boolean).join(', ');
}
