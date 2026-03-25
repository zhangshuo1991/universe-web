'use client';

import { useEffect, useRef } from 'react';

import type { ViewerLayerId } from '@/types/agent';
import type { ViewerController, Annotation, EarthquakeEvent } from '@/store/viewerStore';
import type { SatelliteFeedItem } from '@/server/satellites';
import type { Landmark } from '@/types/explorer';

const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
const HAS_MAPTILER_TERRAIN = Boolean(MAPTILER_API_KEY);

type CesiumViewerProps = {
  simulationTimeMs: number;
  layers: Record<ViewerLayerId, boolean>;
  inertialMode: boolean;
  annotations: Annotation[];
  selectedLocation: { lat: number; lon: number; label?: string } | null;
  satellites: SatelliteFeedItem[];
  earthquakes: EarthquakeEvent[];
  landmarks: Landmark[];
  onLocationClick: (lat: number, lon: number) => void;
  onLandmarkSelect: (landmark: Landmark) => void;
  onReady: (controller: ViewerController) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumAny = any;

export default function CesiumViewerComponent({
  simulationTimeMs,
  layers,
  inertialMode,
  annotations,
  selectedLocation,
  satellites,
  earthquakes,
  landmarks,
  onLocationClick,
  onLandmarkSelect,
  onReady
}: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumAny>(null);
  const cesiumRef = useRef<CesiumAny>(null);
  const annotationEntitiesRef = useRef<Map<string, CesiumAny>>(new Map());
  const landmarkEntitiesRef = useRef<Map<string, CesiumAny>>(new Map());
  const locationPinRef = useRef<CesiumAny>(null);
  const satelliteEntitiesRef = useRef<Map<number, CesiumAny>>(new Map());
  const earthquakeEntitiesRef = useRef<Map<string, CesiumAny>>(new Map());
  const satrecCacheRef = useRef<Map<number, CesiumAny>>(new Map());
  const labelLayerRef = useRef<CesiumAny>(null);
  const lastSatPropRef = useRef<number>(-Infinity);
  const onLocationClickRef = useRef(onLocationClick);
  const onLandmarkSelectRef = useRef(onLandmarkSelect);

  onLocationClickRef.current = onLocationClick;
  onLandmarkSelectRef.current = onLandmarkSelect;

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    let handler: CesiumAny | null = null;

    (async () => {
      const Cesium = await import('cesium');
      // @ts-expect-error -- CSS import for Cesium widgets
      await import('cesium/Build/Cesium/Widgets/widgets.css');
      window.CESIUM_BASE_URL = '/cesiumStatic';

      if (destroyed || !containerRef.current) return;

      cesiumRef.current = Cesium;
      const terrain = createTerrainProvider(Cesium);

      const viewer = new Cesium.Viewer(containerRef.current, {
        timeline: false,
        animation: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        scene3DOnly: true,
        msaaSamples: 4,
        shadows: false,
        ...(terrain ? { terrain } : {})
      });

      viewerRef.current = viewer;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020611');
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.globe.depthTestAgainstTerrain = HAS_MAPTILER_TERRAIN;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      if (viewer.scene.sun) viewer.scene.sun.show = true;
      if (viewer.scene.moon) viewer.scene.moon.show = false;
      if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
      viewer.clock.shouldAnimate = false;

      try {
        const creditContainer = viewer.cesiumWidget?.creditContainer as HTMLElement | undefined;
        if (creditContainer) {
          creditContainer.style.opacity = '0.32';
          creditContainer.style.fontSize = '10px';
        }
      } catch {
        // Ignore credit styling failures.
      }

      viewer.imageryLayers.removeAll();
      const baseProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
        `${window.CESIUM_BASE_URL}/Assets/Textures/NaturalEarthII`
      );
      viewer.imageryLayers.addImageryProvider(baseProvider);

      try {
        const primaryProvider = createPrimaryImageryProvider(Cesium);
        viewer.imageryLayers.addImageryProvider(primaryProvider);
      } catch {
        // Primary imagery unavailable — NaturalEarthII remains as sole base.
      }

      if (!MAPTILER_API_KEY) {
        const labelProvider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
          credit: 'CartoDB'
        });
        const labelLayer = viewer.imageryLayers.addImageryProvider(labelProvider);
        labelLayer.alpha = 0.85;
        labelLayer.show = true;
        labelLayerRef.current = labelLayer;
      } else {
        labelLayerRef.current = null;
      }

      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((event: CesiumAny) => {
        const picked = viewer.scene.pick(event.position);
        const landmarkId = picked?.id?.properties?.landmarkId?.getValue?.();
        if (landmarkId) {
          const landmark = landmarks.find((item) => item.id === landmarkId);
          if (landmark) {
            onLandmarkSelectRef.current(landmark);
            return;
          }
        }

        const cartesian = pickSurfacePosition(Cesium, viewer, event.position);
        if (!cartesian) return;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        onLocationClickRef.current(lat, lon);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(15, 18, 24_000_000),
        orientation: {
          heading: Cesium.Math.toRadians(4),
          pitch: Cesium.Math.toRadians(-85),
          roll: 0
        }
      });

      viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date());
      viewer.scene.requestRender();

      onReady({
        flyTo: (target) => {
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              target.lon,
              target.lat,
              target.altitude ?? 3_000_000
            ),
            orientation: {
              heading: Cesium.Math.toRadians(target.heading ?? 0),
              pitch: Cesium.Math.toRadians(target.pitch ?? -55),
              roll: 0
            },
            duration: reduceMotion ? 0 : 2
          });
        },
        focusBody: () => undefined,
        setViewPreset: () => undefined,
        resetNorth: () => {
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          viewer.camera.flyTo({
            destination: viewer.camera.positionWC,
            orientation: {
              heading: 0,
              pitch: viewer.camera.pitch,
              roll: 0
            },
            duration: reduceMotion ? 0 : 0.6
          });
        },
        zoomIn: () => {
          viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.4);
          viewer.scene.requestRender();
        },
        zoomOut: () => {
          viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.6);
          viewer.scene.requestRender();
        },
        locateMoon: () => {
          if (!viewer.scene.moon?.show) return;
          const moonPos = Cesium.Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(viewer.clock.currentTime);
          if (!moonPos) return;
          const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(viewer.clock.currentTime);
          if (!icrfToFixed) return;
          const fixedPos = Cesium.Matrix3.multiplyByVector(icrfToFixed, moonPos, new Cesium.Cartesian3());
          const direction = Cesium.Cartesian3.normalize(fixedPos, new Cesium.Cartesian3());
          const cameraHeight = 15_000_000;
          const cameraCartesian = Cesium.Cartesian3.multiplyByScalar(direction, cameraHeight, new Cesium.Cartesian3());

          // Compute look direction from camera toward the moon
          const lookDir = Cesium.Cartesian3.subtract(fixedPos, cameraCartesian, new Cesium.Cartesian3());
          const lookDirNorm = Cesium.Cartesian3.normalize(lookDir, new Cesium.Cartesian3());
          const right = Cesium.Cartesian3.cross(lookDirNorm, Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3());
          Cesium.Cartesian3.normalize(right, right);
          const up = Cesium.Cartesian3.cross(right, lookDirNorm, new Cesium.Cartesian3());
          Cesium.Cartesian3.normalize(up, up);

          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          viewer.camera.flyTo({
            destination: cameraCartesian,
            orientation: {
              direction: lookDirNorm,
              up: up
            },
            duration: reduceMotion ? 0 : 2.5
          });
        },
        locateSun: () => {
          const sunPos = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(viewer.clock.currentTime);
          if (!sunPos) return;
          const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(viewer.clock.currentTime);
          if (!icrfToFixed) return;
          const fixedPos = Cesium.Matrix3.multiplyByVector(icrfToFixed, sunPos, new Cesium.Cartesian3());
          const sunDir = Cesium.Cartesian3.normalize(fixedPos, new Cesium.Cartesian3());
          const cameraHeight = 18_000_000;
          const cameraCartesian = Cesium.Cartesian3.multiplyByScalar(sunDir, cameraHeight, new Cesium.Cartesian3());

          const lookDir = Cesium.Cartesian3.subtract(fixedPos, cameraCartesian, new Cesium.Cartesian3());
          const lookDirNorm = Cesium.Cartesian3.normalize(lookDir, new Cesium.Cartesian3());
          const right = Cesium.Cartesian3.cross(lookDirNorm, Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3());
          Cesium.Cartesian3.normalize(right, right);
          const up = Cesium.Cartesian3.cross(right, lookDirNorm, new Cesium.Cartesian3());
          Cesium.Cartesian3.normalize(up, up);

          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          viewer.camera.flyTo({
            destination: cameraCartesian,
            orientation: {
              direction: lookDirNorm,
              up: up
            },
            duration: reduceMotion ? 0 : 2.5
          });
        },
        locateSatellite: (catnr: number) => {
          const entity = satelliteEntitiesRef.current.get(catnr);
          if (!entity?.position) return;
          const pos = entity.position.getValue(viewer.clock.currentTime);
          if (!pos) return;
          const carto = Cesium.Cartographic.fromCartesian(pos);
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height + 2_000_000),
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-45),
              roll: 0
            },
            duration: reduceMotion ? 0 : 2
          });
        }
      });
    })();

    return () => {
      destroyed = true;
      handler?.destroy();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [landmarks, onReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(simulationTimeMs));
    viewer.scene.requestRender();
  }, [simulationTimeMs]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.globe.enableLighting = layers.dayNight;
    viewer.scene.requestRender();
  }, [layers.dayNight]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = layers.atmosphere;
    viewer.scene.globe.showGroundAtmosphere = layers.atmosphere;
    viewer.scene.requestRender();
  }, [layers.atmosphere]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (viewer.scene.moon) viewer.scene.moon.show = layers.moon;
    viewer.scene.requestRender();
  }, [layers.moon]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    if (inertialMode) {
      const removeCallback = viewer.scene.postUpdate.addEventListener(() => {
        if (viewer.isDestroyed()) return;
        const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(viewer.clock.currentTime);
        if (!icrfToFixed) return;

        const camera = viewer.camera;
        const offset = Cesium.Cartesian3.clone(camera.position);
        const transform = Cesium.Matrix4.fromRotationTranslation(icrfToFixed);
        camera.lookAtTransform(transform, offset);
      });

      return () => removeCallback();
    }

    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }, [inertialMode]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    if (locationPinRef.current) {
      viewer.entities.remove(locationPinRef.current);
      locationPinRef.current = null;
    }

    if (selectedLocation) {
      locationPinRef.current = viewer.entities.add({
        name: selectedLocation.label ?? '选中位置',
        position: Cesium.Cartesian3.fromDegrees(selectedLocation.lon, selectedLocation.lat, 0),
        billboard: {
          image: PIN_SVG_URI,
          width: 34,
          height: 42,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: selectedLocation.label ?? '',
          font: '13px Oxanium, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -48),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20_000_000)
        }
      });
    }

    viewer.scene.requestRender();
  }, [selectedLocation]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    const visible = layers.cityMarkers;
    const activeIds = new Set(landmarks.map((landmark) => landmark.id));

    if (labelLayerRef.current) {
      labelLayerRef.current.show = visible;
    }

    for (const landmark of landmarks) {
      let entity = landmarkEntitiesRef.current.get(landmark.id);
      if (!entity) {
        entity = viewer.entities.add({
          name: landmark.name,
          properties: {
            landmarkId: landmark.id
          },
          position: Cesium.Cartesian3.fromDegrees(landmark.lon, landmark.lat, 0),
          billboard: {
            image: LANDMARK_SVG_URI,
            width: 22,
            height: 22,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(400_000, 1.1, 20_000_000, 0.42)
          },
          label: {
            text: `${landmark.name}\n${landmark.regionName}`,
            font: '12px Oxanium, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.9),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 16_000_000)
          }
        });
        landmarkEntitiesRef.current.set(landmark.id, entity);
      }

      entity.show = visible;
    }

    for (const [id, entity] of landmarkEntitiesRef.current) {
      if (!activeIds.has(id)) {
        viewer.entities.remove(entity);
        landmarkEntitiesRef.current.delete(id);
      }
    }

    viewer.scene.requestRender();
  }, [landmarks, layers.cityMarkers]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    if (!layers.satellites) {
      for (const [, entity] of satelliteEntitiesRef.current) {
        entity.show = false;
      }
      viewer.scene.requestRender();
      return;
    }

    if (satellites.length === 0) return;

    const now = performance.now();
    if (now - lastSatPropRef.current < 2000) return;
    lastSatPropRef.current = now;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const satelliteJs = require('satellite.js');
    const simulationDate = new Date(simulationTimeMs);
    const gmst = satelliteJs.gstime(simulationDate);
    const currentIds = new Set<number>();

    for (const satellite of satellites) {
      currentIds.add(satellite.catnr);

      try {
        let satrec = satrecCacheRef.current.get(satellite.catnr);
        if (!satrec) {
          satrec = satelliteJs.twoline2satrec(buildTleLine1(satellite.omm), buildTleLine2(satellite.omm));
          satrecCacheRef.current.set(satellite.catnr, satrec);
        }

        const propagated = satelliteJs.propagate(satrec, simulationDate);
        const position = propagated.position;
        if (!position || typeof position === 'boolean') continue;

        const geodetic = satelliteJs.eciToGeodetic(position, gmst);
        const lon = satelliteJs.degreesLong(geodetic.longitude);
        const lat = satelliteJs.degreesLat(geodetic.latitude);
        const alt = geodetic.height * 1000;
        const cartesian = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

        let entity = satelliteEntitiesRef.current.get(satellite.catnr);
        if (!entity) {
          entity = viewer.entities.add({
            name: satellite.label,
            position: cartesian,
            point: {
              pixelSize: 6,
              color: Cesium.Color.fromCssColorString(satellite.color),
              outlineColor: Cesium.Color.WHITE.withAlpha(0.6),
              outlineWidth: 1,
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
              text: satellite.label,
              font: '11px Oxanium, sans-serif',
              fillColor: Cesium.Color.fromCssColorString(satellite.color),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 30_000_000),
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
          });
          satelliteEntitiesRef.current.set(satellite.catnr, entity);
        } else {
          entity.position.setValue(cartesian);
          entity.show = true;
        }
      } catch {
        // Ignore failed satellite propagation.
      }
    }

    for (const [id, entity] of satelliteEntitiesRef.current) {
      if (!currentIds.has(id)) {
        entity.show = false;
      }
    }

    viewer.scene.requestRender();
  }, [satellites, layers.satellites, simulationTimeMs]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    const visible = layers.earthquakes;
    const currentIds = new Set<string>();

    if (visible) {
      for (const earthquake of earthquakes) {
        currentIds.add(earthquake.id);
        let entity = earthquakeEntitiesRef.current.get(earthquake.id);

        if (!entity) {
          const size = Math.max(5, Math.min(22, earthquake.magnitude * 3));
          const color = earthquake.magnitude >= 6
            ? Cesium.Color.fromCssColorString('#f87171').withAlpha(0.8)
            : earthquake.magnitude >= 4
              ? Cesium.Color.fromCssColorString('#f7b955').withAlpha(0.74)
              : Cesium.Color.fromCssColorString('#5eead4').withAlpha(0.65);

          entity = viewer.entities.add({
            name: `M${earthquake.magnitude} — ${earthquake.place}`,
            position: Cesium.Cartesian3.fromDegrees(earthquake.lon, earthquake.lat, 0),
            point: {
              pixelSize: size,
              color,
              outlineColor: color.withAlpha(1),
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
              text: `M${earthquake.magnitude.toFixed(1)}`,
              font: '10px Oxanium, sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -16),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 12_000_000),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
          });
          earthquakeEntitiesRef.current.set(earthquake.id, entity);
        }

        entity.show = true;
      }
    }

    for (const [id, entity] of earthquakeEntitiesRef.current) {
      if (!visible || !currentIds.has(id)) {
        entity.show = false;
      }
    }

    viewer.scene.requestRender();
  }, [earthquakes, layers.earthquakes]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || viewer.isDestroyed()) return;

    const existingIds = new Set(annotationEntitiesRef.current.keys());
    const currentIds = new Set(annotations.map((annotation) => annotation.id));

    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const entity = annotationEntitiesRef.current.get(id);
        if (entity) viewer.entities.remove(entity);
        annotationEntitiesRef.current.delete(id);
      }
    }

    for (const annotation of annotations) {
      if (annotationEntitiesRef.current.has(annotation.id)) continue;

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(annotation.lon, annotation.lat, 10_000),
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString(annotation.color ?? '#f7b955'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        },
        label: {
          text: annotation.text,
          font: '12px Oxanium, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
        }
      });

      annotationEntitiesRef.current.set(annotation.id, entity);
    }

    viewer.scene.requestRender();
  }, [annotations]);

  return <div ref={containerRef} className="cesiumContainer" />;
}

