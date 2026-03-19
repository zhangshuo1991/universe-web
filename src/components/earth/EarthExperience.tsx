'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  Credit,
  CustomDataSource,
  EllipsoidTerrainProvider,
  HorizontalOrigin,
  ImageryLayer,
  JulianDate,
  LabelStyle,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TileMapServiceImageryProvider,
  TimeInterval,
  Transforms,
  VerticalOrigin,
  Viewer,
  WebMapTileServiceImageryProvider
} from 'cesium';
import { degreesLat, degreesLong, eciToGeodetic, gstime, json2satrec, propagate } from 'satellite.js';
import type { OMMJsonObject } from 'satellite.js';

import { applyClientActions } from '@/agent/applyClientActions';
import { OrbitDial } from '@/components/earth/OrbitDial';
import {
  EARTH_AXIAL_TILT_DEGREES,
  EARTH_SIDEREAL_DAY_HOURS,
  getEarthState,
  getLocationLabel,
  getSolarPointInfo
} from '@/simulation/astronomy';
import { useViewerStore } from '@/store/viewerStore';
import type { LayerDescriptor, ProviderDescriptor } from '@/types/observation';
import type { AgentMessage, AgentResponsePayload, ViewerLayerId } from '@/types/agent';

type GeocodeResult = {
  id: number;
  label: string;
  lat: number;
  lon: number;
  kind: string;
  importance: number;
};

type SatelliteOmm = OMMJsonObject;

type SatelliteFeedItem = {
  catnr: number;
  label: string;
  color: string;
  omm: SatelliteOmm;
};

type SatelliteCategoryId = 'all' | 'stations' | 'weather' | 'science';

type SatelliteCategory = {
  id: SatelliteCategoryId;
  label: string;
  count: number;
};

type SatelliteSnapshot = {
  id: number;
  label: string;
  color: string;
  lat: number;
  lon: number;
  altitudeKm: number;
};

type EarthquakeEvent = {
  id: string;
  magnitude: number | null;
  place: string;
  timeIso: string | null;
  coordinates: number[];
  title?: string;
};

type LocationSnapshot = {
  temperatureC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  nearestQuake: EarthquakeEvent | null;
  nearestQuakeDistanceKm: number | null;
};

type Locale = 'en' | 'zh';
const LOCALE_STORAGE_KEY = 'earth-observer-locale';
const SIM_TICK_INTERVAL_MS = 100;
const SATELLITE_UPDATE_INTERVAL_MS = 1000;

