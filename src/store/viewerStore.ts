'use client';

import { create } from 'zustand';

import type { AgentMessage, InterfaceMode, SolarViewPresetId, ViewerLayerId } from '@/types/agent';
import type { SatelliteFeedItem } from '@/server/satellites';
import type { LocationDigest, LocationHotspot } from '@/types/explorer';

export type SelectedLocation = {
  lat: number;
  lon: number;
  label?: string;
  landmarkId?: string | null;
  kind?: 'landmark' | 'region' | 'coordinate' | 'space-object';
  country?: string | null;
  region?: string | null;
  description?: string | null;
  cameraAltitude?: number;
};

export type Annotation = {
  id: string;
  text: string;
  lat: number;
  lon: number;
  color?: string;
};

export type RoutePreview = {
  id: string;
  from: {
    lat: number;
    lon: number;
    label: string;
  };
  to: {
    lat: number;
    lon: number;
    label: string;
  };
  color?: string;
};

export type ViewerController = {
  flyTo: (target: {
    lat: number;
    lon: number;
    altitude?: number;
    heading?: number;
    pitch?: number;
    label?: string;
  }) => void;
  focusBody?: (bodyId: string) => void;
  setViewPreset?: (presetId: SolarViewPresetId) => void;
  resetNorth?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  locateMoon?: () => void;
  locateSun?: () => void;
  locateSatellite?: (catnr: number) => void;
};

export type LocationData = {
  weather?: WeatherResult | null;
  solar?: SolarPointInfo | null;
  placeName?: string | null;
};

export type WeatherResult = {
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
  weatherCode?: number;
  description?: string;
};

export type SolarPointInfo = {
  altitudeDegrees: number;
  daylight: boolean;
  localSolarTimeHours: number;
  azimuthDegrees: number;
};

export type SpaceWeatherData = {
  latestKp?: {
    timeTag: string | null;
    kpIndex: number | null;
  } | null;
  solarProbabilities?: unknown;
};

export type MoonEphemerisData = {
  distanceKm?: number;
  illumination?: number;
  phaseName?: string;
  azimuthDeg?: number;
  altitudeDeg?: number;
};

export type EarthquakeEvent = {
  id: string;
  lat: number;
  lon: number;
  depth: number;
  magnitude: number;
  place: string;
  time: string;
};

export type SmallBodyEvent = {
  designation: unknown;
  closeApproachTimeIso?: unknown;
  closeApproachTimeUtc: unknown;
  missDistanceAu: unknown;
  relativeVelocityKmS: unknown;
  vectorSource?: unknown;
};

type ViewerStore = {
  // Time
  currentTimeMs: number;
  isPlaying: boolean;
  playbackSpeed: number;

  // Camera / view
  inertialMode: boolean;
  selectedLocation: SelectedLocation | null;
  hoveredLocation: { lat: number; lon: number } | null;

  // Location data (populated on click)
  locationData: LocationData | null;
  locationDigest: LocationDigest | null;
  locationLoading: boolean;
  locationHotspots: LocationHotspot[];
  locationHotspotsLoading: boolean;

  // Agent compat
  selectedBodyId: string | null;
  activePreset: SolarViewPresetId;
  interfaceMode: InterfaceMode;

  // Annotations
  annotations: Annotation[];
  routePreview: RoutePreview | null;

  // Layers
  layers: Record<ViewerLayerId, boolean>;

  // Viewer controller
  controller: ViewerController | null;

  // Chat
  chatHistory: AgentMessage[];

  // Satellites
  satellites: SatelliteFeedItem[];
  selectedSatelliteId: number | null;
  satelliteCategories: Record<'stations' | 'weather' | 'science', boolean>;

  // Periodic data
  spaceWeather: SpaceWeatherData | null;
  moonEphemeris: MoonEphemerisData | null;
  earthquakes: EarthquakeEvent[];
  smallBodyEvents: SmallBodyEvent[];

  // UI state
  sidebarCollapsed: boolean;
  chatExpanded: boolean;

  // Actions
  setCurrentTime: (time: number) => void;
  advanceTime: (deltaMs: number) => void;
  setPlayback: (playing: boolean, speed?: number) => void;
  setInertialMode: (enabled: boolean) => void;
  setSelectedLocation: (location: SelectedLocation | null) => void;
  setHoveredLocation: (location: { lat: number; lon: number } | null) => void;
  setLocationData: (data: LocationData | null) => void;
  setLocationDigest: (digest: LocationDigest | null) => void;
  setLocationLoading: (loading: boolean) => void;
  setLocationHotspots: (hotspots: LocationHotspot[]) => void;
  setLocationHotspotsLoading: (loading: boolean) => void;
  setSelectedBodyId: (bodyId: string | null) => void;
  setActivePreset: (presetId: SolarViewPresetId) => void;
  setInterfaceMode: (mode: InterfaceMode) => void;
  toggleLayer: (layerId: ViewerLayerId, visible?: boolean) => void;
  setController: (controller: ViewerController | null) => void;
  addAnnotation: (annotation: Annotation) => void;
  replaceAnnotations: (annotations: Annotation[]) => void;
  clearAnnotations: () => void;
  setRoutePreview: (route: RoutePreview | null) => void;
  clearRoutePreview: () => void;
  pushChatMessage: (message: AgentMessage) => void;
  setSatellites: (satellites: SatelliteFeedItem[]) => void;
  setSelectedSatelliteId: (id: number | null) => void;
  toggleSatelliteCategory: (category: 'stations' | 'weather' | 'science') => void;
  setSpaceWeather: (data: SpaceWeatherData | null) => void;
  setMoonEphemeris: (data: MoonEphemerisData | null) => void;
  setEarthquakes: (events: EarthquakeEvent[]) => void;
  setSmallBodyEvents: (events: SmallBodyEvent[]) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setChatExpanded: (expanded: boolean) => void;
};