const PIN_SVG_URI = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/></filter></defs>
    <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#f7b955" filter="url(#s)"/>
    <circle cx="16" cy="16" r="7" fill="#050913"/>
    <circle cx="16" cy="16" r="4" fill="#5eead4"/>
  </svg>`
);

const LANDMARK_SVG_URI = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="#091324" stroke="#f7b955" stroke-width="2"/>
    <circle cx="12" cy="12" r="3" fill="#5eead4"/>
  </svg>`
);

function buildTleLine1(omm: CesiumAny): string {
  const catId = String(omm.NORAD_CAT_ID).padStart(5, '0');
  const classification = omm.CLASSIFICATION_TYPE ?? 'U';
  const intlDesig = String(omm.OBJECT_ID ?? '00000A').padEnd(8).slice(0, 8);
  const epoch = epochToTle(String(omm.EPOCH));
  const mmDot = fmtMmDot(Number(omm.MEAN_MOTION_DOT));
  const mmDdot = fmtExp(Number(omm.MEAN_MOTION_DDOT));
  const bstar = fmtExp(Number(omm.BSTAR));
  const elsetNo = String(omm.ELEMENT_SET_NO).padStart(4, ' ');
  const line = `1 ${catId}${classification} ${intlDesig} ${epoch} ${mmDot} ${mmDdot} ${bstar} 0 ${elsetNo}`;
  return line + tleChecksum(line);
}

