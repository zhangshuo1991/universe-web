import { daysSinceJ2000, toJulianDate } from '@/simulation/julian';
import {
  clamp,
  degreesToRadians,
  normalizeDegrees,
  normalizeSignedDegrees,
  radiansToDegrees
} from '@/simulation/math';

export const EARTH_AXIAL_TILT_DEGREES = 23.439291;
export const EARTH_SIDEREAL_DAY_HOURS = 23.9344696;

export type EarthState = {
  date: Date;
  subsolarLatitude: number;
  subsolarLongitude: number;
  solarDeclination: number;
  solarLongitude: number;
  earthRotationAngle: number;
  orbitAngleRadians: number;
  orbitDistanceAu: number;
  seasonLabel: string;
  gmstDegrees: number;
};

export type SolarPointInfo = {
  altitudeDegrees: number;
  daylight: boolean;
  localSolarTimeHours: number;
  azimuthDegrees: number;
};

function getSeasonLabel(solarLongitude: number) {
  const angle = normalizeDegrees(solarLongitude);

  if (angle >= 315 || angle < 45) {
    return '北半球冬季';
  }

  if (angle < 135) {
    return '北半球春季';
  }

  if (angle < 225) {
    return '北半球夏季';
  }

  return '北半球秋季';
}

export function getEarthState(date: Date): EarthState {
  const n = daysSinceJ2000(date);
  const meanLongitude = normalizeDegrees(280.460 + 0.9856474 * n);
  const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * n);
  const meanAnomalyRad = degreesToRadians(meanAnomaly);
  const eclipticLongitude = normalizeDegrees(
    meanLongitude + 1.915 * Math.sin(meanAnomalyRad) + 0.020 * Math.sin(2 * meanAnomalyRad)
  );
  const eclipticLongitudeRad = degreesToRadians(eclipticLongitude);
  const obliquity = 23.439 - 0.0000004 * n;
  const obliquityRad = degreesToRadians(obliquity);

  const rightAscension = Math.atan2(
    Math.cos(obliquityRad) * Math.sin(eclipticLongitudeRad),
    Math.cos(eclipticLongitudeRad)
  );
  const rightAscensionDegrees = normalizeDegrees(radiansToDegrees(rightAscension));
  const declinationDegrees = radiansToDegrees(
    Math.asin(Math.sin(obliquityRad) * Math.sin(eclipticLongitudeRad))
  );

  const julianDate = toJulianDate(date);
  const t = (julianDate - 2451545.0) / 36525.0;
  const gmstDegrees = normalizeDegrees(
    280.46061837 +
      360.98564736629 * (julianDate - 2451545.0) +
      0.000387933 * t * t -
      (t * t * t) / 38710000
  );

  const subsolarLongitude = normalizeSignedDegrees(rightAscensionDegrees - gmstDegrees);
  const earthHeliocentricLongitude = normalizeDegrees(eclipticLongitude + 180);
  const orbitDistanceAu = 1.00014 - 0.01671 * Math.cos(meanAnomalyRad) - 0.00014 * Math.cos(2 * meanAnomalyRad);

  return {
    date,
    subsolarLatitude: declinationDegrees,
    subsolarLongitude,
    solarDeclination: declinationDegrees,
    solarLongitude: eclipticLongitude,
    earthRotationAngle: gmstDegrees,
    orbitAngleRadians: degreesToRadians(earthHeliocentricLongitude),
    orbitDistanceAu,
    seasonLabel: getSeasonLabel(eclipticLongitude),
    gmstDegrees
  };
}

export function getSolarPointInfo(lat: number, lon: number, earthState: EarthState): SolarPointInfo {
  const latRad = degreesToRadians(lat);
  const declinationRad = degreesToRadians(earthState.solarDeclination);
  const hourAngleDegrees = normalizeSignedDegrees(lon - earthState.subsolarLongitude);
  const hourAngleRad = degreesToRadians(hourAngleDegrees);

  const sinAltitude =
    Math.sin(latRad) * Math.sin(declinationRad) +
    Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
  const altitudeDegrees = radiansToDegrees(Math.asin(clamp(sinAltitude, -1, 1)));

  const azimuthRadians = Math.atan2(
    Math.sin(hourAngleRad),
    Math.cos(hourAngleRad) * Math.sin(latRad) - Math.tan(declinationRad) * Math.cos(latRad)
  );
  const azimuthDegrees = normalizeDegrees(radiansToDegrees(azimuthRadians) + 180);
  const localSolarTimeHours = ((12 + hourAngleDegrees / 15) % 24 + 24) % 24;

  return {
    altitudeDegrees,
    daylight: altitudeDegrees > 0,
    localSolarTimeHours,
    azimuthDegrees
  };
}

export function getLocationLabel(lat: number, lon: number) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}
