import type { LayerDescriptor, ProviderDescriptor } from '@/types/observation';
import { getProviderHealthMap } from '@/server/observation/providerHealth';

function nowIso() {
  return new Date().toISOString();
}

export async function getProviderCatalog(): Promise<ProviderDescriptor[]> {
  const checkedAt = nowIso();
  const health = await getProviderHealthMap();
  const googleEnabled = health.googleMaps.status !== 'disabled';

  return [
    {
      id: 'nasaGibs',
      name: 'NASA GIBS',
      category: 'imagery',
      enabled: true,
      optional: false,
      status: health.nasaGibs.status,
      reason: health.nasaGibs.reason,
      docsUrl: 'https://earthdata.nasa.gov/gibs',
      lastCheckedIso: health.nasaGibs.checkedAtIso ?? checkedAt
    },
    {
      id: 'celestrak',
      name: 'CelesTrak',
      category: 'satellite',
      enabled: true,
      optional: false,
      status: health.celestrak.status,
      reason: health.celestrak.reason,
      docsUrl: 'https://celestrak.org',
      lastCheckedIso: health.celestrak.checkedAtIso ?? checkedAt
    },
    {
      id: 'openMeteo',
      name: 'Open-Meteo',
      category: 'weather',
      enabled: true,
      optional: false,
      status: health.openMeteo.status,
      reason: health.openMeteo.reason,
      docsUrl: 'https://open-meteo.com',
      lastCheckedIso: health.openMeteo.checkedAtIso ?? checkedAt
    },
    {
      id: 'usgs',
      name: 'USGS Earthquake Feed',
      category: 'events',
      enabled: true,
      optional: false,
      status: health.usgs.status,
      reason: health.usgs.reason,
      docsUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
      lastCheckedIso: health.usgs.checkedAtIso ?? checkedAt
    },
    {
      id: 'jplHorizons',
      name: 'JPL Horizons',
      category: 'ephemeris',
      enabled: true,
      optional: false,
      status: health.jplHorizons.status,
      reason: health.jplHorizons.reason,
      docsUrl: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
      lastCheckedIso: health.jplHorizons.checkedAtIso ?? checkedAt
    },
    {
      id: 'jplCneos',
      name: 'JPL CNEOS',
      category: 'events',
      enabled: true,
      optional: false,
      status: health.jplCneos.status,
      reason: health.jplCneos.reason,
      docsUrl: 'https://ssd-api.jpl.nasa.gov/',
      lastCheckedIso: health.jplCneos.checkedAtIso ?? checkedAt
    },
    {
      id: 'naifSpice',
      name: 'NAIF SPICE',
      category: 'ephemeris',
      enabled: health.naifSpice.status === 'available',
      optional: true,
      status: health.naifSpice.status,
      reason: health.naifSpice.reason,
      docsUrl: 'https://naif.jpl.nasa.gov/naif/',
      lastCheckedIso: health.naifSpice.checkedAtIso ?? checkedAt
    },
    {
      id: 'nasaPds',
      name: 'NASA PDS',
      category: 'catalog',
      enabled: true,
      optional: false,
      status: health.nasaPds.status,
      reason: health.nasaPds.reason,
      docsUrl: 'https://nasa-pds.github.io/pds-api/',
      lastCheckedIso: health.nasaPds.checkedAtIso ?? checkedAt
    },
    {
      id: 'nasaTreks',
      name: 'NASA Solar System Treks',
      category: 'imagery',
      enabled: true,
      optional: false,
      status: health.nasaTreks.status,
      reason: health.nasaTreks.reason,
      docsUrl: 'https://trek.nasa.gov/',
      lastCheckedIso: health.nasaTreks.checkedAtIso ?? checkedAt
    },
    {
      id: 'noaaSwpc',
      name: 'NOAA SWPC',
      category: 'space_weather',
      enabled: true,
      optional: false,
      status: health.noaaSwpc.status,
      reason: health.noaaSwpc.reason,
      docsUrl: 'https://www.swpc.noaa.gov/content/data-access',
      lastCheckedIso: health.noaaSwpc.checkedAtIso ?? checkedAt
    },
    {
      id: 'googleMaps',
      name: 'Google Maps Platform',
      category: 'maps',
      enabled: googleEnabled,
      optional: true,
      status: health.googleMaps.status,
      reason: health.googleMaps.reason,
      docsUrl: 'https://developers.google.com/maps',
      lastCheckedIso: health.googleMaps.checkedAtIso ?? checkedAt
    }
  ];
}

