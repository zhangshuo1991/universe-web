import type { LayerDescriptor, ProviderDescriptor } from '@/types/observation';

function nowIso() {
  return new Date().toISOString();
}

function hasGoogleMapsKey() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

export function getProviderCatalog(): ProviderDescriptor[] {
  const checkedAt = nowIso();
  const googleEnabled = hasGoogleMapsKey();

  return [
    {
      id: 'nasaGibs',
      name: 'NASA GIBS',
      category: 'imagery',
      enabled: true,
      optional: false,
      status: 'available',
      docsUrl: 'https://earthdata.nasa.gov/gibs',
      lastCheckedIso: checkedAt
    },
    {
      id: 'celestrak',
      name: 'CelesTrak',
      category: 'satellite',
      enabled: true,
      optional: false,
      status: 'available',
      docsUrl: 'https://celestrak.org',
      lastCheckedIso: checkedAt
    },
    {
      id: 'openMeteo',
      name: 'Open-Meteo',
      category: 'weather',
      enabled: true,
      optional: false,
      status: 'available',
      docsUrl: 'https://open-meteo.com',
      lastCheckedIso: checkedAt
    },
    {
      id: 'usgs',
      name: 'USGS Earthquake Feed',
      category: 'events',
      enabled: true,
      optional: false,
      status: 'available',
      docsUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
      lastCheckedIso: checkedAt
    },
    {
      id: 'googleMaps',
      name: 'Google Maps Platform',
      category: 'maps',
      enabled: googleEnabled,
      optional: true,
      status: googleEnabled ? 'available' : 'disabled',
      reason: googleEnabled ? undefined : 'Set GOOGLE_MAPS_API_KEY to enable this optional provider.',
      docsUrl: 'https://developers.google.com/maps',
      lastCheckedIso: checkedAt
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
    }
  ];
}
