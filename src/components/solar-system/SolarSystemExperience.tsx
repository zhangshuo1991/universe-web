'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';

import { applyClientActions } from '@/agent/applyClientActions';
import { SolarSystemCesiumScene } from '@/components/solar-system/SolarSystemCesiumScene';
import { useViewerStore } from '@/store/viewerStore';
import type {
  AgentArtifact,
  AgentCitation,
  AgentMessage,
  AgentResponsePayload,
  InterfaceMode,
  SolarViewPresetId,
  ViewerLayerId
} from '@/types/agent';
import type {
  BodyStateVector,
  CelestialBodyDescriptor,
  LayerDescriptor,
  ObservationCitation,
  ProviderDescriptor,
  SystemSnapshot
} from '@/types/observation';

type Locale = 'en' | 'zh';

type SpaceWeatherData = {
  latestKp?: {
    timeTag: string | null;
    kpIndex: number | null;
  } | null;
  solarProbabilities?: unknown;
};

type SmallBodyEvent = {
  designation: unknown;
  closeApproachTimeUtc: unknown;
  missDistanceAu: unknown;
  relativeVelocityKmS: unknown;
};

type SmallBodyEventsResponse = {
  closeApproaches?: SmallBodyEvent[];
};

type SmallBodyWindowFilter = '24h' | '7d' | '30d';

const LOCALE_STORAGE_KEY = 'earth-observer-locale';
const TICK_MS = 100;
const SNAPSHOT_REFRESH_MS = 8_000;
const SPACE_WEATHER_REFRESH_MS = 300_000;
const SMALL_BODIES_REFRESH_MS = 15 * 60_000;
const AU_IN_KM = 149_597_870.7;

const PRESET_BODY_IDS: Record<SolarViewPresetId, string[]> = {
  inner: ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars'],
  outer: ['sun', 'jupiter', 'saturn', 'uranus', 'neptune', 'io', 'europa', 'ganymede', 'callisto', 'titan'],
  full: ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'titan'],
  earthMoon: ['sun', 'earth', 'moon']
};

const SPEED_OPTIONS = [3600, 86400, 604800] as const;
const SMALL_BODY_FILTER_OPTIONS: readonly SmallBodyWindowFilter[] = ['24h', '7d', '30d'];

const LAYER_TOGGLES: Array<{
  id: ViewerLayerId;
  label: {
    en: string;
    zh: string;
  };
}> = [
  {
    id: 'planetOrbits',
    label: {
      en: 'Planet Orbits',
      zh: '行星轨道'
    }
  },
  {
    id: 'planetLabels',
    label: {
      en: 'Planet Labels',
      zh: '天体标签'
    }
  },
  {
    id: 'majorMoons',
    label: {
      en: 'Major Moons',
      zh: '主要卫星'
    }
  },
  {
    id: 'spaceWeather',
    label: {
      en: 'Space Weather',
      zh: '空间天气'
    }
  },
  {
    id: 'surfaceOverlays',
    label: {
      en: 'Surface Layers',
      zh: '表面参考层'
    }
  },
  {
    id: 'smallBodies',
    label: {
      en: 'Small Bodies',
      zh: '小天体事件'
    }
  }
];

