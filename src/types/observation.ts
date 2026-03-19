export type ProviderId =
  | 'nasaGibs'
  | 'celestrak'
  | 'openMeteo'
  | 'usgs'
  | 'jplHorizons'
  | 'jplCneos'
  | 'googleMaps'
  | 'naifSpice'
  | 'nasaPds'
  | 'nasaTreks'
  | 'noaaSwpc';

export type ProviderCategory =
  | 'imagery'
  | 'satellite'
  | 'weather'
  | 'events'
  | 'ephemeris'
  | 'maps'
  | 'catalog'
  | 'space_weather';

export type ProviderStatus = 'available' | 'disabled' | 'degraded';

export type ProviderDescriptor = {
  id: ProviderId;
  name: string;
  category: ProviderCategory;
  enabled: boolean;
  optional: boolean;
  status: ProviderStatus;
  reason?: string;
  docsUrl: string;
  lastCheckedIso: string;
};

export type LayerTimeDimension = 'none' | 'date' | 'month' | 'datetime';

export type LayerDescriptor = {
  id: string;
  label: string;
  providerId: ProviderId;
  defaultVisible: boolean;
  timeDimension: LayerTimeDimension;
  description: string;
};

export type ObservationCitation = {
  providerId: ProviderId;
  title: string;
  url: string;
  retrievedAtIso: string;
};

export type CelestialBodyCategory = 'star' | 'planet' | 'moon';

export type SurfaceLayerDescriptor = {
  id: string;
  label: string;
  providerId: ProviderId;
  bodyId: string;
  kind: 'visual' | 'scientific';
  url: string;
  description: string;
};

export type CelestialBodyDescriptor = {
  id: string;
  name: string;
  shortName?: string;
  category: CelestialBodyCategory;
  parentId?: string;
  radiusKm: number;
  color: string;
  summary: string;
  defaultVisible: boolean;
  semiMajorAxisAu?: number;
  semiMajorAxisKm?: number;
  eccentricity?: number;
  orbitalPeriodDays?: number;
  rotationPeriodHours?: number;
  axialTiltDeg?: number;
  phaseAtJ2000Deg?: number;
  orbitInclinationDeg?: number;
  surfaceLayers?: SurfaceLayerDescriptor[];
};

export type BodyStateVector = {
  bodyId: string;
  parentId?: string;
  epochIso: string;
  source: 'jpl_horizons' | 'cached_horizons' | 'local_spice' | 'fallback_model';
  positionKm: {
    x: number;
    y: number;
    z: number;
  };
  positionAu: {
    x: number;
    y: number;
    z: number;
  };
  velocityKmS: {
    x: number;
    y: number;
    z: number;
  };
  distanceFromSunAu: number;
};

export type SystemSnapshot = {
  epochIso: string;
  bodies: BodyStateVector[];
};

export type ObservationQueryKind =
  | 'weather_current'
  | 'earthquakes_recent'
  | 'satellites_snapshot'
  | 'solar_at_location'
  | 'moon_ephemeris'
  | 'body_catalog'
  | 'body_metadata'
  | 'body_state'
  | 'system_snapshot'
  | 'space_weather_current'
  | 'small_body_events';

export type ObservationQueryRequest = {
  kind: ObservationQueryKind;
  location?: {
    lat: number;
    lon: number;
  };
  satelliteCategory?: 'all' | 'stations' | 'weather' | 'science';
  maxResults?: number;
  bodyId?: string;
  bodyIds?: string[];
  epochIso?: string;
};

export type ObservationQueryResponse = {
  kind: ObservationQueryKind;
  providerId: ProviderId;
  generatedAtIso: string;
  data: unknown;
  citations: ObservationCitation[];
};
