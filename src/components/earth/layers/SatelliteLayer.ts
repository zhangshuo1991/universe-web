import type { SatelliteFeedItem } from '@/server/satellites';

type CesiumModule = typeof import('cesium');

type SatelliteLayerState = {
  entities: Map<number, InstanceType<typeof import('cesium').Entity>>;
  orbitEntity: InstanceType<typeof import('cesium').Entity> | null;
  trackedId: number | null;
};

export function createSatelliteLayer(): SatelliteLayerState {
  return {
    entities: new Map(),
    orbitEntity: null,
    trackedId: null
  };
}

export function updateSatellitePositions(
  Cesium: CesiumModule,
  viewer: InstanceType<typeof import('cesium').Viewer>,
  state: SatelliteLayerState,
  satellites: SatelliteFeedItem[],
  simulationDate: Date,
  visible: boolean
) {
  if (!visible) {
    for (const entity of state.entities.values()) {
      entity.show = false;
    }
    if (state.orbitEntity) state.orbitEntity.show = false;
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const satelliteJs = require('satellite.js');

  const currentIds = new Set<number>();

  for (const sat of satellites) {
    currentIds.add(sat.catnr);

    try {
      const satrec = satelliteJs.twoline2satrec(
        buildTleLine1(sat.omm),
        buildTleLine2(sat.omm)
      );

      const positionAndVelocity = satelliteJs.propagate(satrec, simulationDate);
      const positionEci = positionAndVelocity.position;
      if (!positionEci || typeof positionEci === 'boolean') continue;

      const gmst = satelliteJs.gstime(simulationDate);
      const positionGd = satelliteJs.eciToGeodetic(positionEci, gmst);

      const lon = satelliteJs.degreesLong(positionGd.longitude);
      const lat = satelliteJs.degreesLat(positionGd.latitude);
      const alt = positionGd.height * 1000; // km to m

      const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

      let entity = state.entities.get(sat.catnr);
      if (entity) {
        (entity.position as unknown as { setValue: (v: unknown) => void }).setValue(position);
        entity.show = true;
      } else {
        entity = viewer.entities.add({
          name: sat.label,
          position,
          point: {
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString(sat.color),
            outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
            outlineWidth: 1
          },
          label: {
            text: sat.label,
            font: '11px Oxanium, sans-serif',
            fillColor: Cesium.Color.fromCssColorString(sat.color),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 30_000_000),
            scaleByDistance: new Cesium.NearFarScalar(5_000_000, 1.0, 20_000_000, 0.4)
          }
        });
        state.entities.set(sat.catnr, entity);
      }
    } catch {
      // SGP4 propagation can fail for old TLEs
    }
  }

  // Remove stale entities
  for (const [id, entity] of state.entities) {
    if (!currentIds.has(id)) {
      viewer.entities.remove(entity);
      state.entities.delete(id);
    }
  }

  viewer.scene.requestRender();
}

export function showSatelliteOrbit(
  Cesium: CesiumModule,
  viewer: InstanceType<typeof import('cesium').Viewer>,
  state: SatelliteLayerState,
  satellite: SatelliteFeedItem,
  simulationDate: Date
) {
  // Remove old orbit
  if (state.orbitEntity) {
    viewer.entities.remove(state.orbitEntity);
    state.orbitEntity = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const satelliteJs = require('satellite.js');

  try {
    const satrec = satelliteJs.twoline2satrec(
      buildTleLine1(satellite.omm),
      buildTleLine2(satellite.omm)
    );

    const meanMotion = Number(satellite.omm.MEAN_MOTION);
    const periodMinutes = 1440 / meanMotion;
    const periodMs = periodMinutes * 60 * 1000;
    const startTime = new Date(simulationDate.getTime() - periodMs);
    const endTime = new Date(simulationDate.getTime() + periodMs);
    const stepMs = periodMs / 90;

    const positions: number[] = [];

    for (let t = startTime.getTime(); t <= endTime.getTime(); t += stepMs) {
      const date = new Date(t);
      const pv = satelliteJs.propagate(satrec, date);
      const pos = pv.position;
      if (!pos || typeof pos === 'boolean') continue;
      const gmst = satelliteJs.gstime(date);
      const gd = satelliteJs.eciToGeodetic(pos, gmst);
      positions.push(
        satelliteJs.degreesLong(gd.longitude),
        satelliteJs.degreesLat(gd.latitude),
        gd.height * 1000
      );
    }

    if (positions.length > 0) {
      state.orbitEntity = viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
          width: 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString(satellite.color).withAlpha(0.5),
            dashLength: 8
          })
        }
      });
    }

    state.trackedId = satellite.catnr;
    viewer.scene.requestRender();
  } catch {
    // Propagation error
  }
}

