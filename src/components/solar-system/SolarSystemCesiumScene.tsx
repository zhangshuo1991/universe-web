'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  EllipsoidTerrainProvider,
  Math as CesiumMath,
  SceneMode,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer
} from 'cesium';

import type { SolarViewPresetId, ViewerLayerId } from '@/types/agent';
import type { BodyStateVector, CelestialBodyDescriptor } from '@/types/observation';

type SmallBodyEvent = {
  designation: unknown;
  closeApproachTimeIso?: unknown;
  closeApproachTimeUtc: unknown;
  missDistanceAu: unknown;
  relativeVelocityKmS: unknown;
  vectorSource?: unknown;
  vectorEpochIso?: unknown;
  vectorKm?: {
    x: unknown;
    y: unknown;
    z: unknown;
  } | null;
  velocityKmS?: {
    x: unknown;
    y: unknown;
    z: unknown;
  } | null;
};

type SolarBodyRender = BodyStateVector & {
  metadata: CelestialBodyDescriptor;
};

type Props = {
  bodies: SolarBodyRender[];
  catalog: CelestialBodyDescriptor[];
  selectedBodyId: string | null;
  preset: SolarViewPresetId;
  layers: Record<ViewerLayerId, boolean>;
  smallBodyEvents: SmallBodyEvent[];
  selectedSmallBodyIndex: number | null;
  simulationTimeMs: number;
  onSelectBody: (bodyId: string) => void;
  onSelectSmallBody: (eventIndex: number) => void;
};

const AU_TO_SCENE_METERS = 250_000_000;
const KM_TO_SCENE_METERS = 1_200;

function bodyRadiusMeters(body: CelestialBodyDescriptor) {
  if (body.id === 'sun') {
    return 28_000_000;
  }
  return Math.max(900_000, Math.min(7_200_000, Math.log10(Math.max(body.radiusKm, 1)) * 1_100_000));
}

function toCartesian(body: SolarBodyRender, preset: SolarViewPresetId, anchor: SolarBodyRender | null) {
  if (preset === 'earthMoon' && anchor) {
    return new Cartesian3(
      (body.positionKm.x - anchor.positionKm.x) * KM_TO_SCENE_METERS,
      (body.positionKm.y - anchor.positionKm.y) * KM_TO_SCENE_METERS,
      (body.positionKm.z - anchor.positionKm.z) * KM_TO_SCENE_METERS
    );
  }

  return new Cartesian3(
    body.positionAu.x * AU_TO_SCENE_METERS,
    body.positionAu.y * AU_TO_SCENE_METERS,
    body.positionAu.z * AU_TO_SCENE_METERS
  );
}

function orbitPositions(
  semiMajorAxisAu: number,
  points = 192
) {
  const positions: Cartesian3[] = [];
  const radius = semiMajorAxisAu * AU_TO_SCENE_METERS;
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    positions.push(new Cartesian3(radius * Math.cos(angle), radius * Math.sin(angle), 0));
  }
  return positions;
}

function moonOrbitPositions(semiMajorAxisKm: number, center: Cartesian3, points = 160) {
  const positions: Cartesian3[] = [];
  const radius = semiMajorAxisKm * KM_TO_SCENE_METERS;
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    positions.push(
      new Cartesian3(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle), center.z)
    );
  }
  return positions;
}

