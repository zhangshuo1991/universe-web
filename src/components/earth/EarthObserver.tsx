'use client';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { applyClientActions } from '@/agent/applyClientActions';
import CesiumViewer from '@/components/earth/CesiumViewer';
import { ExplorerSidebar } from '@/components/earth/ExplorerSidebar';
import type { SidebarSection } from '@/components/earth/ExplorerSidebar';
import { ViewerHUD } from '@/components/earth/ViewerHUD';
import { ExploreChatDrawer } from '@/components/earth/panels/ExploreChatDrawer';
import { LocationDigestPanel } from '@/components/earth/panels/LocationDigestPanel';
import { PlaceSearch } from '@/components/earth/PlaceSearch';
import { GlobeControls } from '@/components/earth/GlobeControls';
import { FEATURED_LANDMARKS } from '@/data/landmarks';
import { useViewerStore } from '@/store/viewerStore';
import type { SelectedLocation } from '@/store/viewerStore';
import { getEarthState } from '@/simulation/astronomy';
import type { Landmark, LocationDigest, LocationHotspot, LocationHotspotResponse } from '@/types/explorer';
import type { AgentMessage, AgentResponsePayload } from '@/types/agent';
import type { ProviderDescriptor } from '@/types/observation';

const TICK_MS = 100;
const SATELLITE_REFRESH_MS = 15 * 60_000;
const EARTHQUAKE_REFRESH_MS = 5 * 60_000;

const SAT_CATEGORY_MAP: Record<number, 'stations' | 'weather' | 'science'> = {
  25544: 'stations',
  48274: 'stations',
  43013: 'weather',
  33591: 'weather',
  37849: 'weather',
  20580: 'science',
  25994: 'science',
  27424: 'science'
};

const GLOBAL_VIEW = {
  lat: 18,
  lon: 15,
  altitude: 24_000_000,
  heading: 4,
  pitch: -85
};

