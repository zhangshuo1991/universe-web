export type ProviderId = 'nasaGibs' | 'celestrak' | 'openMeteo' | 'usgs' | 'googleMaps';

export type ProviderCategory = 'imagery' | 'satellite' | 'weather' | 'events' | 'maps';

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

export type ObservationQueryKind = 'weather_current' | 'earthquakes_recent' | 'satellites_snapshot' | 'solar_at_location';

export type ObservationQueryRequest = {
  kind: ObservationQueryKind;
  location?: {
    lat: number;
    lon: number;
  };
  satelliteCategory?: 'all' | 'stations' | 'weather' | 'science';
  maxResults?: number;
};

export type ObservationQueryResponse = {
  kind: ObservationQueryKind;
  providerId: ProviderId;
  generatedAtIso: string;
  data: unknown;
  citations: ObservationCitation[];
};
