import type { ProviderId, ProviderStatus } from '@/types/observation';

type ProviderHealthResult = {
  status: ProviderStatus;
  reason?: string;
  checkedAtIso: string;
};

type HealthCache = {
  expiresAt: number;
  results: Record<ProviderId, ProviderHealthResult>;
};

const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;

let cache: HealthCache | null = null;

function nowIso() {
  return new Date().toISOString();
}

async function probe(url: string, timeoutMs = 4500) {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

function hasGoogleMapsKey() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

function hasSpiceKernelRoot() {
  return Boolean(process.env.NAIF_SPICE_KERNEL_ROOT);
}

async function runProviderProbes(): Promise<Record<ProviderId, ProviderHealthResult>> {
  const checkedAt = nowIso();
  const results: Record<ProviderId, ProviderHealthResult> = {
    nasaGibs: { status: 'degraded', checkedAtIso: checkedAt },
    celestrak: { status: 'degraded', checkedAtIso: checkedAt },
    openMeteo: { status: 'degraded', checkedAtIso: checkedAt },
    usgs: { status: 'degraded', checkedAtIso: checkedAt },
    jplHorizons: { status: 'degraded', checkedAtIso: checkedAt },
    jplCneos: { status: 'degraded', checkedAtIso: checkedAt },
    naifSpice: hasSpiceKernelRoot()
      ? { status: 'available', checkedAtIso: checkedAt }
      : { status: 'disabled', checkedAtIso: checkedAt, reason: 'Set NAIF_SPICE_KERNEL_ROOT to enable local SPICE kernels.' },
    nasaPds: { status: 'degraded', checkedAtIso: checkedAt },
    nasaTreks: { status: 'degraded', checkedAtIso: checkedAt },
    noaaSwpc: { status: 'degraded', checkedAtIso: checkedAt },
    googleMaps: hasGoogleMapsKey()
      ? { status: 'available', checkedAtIso: checkedAt }
      : { status: 'disabled', checkedAtIso: checkedAt, reason: 'Set GOOGLE_MAPS_API_KEY to enable this optional provider.' }
  };

  const probes: Array<[ProviderId, string]> = [
    ['nasaGibs', 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml'],
    ['celestrak', 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json'],
    ['openMeteo', 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m&timezone=UTC'],
    ['usgs', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson'],
    ['jplHorizons', 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json'],
    ['jplCneos', 'https://ssd-api.jpl.nasa.gov/cad.api?date-min=2026-01-01&date-max=2026-01-05'],
    ['nasaPds', 'https://nasa-pds.github.io/pds-api/'],
    ['nasaTreks', 'https://trek.nasa.gov/'],
    ['noaaSwpc', 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json']
  ];

  await Promise.all(
    probes.map(async ([id, url]) => {
      try {
        await probe(url);
        results[id] = {
          status: 'available',
          checkedAtIso: checkedAt
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Probe failed';
        results[id] = {
          status: 'degraded',
          reason: message,
          checkedAtIso: checkedAt
        };
      }
    })
  );

  return results;
}

export async function getProviderHealthMap() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return cache.results;
  }

  const results = await runProviderProbes();
  cache = {
    expiresAt: now + HEALTH_CACHE_TTL_MS,
    results
  };
  return results;
}