export default function EarthObserver() {
  const currentTimeMs = useViewerStore((s) => s.currentTimeMs);
  const isPlaying = useViewerStore((s) => s.isPlaying);
  const playbackSpeed = useViewerStore((s) => s.playbackSpeed);
  const inertialMode = useViewerStore((s) => s.inertialMode);
  const layers = useViewerStore((s) => s.layers);
  const annotations = useViewerStore((s) => s.annotations);
  const routePreview = useViewerStore((s) => s.routePreview);
  const controller = useViewerStore((s) => s.controller);
  const selectedLocation = useViewerStore((s) => s.selectedLocation);
  const locationDigest = useViewerStore((s) => s.locationDigest);
  const locationLoading = useViewerStore((s) => s.locationLoading);
  const locationHotspots = useViewerStore((s) => s.locationHotspots);
  const locationHotspotsLoading = useViewerStore((s) => s.locationHotspotsLoading);
  const satellites = useViewerStore((s) => s.satellites);
  const satelliteCategories = useViewerStore((s) => s.satelliteCategories);
  const earthquakes = useViewerStore((s) => s.earthquakes);
  const advanceTime = useViewerStore((s) => s.advanceTime);
  const setController = useViewerStore((s) => s.setController);
  const setSelectedLocation = useViewerStore((s) => s.setSelectedLocation);
  const setLocationData = useViewerStore((s) => s.setLocationData);
  const setLocationDigest = useViewerStore((s) => s.setLocationDigest);
  const setLocationLoading = useViewerStore((s) => s.setLocationLoading);
  const setLocationHotspots = useViewerStore((s) => s.setLocationHotspots);
  const setLocationHotspotsLoading = useViewerStore((s) => s.setLocationHotspotsLoading);
  const setSatellites = useViewerStore((s) => s.setSatellites);
  const setEarthquakes = useViewerStore((s) => s.setEarthquakes);
  const pushChatMessage = useViewerStore((s) => s.pushChatMessage);
  const toggleLayer = useViewerStore((s) => s.toggleLayer);
  const toggleSatelliteCategory = useViewerStore((s) => s.toggleSatelliteCategory);
  const clearRoutePreview = useViewerStore((s) => s.clearRoutePreview);

  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [commandBusy, setCommandBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<SidebarSection>('explore');
  const [bottomSheetState, setBottomSheetState] = useState<'collapsed' | 'half' | 'full'>('collapsed');
  const [hotspotMarkersEnabled, setHotspotMarkersEnabled] = useState(true);
  const commandBusyRef = useRef(false);

  const earthStateTimeMs = Math.floor(currentTimeMs / 1000) * 1000;
  const earthState = useMemo(() => getEarthState(new Date(earthStateTimeMs)), [earthStateTimeMs]);

  const filteredSatellites = useMemo(
    () => satellites.filter((sat) => {
      const category = SAT_CATEGORY_MAP[sat.catnr];
      return !category || satelliteCategories[category];
    }),
    [satellites, satelliteCategories]
  );

  const loadProviders = useCallback(() => {
    fetch('/api/providers')
      .then((response) => response.json())
      .then((data: { providers: ProviderDescriptor[] }) => {
        startTransition(() => setProviders(data.providers));
      })
      .catch(() => {
        startTransition(() => setProviders([]));
      });
  }, []);

  const loadLocationHotspots = useCallback(() => {
    startTransition(() => setLocationHotspotsLoading(true));
    fetch('/api/location-hotspots')
      .then((response) => response.json())
      .then((data: LocationHotspotResponse) => {
        const merged = [...data.trendingHubs, ...data.featuredHubs, ...data.recommendedHubs]
          .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
          .sort((a, b) => b.score - a.score);
        startTransition(() => setLocationHotspots(merged));
      })
      .catch(() => {
        startTransition(() => setLocationHotspots([]));
      })
      .finally(() => {
        startTransition(() => setLocationHotspotsLoading(false));
      });
  }, [setLocationHotspots, setLocationHotspotsLoading]);

  const loadSatellites = useCallback(() => {
    fetch('/api/satellites')
      .then((response) => response.json())
      .then((data: { satellites: import('@/server/satellites').SatelliteFeedItem[] }) => {
        startTransition(() => setSatellites(data.satellites));
      })
      .catch(() => {
        startTransition(() => setSatellites([]));
      });
  }, [setSatellites]);

  const loadEarthquakes = useCallback(() => {
    fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'earthquakes_recent', maxResults: 40 })
    })
      .then((response) => response.json())
      .then((data: { data: { events?: Array<{ id: string; magnitude: number | null; place: string; timeIso: string | null; coordinates: number[] }> } }) => {
        const events = (data.data.events ?? [])
          .filter((event) => event.magnitude != null && event.coordinates.length >= 2)
          .map((event) => ({
            id: event.id,
            lat: event.coordinates[1],
            lon: event.coordinates[0],
            depth: event.coordinates[2] ?? 0,
            magnitude: event.magnitude!,
            place: event.place,
            time: event.timeIso ?? ''
          }));

        startTransition(() => setEarthquakes(events));
      })
      .catch(() => {
        startTransition(() => setEarthquakes([]));
      });
  }, [setEarthquakes]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = window.setInterval(() => {
      advanceTime((TICK_MS / 1000) * playbackSpeed * 1000);
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [advanceTime, isPlaying, playbackSpeed]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (locationHotspots.length > 0 || locationHotspotsLoading) {
      return;
    }

    loadLocationHotspots();
  }, [loadLocationHotspots, locationHotspots.length, locationHotspotsLoading]);

  useEffect(() => {
    if (!layers.satellites) return;

    loadSatellites();
    const interval = window.setInterval(loadSatellites, SATELLITE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [layers.satellites, loadSatellites]);

  useEffect(() => {
    if (!layers.earthquakes) return;

    loadEarthquakes();
    const interval = window.setInterval(loadEarthquakes, EARTHQUAKE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [layers.earthquakes, loadEarthquakes]);

  const sendAgentMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || commandBusyRef.current) return;

      commandBusyRef.current = true;
      setCommandBusy(true);

      const state = useViewerStore.getState();
      const historyBefore = state.chatHistory.slice(-12);
      const userMessage: AgentMessage = { role: 'user', content: trimmed };

      startTransition(() => {
        pushChatMessage(userMessage);
      });

      const contextualPrompt = buildContextualPrompt(trimmed, state.selectedLocation, state.locationDigest);

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...historyBefore, { role: 'user', content: contextualPrompt }],
            context: {
              simulationTimeIso: new Date(state.currentTimeMs).toISOString(),
              inertialMode: state.inertialMode,
              selectedLocation: state.selectedLocation,
              selectedBodyId: state.selectedBodyId,
              activePreset: state.activePreset,
              interfaceMode: state.interfaceMode,
              layers: state.layers
            }
          })
        });

        const payload = (await response.json()) as AgentResponsePayload & {
          providerSnapshot?: ProviderDescriptor[];
        };

        if (payload.actions?.length) {
          applyClientActions(payload.actions);
        }

        startTransition(() => {
          pushChatMessage({
            role: 'assistant',
            content: payload.reply
          });
          if (payload.providerSnapshot) {
            setProviders(payload.providerSnapshot);
          }
        });
      } catch (error) {
        startTransition(() => {
          pushChatMessage({
            role: 'assistant',
            content: `分析出错: ${error instanceof Error ? error.message : '网络请求失败'}`
          });
        });
      } finally {
        commandBusyRef.current = false;
        setCommandBusy(false);
      }
    },
    [pushChatMessage]
  );

  const requestLocationDigest = useCallback(
    async (
      lat: number,
      lon: number,
      options?: {
        landmark?: Landmark | null;
        placeName?: string | null;
      }
    ) => {
      const landmark = options?.landmark ?? null;
      const placeName = options?.placeName ?? null;

      startTransition(() => {
        setSelectedLocation({
          lat,
          lon,
          label: landmark?.name ?? placeName ?? formatCoordLabel(lat, lon),
          landmarkId: landmark?.id ?? null,
          kind: landmark ? 'landmark' : placeName ? 'region' : 'coordinate',
          region: landmark?.regionName ?? null,
          country: landmark?.country ?? null,
          description: landmark?.description ?? null,
          cameraAltitude: landmark?.cameraAltitude
        });
        setLocationData(null);
        setLocationDigest(null);
        setLocationLoading(true);
      });

      try {
        const response = await fetch('/api/location-digest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lon,
            landmarkId: landmark?.id ?? null,
            placeName: landmark?.name ?? placeName ?? null
          })
        });

        if (!response.ok) {
          throw new Error(`Location digest failed with status ${response.status}`);
        }

        const digest = (await response.json()) as LocationDigest;

        startTransition(() => {
          setSelectedLocation({
            lat: digest.location.lat,
            lon: digest.location.lon,
            label: digest.location.name,
            landmarkId: digest.location.landmarkId ?? null,
            kind: digest.location.kind,
            region: digest.location.region,
            country: digest.location.country,
            description: digest.location.description,
            cameraAltitude: landmark?.cameraAltitude
          });
          setLocationDigest(digest);
        });
      } catch {
        startTransition(() => {
          setLocationDigest(null);
        });
      } finally {
        startTransition(() => {
          setLocationLoading(false);
        });
      }
    },
    [setLocationData, setLocationDigest, setLocationLoading, setSelectedLocation]
  );

  const handleLandmarkSelect = useCallback(
    (landmark: Landmark) => {
      setActiveSection('explore');
      setBottomSheetState('half');
      controller?.flyTo({
        lat: landmark.lat,
        lon: landmark.lon,
        altitude: landmark.cameraAltitude,
        pitch: -56,
        label: landmark.name
      });
      clearRoutePreview();
      void requestLocationDigest(landmark.lat, landmark.lon, { landmark });
    },
    [clearRoutePreview, controller, requestLocationDigest]
  );

  const handleLocationClick = useCallback(
    (lat: number, lon: number) => {
      clearRoutePreview();
      void requestLocationDigest(lat, lon);
    },
    [clearRoutePreview, requestLocationDigest]
  );

  const handleClearSelection = useCallback(() => {
    startTransition(() => {
      setSelectedLocation(null);
      setLocationDigest(null);
      setLocationLoading(false);
    });
    clearRoutePreview();
    setBottomSheetState('collapsed');
    controller?.flyTo(GLOBAL_VIEW);
  }, [clearRoutePreview, controller, setLocationDigest, setLocationLoading, setSelectedLocation]);

  const handlePlaceSelect = useCallback(
    (lat: number, lon: number, label: string) => {
      controller?.flyTo({ lat, lon, altitude: 800_000, pitch: -56, label });
      setBottomSheetState('half');
      clearRoutePreview();
      void requestLocationDigest(lat, lon, { placeName: label });
    },
    [clearRoutePreview, controller, requestLocationDigest]
  );

  const handleHotspotSelect = useCallback(
    (hotspot: LocationHotspot) => {
      setActiveSection('highlights');
      setBottomSheetState('half');
      controller?.flyTo({
        lat: hotspot.lat,
        lon: hotspot.lon,
        altitude: 1_800_000,
        pitch: -58,
        label: hotspot.name
      });
      clearRoutePreview();
      void requestLocationDigest(hotspot.lat, hotspot.lon, { placeName: hotspot.name });
    },
    [clearRoutePreview, controller, requestLocationDigest]
  );

  const handleSectionChange = useCallback(
    (section: SidebarSection) => {
      setActiveSection(section);
      if (section === 'explore') {
        setBottomSheetState('collapsed');
        startTransition(() => {
          setSelectedLocation(null);
          setLocationDigest(null);
          setLocationLoading(false);
        });
        clearRoutePreview();
        controller?.flyTo(GLOBAL_VIEW);
      } else {
        setBottomSheetState('half');
      }
    },
    [clearRoutePreview, controller, setLocationDigest, setLocationLoading, setSelectedLocation]
  );

  const handleLocateMoon = useCallback(() => {
    controller?.locateMoon?.();
  }, [controller]);

  const handleLocateSatellite = useCallback(
    (catnr: number) => {
      controller?.locateSatellite?.(catnr);
    },
    [controller]
  );

  const handleLocateObject = useCallback(
    (objectId: string) => {
      const setObjectSelected = (label: string, description: string) => {
        startTransition(() => {
          setSelectedLocation({
            lat: 0,
            lon: 0,
            label,
            kind: 'space-object',
            description
          });
          setLocationDigest(null);
          setLocationLoading(false);
        });
        setBottomSheetState('half');
      };

      if (objectId === 'moon') {
        if (!layers.moon) toggleLayer('moon', true);
        controller?.locateMoon?.();
        setObjectSelected('月球', '当前视图会沿月球方向转向天空，用于观察月球在此刻的相对方位，不对应地表上的具体落点。');
      } else if (objectId === 'sun') {
        controller?.locateSun?.();
        setObjectSelected('太阳', '当前视图会沿太阳方向转向天空，用于观察太阳在此刻的相对方向，不对应地表上的具体落点。');
      } else if (objectId === 'iss') {
        if (!layers.satellites) toggleLayer('satellites', true);
        controller?.locateSatellite?.(25544);
        setObjectSelected('国际空间站 (ISS)', '人类在近地轨道运行的载人空间站，轨道高度约408公里');
      } else if (objectId === 'tiangong') {
        if (!layers.satellites) toggleLayer('satellites', true);
        controller?.locateSatellite?.(48274);
        setObjectSelected('天宫空间站', '中国自主运营的载人空间站，轨道高度约400公里');
      }
    },
    [controller, layers.moon, layers.satellites, toggleLayer, setSelectedLocation, setLocationDigest, setLocationLoading]
  );

  const visibleHotspots = useMemo(
    () => (hotspotMarkersEnabled ? locationHotspots.slice(0, 15) : []),
    [hotspotMarkersEnabled, locationHotspots]
  );

  const showDetail = selectedLocation !== null || activeSection === 'layers' || activeSection === 'about' || activeSection === 'highlights';

  return (
    <div className={`earthStage ${showDetail ? 'detailVisible' : ''}`} data-sheet={bottomSheetState}>
      <ExplorerSidebar
        activeSection={activeSection}
        onChange={handleSectionChange}
        hotspotMarkersEnabled={hotspotMarkersEnabled}
        onToggleHotspotMarkers={() => setHotspotMarkersEnabled((prev) => !prev)}
      />

      <main className="globePanel" id="viewer-main">
        <div className="viewerFrame">
          <PlaceSearch onSelect={handlePlaceSelect} onLocateObject={handleLocateObject} />
          <GlobeControls />
          {showDetail && (
            <button
              type="button"
              className="detailCollapseToggle"
              title="收起面板"
              aria-label="收起详情面板"
              onClick={handleClearSelection}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
              </svg>
            </button>
          )}
          <CesiumViewer
            simulationTimeMs={currentTimeMs}
            layers={layers}
            inertialMode={inertialMode}
            annotations={annotations}
            hotspots={visibleHotspots}
            routePreview={routePreview}
            selectedLocation={selectedLocation}
            satellites={filteredSatellites}
            earthquakes={earthquakes}
            landmarks={FEATURED_LANDMARKS}
            onLocationClick={handleLocationClick}
            onHotspotSelect={handleHotspotSelect}
            onLandmarkSelect={handleLandmarkSelect}
            onReady={setController}
          />
          <ViewerHUD earthState={earthState} landmarkCount={FEATURED_LANDMARKS.length} />
        </div>
      </main>

      <div className="detailDrawerWrap">
        <button
          type="button"
          className="drawerHandle"
          aria-label="切换详情面板"
          onClick={() =>
            setBottomSheetState((prev) =>
              prev === 'collapsed' ? 'half' : prev === 'half' ? 'full' : 'collapsed'
            )
          }
        >
          <span className="drawerHandleBar" />
        </button>
        <LocationDigestPanel
          activeSection={activeSection}
          landmarks={FEATURED_LANDMARKS}
          hotspots={locationHotspots}
          hotspotMarkersEnabled={hotspotMarkersEnabled}
          selectedLocation={selectedLocation}
          locationDigest={locationDigest}
          locationLoading={locationLoading}
          locationHotspotsLoading={locationHotspotsLoading}
          providers={providers}
          layers={layers}
          satelliteCategories={satelliteCategories}
          onSelectLandmark={handleLandmarkSelect}
          onToggleHotspotMarkers={() => setHotspotMarkersEnabled((prev) => !prev)}
          onClearSelection={handleClearSelection}
          onToggleLayer={toggleLayer}
          onToggleSatelliteCategory={toggleSatelliteCategory}
          onLocateMoon={handleLocateMoon}
          onLocateSatellite={handleLocateSatellite}
        />
      </div>

      <ExploreChatDrawer
        onSend={sendAgentMessage}
        busy={commandBusy}
        contextLabel={selectedLocation?.label ?? null}
        suggestedPrompts={locationDigest?.summary.quickPrompts}
      />
    </div>
  );
}