function asFinite(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function SolarSystemCesiumScene({
  bodies,
  catalog,
  selectedBodyId,
  preset,
  layers,
  smallBodyEvents,
  selectedSmallBodyIndex,
  simulationTimeMs,
  onSelectBody,
  onSelectSmallBody
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const bodySourceRef = useRef<CustomDataSource | null>(null);
  const orbitSourceRef = useRef<CustomDataSource | null>(null);
  const smallBodySourceRef = useRef<CustomDataSource | null>(null);
  const smallBodyPositionMapRef = useRef<Map<number, Cartesian3>>(new Map());
  const clickHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const cameraKeyRef = useRef('');

  const bodyMap = useMemo(() => new Map(bodies.map((body) => [body.bodyId, body])), [bodies]);
  const earthAnchor = useMemo(() => bodyMap.get('earth') ?? null, [bodyMap]);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) {
      return;
    }

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      terrainProvider: new EllipsoidTerrainProvider()
    });
    viewer.scene.mode = SceneMode.SCENE3D;
    viewer.scene.globe.show = false;
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = false;
    }
    if (viewer.scene.moon) {
      viewer.scene.moon.show = false;
    }
    if (viewer.scene.sun) {
      viewer.scene.sun.show = false;
    }
    viewer.scene.backgroundColor = Color.fromCssColorString('#020611');
    viewer.imageryLayers.removeAll();
    viewer.scene.requestRenderMode = true;

    const bodySource = new CustomDataSource('solar-bodies');
    const orbitSource = new CustomDataSource('solar-orbits');
    const smallBodySource = new CustomDataSource('small-bodies');
    viewer.dataSources.add(bodySource);
    viewer.dataSources.add(orbitSource);
    viewer.dataSources.add(smallBodySource);

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: unknown) => {
      const position = (movement as { position?: Cartesian2 }).position;
      if (!position) {
        return;
      }
      const picked = viewer.scene.pick(position) as
        | {
            id?: {
              properties?: {
                bodyId?: {
                  getValue?: () => unknown;
                };
                smallBodyIndex?: {
                  getValue?: () => unknown;
                };
              };
            };
          }
        | undefined;
      const bodyValue = picked?.id?.properties?.bodyId?.getValue?.();
      const eventValue = picked?.id?.properties?.smallBodyIndex?.getValue?.();
      const bodyId = typeof bodyValue === 'string' ? bodyValue : undefined;
      const eventIndex = typeof eventValue === 'number' ? eventValue : Number.NaN;
      if (bodyId) {
        onSelectBody(bodyId);
        return;
      }
      if (Number.isFinite(eventIndex)) {
        onSelectSmallBody(eventIndex);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;
    bodySourceRef.current = bodySource;
    orbitSourceRef.current = orbitSource;
    smallBodySourceRef.current = smallBodySource;
    clickHandlerRef.current = handler;

    return () => {
      clickHandlerRef.current?.destroy();
      clickHandlerRef.current = null;
      viewer.destroy();
      viewerRef.current = null;
      bodySourceRef.current = null;
      orbitSourceRef.current = null;
      smallBodySourceRef.current = null;
    };
  }, [onSelectBody, onSelectSmallBody]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const bodySource = bodySourceRef.current;
    const orbitSource = orbitSourceRef.current;
    const smallSource = smallBodySourceRef.current;
    if (!viewer || !bodySource || !orbitSource || !smallSource) {
      return;
    }

    bodySource.entities.removeAll();
    orbitSource.entities.removeAll();
    smallSource.entities.removeAll();
    const smallBodyPositions = new Map<number, Cartesian3>();

    const anchor = preset === 'earthMoon' ? earthAnchor : null;
    const filteredBodies = bodies.filter((body) => {
      if (!layers.majorMoons && body.metadata.category === 'moon' && body.bodyId !== 'moon') {
        return false;
      }
      if (preset === 'earthMoon' && body.bodyId === 'sun') {
        return false;
      }
      return true;
    });

    const positionMap = new Map<string, Cartesian3>();
    for (const body of filteredBodies) {
      const position = toCartesian(body, preset, anchor);
      positionMap.set(body.bodyId, position);
      const color = Color.fromCssColorString(body.metadata.color);
      const selected = selectedBodyId === body.bodyId;
      const radius = bodyRadiusMeters(body.metadata) * (selected ? 1.2 : 1);

      bodySource.entities.add({
        id: `body-${body.bodyId}`,
        position,
        ellipsoid: {
          radii: new Cartesian3(radius, radius, radius),
          material: color.withAlpha(0.92),
          outline: true,
          outlineWidth: 1.6,
          outlineColor: selected ? Color.WHITE : color.withAlpha(0.45)
        },
        point: {
          pixelSize: selected ? 10 : 7,
          color: color.withAlpha(0.95),
          outlineColor: Color.WHITE.withAlpha(selected ? 0.9 : 0.55),
          outlineWidth: selected ? 2 : 1
        },
        label: layers.planetLabels
          ? {
              text: body.metadata.shortName ?? body.metadata.name,
              fillColor: Color.WHITE,
              outlineColor: Color.BLACK.withAlpha(0.6),
              outlineWidth: 2,
              scale: selected ? 0.78 : 0.64,
              pixelOffset: new Cartesian2(0, -22),
              showBackground: true,
              backgroundColor: Color.BLACK.withAlpha(0.38)
            }
          : undefined,
        properties: {
          bodyId: body.bodyId
        }
      });
    }

    if (layers.planetOrbits) {
      for (const body of catalog) {
        if (!body.semiMajorAxisAu || body.parentId !== 'sun') {
          continue;
        }
        orbitSource.entities.add({
          id: `orbit-${body.id}`,
          polyline: {
            positions: orbitPositions(body.semiMajorAxisAu),
            width: 1.2,
            material: Color.fromCssColorString('#5f7fa6').withAlpha(0.32),
            arcType: ArcType.NONE
          }
        });
      }

      if (preset === 'earthMoon' && earthAnchor) {
        const earthPosition = positionMap.get('earth');
        const moon = catalog.find((body) => body.id === 'moon');
        if (earthPosition && moon?.semiMajorAxisKm) {
          orbitSource.entities.add({
            id: 'orbit-moon-earthmoon',
            polyline: {
              positions: moonOrbitPositions(moon.semiMajorAxisKm, earthPosition),
              width: 1.4,
              material: Color.fromCssColorString('#cfd8e6').withAlpha(0.45),
              arcType: ArcType.NONE
            }
          });
        }
      }
    }

    if (layers.smallBodies && smallBodyEvents.length > 0) {
      const earthPos = positionMap.get('earth') ?? new Cartesian3(0, 0, 0);
      smallBodyEvents.slice(0, 24).forEach((event, index) => {
        const designation = typeof event.designation === 'string' ? event.designation : `NEO-${index + 1}`;
        const selectedEvent = selectedSmallBodyIndex === index;
        const eventIso =
          typeof event.vectorEpochIso === 'string'
            ? event.vectorEpochIso
            : typeof event.closeApproachTimeIso === 'string'
              ? event.closeApproachTimeIso
              : null;
        const eventEpochMs = eventIso ? Date.parse(eventIso) : Number.NaN;
        const eventVectorX = asFinite(event.vectorKm?.x);
        const eventVectorY = asFinite(event.vectorKm?.y);
        const eventVectorZ = asFinite(event.vectorKm?.z);
        const eventVelocityX = asFinite(event.velocityKmS?.x);
        const eventVelocityY = asFinite(event.velocityKmS?.y);
        const eventVelocityZ = asFinite(event.velocityKmS?.z);

        let markerPosition: Cartesian3;
        if (eventVectorX !== null && eventVectorY !== null && eventVectorZ !== null) {
          const dtSeconds = Number.isFinite(eventEpochMs) ? (simulationTimeMs - eventEpochMs) / 1000 : 0;
          const xKm = eventVectorX + (eventVelocityX ?? 0) * dtSeconds;
          const yKm = eventVectorY + (eventVelocityY ?? 0) * dtSeconds;
          const zKm = eventVectorZ + (eventVelocityZ ?? 0) * dtSeconds;
          markerPosition = new Cartesian3(
            earthPos.x + xKm * KM_TO_SCENE_METERS,
            earthPos.y + yKm * KM_TO_SCENE_METERS,
            earthPos.z + zKm * KM_TO_SCENE_METERS
          );
        } else {
          const distAu = Number(event.missDistanceAu);
          const distanceMeters =
            Number.isFinite(distAu) && distAu > 0 ? distAu * AU_TO_SCENE_METERS : 0.18 * AU_TO_SCENE_METERS;
          const theta = (index / Math.max(smallBodyEvents.length, 1)) * Math.PI * 2;
          const phi = ((index % 7) / 6) * Math.PI - Math.PI / 2;
          const x = earthPos.x + distanceMeters * Math.cos(theta) * Math.cos(phi);
          const y = earthPos.y + distanceMeters * Math.sin(theta) * Math.cos(phi);
          const z = earthPos.z + distanceMeters * Math.sin(phi) * 0.5;
          markerPosition = new Cartesian3(x, y, z);
        }

        smallBodyPositions.set(index, markerPosition);
        smallSource.entities.add({
          id: `small-body-${index}`,
          position: markerPosition,
          point: {
            pixelSize: selectedEvent ? 9 : 6,
            color: Color.fromCssColorString('#f6a14d').withAlpha(selectedEvent ? 1 : 0.92),
            outlineColor: Color.WHITE.withAlpha(0.58),
            outlineWidth: selectedEvent ? 2 : 1
          },
          label: layers.planetLabels
            ? {
                text: designation,
                fillColor: Color.fromCssColorString('#ffd6ad'),
                showBackground: true,
                backgroundColor: Color.BLACK.withAlpha(0.28),
                scale: 0.46,
                pixelOffset: new Cartesian2(0, -16)
              }
            : undefined,
          properties: {
            smallBodyIndex: index
          }
        });
      });
    }
    smallBodyPositionMapRef.current = smallBodyPositions;

    viewer.scene.requestRender();
  }, [bodies, catalog, earthAnchor, layers.majorMoons, layers.planetLabels, layers.planetOrbits, layers.smallBodies, preset, selectedBodyId, selectedSmallBodyIndex, simulationTimeMs, smallBodyEvents]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    const nextKey = `${preset}:${selectedBodyId ?? 'none'}`;
    if (nextKey === cameraKeyRef.current) {
      return;
    }
    cameraKeyRef.current = nextKey;

    const selected = selectedBodyId ? bodyMap.get(selectedBodyId) : null;
    const anchor = preset === 'earthMoon' ? earthAnchor : null;
    const center = selected ? toCartesian(selected, preset, anchor) : new Cartesian3(0, 0, 0);

    const offset =
      preset === 'earthMoon'
        ? new Cartesian3(0, -420_000_000, 220_000_000)
        : preset === 'inner'
          ? new Cartesian3(0, -900_000_000, 380_000_000)
          : preset === 'outer'
            ? new Cartesian3(0, -4_000_000_000, 1_500_000_000)
            : new Cartesian3(0, -3_200_000_000, 1_200_000_000);

    viewer.camera.flyTo({
      destination: Cartesian3.add(center, offset, new Cartesian3()),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(-38),
        roll: 0
      },
      duration: 0.9
    });
  }, [bodyMap, earthAnchor, preset, selectedBodyId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || selectedSmallBodyIndex === null) {
      return;
    }

    const eventPosition = smallBodyPositionMapRef.current.get(selectedSmallBodyIndex);
    if (!eventPosition) {
      return;
    }

    const offset = new Cartesian3(75_000_000, -180_000_000, 90_000_000);
    viewer.camera.flyTo({
      destination: Cartesian3.add(eventPosition, offset, new Cartesian3()),
      orientation: {
        heading: CesiumMath.toRadians(10),
        pitch: CesiumMath.toRadians(-34),
        roll: 0
      },
      duration: 0.85
    });
  }, [selectedSmallBodyIndex]);

  return <div ref={containerRef} className="solarCesiumContainer" />;
}