function buildTleLine2(omm: CesiumAny): string {
  const catId = String(omm.NORAD_CAT_ID).padStart(5, '0');
  const incl = Number(omm.INCLINATION).toFixed(4).padStart(8, ' ');
  const raan = Number(omm.RA_OF_ASC_NODE).toFixed(4).padStart(8, ' ');
  const ecc = Number(omm.ECCENTRICITY).toFixed(7).slice(2);
  const argPeri = Number(omm.ARG_OF_PERICENTER).toFixed(4).padStart(8, ' ');
  const meanAnom = Number(omm.MEAN_ANOMALY).toFixed(4).padStart(8, ' ');
  const meanMotion = Number(omm.MEAN_MOTION).toFixed(8).padStart(11, ' ');
  const revNum = String(omm.REV_AT_EPOCH ?? 0).padStart(5, ' ');
  const line = `2 ${catId} ${incl} ${raan} ${ecc} ${argPeri} ${meanAnom} ${meanMotion}${revNum}`;
  return line + tleChecksum(line);
}

function epochToTle(iso: string): string {
  const date = new Date(iso);
  const year = date.getUTCFullYear() % 100;
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const day = (date.getTime() - start.getTime()) / 86_400_000 + 1;
  return `${year.toString().padStart(2, '0')}${day.toFixed(8).padStart(12, ' ')}`;
}