const I18N = {
  en: {
    eyebrow: 'Solar System Observatory',
    title: 'Real Ephemeris Control Room',
    hero:
      'JPL-based Solar System positions, NASA planetary references, NOAA space weather, and an OpenAI-compatible analysis loop. Explore and analysis share one workspace.',
    explore: 'Explore',
    analysis: 'Analysis',
    collapse: 'Collapse',
    expand: 'Expand',
    language: 'Language',
    bodyDirectory: 'Body Directory',
    dataProviders: 'Data Providers',
    visibleLayers: 'Visible Layers',
    viewPreset: 'View Preset',
    simulationClock: 'Simulation Clock',
    bodyFocus: 'Body Focus',
    sourceState: 'Source State',
    analysisDesk: 'Analysis Desk',
    observerNote: 'Observer Note',
    askPlaceholder: 'Examples: compare Earth and Mars right now; focus Jupiter and switch to outer view; explain the current Moon geometry.',
    runAnalysis: 'Run Analysis',
    thinking: 'Thinking...',
    noReply: 'No analysis yet. Ask for a comparison, explanation, or a new camera focus.',
    live: 'Live',
    cached: 'Cached',
    local: 'Local',
    fallback: 'Estimated',
    selectedBody: 'Selected Body',
    heliocentricDistance: 'Sun Distance',
    radius: 'Radius',
    orbitPeriod: 'Orbital Period',
    rotation: 'Rotation',
    tilt: 'Axial Tilt',
    surfaceRefs: 'Surface References',
    noSurfaceRefs: 'No reference layers attached yet.',
    spaceWeather: 'Space Weather',
    currentKp: 'Current Kp',
    solarProbabilities: 'Solar Probabilities',
    citations: 'Citations',
    artifacts: 'Artifacts',
    snapshotEpoch: 'Snapshot Epoch',
    bodiesTracked: 'Bodies Tracked',
    viewInner: 'Inner',
    viewOuter: 'Outer',
    viewFull: 'Full',
    viewEarthMoon: 'Earth-Moon',
    pause: 'Pause',
    resume: 'Resume',
    now: 'Now',
    noSnapshot: 'Loading solar-system snapshot...',
    layersHint: 'Agent and user share the same layers and time controls.',
    presetInnerDesc: 'Inner planets and Earth-Moon system',
    presetOuterDesc: 'Jovian to Neptunian system',
    presetFullDesc: 'All core planets in one frame',
    presetEarthMoonDesc: 'Expanded Earth-Moon geometry',
    providerOptional: 'Optional',
    available: 'Available',
    degraded: 'Degraded',
    disabled: 'Disabled',
    latestKpUnknown: 'No live SWPC value yet',
    moonModeHint: 'Earth-Moon mode is rendered in kilometer-scale relative geometry.',
    commandConsole: 'LLM Console',
    smallBodyEvents: 'Small Body Events',
    smallBodyHint: 'Event markers are proxy positions around Earth when full orbital vectors are unavailable.',
    smallBodyWindow: 'Window',
    noSmallBodies: 'No close approaches in current feed window.',
    missDistance: 'Miss Distance',
    relVelocity: 'Relative Velocity',
    closeApproach: 'Close Approach',
    unknown: 'Unknown',
    autoAnalyzing: 'Auto analyzing...',
    filter24h: '24H',
    filter7d: '7D',
    filter30d: '30D'
  },
  zh: {
    eyebrow: '太阳系观测站',
    title: '真实星历控制台',
    hero:
      '基于 JPL 真实太阳系位置、NASA 行星参考数据、NOAA 空间天气和兼容 OpenAI 的分析闭环。探索与分析共用同一个工作空间。',
    explore: '探索',
    analysis: '分析',
    collapse: '收起',
    expand: '展开',
    language: '语言',
    bodyDirectory: '天体目录',
    dataProviders: '数据源',
    visibleLayers: '显示图层',
    viewPreset: '视图预设',
    simulationClock: '模拟时钟',
    bodyFocus: '观测主体',
    sourceState: '数据状态',
    analysisDesk: '分析工作台',
    observerNote: '观测说明',
    askPlaceholder: '例如：比较当前地球和火星；聚焦木星并切到外太阳系；解释当前月球几何关系。',
    runAnalysis: '运行分析',
    thinking: '分析中...',
    noReply: '还没有分析结果。可以让它做比较、解释或切换视角。',
    live: '实时',
    cached: '缓存',
    local: '本地',
    fallback: '估算',
    selectedBody: '当前主体',
    heliocentricDistance: '距太阳',
    radius: '半径',
    orbitPeriod: '公转周期',
    rotation: '自转周期',
    tilt: '轴倾角',
    surfaceRefs: '表面参考层',
    noSurfaceRefs: '还没有挂接参考图层。',
    spaceWeather: '空间天气',
    currentKp: '当前 Kp',
    solarProbabilities: '太阳活动概率',
    citations: '引用',
    artifacts: '分析产物',
    snapshotEpoch: '快照时刻',
    bodiesTracked: '追踪天体',
    viewInner: '内太阳系',
    viewOuter: '外太阳系',
    viewFull: '全系统',
    viewEarthMoon: '地月系',
    pause: '暂停',
    resume: '继续',
    now: '现在',
    noSnapshot: '太阳系快照加载中...',
    layersHint: 'Agent 和用户共用同一套图层与时间控制。',
    presetInnerDesc: '内行星与地月系统',
    presetOuterDesc: '木星到海王星区间',
    presetFullDesc: '核心行星全景',
    presetEarthMoonDesc: '公里级地月几何',
    providerOptional: '可选',
    available: '可用',
    degraded: '降级',
    disabled: '禁用',
    latestKpUnknown: '当前还没有可用的 SWPC 实时值',
    moonModeHint: '地月视图按地月相对公里尺度渲染。',
    commandConsole: 'LLM 控制台',
    smallBodyEvents: '小天体事件',
    smallBodyHint: '当前在缺少完整轨道矢量时，小天体仅按事件代理点围绕地球展示。',
    smallBodyWindow: '时间窗口',
    noSmallBodies: '当前窗口未发现近地接近事件。',
    missDistance: '掠过距离',
    relVelocity: '相对速度',
    closeApproach: '接近时刻',
    unknown: '未知',
    autoAnalyzing: '自动分析中...',
    filter24h: '24小时',
    filter7d: '7天',
    filter30d: '30天'
  }
} as const;

