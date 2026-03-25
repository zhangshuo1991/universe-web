import type { EarthquakeEvent } from '@/store/viewerStore';

type CesiumModule = typeof import('cesium');

type EarthquakeLayerState = {
  entities: Map<string, InstanceType<typeof import('cesium').Entity>>;
};

export function createEarthquakeLayer(): EarthquakeLayerState {
  return { entities: new Map() };
}

function magnitudeToSize(mag: number): number {
  return Math.max(4, Math.min(20, mag * 3));
}

function magnitudeToColor(Cesium: CesiumModule, mag: number) {
  if (mag >= 6) return Cesium.Color.fromCssColorString('#f87171');
  if (mag >= 4) return Cesium.Color.fromCssColorString('#f7b955');
  return Cesium.Color.fromCssColorString('#5eead4');
}

export function updateEarthquakes(
  Cesium: CesiumModule,
  viewer: InstanceType<typeof import('cesium').Viewer>,
  state: EarthquakeLayerState,
  earthquakes: EarthquakeEvent[],
  visible: boolean
) {
  if (!visible) {
    for (const entity of state.entities.values()) {
      entity.show = false;
    }
    return;
  }

  const currentIds = new Set<string>();

  for (const eq of earthquakes) {
    currentIds.add(eq.id);

    let entity = state.entities.get(eq.id);
    if (entity) {
      entity.show = true;
    } else {
      entity = viewer.entities.add({
        name: `M${eq.magnitude} — ${eq.place}`,
        position: Cesium.Cartesian3.fromDegrees(eq.lon, eq.lat, 0),
        point: {
          pixelSize: magnitudeToSize(eq.magnitude),
          color: magnitudeToColor(Cesium, eq.magnitude).withAlpha(0.7),
          outlineColor: magnitudeToColor(Cesium, eq.magnitude),
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: `M${eq.magnitude.toFixed(1)}`,
          font: '10px Oxanium, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15_000_000),
          scaleByDistance: new Cesium.NearFarScalar(2_000_000, 1.0, 15_000_000, 0.3),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
      state.entities.set(eq.id, entity);
    }
  }

  // Remove stale
  for (const [id, entity] of state.entities) {
    if (!currentIds.has(id)) {
      viewer.entities.remove(entity);
      state.entities.delete(id);
    }
  }

  viewer.scene.requestRender();
}

export function clearEarthquakeLayer(
  viewer: InstanceType<typeof import('cesium').Viewer>,
  state: EarthquakeLayerState
) {
  for (const entity of state.entities.values()) {
    viewer.entities.remove(entity);
  }
  state.entities.clear();
}