const ANCHOR_CITIES = [
  { label: 'Shanghai', lat: 31.2304, lon: 121.4737 },
  { label: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { label: 'Cairo', lat: 30.0444, lon: 31.2357 },
  { label: 'Nairobi', lat: -1.2921, lon: 36.8219 },
  { label: 'New York', lat: 40.7128, lon: -74.006 },
  { label: 'Sydney', lat: -33.8688, lon: 151.2093 }
];

const I18N = {
  en: {
    planetaryControlRoom: 'PLANETARY CONTROL ROOM',
    freeObserveEarth: 'Free Earth Observer',
    heroCopy:
      'Supports place search, inertial camera mode, moon visibility, live satellite propagation, and NASA GIBS weather layers. Earth spin and orbit remain deterministic; the LLM interprets intent and triggers primitives.',
    axialTilt: 'Axial Tilt',
    siderealDay: 'Sidereal Day',
    visibleSatellites: 'Visible Satellites',
    geocodeSearch: 'Geocode Search',
    querying: 'QUERYING',
    searchPlaceholder: 'Type a city, landmark, or country, e.g. Reykjavik / Shanghai / Nairobi',
    searching: 'Searching...',
    searchPlace: 'Search Place',
    clearResults: 'Clear',
    noMatchedPlace: 'No matched location. Try another spelling or broader place name.',
    simulationClock: 'Simulation Clock',
    running: 'RUNNING',
    paused: 'PAUSED',
    now: 'Now',
    pause: 'Pause',
    resume: 'Resume',
    orbitSolver: 'Orbit Solver',
    inertialCamera: 'Inertial Camera',
    earthFixed: 'EARTH-FIXED',
    inertialDesc:
      'In inertial mode, the camera is locked to the celestial inertial frame and Earth rotates beneath it. Mouse drag is temporarily disabled.',
    backToFixed: 'Back to Fixed',
    switchToInertial: 'To Inertial',
    equatorWideView: 'Equator View',
    subsolarPoint: 'Subsolar Point',
    lit: 'LIT',
    static: 'STATIC',
    latitude: 'Latitude',
    longitude: 'Longitude',
    gmst: 'GMST',
    moonDistance: 'Moon Distance',
    citySnapshot: 'City Snapshot',
    weatherNow: 'Weather Now',
    humidity: 'Humidity',
    windSpeed: 'Wind Speed',
    nearestQuake: 'Nearest Quake',
    aiCityBrief: 'AI City Brief',
    generateBrief: 'Generate Brief',
    generating: 'Generating...',
    noCitySnapshot: 'Select a city or click the globe to load local data.',
    unknown: 'Unknown',
    selectedSurfacePoint: 'Selected Surface Point',
    locked: 'LOCKED',
    none: 'NONE',
    location: 'Location',
    solarAltitude: 'Solar Altitude',
    localSolarTime: 'Local Solar Time',
    daylightState: 'Daylight',
    daytime: 'Day',
    nighttime: 'Night',
    clickEarthHint: 'Click on Earth to inspect local solar geometry.',
    orbitalObjects: 'Orbital Objects',
    earthquakeEvents: 'Earthquake Events',
    refreshing: 'REFRESHING',
    eventFeedEmpty: 'No earthquake events loaded yet.',
    syncing: 'SYNCING',
    tracking: 'TRACKING',
    hidden: 'HIDDEN',
    satelliteLoadingHint: 'Satellite feeds are loading, or some sources are temporarily unavailable.',
    weatherTimeLayers: 'Weather Time Layers',
    cloudDate: 'Cloud Date (UTC)',
    temperatureMonth: 'Temperature Month (UTC)',
    useToday: 'Use Today',
    alignSimTime: 'Align With Sim Time',
    dataProviders: 'Data Providers',
    layerCatalog: 'Layer Catalog',
    availability: 'Availability',
    optionalProvider: 'Optional',
    available: 'Available',
    degraded: 'Degraded',
    disabled: 'Disabled',
    viewerLayers: 'Viewer Layers',
    dayNight: 'Day/Night Lighting',
    atmosphere: 'Atmosphere',
    cityMarkers: 'Anchor Cities',
    moon: 'Moon',
    satellites: 'Satellites',
    earthquakes: 'Earthquakes',
    weatherClouds: 'Cloud Fraction',
    weatherTemperature: 'Temperature',
    llmControlConsole: 'LLM Control Console',
    thinking: 'THINKING',
    idle: 'IDLE',
    promptPlaceholder:
      'Examples: show day/night terminator; enable moon and satellite layers; pause time; with OPENAI_API_KEY (and optional OPENAI_BASE_URL), you can send freer control instructions.',
    sending: 'Sending...',
    execute: 'Run',
    backToShanghai: 'Go Shanghai',
    switchToSydney: 'Go Sydney',
    noChatHint:
      'No command yet. With OPENAI_API_KEY (optional OPENAI_BASE_URL), this enters a real tool-calling agent loop.',
    user: 'USER',
    agent: 'AGENT',
    observer: 'Observer',
    clickEarth: 'Click Earth',
    reference: 'Reference',
    icrfCamera: 'ICRF inertial camera',
    fixedCamera: 'Earth-fixed camera',
    collapseSidebar: 'Collapse',
    expandSidebar: 'Expand',
    language: 'Language',
    fallbackMode: 'Fallback command mode',
    openaiReady: 'OpenAI tool loop ready',
    inertialNotice: 'Inertial frame locked. Earth rotates beneath the camera.',
    geocodeFound: 'Found {count} candidate places.',
    geocodeNone: 'No matched place found.',
    geocodeUnavailable: 'Geocoding is temporarily unavailable.',
    satellitePartial: 'Satellite feed partially available: {ok} success, {fail} failed.',
    citations: 'Data Citations',
    noCitations: 'No citations yet. Ask for weather, earthquakes, or comparative analysis.',
    analysisArtifacts: 'Analysis Artifacts',
    all: 'All',
    stations: 'Stations',
    weather: 'Weather',
    science: 'Science',
    springEquinox: 'Spring Eqx',
    summerSolstice: 'Summer Solstice',
    autumnEquinox: 'Autumn Eqx',
    winterSolstice: 'Winter Solstice'
  },
  zh: {
    planetaryControlRoom: '行星控制台',
    freeObserveEarth: '自由观测地球',
    heroCopy: '支持地名搜索、惯性相机、月球显示、实时卫星传播和 NASA GIBS 天气图层。地球自转与公转保持确定性，LLM 负责意图解释与原语调用。',
    axialTilt: '地轴倾角',
    siderealDay: '恒星日',
    visibleSatellites: '可见卫星',
    geocodeSearch: '地名检索',
    querying: '检索中',
    searchPlaceholder: '输入城市、地标或国家，例如 Reykjavik / 上海 / Nairobi',
    searching: '搜索中...',
    searchPlace: '搜索地点',
    clearResults: '清空结果',
    noMatchedPlace: '暂无匹配地点，换一个城市名、地标名或英文拼写再试一次。',
    simulationClock: '模拟时钟',
    running: '运行中',
    paused: '已暂停',
    now: '现在',
    pause: '暂停',
    resume: '继续',
    orbitSolver: '轨道求解',
    inertialCamera: '惯性相机',
    earthFixed: '地固系',
    inertialDesc: '惯性模式会把镜头锁到天球惯性系，让地球在相机下真实自转。开启后临时禁用鼠标拖拽。',
    backToFixed: '回到地固系',
    switchToInertial: '切到惯性系',
    equatorWideView: '赤道远景',
    subsolarPoint: '太阳直射点',
    lit: '受光',
    static: '静态',
    latitude: '纬度',
    longitude: '经度',
    gmst: '格林尼治恒星时',
    moonDistance: '月地距离',
    citySnapshot: '城市快照',
    weatherNow: '当前天气',
    humidity: '湿度',
    windSpeed: '风速',
    nearestQuake: '最近地震',
    aiCityBrief: 'AI 城市摘要',
    generateBrief: '生成摘要',
    generating: '生成中...',
    noCitySnapshot: '选择城市或点击地球表面后，这里会加载本地信息。',
    unknown: '未知',
    selectedSurfacePoint: '观测点',
    locked: '已锁定',
    none: '无',
    location: '位置',
    solarAltitude: '太阳高度角',
    localSolarTime: '地方太阳时',
    daylightState: '昼夜状态',
    daytime: '白天',
    nighttime: '夜晚',
    clickEarthHint: '点击地球表面后，这里会显示当前观测点的太阳几何信息。',
    orbitalObjects: '轨道目标',
    earthquakeEvents: '地震事件',
    refreshing: '刷新中',
    eventFeedEmpty: '暂时没有可显示的地震事件。',
    syncing: '同步中',
    tracking: '追踪中',
    hidden: '隐藏',
    satelliteLoadingHint: '卫星轨道数据加载中，或当前数据源暂时不可用。',
    weatherTimeLayers: '天气时间图层',
    cloudDate: '云量日图日期 (UTC)',
    temperatureMonth: '气温月均月份 (UTC)',
    useToday: '使用今天',
    alignSimTime: '对齐模拟时间',
    dataProviders: '数据源状态',
    layerCatalog: '图层目录',
    availability: '可用性',
    optionalProvider: '可选增强',
    available: '可用',
    degraded: '降级',
    disabled: '关闭',
    viewerLayers: '视图图层',
    dayNight: '昼夜光照',
    atmosphere: '大气层',
    cityMarkers: '锚点城市',
    moon: '月球',
    satellites: '卫星',
    earthquakes: '地震',
    weatherClouds: '云量层',
    weatherTemperature: '气温层',
    llmControlConsole: 'LLM 控制台',
    thinking: '思考中',
    idle: '空闲',
    promptPlaceholder:
      '例如：显示昼夜分界线；打开月球与卫星图层；暂停时间；如果已配置 OPENAI_API_KEY（可选 OPENAI_BASE_URL），也可以直接发更自由的控制指令。',
    sending: '发送中...',
    execute: '执行指令',
    backToShanghai: '回到上海',
    switchToSydney: '切到悉尼',
    noChatHint: '尚未发送控制指令。启用 OPENAI_API_KEY（可选 OPENAI_BASE_URL）后，这里会进入真实 tool-calling agent 回路。',
    user: '用户',
    agent: '智能体',
    observer: '观测点',
    clickEarth: '点击地球',
    reference: '参考系',
    icrfCamera: 'ICRF 惯性相机',
    fixedCamera: '地固相机',
    collapseSidebar: '收起',
    expandSidebar: '展开',
    language: '语言',
    fallbackMode: '本地 fallback 模式',
    openaiReady: 'OpenAI 工具回路已就绪',
    inertialNotice: '惯性参考系已锁定，地球会在镜头下自转。',
    geocodeFound: '找到 {count} 个地名候选。',
    geocodeNone: '没有找到匹配地点。',
    geocodeUnavailable: '地名检索暂时不可用。',
    satellitePartial: '卫星源部分可用：{ok} 条成功，{fail} 条失败。',
    citations: '数据引用',
    noCitations: '还没有引用。你可以让 LLM 查询天气、地震或做位置对比分析。',
    analysisArtifacts: '分析产物',
    all: '全部',
    stations: '空间站',
    weather: '气象',
    science: '科学',
    springEquinox: '春分',
    summerSolstice: '夏至',
    autumnEquinox: '秋分',
    winterSolstice: '冬至'
  }
} as const;

const CLOUD_LAYER_ID = 'MODIS_Aqua_Cloud_Fraction_Day';
const TEMPERATURE_LAYER_ID = 'MERRA2_2m_Air_Temperature_Monthly';
const CLOUD_LAYER_ALPHA = 0.34;
const TEMPERATURE_LAYER_ALPHA = 0.46;

function toIsoDateUTC(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function toIsoMonthUTC(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shiftUtcMonth(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function monthToIsoDate(month: string) {
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : `${toIsoMonthUTC(new Date())}-01`;
}

function createCloudProvider(dateIso: string) {
  return new WebMapTileServiceImageryProvider({
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${CLOUD_LAYER_ID}/default/${dateIso}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`,
    layer: CLOUD_LAYER_ID,
    style: 'default',
    format: 'image/png',
    tileMatrixSetID: '2km',
    maximumLevel: 5,
    credit: new Credit('NASA GIBS')
  });
}

function createTemperatureProvider(month: string) {
  return new WebMapTileServiceImageryProvider({
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${TEMPERATURE_LAYER_ID}/default/${monthToIsoDate(month)}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`,
    layer: TEMPERATURE_LAYER_ID,
    style: 'default',
    format: 'image/png',
    tileMatrixSetID: '2km',
    maximumLevel: 4,
    credit: new Credit('NASA GIBS')
  });
}

function formatIsoTime(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  }).format(date);
}

function formatLocalSolarTime(hours: number) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.floor((hours - wholeHours) * 60);
  return `${wholeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function getYearProgress(timeMs: number) {
  const date = new Date(timeMs);
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const end = Date.UTC(date.getUTCFullYear() + 1, 0, 1);
  return ((timeMs - start) / (end - start)) * 1000;
}

function getTimeFromYearProgress(timeMs: number, value: number) {
  const date = new Date(timeMs);
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const end = Date.UTC(date.getUTCFullYear() + 1, 0, 1);
  return start + ((end - start) * value) / 1000;
}

function getSeasonPresets(year: number, locale: Locale) {
  const text = I18N[locale];
  return [
    { label: text.springEquinox, time: Date.UTC(year, 2, 20, 3, 0, 0) },
    { label: text.summerSolstice, time: Date.UTC(year, 5, 21, 20, 0, 0) },
    { label: text.autumnEquinox, time: Date.UTC(year, 8, 22, 12, 0, 0) },
    { label: text.winterSolstice, time: Date.UTC(year, 11, 21, 15, 0, 0) }
  ];
}

function setInteractionEnabled(viewer: Viewer, enabled: boolean) {
  const controls = viewer.scene.screenSpaceCameraController;
  controls.enableRotate = enabled;
  controls.enableTranslate = enabled;
  controls.enableTilt = enabled;
  controls.enableLook = enabled;
  controls.enableZoom = enabled;
}

function formatSeasonLabel(source: string, locale: Locale) {
  if (locale === 'zh') {
    return source;
  }
  if (source.includes('冬')) return 'Northern Winter';
  if (source.includes('春')) return 'Northern Spring';
  if (source.includes('夏')) return 'Northern Summer';
  if (source.includes('秋')) return 'Northern Autumn';
  return source;
}

function providerStatusLabel(status: ProviderDescriptor['status'], t: <K extends keyof (typeof I18N)['en']>(key: K) => string) {
  if (status === 'available') return t('available');
  if (status === 'degraded') return t('degraded');
  return t('disabled');
}

function earthquakeColor(magnitude: number | null) {
  if (magnitude === null) return '#60a5fa';
  if (magnitude >= 6.5) return '#ef4444';
  if (magnitude >= 5) return '#f97316';
  if (magnitude >= 4) return '#f59e0b';
  return '#38bdf8';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

export default function EarthExperience() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const cityLayerRef = useRef<CustomDataSource | null>(null);
  const annotationLayerRef = useRef<CustomDataSource | null>(null);
  const satelliteLayerRef = useRef<CustomDataSource | null>(null);
  const earthquakeLayerRef = useRef<CustomDataSource | null>(null);
  const cloudLayerRef = useRef<ImageryLayer | null>(null);
  const temperatureLayerRef = useRef<ImageryLayer | null>(null);
  const inertialOffsetRef = useRef<Cartesian3 | null>(null);

  const [prompt, setPrompt] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentNotice, setAgentNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [satelliteCategory, setSatelliteCategory] = useState<SatelliteCategoryId>('all');
  const [satelliteCategories, setSatelliteCategories] = useState<SatelliteCategory[]>([]);
  const [satelliteBusy, setSatelliteBusy] = useState(false);
  const [satelliteFeed, setSatelliteFeed] = useState<SatelliteFeedItem[]>([]);
  const [earthquakeBusy, setEarthquakeBusy] = useState(false);
  const [earthquakeEvents, setEarthquakeEvents] = useState<EarthquakeEvent[]>([]);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [layerCatalog, setLayerCatalog] = useState<LayerDescriptor[]>([]);
  const [moonDistanceKm, setMoonDistanceKm] = useState<number | null>(null);
  const [locationSnapshotBusy, setLocationSnapshotBusy] = useState(false);
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(null);
  const [cityBriefBusy, setCityBriefBusy] = useState(false);
  const [cityBrief, setCityBrief] = useState('');
  const [agentCitations, setAgentCitations] = useState<NonNullable<AgentResponsePayload['citations']>>([]);
  const [agentArtifacts, setAgentArtifacts] = useState<NonNullable<AgentResponsePayload['artifacts']>>([]);
  const [cloudDate, setCloudDate] = useState(() => toIsoDateUTC(new Date()));
  const [temperatureMonth, setTemperatureMonth] = useState(() => toIsoMonthUTC(shiftUtcMonth(new Date(), -3)));
  const text = I18N[locale];
  const t = <K extends keyof (typeof I18N)['en']>(key: K) => text[key];

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (savedLocale === 'en' || savedLocale === 'zh') {
      setLocale(savedLocale);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const {
    currentTimeMs,
    playbackSpeed,
    isPlaying,
    inertialMode,
    selectedLocation,
    annotations,
    layers,
    chatHistory,
    setCurrentTime,
    setPlayback,
    setInertialMode,
    setSelectedLocation,
    setController,
    pushChatMessage,
    controller
  } = useViewerStore();

  useEffect(() => {
    let frameId = 0;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTick;
      const state = useViewerStore.getState();
      if (elapsed >= SIM_TICK_INTERVAL_MS) {
        if (state.isPlaying) {
          state.advanceTime(elapsed * state.playbackSpeed);
        }
        lastTick = now;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const localeText = I18N[locale];
    setSatelliteBusy(true);

    fetch(`/api/satellites?category=${encodeURIComponent(satelliteCategory)}&locale=${encodeURIComponent(locale)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load satellite feed');
        }
        return response.json() as Promise<{
          activeCategory: SatelliteCategoryId;
          categories: SatelliteCategory[];
          failedCount: number;
          satellites: SatelliteFeedItem[];
        }>;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setSatelliteCategories(payload.categories);
        setSatelliteFeed(payload.satellites);
        if (payload.activeCategory !== satelliteCategory) {
          setSatelliteCategory(payload.activeCategory);
        }
        if (payload.failedCount > 0) {
          setAgentNotice(
            localeText.satellitePartial
              .replace('{ok}', String(payload.satellites.length))
              .replace('{fail}', String(payload.failedCount))
          );
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setAgentNotice(error instanceof Error ? error.message : 'Satellite feed unavailable');
      })
      .finally(() => {
        if (!cancelled) {
          setSatelliteBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale, satelliteCategory]);

  useEffect(() => {
    let cancelled = false;
    setProviderBusy(true);

    Promise.all([fetch('/api/providers'), fetch('/api/layers')])
      .then(async ([providersResponse, layersResponse]) => {
        if (!providersResponse.ok || !layersResponse.ok) {
          throw new Error('Provider metadata unavailable');
        }
        const providersPayload = (await providersResponse.json()) as { providers: ProviderDescriptor[] };
        const layersPayload = (await layersResponse.json()) as { layers: LayerDescriptor[] };
        if (cancelled) {
          return;
        }
        setProviders(providersPayload.providers);
        setLayerCatalog(layersPayload.layers);
      })
      .catch((error) => {
        if (!cancelled) {
          setAgentNotice(error instanceof Error ? error.message : 'Provider metadata unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProviderBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadMoonEphemeris = async () => {
      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            kind: 'moon_ephemeris'
          })
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          data?: {
            distanceKm?: number;
          };
        };
        if (!cancelled && typeof payload.data?.distanceKm === 'number') {
          setMoonDistanceKm(payload.data.distanceKm);
        }
      } catch {
        if (!cancelled) {
          setMoonDistanceKm(null);
        }
      }
    };

    void loadMoonEphemeris();
    const timer = window.setInterval(() => {
      void loadMoonEphemeris();
    }, 120000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!selectedLocation) {
      setLocationSnapshot(null);
      setCityBrief('');
      return;
    }

    let cancelled = false;
    setLocationSnapshotBusy(true);
    setCityBrief('');

    Promise.all([
      fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kind: 'weather_current',
          location: {
            lat: selectedLocation.lat,
            lon: selectedLocation.lon
          }
        })
      }),
      fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kind: 'earthquakes_recent',
          maxResults: 40
        })
      })
    ])
      .then(async ([weatherResponse, quakesResponse]) => {
        if (!weatherResponse.ok || !quakesResponse.ok) {
          throw new Error('City snapshot request failed');
        }
        const weatherPayload = (await weatherResponse.json()) as {
          data?: {
            current?: {
              temperature_2m?: number;
              relative_humidity_2m?: number;
              wind_speed_10m?: number;
            };
          };
        };
        const quakesPayload = (await quakesResponse.json()) as {
          data?: {
            events?: EarthquakeEvent[];
          };
        };

        const events = quakesPayload.data?.events ?? [];
        let nearest: EarthquakeEvent | null = null;
        let nearestDistance: number | null = null;

        events.forEach((event) => {
          if (event.coordinates.length < 2) {
            return;
          }
          const distance = haversineKm(selectedLocation.lat, selectedLocation.lon, event.coordinates[1], event.coordinates[0]);
          if (nearestDistance === null || distance < nearestDistance) {
            nearest = event;
            nearestDistance = distance;
          }
        });

        if (!cancelled) {
          setLocationSnapshot({
            temperatureC: weatherPayload.data?.current?.temperature_2m ?? null,
            humidityPct: weatherPayload.data?.current?.relative_humidity_2m ?? null,
            windKmh: weatherPayload.data?.current?.wind_speed_10m ?? null,
            nearestQuake: nearest,
            nearestQuakeDistanceKm: nearestDistance
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAgentNotice(error instanceof Error ? error.message : 'City snapshot unavailable');
          setLocationSnapshot(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLocationSnapshotBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLocation]);

  useEffect(() => {
    if (!layers.earthquakes) {
      setEarthquakeBusy(false);
      return;
    }

    let cancelled = false;

    const loadEarthquakes = async () => {
      setEarthquakeBusy(true);
      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            kind: 'earthquakes_recent',
            maxResults: 24
          })
        });
        if (!response.ok) {
          throw new Error('Earthquake query failed');
        }
        const payload = (await response.json()) as {
          data?: {
            events?: EarthquakeEvent[];
          };
        };
        if (!cancelled) {
          setEarthquakeEvents(payload.data?.events ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setAgentNotice(error instanceof Error ? error.message : 'Earthquake feed unavailable');
        }
      } finally {
        if (!cancelled) {
          setEarthquakeBusy(false);
        }
      }
    };

    void loadEarthquakes();
    const timer = window.setInterval(() => {
      void loadEarthquakes();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [layers.earthquakes]);

  const satelliteRecords = useMemo(
    () =>
      satelliteFeed.map((item) => ({
        ...item,
        satrec: json2satrec({
          ...item.omm,
          EPHEMERIS_TYPE: item.omm.EPHEMERIS_TYPE ?? 0
        })
      })),
    [satelliteFeed]
  );

  const currentDate = useMemo(() => new Date(currentTimeMs), [currentTimeMs]);
  const earthState = useMemo(() => getEarthState(currentDate), [currentDate]);
  const solarInfo = useMemo(() => {
    if (!selectedLocation) {
      return null;
    }
    return getSolarPointInfo(selectedLocation.lat, selectedLocation.lon, earthState);
  }, [earthState, selectedLocation]);
  const yearPresets = useMemo(() => getSeasonPresets(currentDate.getUTCFullYear(), locale), [currentDate, locale]);
  const satelliteTimeMs = useMemo(
    () => Math.floor(currentTimeMs / SATELLITE_UPDATE_INTERVAL_MS) * SATELLITE_UPDATE_INTERVAL_MS,
    [currentTimeMs]
  );
  const satelliteDate = useMemo(() => new Date(satelliteTimeMs), [satelliteTimeMs]);
  const satelliteSnapshots = useMemo<SatelliteSnapshot[]>(() => {
    return satelliteRecords
      .map((item) => {
        const propagation = propagate(item.satrec, satelliteDate);
        if (!propagation?.position) {
          return null;
        }
        const gmst = gstime(satelliteDate);
        const geodetic = eciToGeodetic(propagation.position, gmst);
        return {
          id: item.catnr,
          label: item.label,
          color: item.color,
          lat: degreesLat(geodetic.latitude),
          lon: degreesLong(geodetic.longitude),
          altitudeKm: geodetic.height
        };
      })
      .filter((snapshot): snapshot is SatelliteSnapshot => Boolean(snapshot));
  }, [satelliteDate, satelliteRecords]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) {
      return;
    }

    let cancelled = false;
    let handler: ScreenSpaceEventHandler | null = null;
    let removeInertialListener: (() => void) | null = null;

    const init = async () => {
      window.CESIUM_BASE_URL = '/cesiumStatic';
      if (cancelled || !containerRef.current) {
        return;
      }

      const viewer = new Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        baseLayer: ImageryLayer.fromProviderAsync(
          TileMapServiceImageryProvider.fromUrl('/cesiumStatic/Assets/Textures/NaturalEarthII')
        ),
        terrainProvider: new EllipsoidTerrainProvider(),
        shouldAnimate: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity
      });

      viewer.scene.globe.baseColor = Color.fromCssColorString('#02050d');
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showGroundAtmosphere = true;
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true;
      }
      if (viewer.scene.moon) {
        viewer.scene.moon.show = true;
      }
      if (viewer.scene.sun) {
        viewer.scene.sun.show = true;
      }
      viewer.scene.backgroundColor = Color.fromCssColorString('#01030a');
      viewer.scene.postProcessStages.fxaa.enabled = true;
      (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(103, 22, 26_000_000),
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-88),
          roll: 0
        }
      });

      const initialState = useViewerStore.getState();
      const initialTimeMs = initialState.currentTimeMs;
      const initialLayers = initialState.layers;
      const initialCloudDate = toIsoDateUTC(new Date(initialTimeMs));
      const initialTemperatureMonth = toIsoMonthUTC(new Date(initialTimeMs));

      await Transforms.preloadIcrfFixed(
        new TimeInterval({
          start: JulianDate.fromDate(new Date(initialTimeMs - 86400000 * 5)),
          stop: JulianDate.fromDate(new Date(initialTimeMs + 86400000 * 5))
        })
      );

      const cityLayer = new CustomDataSource('anchor-cities');
      ANCHOR_CITIES.forEach((city) => {
        cityLayer.entities.add({
          name: city.label,
          position: Cartesian3.fromDegrees(city.lon, city.lat),
          properties: {
            cityLabel: city.label
          },
          point: {
            pixelSize: 6,
            color: Color.fromCssColorString('#f7b955'),
            outlineColor: Color.fromCssColorString('#07111f'),
            outlineWidth: 2
          },
          label: {
            text: city.label,
            font: '12px sans-serif',
            fillColor: Color.fromCssColorString('#fff6db'),
            outlineColor: Color.fromCssColorString('#07111f'),
            outlineWidth: 4,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.LEFT,
            pixelOffset: new Cartesian2(10, -12)
          }
        });
      });
      await viewer.dataSources.add(cityLayer);

      const annotationLayer = new CustomDataSource('annotations');
      await viewer.dataSources.add(annotationLayer);

      const satelliteLayer = new CustomDataSource('satellites');
      await viewer.dataSources.add(satelliteLayer);

      const earthquakeLayer = new CustomDataSource('earthquakes');
      earthquakeLayer.show = initialLayers.earthquakes;
      await viewer.dataSources.add(earthquakeLayer);

      const cloudLayer = viewer.imageryLayers.addImageryProvider(createCloudProvider(initialCloudDate));
      cloudLayer.alpha = CLOUD_LAYER_ALPHA;
      cloudLayer.show = initialLayers.weatherClouds;

      const temperatureLayer = viewer.imageryLayers.addImageryProvider(createTemperatureProvider(initialTemperatureMonth));
      temperatureLayer.alpha = TEMPERATURE_LAYER_ALPHA;
      temperatureLayer.show = initialLayers.weatherTemperature;

      handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: Cartesian2 }) => {
        const picked = viewer.scene.pick(movement.position) as { id?: { name?: string; position?: { getValue: (time: JulianDate) => Cartesian3 } } } | undefined;
        if (picked?.id?.name && picked.id.position) {
          const cityPosition = picked.id.position.getValue(viewer.clock.currentTime);
          if (cityPosition) {
            const cityCartographic = Cartographic.fromCartesian(cityPosition);
            const cityLat = CesiumMath.toDegrees(cityCartographic.latitude);
            const cityLon = CesiumMath.toDegrees(cityCartographic.longitude);
            setSelectedLocation({
              lat: cityLat,
              lon: cityLon,
              label: picked.id.name
            });
            return;
          }
        }

        const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
        if (!cartesian) {
          return;
        }

        const cartographic = Cartographic.fromCartesian(cartesian);
        const lat = CesiumMath.toDegrees(cartographic.latitude);
        const lon = CesiumMath.toDegrees(cartographic.longitude);
        setSelectedLocation({
          lat,
          lon,
          label: getLocationLabel(lat, lon)
        });
      }, ScreenSpaceEventType.LEFT_CLICK);

      const inertialUpdater = (_scene: unknown, time: JulianDate) => {
        const state = useViewerStore.getState();
        if (!state.inertialMode || !inertialOffsetRef.current) {
          return;
        }

        const icrfToFixed = Transforms.computeIcrfToFixedMatrix(time, new Matrix3());
        if (!icrfToFixed) {
          return;
        }

        const transform = Matrix4.fromRotationTranslation(icrfToFixed, Cartesian3.ZERO, new Matrix4());
        viewer.camera.lookAtTransform(transform, inertialOffsetRef.current);
      };
      viewer.scene.postUpdate.addEventListener(inertialUpdater);
      removeInertialListener = () => viewer.scene.postUpdate.removeEventListener(inertialUpdater);

      const flyTo = (target: {
        lat: number;
        lon: number;
        altitude?: number;
        heading?: number;
        pitch?: number;
      }) => {
        if (useViewerStore.getState().inertialMode) {
          useViewerStore.getState().setInertialMode(false);
        }
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(target.lon, target.lat, target.altitude ?? 4_000_000),
          orientation: {
            heading: CesiumMath.toRadians(target.heading ?? 0),
            pitch: CesiumMath.toRadians(target.pitch ?? -42),
            roll: 0
          },
          duration: 1.8
        });
      };

      viewerRef.current = viewer;
      cityLayerRef.current = cityLayer;
      annotationLayerRef.current = annotationLayer;
      satelliteLayerRef.current = satelliteLayer;
      earthquakeLayerRef.current = earthquakeLayer;
      cloudLayerRef.current = cloudLayer;
      temperatureLayerRef.current = temperatureLayer;
      setController({ flyTo });
    };

    init().catch((error) => {
      setAgentNotice(error instanceof Error ? error.message : 'Viewer initialization failed');
    });

    return () => {
      cancelled = true;
      handler?.destroy();
      removeInertialListener?.();
      setController(null);
      viewerRef.current?.destroy();
      viewerRef.current = null;
      cityLayerRef.current = null;
      annotationLayerRef.current = null;
      satelliteLayerRef.current = null;
      earthquakeLayerRef.current = null;
      cloudLayerRef.current = null;
      temperatureLayerRef.current = null;
    };
  }, [setController, setSelectedLocation]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    viewer.clock.currentTime = JulianDate.fromDate(currentDate);
    viewer.scene.globe.enableLighting = layers.dayNight;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = layers.atmosphere;
    }
    viewer.scene.globe.showGroundAtmosphere = layers.atmosphere;
    if (viewer.scene.moon) {
      viewer.scene.moon.show = layers.moon;
    }

    if (cityLayerRef.current) {
      cityLayerRef.current.show = layers.cityMarkers;
    }
    if (satelliteLayerRef.current) {
      satelliteLayerRef.current.show = layers.satellites;
    }
    if (earthquakeLayerRef.current) {
      earthquakeLayerRef.current.show = layers.earthquakes;
    }
    if (cloudLayerRef.current) {
      cloudLayerRef.current.show = layers.weatherClouds;
    }
    if (temperatureLayerRef.current) {
      temperatureLayerRef.current.show = layers.weatherTemperature;
    }

    viewer.scene.requestRender();
  }, [currentDate, layers]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !cloudLayerRef.current || !temperatureLayerRef.current) {
      return;
    }

    const layerState = useViewerStore.getState().layers;

    viewer.imageryLayers.remove(cloudLayerRef.current, false);
    const nextCloudLayer = viewer.imageryLayers.addImageryProvider(createCloudProvider(cloudDate));
    nextCloudLayer.alpha = CLOUD_LAYER_ALPHA;
    nextCloudLayer.show = layerState.weatherClouds;
    cloudLayerRef.current = nextCloudLayer;

    viewer.imageryLayers.remove(temperatureLayerRef.current, false);
    const nextTemperatureLayer = viewer.imageryLayers.addImageryProvider(createTemperatureProvider(temperatureMonth));
    nextTemperatureLayer.alpha = TEMPERATURE_LAYER_ALPHA;
    nextTemperatureLayer.show = layerState.weatherTemperature;
    temperatureLayerRef.current = nextTemperatureLayer;

    viewer.scene.requestRender();
  }, [cloudDate, temperatureMonth]);

  useEffect(() => {
    const annotationLayer = annotationLayerRef.current;
    if (!annotationLayer) {
      return;
    }

    annotationLayer.entities.removeAll();
    annotations.forEach((annotation) => {
      annotationLayer.entities.add({
        position: Cartesian3.fromDegrees(annotation.lon, annotation.lat),
        point: {
          pixelSize: 9,
          color: Color.fromCssColorString(annotation.color ?? '#5eead4'),
          outlineColor: Color.fromCssColorString('#07111f'),
          outlineWidth: 2
        },
        label: {
          text: annotation.text,
          font: '13px sans-serif',
          fillColor: Color.fromCssColorString('#e6fffb'),
          outlineColor: Color.fromCssColorString('#07111f'),
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(12, -10)
        }
      });
    });

    viewerRef.current?.scene.requestRender();
  }, [annotations]);

  useEffect(() => {
    const satelliteLayer = satelliteLayerRef.current;
    if (!satelliteLayer) {
      return;
    }

    satelliteLayer.entities.removeAll();
    satelliteSnapshots.forEach((satellite) => {
      satelliteLayer.entities.add({
        position: Cartesian3.fromDegrees(satellite.lon, satellite.lat, satellite.altitudeKm * 1000),
        point: {
          pixelSize: 7,
          color: Color.fromCssColorString(satellite.color),
          outlineColor: Color.fromCssColorString('#050913'),
          outlineWidth: 2
        },
        label: {
          text: satellite.label,
          font: '12px sans-serif',
          fillColor: Color.fromCssColorString('#f8fbff'),
          outlineColor: Color.fromCssColorString('#050913'),
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(10, -12)
        }
      });
    });

    viewerRef.current?.scene.requestRender();
  }, [satelliteSnapshots]);

  useEffect(() => {
    const earthquakeLayer = earthquakeLayerRef.current;
    if (!earthquakeLayer) {
      return;
    }

    earthquakeLayer.entities.removeAll();
    earthquakeEvents.forEach((event) => {
      if (event.coordinates.length < 2) {
        return;
      }

      const lon = event.coordinates[0] ?? 0;
      const lat = event.coordinates[1] ?? 0;
      const magnitude = event.magnitude;
      const label = magnitude !== null ? `M${magnitude.toFixed(1)}` : 'M?';
      earthquakeLayer.entities.add({
        position: Cartesian3.fromDegrees(lon, lat, 12_000),
        point: {
          pixelSize: magnitude !== null ? Math.max(6, Math.min(16, 5 + magnitude * 1.25)) : 7,
          color: Color.fromCssColorString(earthquakeColor(magnitude)),
          outlineColor: Color.fromCssColorString('#08101e'),
          outlineWidth: 2
        },
        label: {
          text: label,
          font: '11px sans-serif',
          fillColor: Color.fromCssColorString('#fff4d8'),
          outlineColor: Color.fromCssColorString('#07111f'),
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(10, -10)
        }
      });
    });

    viewerRef.current?.scene.requestRender();
  }, [earthquakeEvents]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const localeText = I18N[locale];
    if (!viewer) {
      return;
    }

    if (inertialMode) {
      const fixedToIcrf = Transforms.computeFixedToIcrfMatrix(viewer.clock.currentTime, new Matrix3());
      if (fixedToIcrf) {
        inertialOffsetRef.current = Matrix3.multiplyByVector(
          fixedToIcrf,
          viewer.camera.positionWC,
          new Cartesian3()
        );
      } else {
        inertialOffsetRef.current = Cartesian3.clone(viewer.camera.positionWC);
      }
      setInteractionEnabled(viewer, false);
      setAgentNotice(localeText.inertialNotice);
    } else {
      const currentPosition = Cartesian3.clone(viewer.camera.positionWC);
      const currentDirection = Cartesian3.clone(viewer.camera.directionWC);
      const currentUp = Cartesian3.clone(viewer.camera.upWC);
      viewer.camera.lookAtTransform(Matrix4.IDENTITY);
      viewer.camera.setView({
        destination: currentPosition,
        orientation: {
          direction: currentDirection,
          up: currentUp
        }
      });
      inertialOffsetRef.current = null;
      setInteractionEnabled(viewer, true);
    }

    viewer.scene.requestRender();
  }, [inertialMode, locale]);

  const handlePromptSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      return;
    }

    const outgoingMessages: AgentMessage[] = [...chatHistory, { role: 'user', content: nextPrompt }];
    pushChatMessage({ role: 'user', content: nextPrompt });
    setPrompt('');
    setAgentBusy(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: outgoingMessages,
          context: {
            simulationTimeIso: currentDate.toISOString(),
            inertialMode,
            selectedLocation,
            layers
          }
        })
      });

      const payload = (await response.json()) as AgentResponsePayload;
      applyClientActions(payload.actions);
      pushChatMessage({ role: 'assistant', content: payload.reply });
      setAgentCitations(payload.citations ?? []);
      setAgentArtifacts(payload.artifacts ?? []);
      setAgentNotice(payload.provider === 'openai' ? t('openaiReady') : t('fallbackMode'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent request failed';
      pushChatMessage({ role: 'assistant', content: message });
      setAgentNotice(message);
    } finally {
      setAgentBusy(false);
    }
  };

  const handleSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setHasSubmittedSearch(false);
      setSearchResults([]);
      return;
    }

    setHasSubmittedSearch(true);
    setSearchBusy(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Geocode request failed');
      }
      const payload = (await response.json()) as { results: GeocodeResult[] };
      setSearchResults(payload.results);
      setAgentNotice(
        payload.results.length > 0 ? t('geocodeFound').replace('{count}', String(payload.results.length)) : t('geocodeNone')
      );
    } catch {
      setSearchResults([]);
      setAgentNotice(t('geocodeUnavailable'));
    } finally {
      setSearchBusy(false);
    }
  };

  const focusSearchResult = (result: GeocodeResult) => {
    const label = result.label.split(',')[0] || result.label;
    setSelectedLocation({ lat: result.lat, lon: result.lon, label });
    controller?.flyTo({ lat: result.lat, lon: result.lon, label, altitude: 3_200_000 });
    setSearchQuery(result.label);
    setHasSubmittedSearch(false);
    setSearchResults([]);
  };

  const toggleLayer = (layerId: ViewerLayerId) => {
    useViewerStore.getState().toggleLayer(layerId);
  };

  const handleGenerateCityBrief = async () => {
    if (!selectedLocation) {
      return;
    }

    setCityBriefBusy(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Summarize current conditions for ${selectedLocation.label ?? 'selected location'} at ${selectedLocation.lat.toFixed(3)}, ${selectedLocation.lon.toFixed(3)}. Include weather, daylight context, and any nearby seismic relevance using available tools.`
            }
          ],
          context: {
            simulationTimeIso: currentDate.toISOString(),
            inertialMode,
            selectedLocation,
            layers
          }
        })
      });
      if (!response.ok) {
        throw new Error('City brief request failed');
      }
      const payload = (await response.json()) as AgentResponsePayload;
      setCityBrief(payload.reply);
      setAgentCitations(payload.citations ?? []);
      setAgentArtifacts(payload.artifacts ?? []);
      setAgentNotice(payload.provider === 'openai' ? t('openaiReady') : t('fallbackMode'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'City brief unavailable';
      setCityBrief(message);
      setAgentNotice(message);
    } finally {
      setCityBriefBusy(false);
    }
  };

  return (
    <main className={sidebarCollapsed ? 'earthStage sidebarCollapsed' : 'earthStage'}>
      <section className="controlColumn">
        <div className="sidebarTopbar">
          <button type="button" className="sidebarToggle" onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
          </button>
          <div className="langSwitch" aria-label={t('language')}>
            <button type="button" className={locale === 'en' ? 'langBtn active' : 'langBtn'} onClick={() => setLocale('en')}>
              EN
            </button>
            <button type="button" className={locale === 'zh' ? 'langBtn active' : 'langBtn'} onClick={() => setLocale('zh')}>
              中文
            </button>
          </div>
        </div>
        {!sidebarCollapsed ? (
          <>
        <div className="heroCard">
          <p className="eyebrow">{t('planetaryControlRoom')}</p>
          <h1>{t('freeObserveEarth')}</h1>
          <p className="heroCopy">{t('heroCopy')}</p>
          <div className="statRow">
            <div>
              <span>{t('axialTilt')}</span>
              <strong>{EARTH_AXIAL_TILT_DEGREES.toFixed(3)}°</strong>
            </div>
            <div>
              <span>{t('siderealDay')}</span>
              <strong>{EARTH_SIDEREAL_DAY_HOURS.toFixed(3)} h</strong>
            </div>
            <div>
              <span>{t('visibleSatellites')}</span>
              <strong>{satelliteSnapshots.length}</strong>
            </div>
          </div>
        </div>

        <article className="infoPanel searchPanel">
          <div className="panelHeader">
            <span>{t('geocodeSearch')}</span>
            <strong>{searchBusy ? t('querying') : 'NOMINATIM'}</strong>
          </div>
          <form onSubmit={handleSearchSubmit} className="searchForm">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSearchQuery(nextValue);
                if (nextValue.trim().length < 2) {
                  setHasSubmittedSearch(false);
                  setSearchResults([]);
                }
              }}
              placeholder={t('searchPlaceholder')}
            />
            <div className="buttonRow compact twoCol">
              <button type="submit" disabled={searchBusy}>
                {searchBusy ? t('searching') : t('searchPlace')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setHasSubmittedSearch(false);
                  setSearchResults([]);
                }}
              >
                {t('clearResults')}
              </button>
            </div>
          </form>
          <div className="searchResults">
            {searchResults.map((result) => (
              <button key={result.id} type="button" className="resultItem" onClick={() => focusSearchResult(result)}>
                <strong>{result.label.split(',')[0]}</strong>
                <span>{result.label}</span>
              </button>
            ))}
          </div>
          {!searchBusy && hasSubmittedSearch && searchResults.length === 0 ? (
            <p className="emptyState">{t('noMatchedPlace')}</p>
          ) : null}
        </article>

        <div className="panelCluster twoUp">
          <article className="infoPanel">
            <div className="panelHeader">
              <span>{t('simulationClock')}</span>
              <strong>{isPlaying ? t('running') : t('paused')}</strong>
            </div>
            <div className="timeReadout">{formatIsoTime(currentDate, locale)} UTC</div>
            <input
              className="timeSlider"
              type="range"
              min="0"
              max="1000"
              value={getYearProgress(currentTimeMs)}
              onChange={(event) => setCurrentTime(getTimeFromYearProgress(currentTimeMs, Number(event.target.value)))}
            />
            <div className="buttonRow compact">
              <button type="button" onClick={() => setCurrentTime(Date.now())}>
                {t('now')}
              </button>
              <button type="button" onClick={() => setPlayback(!isPlaying, playbackSpeed)}>
                {isPlaying ? t('pause') : t('resume')}
              </button>
              <button type="button" onClick={() => setPlayback(true, 86400)}>
                86400x
              </button>
            </div>
            <div className="presetGrid">
              {yearPresets.map((preset) => (
                <button key={preset.label} type="button" onClick={() => setCurrentTime(preset.time)}>
                  {preset.label}
                </button>
              ))}
            </div>
          </article>

          <article className="infoPanel orbitPanel">
            <div className="panelHeader">
              <span>{t('orbitSolver')}</span>
              <strong>{formatSeasonLabel(earthState.seasonLabel, locale)}</strong>
            </div>
            <OrbitDial earthState={earthState} />
          </article>
        </div>

        <div className="panelCluster twoUp">
          <article className="infoPanel">
            <div className="panelHeader">
              <span>{t('inertialCamera')}</span>
              <strong>{inertialMode ? 'ICRF' : t('earthFixed')}</strong>
            </div>
            <p className="emptyState inertialCopy">{t('inertialDesc')}</p>
            <div className="buttonRow compact twoCol">
              <button type="button" onClick={() => setInertialMode(!inertialMode)}>
                {inertialMode ? t('backToFixed') : t('switchToInertial')}
              </button>
              <button type="button" onClick={() => controller?.flyTo({ lat: 0, lon: 0, altitude: 26_000_000, pitch: -88 })}>
                {t('equatorWideView')}
              </button>
            </div>
          </article>

          <article className="infoPanel">
            <div className="panelHeader">
              <span>{t('subsolarPoint')}</span>
              <strong>{layers.dayNight ? t('lit') : t('static')}</strong>
            </div>
            <div className="metricList">
              <div>
                <span>{t('latitude')}</span>
                <strong>{earthState.subsolarLatitude.toFixed(2)}°</strong>
              </div>
              <div>
                <span>{t('longitude')}</span>
                <strong>{earthState.subsolarLongitude.toFixed(2)}°</strong>
              </div>
              <div>
                <span>{t('gmst')}</span>
                <strong>{earthState.gmstDegrees.toFixed(2)}°</strong>
              </div>
              <div>
                <span>{t('moonDistance')}</span>
                <strong>{moonDistanceKm ? `${Math.round(moonDistanceKm).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')} km` : '--'}</strong>
              </div>
            </div>
          </article>
        </div>

        <div className="panelCluster twoUp">
          <article className="infoPanel">
            <div className="panelHeader">
              <span>{t('selectedSurfacePoint')}</span>
              <strong>{selectedLocation ? t('locked') : t('none')}</strong>
            </div>
            {selectedLocation && solarInfo ? (
              <>
                <div className="metricList">
                  <div>
                    <span>{t('location')}</span>
                    <strong>{selectedLocation.label ?? getLocationLabel(selectedLocation.lat, selectedLocation.lon)}</strong>
                  </div>
                  <div>
                    <span>{t('solarAltitude')}</span>
                    <strong>{solarInfo.altitudeDegrees.toFixed(1)}°</strong>
                  </div>
                  <div>
                    <span>{t('localSolarTime')}</span>
                    <strong>{formatLocalSolarTime(solarInfo.localSolarTimeHours)}</strong>
                  </div>
                  <div>
                    <span>{t('daylightState')}</span>
                    <strong>{solarInfo.daylight ? t('daytime') : t('nighttime')}</strong>
                  </div>
                  <div>
                    <span>{t('weatherNow')}</span>
                    <strong>{locationSnapshotBusy ? t('refreshing') : locationSnapshot?.temperatureC !== null && locationSnapshot?.temperatureC !== undefined ? `${locationSnapshot.temperatureC.toFixed(1)}°C` : '--'}</strong>
                  </div>
                  <div>
                    <span>{t('humidity')}</span>
                    <strong>{locationSnapshotBusy ? t('refreshing') : locationSnapshot?.humidityPct !== null && locationSnapshot?.humidityPct !== undefined ? `${Math.round(locationSnapshot.humidityPct)}%` : '--'}</strong>
                  </div>
                  <div>
                    <span>{t('windSpeed')}</span>
                    <strong>{locationSnapshotBusy ? t('refreshing') : locationSnapshot?.windKmh !== null && locationSnapshot?.windKmh !== undefined ? `${locationSnapshot.windKmh.toFixed(1)} km/h` : '--'}</strong>
                  </div>
                  <div>
                    <span>{t('nearestQuake')}</span>
                    <strong>
                      {locationSnapshot?.nearestQuake
                        ? `${locationSnapshot.nearestQuake.magnitude !== null ? `M${locationSnapshot.nearestQuake.magnitude.toFixed(1)}` : 'M?'} · ${locationSnapshot.nearestQuakeDistanceKm ? `${Math.round(locationSnapshot.nearestQuakeDistanceKm)} km` : '--'}`
                        : t('unknown')}
                    </strong>
                  </div>
                </div>
                <div className="buttonRow compact twoCol">
                  <button type="button" onClick={handleGenerateCityBrief} disabled={cityBriefBusy}>
                    {cityBriefBusy ? t('generating') : t('generateBrief')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCityBrief('');
                    }}
                  >
                    {t('clearResults')}
                  </button>
                </div>
                <div className="chatLog">
                  <p className="emptyState">{t('aiCityBrief')}</p>
                  <div className="chatBubble assistant">
                    <span>{t('agent')}</span>
                    <p>{cityBrief || t('noCitySnapshot')}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="emptyState">{t('clickEarthHint')}</p>
            )}
          </article>

          <article className="infoPanel">
            <div className="panelHeader">
              <span>{t('orbitalObjects')}</span>
              <strong>{satelliteBusy ? t('syncing') : layers.satellites ? t('tracking') : t('hidden')}</strong>
            </div>
            <div className="chipRow">
              {satelliteCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={category.id === satelliteCategory ? 'chip active' : 'chip'}
                  onClick={() => setSatelliteCategory(category.id)}
                  disabled={satelliteBusy && category.id === satelliteCategory}
                >
                  {category.id === 'all'
                    ? t('all')
                    : category.id === 'stations'
                      ? t('stations')
                      : category.id === 'weather'
                        ? t('weather')
                        : t('science')}{' '}
                  ({category.count})
                </button>
              ))}
            </div>
            <div className="satelliteList">
              {satelliteSnapshots.length > 0 ? (
                satelliteSnapshots.map((satellite) => (
                  <button
                    key={satellite.id}
                    type="button"
                    className="resultItem satelliteItem"
                    onClick={() => controller?.flyTo({ lat: satellite.lat, lon: satellite.lon, altitude: 7_500_000, pitch: -62 })}
                  >
                    <strong>{satellite.label}</strong>
                    <span>
                      {satellite.lat.toFixed(1)}°, {satellite.lon.toFixed(1)}° · {satellite.altitudeKm.toFixed(0)} km
                    </span>
                  </button>
                ))
              ) : (
                <p className="emptyState">{t('satelliteLoadingHint')}</p>
              )}
            </div>
            {layers.earthquakes ? (
              <>
                <div className="panelHeader" style={{ marginTop: 12 }}>
                  <span>{t('earthquakeEvents')}</span>
                  <strong>{earthquakeBusy ? t('refreshing') : String(earthquakeEvents.length)}</strong>
                </div>
                <div className="satelliteList">
                  {earthquakeEvents.length > 0 ? (
                    earthquakeEvents.slice(0, 8).map((event) => {
                      if (event.coordinates.length < 2) {
                        return null;
                      }
                      const lon = event.coordinates[0] ?? 0;
                      const lat = event.coordinates[1] ?? 0;
                      return (
                        <button
                          key={event.id}
                          type="button"
                          className="resultItem satelliteItem"
                          onClick={() => controller?.flyTo({ lat, lon, altitude: 5_200_000, pitch: -74 })}
                        >
                          <strong>
                            {event.magnitude !== null ? `M${event.magnitude.toFixed(1)}` : 'M?'} · {event.place}
                          </strong>
                          <span>{event.timeIso ? formatIsoTime(new Date(event.timeIso), locale) : 'UTC unknown'}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="emptyState">{t('eventFeedEmpty')}</p>
                  )}
                </div>
              </>
            ) : null}
          </article>
        </div>

        <article className="infoPanel weatherPanel">
          <div className="panelHeader">
            <span>{t('weatherTimeLayers')}</span>
            <strong>NASA GIBS</strong>
          </div>
          <div className="fieldGrid">
            <label className="fieldGroup">
              <span>{t('cloudDate')}</span>
              <input
                type="date"
                value={cloudDate}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue) {
                    setCloudDate(nextValue);
                  }
                }}
              />
            </label>
            <label className="fieldGroup">
              <span>{t('temperatureMonth')}</span>
              <input
                type="month"
                value={temperatureMonth}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue) {
                    setTemperatureMonth(nextValue);
                  }
                }}
              />
            </label>
          </div>
          <div className="buttonRow compact twoCol">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCloudDate(toIsoDateUTC(now));
                setTemperatureMonth(toIsoMonthUTC(shiftUtcMonth(now, -3)));
              }}
            >
              {t('useToday')}
            </button>
            <button
              type="button"
              onClick={() => {
                setCloudDate(toIsoDateUTC(currentDate));
                setTemperatureMonth(toIsoMonthUTC(currentDate));
              }}
            >
              {t('alignSimTime')}
            </button>
          </div>
        </article>

        <div className="panelCluster twoUp">
          <article className="infoPanel">
            <div className="panelHeader">
              <span>{t('dataProviders')}</span>
              <strong>{providerBusy ? t('syncing') : t('availability')}</strong>
            </div>
            <div className="searchResults">
              {providers.map((provider) => (
                <div key={provider.id} className="resultItem">
                  <strong>{provider.name}</strong>
                  <span>
                    {providerStatusLabel(provider.status, t)}
                    {provider.optional ? ` · ${t('optionalProvider')}` : ''}
                  </span>
                  {provider.reason ? <span>{provider.reason}</span> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="infoPanel">
            <div className="panelHeader">
              <span>{t('layerCatalog')}</span>
              <strong>{layerCatalog.length}</strong>
            </div>
            <div className="searchResults">
              {layerCatalog.map((layer) => (
                <div key={layer.id} className="resultItem">
                  <strong>{layer.label}</strong>
                  <span>{layer.description}</span>
                  <span>
                    {layer.providerId} · {layer.timeDimension}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>

        <article className="infoPanel layerPanel">
          <div className="panelHeader">
            <span>{t('viewerLayers')}</span>
            <strong>{agentNotice || 'READY'}</strong>
          </div>
          <div className="toggleGrid dense">
            {([
              ['dayNight', t('dayNight')],
              ['atmosphere', t('atmosphere')],
              ['cityMarkers', t('cityMarkers')],
              ['moon', t('moon')],
              ['satellites', t('satellites')],
              ['earthquakes', t('earthquakes')],
              ['weatherClouds', t('weatherClouds')],
              ['weatherTemperature', t('weatherTemperature')]
            ] as Array<[ViewerLayerId, string]>).map(([layerId, label]) => (
              <button
                key={layerId}
                type="button"
                className={layers[layerId] ? 'toggle active' : 'toggle'}
                onClick={() => toggleLayer(layerId)}
              >
                <span>{label}</span>
                <strong>{layers[layerId] ? 'ON' : 'OFF'}</strong>
              </button>
            ))}
          </div>
        </article>

        <article className="infoPanel">
          <div className="panelHeader">
            <span>{t('citations')}</span>
            <strong>{agentCitations.length}</strong>
          </div>
          <div className="searchResults">
            {agentCitations.length > 0 ? (
              agentCitations.map((item, index) => (
                <a key={`${item.providerId}-${index}`} className="resultItem citationItem" href={item.url} target="_blank" rel="noreferrer">
                  <strong>{item.title}</strong>
                  <span>{item.providerId}</span>
                  <span>{new Date(item.retrievedAtIso).toISOString()}</span>
                </a>
              ))
            ) : (
              <p className="emptyState">{t('noCitations')}</p>
            )}
          </div>
          {agentArtifacts.length > 0 ? (
            <div className="chatLog">
              <p className="emptyState">{t('analysisArtifacts')}</p>
              {agentArtifacts.slice(0, 2).map((artifact, index) => (
                <div key={`${artifact.kind}-${index}`} className="chatBubble assistant">
                  <span>{artifact.title}</span>
                  <p>{artifact.content}</p>
                </div>
              ))}
            </div>
          ) : null}
        </article>

        <article className="infoPanel commandPanel">
          <div className="panelHeader">
            <span>{t('llmControlConsole')}</span>
            <strong>{agentBusy ? t('thinking') : t('idle')}</strong>
          </div>
          <form onSubmit={handlePromptSubmit} className="commandForm">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t('promptPlaceholder')}
              rows={4}
            />
            <div className="buttonRow">
              <button type="submit" disabled={agentBusy}>
                {agentBusy ? t('sending') : t('execute')}
              </button>
              <button type="button" onClick={() => controller?.flyTo({ lat: 31.2304, lon: 121.4737 })}>
                {t('backToShanghai')}
              </button>
              <button type="button" onClick={() => controller?.flyTo({ lat: -33.8688, lon: 151.2093 })}>
                {t('switchToSydney')}
              </button>
            </div>
          </form>
          <div className="chatLog">
            {chatHistory.length === 0 ? (
              <p className="emptyState">{t('noChatHint')}</p>
            ) : (
              chatHistory.slice(-6).map((message, index) => (
                <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'chatBubble user' : 'chatBubble assistant'}>
                  <span>{message.role === 'user' ? t('user') : t('agent')}</span>
                  <p>{message.content}</p>
                </div>
              ))
            )}
          </div>
        </article>
          </>
        ) : null}
      </section>

      <section className="viewerColumn">
        <div className="viewerFrame">
          <div ref={containerRef} className="earthCanvas" />
          <div className="viewerOverlay">
            <div>
              <span>{t('subsolarPoint')}</span>
              <strong>
                {earthState.subsolarLatitude.toFixed(1)}° / {earthState.subsolarLongitude.toFixed(1)}°
              </strong>
            </div>
            <div>
              <span>{t('observer')}</span>
              <strong>{selectedLocation ? selectedLocation.label ?? getLocationLabel(selectedLocation.lat, selectedLocation.lon) : t('clickEarth')}</strong>
            </div>
            <div>
              <span>{t('reference')}</span>
              <strong>{inertialMode ? t('icrfCamera') : t('fixedCamera')}</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