export function clearSatelliteOrbit(
  viewer: InstanceType<typeof import('cesium').Viewer>,
  state: SatelliteLayerState
) {
  if (state.orbitEntity) {
    viewer.entities.remove(state.orbitEntity);
    state.orbitEntity = null;
  }
  state.trackedId = null;
  viewer.scene.requestRender();
}

// TLE line builders from OMM data
function padRight(str: string, len: number) {
  return str.padEnd(len).slice(0, len);
}

function buildTleLine1(omm: SatelliteFeedItem['omm']): string {
  const catId = String(omm.NORAD_CAT_ID).padStart(5, '0');
  const classification = omm.CLASSIFICATION_TYPE ?? 'U';
  const intlDesig = padRight(String(omm.OBJECT_ID ?? '00000A'), 8);
  const epoch = epochToTle(String(omm.EPOCH));
  const mmDot = formatMmDot(Number(omm.MEAN_MOTION_DOT));
  const mmDdot = formatExpNotation(Number(omm.MEAN_MOTION_DDOT));
  const bstar = formatExpNotation(Number(omm.BSTAR));
  const elsetNo = String(omm.ELEMENT_SET_NO).padStart(4, ' ');

  const line = `1 ${catId}${classification} ${intlDesig} ${epoch} ${mmDot} ${mmDdot} ${bstar} 0 ${elsetNo}`;
  const checksum = tleChecksum(line);
  return line + checksum;
}

function buildTleLine2(omm: SatelliteFeedItem['omm']): string {
  const catId = String(omm.NORAD_CAT_ID).padStart(5, '0');
  const incl = formatFloat(Number(omm.INCLINATION), 8, 4);
  const raan = formatFloat(Number(omm.RA_OF_ASC_NODE), 8, 4);
  const ecc = formatEccentricity(Number(omm.ECCENTRICITY));
  const argPeri = formatFloat(Number(omm.ARG_OF_PERICENTER), 8, 4);
  const meanAnom = formatFloat(Number(omm.MEAN_ANOMALY), 8, 4);
  const meanMotion = formatFloat(Number(omm.MEAN_MOTION), 11, 8);
  const revNum = String(omm.REV_AT_EPOCH ?? 0).padStart(5, ' ');

  const line = `2 ${catId} ${incl} ${raan} ${ecc} ${argPeri} ${meanAnom} ${meanMotion}${revNum}`;
  const checksum = tleChecksum(line);
  return line + checksum;
}

function formatFloat(value: number, width: number, decimals: number): string {
  return value.toFixed(decimals).padStart(width, ' ');
}

function formatEccentricity(value: number): string {
  return value.toFixed(7).slice(2); // remove "0."
}

function formatMmDot(value: number): string {
  const sign = value >= 0 ? ' ' : '-';
  const abs = Math.abs(value).toFixed(8);
  return sign + abs.slice(1); // remove leading 0
}

function formatExpNotation(value: number): string {
  if (value === 0) return ' 00000-0';
  const sign = value >= 0 ? ' ' : '-';
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  const mantissa = abs / Math.pow(10, exp);
  const mantStr = Math.round(mantissa * 100000).toString().padStart(5, '0');
  const expSign = exp >= 0 ? '+' : '-';
  return `${sign}${mantStr}${expSign}${Math.abs(exp)}`;
}

function epochToTle(isoEpoch: string): string {
  const date = new Date(isoEpoch);
  const year = date.getUTCFullYear() % 100;
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear =
    (date.getTime() - startOfYear.getTime()) / 86_400_000 + 1;
  return `${year.toString().padStart(2, '0')}${dayOfYear.toFixed(8).padStart(12, ' ')}`;
}

function tleChecksum(line: string): string {
  let sum = 0;
  for (const char of line) {
    if (char >= '0' && char <= '9') sum += parseInt(char);
    else if (char === '-') sum += 1;
  }
  return String(sum % 10);
}