export function getLayerCatalog(): LayerDescriptor[] {
  return [
    {
      id: 'base_natural_earth',
      label: 'Natural Earth Base',
      providerId: 'nasaGibs',
      defaultVisible: true,
      timeDimension: 'none',
      description: 'Baseline global Earth texture used for default globe rendering.'
    },
    {
      id: 'weather_cloud_fraction',
      label: 'Cloud Fraction',
      providerId: 'nasaGibs',
      defaultVisible: false,
      timeDimension: 'date',
      description: 'Daily cloud fraction layer from NASA GIBS.'
    },
    {
      id: 'weather_air_temperature_monthly',
      label: 'Air Temperature Monthly',
      providerId: 'nasaGibs',
      defaultVisible: false,
      timeDimension: 'month',
      description: 'Monthly near-surface air temperature from NASA GIBS.'
    },
    {
      id: 'satellite_tracks',
      label: 'Satellite Tracks',
      providerId: 'celestrak',
      defaultVisible: true,
      timeDimension: 'datetime',
      description: 'Near real-time propagated satellite positions from CelesTrak TLE/GP data.'
    },
    {
      id: 'moon_ephemeris',
      label: 'Moon Ephemeris',
      providerId: 'jplHorizons',
      defaultVisible: true,
      timeDimension: 'datetime',
      description: 'Moon geocentric ephemeris backed by JPL Horizons with model fallback.'
    },
    {
      id: 'earthquake_events',
      label: 'Earthquake Events',
      providerId: 'usgs',
      defaultVisible: false,
      timeDimension: 'datetime',
      description: 'Recent global earthquake events from the USGS GeoJSON feed.'
    },
    {
      id: 'google_maps_enhanced',
      label: 'Google Maps Enhanced',
      providerId: 'googleMaps',
      defaultVisible: false,
      timeDimension: 'none',
      description: 'Optional enhanced map provider, enabled only when Google API key is configured.'
    },
    {
      id: 'solar_system_orbits',
      label: 'Solar System Orbits',
      providerId: 'jplHorizons',
      defaultVisible: true,
      timeDimension: 'datetime',
      description: 'Planetary positions sourced from JPL Horizons and rendered against analytic orbital tracks.'
    },
    {
      id: 'solar_system_major_moons',
      label: 'Major Moons',
      providerId: 'jplHorizons',
      defaultVisible: true,
      timeDimension: 'datetime',
      description: 'Moon, Galilean satellites, and Titan rendered from live or cached ephemerides.'
    },
    {
      id: 'space_weather_now',
      label: 'Space Weather',
      providerId: 'noaaSwpc',
      defaultVisible: true,
      timeDimension: 'datetime',
      description: 'Current geomagnetic and solar activity from NOAA SWPC feeds.'
    },
    {
      id: 'small_body_events',
      label: 'Small Body Events',
      providerId: 'jplCneos',
      defaultVisible: true,
      timeDimension: 'datetime',
      description: 'Near-Earth close approaches and fireball events from JPL CNEOS APIs.'
    },
    {
      id: 'surface_reference_layers',
      label: 'Surface Reference Layers',
      providerId: 'nasaTreks',
      defaultVisible: true,
      timeDimension: 'none',
      description: 'Links to scientific and visual body maps from NASA Treks, PDS, and JPL texture catalogs.'
    }
  ];
}
