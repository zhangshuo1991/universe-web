import type { ObservationCitation } from '@/types/observation';

export type LandmarkCategory = 'city' | 'culture' | 'nature' | 'history';

export type GeoHubKind = 'strategic' | 'capital' | 'conflict' | 'science' | 'weather' | 'spaceport';

export type GeoHubPriority = 'critical' | 'major' | 'watch';

export type Landmark = {
  id: string;
  name: string;
  regionName: string;
  country: string;
  lat: number;
  lon: number;
  category: LandmarkCategory;
  description: string;
  cameraAltitude: number;
};

export type GeoHub = {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  kind: GeoHubKind;
  priority: GeoHubPriority;
  aliases: string[];
  keywords: string[];
  description: string;
};

export type GeoHubMatch = {
  hubId: string;
  hubName: string;
  kind: GeoHubKind;
  priority: GeoHubPriority;
  score: number;
  matchedTerms: string[];
};

export type LocationIntelSourceType = 'gdelt' | 'rss';

export type LocationNewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: LocationIntelSourceType;
  category?: string | null;
  sourceCountry?: string | null;
  publishedAt?: string | null;
  matchedTerms?: string[];
  matchedHubIds?: string[];
  score?: number;
};

export type LocationSummary = {
  text: string;
  quickPrompts: string[];
  whyItMatters?: string[];
};

export type SourceBreakdownEntry = {
  label: string;
  count: number;
};

export type SourceStatus = 'ok' | 'empty' | 'error';

export type LocationSourceStatusMap = {
  gdelt: SourceStatus;
  rss: SourceStatus;
  geoHub: SourceStatus;
  weather: SourceStatus;
};

export type LocationHotspot = {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  kind: GeoHubKind;
  priority: GeoHubPriority;
  score: number;
  reason: string;
  matchedHeadline?: string | null;
  updatedAtIso: string;
};

export type LocationHotspotResponse = {
  featuredHubs: LocationHotspot[];
  trendingHubs: LocationHotspot[];
  recommendedHubs: LocationHotspot[];
  citations: ObservationCitation[];
  sourceStatus: Pick<LocationSourceStatusMap, 'gdelt' | 'rss' | 'geoHub'>;
  updatedAtIso: string;
};

export type LocationDigest = {
  location: {
    name: string;
    displayName: string;
    country: string | null;
    region: string | null;
    lat: number;
    lon: number;
    kind: 'landmark' | 'region' | 'coordinate';
    landmarkId?: string | null;
    description?: string | null;
  };
  weather: {
    temperature?: number;
    humidity?: number;
    windSpeed?: number;
    description?: string;
  } | null;
  solar: {
    altitudeDegrees: number;
    daylight: boolean;
    localSolarTimeHours: number;
    azimuthDegrees: number;
  } | null;
  newsItems: LocationNewsItem[];
  geoHubMatches: GeoHubMatch[];
  sourceBreakdown: SourceBreakdownEntry[];
  hotspotScore: number;
  freshnessScore: number;
  sourceStatus: LocationSourceStatusMap;
  summary: LocationSummary;
  citations: ObservationCitation[];
};