const now = Date.now();

export const useViewerStore = create<ViewerStore>((set) => ({
  currentTimeMs: now,
  isPlaying: true,
  playbackSpeed: 1,
  inertialMode: false,
  selectedLocation: null,
  hoveredLocation: null,
  locationData: null,
  locationDigest: null,
  locationLoading: false,
  locationHotspots: [],
  locationHotspotsLoading: false,
  selectedBodyId: 'earth',
  activePreset: 'full',
  interfaceMode: 'explore',
  annotations: [],
  routePreview: null,
  layers: {
    dayNight: true,
    atmosphere: true,
    cityMarkers: true,
    moon: false,
    satellites: false,
    earthquakes: false,
    weatherClouds: false,
    weatherTemperature: false,
    planetOrbits: false,
    planetLabels: false,
    majorMoons: false,
    spaceWeather: false,
    surfaceOverlays: false,
    smallBodies: false
  },
  controller: null,
  chatHistory: [],
  satellites: [],
  selectedSatelliteId: null,
  satelliteCategories: { stations: true, weather: true, science: true },
  spaceWeather: null,
  moonEphemeris: null,
  earthquakes: [],
  smallBodyEvents: [],
  sidebarCollapsed: false,
  chatExpanded: false,

  setCurrentTime: (time) => set({ currentTimeMs: time }),
  advanceTime: (deltaMs) =>
    set((state) => ({
      currentTimeMs: state.currentTimeMs + deltaMs
    })),
  setPlayback: (playing, speed) =>
    set((state) => ({
      isPlaying: playing,
      playbackSpeed: speed ?? state.playbackSpeed
    })),
  setInertialMode: (enabled) => set({ inertialMode: enabled }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setHoveredLocation: (location) => set({ hoveredLocation: location }),
  setLocationData: (data) => set({ locationData: data }),
  setLocationDigest: (digest) => set({ locationDigest: digest }),
  setLocationLoading: (loading) => set({ locationLoading: loading }),
  setLocationHotspots: (hotspots) => set({ locationHotspots: hotspots }),
  setLocationHotspotsLoading: (loading) => set({ locationHotspotsLoading: loading }),
  setSelectedBodyId: (bodyId) => set({ selectedBodyId: bodyId }),
  setActivePreset: (presetId) => set({ activePreset: presetId }),
  setInterfaceMode: (mode) => set({ interfaceMode: mode }),
  toggleLayer: (layerId, visible) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [layerId]: visible ?? !state.layers[layerId]
      }
    })),
  setController: (controller) => set({ controller }),
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations.filter((item) => item.id !== annotation.id), annotation]
    })),
  replaceAnnotations: (annotations) => set({ annotations }),
  clearAnnotations: () => set({ annotations: [] }),
  setRoutePreview: (route) => set({ routePreview: route }),
  clearRoutePreview: () => set({ routePreview: null }),
  pushChatMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message]
    })),
  setSatellites: (satellites) => set({ satellites }),
  setSelectedSatelliteId: (id) => set({ selectedSatelliteId: id }),
  toggleSatelliteCategory: (category) =>
    set((state) => ({
      satelliteCategories: {
        ...state.satelliteCategories,
        [category]: !state.satelliteCategories[category]
      }
    })),
  setSpaceWeather: (data) => set({ spaceWeather: data }),
  setMoonEphemeris: (data) => set({ moonEphemeris: data }),
  setEarthquakes: (events) => set({ earthquakes: events }),
  setSmallBodyEvents: (events) => set({ smallBodyEvents: events }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setChatExpanded: (expanded) => set({ chatExpanded: expanded })
}));