function fmtMmDot(value: number): string {
  const sign = value >= 0 ? ' ' : '-';
  return sign + Math.abs(value).toFixed(8).slice(1);
}

function fmtExp(value: number): string {
  if (value === 0) return ' 00000-0';
  const sign = value >= 0 ? ' ' : '-';
  const abs = Math.abs(value);
  const exponent = Math.floor(Math.log10(abs));
  const mantissa = Math.round((abs / 10 ** exponent) * 1e4);
  const expSign = exponent >= 0 ? '+' : '-';
  return `${sign}${mantissa.toString().padStart(5, '0')}${expSign}${Math.abs(exponent).toString().padStart(1, '0')}`;
}

function tleChecksum(line: string): string {
  const checksum = line
    .split('')
    .reduce((sum, char) => sum + (/^\d$/.test(char) ? Number(char) : char === '-' ? 1 : 0), 0);

  return String(checksum % 10);
}

function createPrimaryImageryProvider(Cesium: CesiumAny): CesiumAny {
  if (MAPTILER_API_KEY) {
    return new Cesium.UrlTemplateImageryProvider({
      url: `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_API_KEY}`,
      credit: '© MapTiler © OpenStreetMap contributors',
      maximumLevel: 20,
      tileWidth: 512,
      tileHeight: 512
    });
  }

  return new Cesium.UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'Esri, Maxar, Earthstar Geographics',
    maximumLevel: 19
  });
}

function createTerrainProvider(Cesium: CesiumAny): CesiumAny | null {
  if (!MAPTILER_API_KEY) return null;

  return new Cesium.Terrain(
    Cesium.CesiumTerrainProvider.fromUrl(
      `https://api.maptiler.com/tiles/terrain-quantized-mesh-v2/?key=${MAPTILER_API_KEY}`,
      {
        requestVertexNormals: true
      }
    )
  );
}

function pickSurfacePosition(Cesium: CesiumAny, viewer: CesiumAny, windowPosition: CesiumAny): CesiumAny | null {
  const { scene, camera } = viewer;

  if (scene.pickPositionSupported) {
    const position = scene.pickPosition(windowPosition);
    if (position) return position;
  }

  const ray = camera.getPickRay(windowPosition);
  if (ray) {
    const globePosition = scene.globe.pick(ray, scene);
    if (globePosition) return globePosition;
  }

  return camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid) ?? null;
}