function dedupeCitations(items: (ObservationCitation | AgentCitation)[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.providerId}:${item.url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function statusLabel(status: ProviderDescriptor['status'], locale: Locale) {
  const dict = I18N[locale];
  if (status === 'available') {
    return dict.available;
  }
  if (status === 'disabled') {
    return dict.disabled;
  }
  return dict.degraded;
}

function number(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits
  });
}

function days(value?: number) {
  return value !== undefined ? `${number(value, 2)} d` : '—';
}

function hours(value?: number) {
  return value !== undefined ? `${number(value, 2)} h` : '—';
}

function degrees(value?: number) {
  return value !== undefined ? `${number(value, 2)}°` : '—';
}

function snapshotSourceSummary(bodies: BodyStateVector[]) {
  const summary: Record<BodyStateVector['source'], number> = {
    jpl_horizons: 0,
    cached_horizons: 0,
    local_spice: 0,
    fallback_model: 0
  };

  for (const body of bodies) {
    summary[body.source] += 1;
  }

  return summary;
}

function describeSolarProbabilities(payload: unknown) {
  if (Array.isArray(payload) && payload.length > 0) {
    const item = payload[0];
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      return Object.entries(record)
        .slice(0, 4)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(' · ');
    }
  }

  if (payload && typeof payload === 'object') {
    return JSON.stringify(payload).slice(0, 180);
  }

  return '—';
}

function presetLabel(locale: Locale, preset: SolarViewPresetId) {
  const dict = I18N[locale];
  if (preset === 'inner') {
    return dict.viewInner;
  }
  if (preset === 'outer') {
    return dict.viewOuter;
  }
  if (preset === 'earthMoon') {
    return dict.viewEarthMoon;
  }
  return dict.viewFull;
}

function presetDescription(locale: Locale, preset: SolarViewPresetId) {
  const dict = I18N[locale];
  if (preset === 'inner') {
    return dict.presetInnerDesc;
  }
  if (preset === 'outer') {
    return dict.presetOuterDesc;
  }
  if (preset === 'earthMoon') {
    return dict.presetEarthMoonDesc;
  }
  return dict.presetFullDesc;
}

function buildActiveBodyIds(preset: SolarViewPresetId, selectedBodyId: string | null, includeMajorMoons: boolean) {
  const set = new Set(PRESET_BODY_IDS[preset]);
  if (includeMajorMoons && preset !== 'inner') {
    ['moon', 'io', 'europa', 'ganymede', 'callisto', 'titan'].forEach((bodyId) => set.add(bodyId));
  }
  if (selectedBodyId) {
    set.add(selectedBodyId);
  }
  return [...set];
}

function formatEventTime(value: unknown, locale: Locale) {
  if (typeof value !== 'string' || !value) {
    return '—';
  }
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');
}

function eventTimeMs(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getTime();
}