function formatCoordLabel(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

function buildContextualPrompt(
  prompt: string,
  selectedLocation: SelectedLocation | null,
  locationDigest: LocationDigest | null
) {
  if (!selectedLocation) {
    return prompt;
  }

  const context = [
    `当前探索地点: ${selectedLocation.label ?? '未命名位置'}`,
    `坐标: ${selectedLocation.lat.toFixed(2)}, ${selectedLocation.lon.toFixed(2)}`,
    selectedLocation.region || selectedLocation.country
      ? `地区: ${[selectedLocation.region, selectedLocation.country].filter(Boolean).join(', ')}`
      : null,
    locationDigest?.weather
      ? `当前天气(面板已显示): 温度=${locationDigest.weather.temperature?.toFixed(1) ?? '?'}°C, 描述=${locationDigest.weather.description ?? '无'}`
      : null,
    locationDigest?.solar
      ? `太阳状态(面板已显示): 高度角=${locationDigest.solar.altitudeDegrees.toFixed(1)}°, ${locationDigest.solar.daylight ? '白天' : '夜间'}`
      : null,
    locationDigest?.summary.text ? `地点摘要: ${locationDigest.summary.text}` : null,
    '重要: 如果用户询问面板上已显示的数值（如温度、太阳高度角），请严格使用上面提供的精确数字，不要重新计算或猜测。'
  ]
    .filter(Boolean)
    .join('\n');

  return `${context}\n\n用户问题: ${prompt}`;
}