export default function SolarSystemExperience() {
  const currentTimeMs = useViewerStore((state) => state.currentTimeMs);
  const isPlaying = useViewerStore((state) => state.isPlaying);
  const playbackSpeed = useViewerStore((state) => state.playbackSpeed);
  const selectedBodyId = useViewerStore((state) => state.selectedBodyId);
  const activePreset = useViewerStore((state) => state.activePreset);
  const interfaceMode = useViewerStore((state) => state.interfaceMode);
  const layers = useViewerStore((state) => state.layers);
  const chatHistory = useViewerStore((state) => state.chatHistory);
  const setCurrentTime = useViewerStore((state) => state.setCurrentTime);
  const advanceTime = useViewerStore((state) => state.advanceTime);
  const setPlayback = useViewerStore((state) => state.setPlayback);
  const setSelectedBodyId = useViewerStore((state) => state.setSelectedBodyId);
  const setActivePreset = useViewerStore((state) => state.setActivePreset);
  const setInterfaceMode = useViewerStore((state) => state.setInterfaceMode);
  const toggleLayer = useViewerStore((state) => state.toggleLayer);
  const setController = useViewerStore((state) => state.setController);
  const pushChatMessage = useViewerStore((state) => state.pushChatMessage);

  const [locale, setLocale] = useState<Locale>('en');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [layerCatalog, setLayerCatalog] = useState<LayerDescriptor[]>([]);
  const [bodies, setBodies] = useState<CelestialBodyDescriptor[]>([]);
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [commandBusy, setCommandBusy] = useState(false);
  const [citations, setCitations] = useState<AgentCitation[]>([]);
  const [artifacts, setArtifacts] = useState<AgentArtifact[]>([]);
  const [spaceWeather, setSpaceWeather] = useState<SpaceWeatherData | null>(null);
  const [smallBodyEvents, setSmallBodyEvents] = useState<SmallBodyEvent[]>([]);
  const [smallBodyWindow, setSmallBodyWindow] = useState<{ startIso: string; stopIso: string } | null>(null);
  const [smallBodyFilter, setSmallBodyFilter] = useState<SmallBodyWindowFilter>('7d');
  const [selectedSmallBodyIndex, setSelectedSmallBodyIndex] = useState<number | null>(null);

  const activeBodyIds = useMemo(
    () => buildActiveBodyIds(activePreset, selectedBodyId, layers.majorMoons),
    [activePreset, layers.majorMoons, selectedBodyId]
  );
  const activeBodyIdsKey = useMemo(() => activeBodyIds.join(':'), [activeBodyIds]);

  const dict = I18N[locale];

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') {
      setLocale(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    setController({
      flyTo: () => undefined,
      focusBody: (bodyId) => setSelectedBodyId(bodyId),
      setViewPreset: (presetId) => setActivePreset(presetId)
    });
    return () => setController(null);
  }, [setActivePreset, setController, setSelectedBodyId]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const interval = window.setInterval(() => {
      advanceTime((TICK_MS / 1000) * playbackSpeed * 1000);
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [advanceTime, isPlaying, playbackSpeed]);

  const loadStaticResources = useCallback(async () => {
    const [providersResponse, layersResponse, bodiesResponse] = await Promise.all([
      fetch('/api/providers'),
      fetch('/api/layers'),
      fetch('/api/bodies')
    ]);

    if (!providersResponse.ok || !layersResponse.ok || !bodiesResponse.ok) {
      throw new Error('Unable to load Solar System resources');
    }

    const providersPayload = (await providersResponse.json()) as {
      providers: ProviderDescriptor[];
    };
    const layersPayload = (await layersResponse.json()) as {
      layers: LayerDescriptor[];
    };
    const bodiesPayload = (await bodiesResponse.json()) as {
      bodies: CelestialBodyDescriptor[];
    };

    startTransition(() => {
      setProviders(providersPayload.providers);
      setLayerCatalog(layersPayload.layers);
      setBodies(bodiesPayload.bodies);
    });
  }, []);

  const loadSnapshot = useCallback(async () => {
    setSnapshotBusy(true);
    setSnapshotError(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kind: 'system_snapshot',
          bodyIds: activeBodyIds,
          epochIso: new Date(currentTimeMs).toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Unable to fetch Solar System snapshot');
      }

      const payload = (await response.json()) as {
        data: SystemSnapshot;
      };
      startTransition(() => setSnapshot(payload.data));
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : 'Snapshot query failed');
    } finally {
      setSnapshotBusy(false);
    }
  }, [activeBodyIds, currentTimeMs]);

  const loadSpaceWeather = useCallback(async () => {
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kind: 'space_weather_current'
        })
      });
      if (!response.ok) {
        throw new Error('Unable to fetch space weather');
      }
      const payload = (await response.json()) as {
        data: SpaceWeatherData;
      };
      startTransition(() => setSpaceWeather(payload.data));
    } catch {
      // Keep the previous SWPC payload when the request fails.
    }
  }, []);

  const loadSmallBodyEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          kind: 'small_body_events',
          maxResults: 24
        })
      });

      if (!response.ok) {
        throw new Error('Unable to fetch small body events');
      }

      const payload = (await response.json()) as {
        data: SmallBodyEventsResponse & {
          window?: {
            startIso?: string;
            stopIso?: string;
          };
        };
      };

      startTransition(() => {
        setSmallBodyEvents(payload.data.closeApproaches ?? []);
        if (payload.data.window?.startIso && payload.data.window?.stopIso) {
          setSmallBodyWindow({
            startIso: payload.data.window.startIso,
            stopIso: payload.data.window.stopIso
          });
        }
      });
    } catch {
      // Keep previous feed.
    }
  }, []);

  useEffect(() => {
    loadStaticResources().catch(() => undefined);
    loadSnapshot().catch(() => undefined);
    loadSpaceWeather().catch(() => undefined);
    loadSmallBodyEvents().catch(() => undefined);
  }, [loadSmallBodyEvents, loadSnapshot, loadSpaceWeather, loadStaticResources]);

  useEffect(() => {
    loadSnapshot().catch(() => undefined);
  }, [activeBodyIdsKey, activePreset, loadSnapshot]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadSnapshot().catch(() => undefined);
    }, SNAPSHOT_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadSnapshot]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadSpaceWeather().catch(() => undefined);
    }, SPACE_WEATHER_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadSpaceWeather]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadSmallBodyEvents().catch(() => undefined);
    }, SMALL_BODIES_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [loadSmallBodyEvents]);

  const bodiesById = useMemo(() => new Map(bodies.map((body) => [body.id, body])), [bodies]);

  const projectedSnapshot = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const snapshotEpochMs = Date.parse(snapshot.epochIso);
    const dtSeconds = (currentTimeMs - snapshotEpochMs) / 1000;

    return snapshot.bodies
      .map((body) => {
        const metadata = bodiesById.get(body.bodyId);
        if (!metadata) {
          return null;
        }

        const positionKm = {
          x: body.positionKm.x + body.velocityKmS.x * dtSeconds,
          y: body.positionKm.y + body.velocityKmS.y * dtSeconds,
          z: body.positionKm.z + body.velocityKmS.z * dtSeconds
        };
        const positionAu = {
          x: positionKm.x / AU_IN_KM,
          y: positionKm.y / AU_IN_KM,
          z: positionKm.z / AU_IN_KM
        };

        return {
          ...body,
          positionKm,
          positionAu,
          distanceFromSunAu: Math.sqrt(positionAu.x ** 2 + positionAu.y ** 2 + positionAu.z ** 2),
          metadata
        };
      })
      .filter((body): body is BodyStateVector & { metadata: CelestialBodyDescriptor } => Boolean(body));
  }, [bodiesById, currentTimeMs, snapshot]);

  const selectedBody = useMemo(
    () =>
      projectedSnapshot.find((body) => body.bodyId === selectedBodyId) ??
      projectedSnapshot.find((body) => body.bodyId === 'earth') ??
      projectedSnapshot[0] ??
      null,
    [projectedSnapshot, selectedBodyId]
  );

  const sourceSummary = useMemo(() => snapshotSourceSummary(projectedSnapshot), [projectedSnapshot]);

  const filteredSmallBodyEvents = useMemo(() => {
    const nowMs = currentTimeMs;
    const horizonMs =
      smallBodyFilter === '24h'
        ? 24 * 60 * 60 * 1000
        : smallBodyFilter === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

    return smallBodyEvents.filter((event) => {
      const timeMs = eventTimeMs(event.closeApproachTimeUtc);
      if (timeMs === null) {
        return false;
      }
      return timeMs >= nowMs && timeMs <= nowMs + horizonMs;
    });
  }, [currentTimeMs, smallBodyEvents, smallBodyFilter]);

  const renderedSmallBodyEvents = useMemo(() => filteredSmallBodyEvents.slice(0, 12), [filteredSmallBodyEvents]);

  useEffect(() => {
    if (selectedSmallBodyIndex === null) {
      return;
    }
    if (!renderedSmallBodyEvents[selectedSmallBodyIndex]) {
      setSelectedSmallBodyIndex(null);
    }
  }, [renderedSmallBodyEvents, selectedSmallBodyIndex]);

  const runAgentPrompt = useCallback(
    async (prompt: string) => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        return;
      }

      setCommandBusy(true);
      const historyBeforeMessage = useViewerStore.getState().chatHistory;
      const userMessage: AgentMessage = {
        role: 'user',
        content: trimmedPrompt
      };
      startTransition(() => pushChatMessage(userMessage));

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [...historyBeforeMessage, userMessage],
            context: {
              simulationTimeIso: new Date(currentTimeMs).toISOString(),
              inertialMode: false,
              selectedLocation: null,
              selectedBodyId,
              activePreset,
              interfaceMode,
              layers
            }
          })
        });

        const payload = (await response.json()) as AgentResponsePayload & {
          providerSnapshot?: ProviderDescriptor[];
        };

        if (payload.actions.length) {
          applyClientActions(payload.actions);
        }

        startTransition(() => {
          pushChatMessage({
            role: 'assistant',
            content: payload.reply
          });
          setCitations((current) => dedupeCitations([...current, ...(payload.citations ?? [])]) as AgentCitation[]);
          setArtifacts(payload.artifacts ?? []);
          if (payload.providerSnapshot) {
            setProviders(payload.providerSnapshot);
          }
        });
      } finally {
        setCommandBusy(false);
      }
    },
    [activePreset, currentTimeMs, interfaceMode, layers, pushChatMessage, selectedBodyId]
  );

  const sendCommand = async () => {
    const prompt = command.trim();
    if (!prompt) {
      return;
    }
    setCommand('');
    await runAgentPrompt(prompt);
  };

  const selectSmallBodyEvent = useCallback(
    async (eventIndex: number) => {
      const event = renderedSmallBodyEvents[eventIndex];
      if (!event) {
        return;
      }
      setSelectedSmallBodyIndex(eventIndex);

      if (commandBusy) {
        return;
      }

      const designation = typeof event.designation === 'string' ? event.designation : `NEO-${eventIndex + 1}`;
      const prompt =
        locale === 'zh'
          ? `请分析这个近地小天体事件并给出风险解释与观测建议：名称 ${designation}，接近时刻 ${String(
              event.closeApproachTimeUtc ?? '未知'
            )}，掠过距离(AU) ${String(event.missDistanceAu ?? '未知')}，相对速度(km/s) ${String(
              event.relativeVelocityKmS ?? '未知'
            )}。同时建议是否切换视角或图层。`
          : `Analyze this near-Earth small-body event with risk context and observation advice: designation ${designation}, close approach time ${String(
              event.closeApproachTimeUtc ?? 'unknown'
            )}, miss distance (AU) ${String(event.missDistanceAu ?? 'unknown')}, relative velocity (km/s) ${String(
              event.relativeVelocityKmS ?? 'unknown'
            )}. Also suggest camera preset or layer changes if useful.`;

      await runAgentPrompt(prompt);
    },
    [commandBusy, locale, renderedSmallBodyEvents, runAgentPrompt]
  );

  return (
    <div className={`solarStage ${sidebarCollapsed ? 'sidebarCollapsed' : ''} ${interfaceMode === 'analysis' ? 'analysisMode' : 'exploreMode'}`}>
      <aside className="solarSidebar">
        <div className="solarTopbar">
          <div className="langSwitch">
            {(['en', 'zh'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`langBtn ${locale === item ? 'active' : ''}`}
                onClick={() => setLocale(item)}
                aria-label={`${dict.language}: ${item}`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" className="sidebarToggle" onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? dict.expand : dict.collapse}
          </button>
        </div>

        <section className="heroCard">
          <p className="eyebrow">{dict.eyebrow}</p>
          <h1>{dict.title}</h1>
          <p className="heroCopy">{dict.hero}</p>

          <div className="modeSwitch">
            {(['explore', 'analysis'] as const satisfies readonly InterfaceMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={interfaceMode === mode ? 'modeBtn active' : 'modeBtn'}
                onClick={() => setInterfaceMode(mode)}
              >
                {mode === 'explore' ? dict.explore : dict.analysis}
              </button>
            ))}
          </div>
        </section>

        <section className="infoPanel">
          <div className="panelHeader">
            <span>{dict.viewPreset}</span>
            <strong>{presetLabel(locale, activePreset)}</strong>
          </div>
          <div className="presetGrid solarPresetGrid">
            {(['inner', 'outer', 'full', 'earthMoon'] as const satisfies readonly SolarViewPresetId[]).map((preset) => (
              <button
                key={preset}
                type="button"
                className={activePreset === preset ? 'panelPill active' : 'panelPill'}
                onClick={() => setActivePreset(preset)}
              >
                <strong>{presetLabel(locale, preset)}</strong>
                <span>{presetDescription(locale, preset)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="infoPanel">
          <div className="panelHeader">
            <span>{dict.simulationClock}</span>
            <strong>{new Date(currentTimeMs).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</strong>
          </div>
          <div className="buttonRow clockRow solarClockRow">
            <button type="button" onClick={() => setCurrentTime(Date.now())}>
              {dict.now}
            </button>
            <button type="button" onClick={() => setPlayback(!isPlaying, playbackSpeed)}>
              {isPlaying ? dict.pause : dict.resume}
            </button>
            {SPEED_OPTIONS.map((speed) => (
              <button key={speed} type="button" onClick={() => setPlayback(true, speed)}>
                {speed.toLocaleString()}x
              </button>
            ))}
          </div>
          <p className="hintText">{dict.layersHint}</p>
        </section>

        <section className="infoPanel">
          <div className="panelHeader">
            <span>{dict.bodyDirectory}</span>
            <strong>{bodies.length}</strong>
          </div>
          <div className="bodyList">
            {bodies.map((body) => (
              <button
                key={body.id}
                type="button"
                className={selectedBodyId === body.id ? 'bodyListItem active' : 'bodyListItem'}
                onClick={() => setSelectedBodyId(body.id)}
              >
                <span className="bodySwatch" style={{ background: body.color }} />
                <strong>{body.name}</strong>
                <small>{body.category}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="infoPanel">
          <div className="panelHeader">
            <span>{dict.visibleLayers}</span>
            <strong>{layerCatalog.length}</strong>
          </div>
          <div className="toggleGrid solarToggleGrid">
            {LAYER_TOGGLES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={layers[item.id] ? 'panelPill active compact' : 'panelPill compact'}
                onClick={() => toggleLayer(item.id)}
              >
                {locale === 'zh' ? item.label.zh : item.label.en}
              </button>
            ))}
          </div>
        </section>

        <section className="infoPanel">
          <div className="panelHeader">
            <span>{dict.dataProviders}</span>
            <strong>{providers.length}</strong>
          </div>
          <div className="providerList">
            {providers.map((provider) => (
              <div key={provider.id} className="providerRow">
                <div>
                  <strong>{provider.name}</strong>
                  <span>
                    {statusLabel(provider.status, locale)}
                    {provider.optional ? ` · ${dict.providerOptional}` : ''}
                  </span>
                </div>
                {provider.reason ? <small>{provider.reason}</small> : null}
              </div>
            ))}
          </div>
        </section>
      </aside>

      <main className="solarMain">
        <section className="solarViewerFrame">
          <div className="solarViewerHeader">
            <div>
              <span>{dict.snapshotEpoch}</span>
              <strong>{snapshot ? new Date(snapshot.epochIso).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US') : dict.noSnapshot}</strong>
            </div>
            <div className="viewerBadges">
              <span>{dict.bodiesTracked}: {projectedSnapshot.length}</span>
              {layers.smallBodies ? <span>{dict.smallBodyEvents}: {filteredSmallBodyEvents.length}</span> : null}
              {snapshotBusy ? <span>{dict.thinking}</span> : null}
              {snapshotError ? <span>{snapshotError}</span> : null}
            </div>
          </div>

          <div className={`solarMapWrap preset-${activePreset}`}>
            <SolarSystemCesiumScene
              bodies={projectedSnapshot}
              catalog={bodies}
              selectedBodyId={selectedBody?.bodyId ?? null}
              preset={activePreset}
              layers={layers}
              smallBodyEvents={renderedSmallBodyEvents}
              selectedSmallBodyIndex={selectedSmallBodyIndex}
              onSelectBody={setSelectedBodyId}
              onSelectSmallBody={(eventIndex) => {
                selectSmallBodyEvent(eventIndex).catch(() => undefined);
              }}
            />

            <div className="viewerOverlayCard topLeft">
              <span>{dict.bodyFocus}</span>
              <strong>{selectedBody?.metadata.name ?? '—'}</strong>
              <small>{selectedBody?.metadata.summary ?? ''}</small>
            </div>

            <div className="viewerOverlayCard topRight">
              <span>{dict.sourceState}</span>
              <strong>
                {dict.live} {sourceSummary.jpl_horizons} · {dict.cached} {sourceSummary.cached_horizons} · {dict.local} {sourceSummary.local_spice} · {dict.fallback}{' '}
                {sourceSummary.fallback_model}
              </strong>
              {activePreset === 'earthMoon' ? <small>{dict.moonModeHint}</small> : null}
            </div>
          </div>

          <div className="solarStatsGrid">
            {selectedBody ? (
              <>
                <article className="metricCard">
                  <span>{dict.selectedBody}</span>
                  <strong>{selectedBody.metadata.name}</strong>
                  <small>{selectedBody.metadata.category}</small>
                </article>
                <article className="metricCard">
                  <span>{dict.heliocentricDistance}</span>
                  <strong>{number(selectedBody.distanceFromSunAu, 4)} AU</strong>
                  <small>{selectedBody.source}</small>
                </article>
                <article className="metricCard">
                  <span>{dict.radius}</span>
                  <strong>{number(selectedBody.metadata.radiusKm, 0)} km</strong>
                  <small>{dict.tilt}: {degrees(selectedBody.metadata.axialTiltDeg)}</small>
                </article>
                <article className="metricCard">
                  <span>{dict.orbitPeriod}</span>
                  <strong>{days(selectedBody.metadata.orbitalPeriodDays)}</strong>
                  <small>{dict.rotation}: {hours(selectedBody.metadata.rotationPeriodHours)}</small>
                </article>
              </>
            ) : null}
          </div>
        </section>

        <aside className="analysisRail">
          <section className="infoPanel">
            <div className="panelHeader">
              <span>{dict.analysisDesk}</span>
              <strong>{dict.commandConsole}</strong>
            </div>
            <textarea
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder={dict.askPlaceholder}
            />
            <div className="buttonRow">
              <button type="button" onClick={sendCommand} disabled={commandBusy}>
                {commandBusy ? dict.thinking : dict.runAnalysis}
              </button>
            </div>
            <div className="chatTranscript">
              {chatHistory.length === 0 ? <p className="hintText">{dict.noReply}</p> : null}
              {chatHistory.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`chatBubble ${message.role}`}>
                  <span>{message.role === 'user' ? 'USER' : 'AGENT'}</span>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="infoPanel">
            <div className="panelHeader">
              <span>{dict.spaceWeather}</span>
              <strong>
                {spaceWeather?.latestKp?.kpIndex !== null && spaceWeather?.latestKp?.kpIndex !== undefined
                  ? number(spaceWeather.latestKp.kpIndex, 2)
                  : dict.latestKpUnknown}
              </strong>
            </div>
            <div className="metricList">
              <div>
                <span>{dict.currentKp}</span>
                <strong>
                  {spaceWeather?.latestKp?.kpIndex !== null && spaceWeather?.latestKp?.kpIndex !== undefined
                    ? number(spaceWeather.latestKp.kpIndex, 2)
                    : '—'}
                </strong>
                <small>{spaceWeather?.latestKp?.timeTag ?? ''}</small>
              </div>
              <div>
                <span>{dict.solarProbabilities}</span>
                <strong>{describeSolarProbabilities(spaceWeather?.solarProbabilities)}</strong>
              </div>
            </div>
          </section>

          <section className="infoPanel">
            <div className="panelHeader">
              <span>{dict.smallBodyEvents}</span>
              <strong>{filteredSmallBodyEvents.length}</strong>
            </div>
            {smallBodyWindow ? (
              <p className="hintText">
                {dict.smallBodyWindow}: {smallBodyWindow.startIso} → {smallBodyWindow.stopIso}
              </p>
            ) : null}
            <div className="smallBodyFilterRow">
              {SMALL_BODY_FILTER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={smallBodyFilter === option ? 'panelPill active compact' : 'panelPill compact'}
                  onClick={() => {
                    setSmallBodyFilter(option);
                    setSelectedSmallBodyIndex(null);
                  }}
                >
                  {option === '24h' ? dict.filter24h : option === '7d' ? dict.filter7d : dict.filter30d}
                </button>
              ))}
            </div>
            <p className="hintText">{dict.smallBodyHint}</p>
            <div className="smallBodyList">
              {renderedSmallBodyEvents.length === 0 ? <p className="hintText">{dict.noSmallBodies}</p> : null}
              {renderedSmallBodyEvents.map((event, index) => {
                const designation = typeof event.designation === 'string' ? event.designation : `${dict.unknown} #${index + 1}`;
                const missDistanceValue = Number(event.missDistanceAu);
                const relVelocityValue = Number(event.relativeVelocityKmS);
                return (
                  <article
                    key={`${designation}-${index}`}
                    className={selectedSmallBodyIndex === index ? 'smallBodyRow active' : 'smallBodyRow'}
                    onClick={() => {
                      selectSmallBodyEvent(index).catch(() => undefined);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(eventKey) => {
                      if (eventKey.key === 'Enter' || eventKey.key === ' ') {
                        eventKey.preventDefault();
                        selectSmallBodyEvent(index).catch(() => undefined);
                      }
                    }}
                  >
                    <strong>{designation}</strong>
                    {commandBusy && selectedSmallBodyIndex === index ? <small>{dict.autoAnalyzing}</small> : null}
                    <div className="smallBodyMeta">
                      <span>{dict.closeApproach}</span>
                      <strong>{formatEventTime(event.closeApproachTimeUtc, locale)}</strong>
                    </div>
                    <div className="smallBodyMeta">
                      <span>{dict.missDistance}</span>
                      <strong>{Number.isFinite(missDistanceValue) ? `${number(missDistanceValue, 5)} AU` : '—'}</strong>
                    </div>
                    <div className="smallBodyMeta">
                      <span>{dict.relVelocity}</span>
                      <strong>{Number.isFinite(relVelocityValue) ? `${number(relVelocityValue, 2)} km/s` : '—'}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="infoPanel">
            <div className="panelHeader">
              <span>{dict.observerNote}</span>
              <strong>{selectedBody?.metadata.name ?? '—'}</strong>
            </div>
            {selectedBody ? (
              <div className="detailStack">
                <p>{selectedBody.metadata.summary}</p>
                <div className="detailRows">
                  <div>
                    <span>{dict.heliocentricDistance}</span>
                    <strong>{number(selectedBody.distanceFromSunAu, 4)} AU</strong>
                  </div>
                  <div>
                    <span>{dict.radius}</span>
                    <strong>{number(selectedBody.metadata.radiusKm, 0)} km</strong>
                  </div>
                  <div>
                    <span>{dict.orbitPeriod}</span>
                    <strong>{days(selectedBody.metadata.orbitalPeriodDays)}</strong>
                  </div>
                  <div>
                    <span>{dict.rotation}</span>
                    <strong>{hours(selectedBody.metadata.rotationPeriodHours)}</strong>
                  </div>
                </div>
                <div className="surfaceLayerList">
                  <span>{dict.surfaceRefs}</span>
                  {selectedBody.metadata.surfaceLayers?.length ? (
                    selectedBody.metadata.surfaceLayers.map((layer) => (
                      <a key={layer.id} href={layer.url} target="_blank" rel="noreferrer" className="surfaceLayerLink">
                        <strong>{layer.label}</strong>
                        <small>{layer.description}</small>
                      </a>
                    ))
                  ) : (
                    <p className="hintText">{dict.noSurfaceRefs}</p>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <section className="infoPanel">
            <div className="panelHeader">
              <span>{dict.citations}</span>
              <strong>{citations.length}</strong>
            </div>
            <div className="citationList">
              {citations.map((item, index) => (
                <a key={`${item.providerId}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="citationRow">
                  <strong>{item.title}</strong>
                  <small>{item.providerId}</small>
                </a>
              ))}
            </div>
          </section>

          <section className="infoPanel">
            <div className="panelHeader">
              <span>{dict.artifacts}</span>
              <strong>{artifacts.length}</strong>
            </div>
            <div className="artifactList">
              {artifacts.map((artifact, index) => (
                <div key={`${artifact.kind}-${index}`} className="artifactCard">
                  <strong>{artifact.title}</strong>
                  <small>{artifact.kind}</small>
                  <pre>{artifact.content}</pre>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
