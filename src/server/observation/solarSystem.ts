import type { BodyStateVector, CelestialBodyDescriptor, SystemSnapshot } from '@/types/observation';

const AU_IN_KM = 149_597_870.7;
const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const CACHE_TTL_MS = 15 * 60 * 1000;

type HorizonsConfig = {
  command: string;
  center: string;
};

type CachedBodyState = {
  expiresAt: number;
  value: BodyStateVector;
};

/**
 * Body catalog with orbital parameters sourced from NASA JPL planetary fact sheets.
 *
 * - `phaseAtJ2000Deg`: Mean longitude L₀ at J2000 (2000-01-01T12:00:00 TDB).
 * - `longitudeOfPerihelionDeg`: Longitude of perihelion ϖ = ω + Ω at J2000.
 *   Used together with phaseAtJ2000Deg to derive mean anomaly M₀ = L₀ − ϖ.
 *
 * Sources:
 *   https://nssdc.gsfc.nasa.gov/planetary/factsheet/
 *   Meeus, "Astronomical Algorithms", Table 31.A
 */
const BODY_CATALOG: CelestialBodyDescriptor[] = [
  {
    id: 'sun',
    name: 'Sun',
    category: 'star',
    radiusKm: 696_340,
    color: '#f7b955',
    summary: 'Central star of the Solar System and the dominant source of gravity, light, and space weather.',
    defaultVisible: true,
    rotationPeriodHours: 648,
    axialTiltDeg: 7.25
  },
  {
    id: 'mercury',
    name: 'Mercury',
    category: 'planet',
    parentId: 'sun',
    radiusKm: 2_439.7,
    color: '#bca58a',
    summary: 'Innermost planet with the largest orbital eccentricity among the eight planets.',
    defaultVisible: true,
    semiMajorAxisAu: 0.3871,
    eccentricity: 0.2056,
    orbitalPeriodDays: 87.969,
    rotationPeriodHours: 1407.6,
    axialTiltDeg: 0.034,
    phaseAtJ2000Deg: 252.25,
    orbitInclinationDeg: 7.0,
    longitudeOfPerihelionDeg: 77.46
  },
  {
    id: 'venus',
    name: 'Venus',
    category: 'planet',
    parentId: 'sun',
    radiusKm: 6_051.8,
    color: '#d5a46a',
    summary: 'Dense-atmosphere terrestrial planet with retrograde rotation and strong greenhouse forcing.',
    defaultVisible: true,
    semiMajorAxisAu: 0.7233,
    eccentricity: 0.0068,
    orbitalPeriodDays: 224.701,
    rotationPeriodHours: -5832.5,
    axialTiltDeg: 177.36,
    phaseAtJ2000Deg: 181.98,
    orbitInclinationDeg: 3.39,
    longitudeOfPerihelionDeg: 131.53
  },
  {
    id: 'earth',
    name: 'Earth',
    category: 'planet',
    parentId: 'sun',
    radiusKm: 6_371,
    color: '#4da4ff',
    summary: 'Ocean-bearing terrestrial planet with active plate tectonics and a large natural satellite.',
    defaultVisible: true,
    semiMajorAxisAu: 1,
    eccentricity: 0.0167,
    orbitalPeriodDays: 365.256,
    rotationPeriodHours: 23.934,
    axialTiltDeg: 23.439,
    phaseAtJ2000Deg: 100.46,
    longitudeOfPerihelionDeg: 102.94
  },
  {
    id: 'moon',
    name: 'Moon',
    category: 'moon',
    parentId: 'earth',
    radiusKm: 1_737.4,
    color: '#d8dde6',
    summary: 'Earth\u2019s only natural satellite and the strongest external tidal driver in the Earth system.',
    defaultVisible: true,
    semiMajorAxisKm: 384_400,
    eccentricity: 0.0549,
    orbitalPeriodDays: 27.321661,
    rotationPeriodHours: 655.728,
    axialTiltDeg: 6.68,
    phaseAtJ2000Deg: 218.32,
    orbitInclinationDeg: 5.145,
    longitudeOfPerihelionDeg: 83.35
  },
  {
    id: 'mars',
    name: 'Mars',
    category: 'planet',
    parentId: 'sun',
    radiusKm: 3_389.5,
    color: '#e36a4e',
    summary: 'Cold desert world with strong seasonal dust transport and a rich orbital exploration record.',
    defaultVisible: true,
    semiMajorAxisAu: 1.5237,
    eccentricity: 0.0934,
    orbitalPeriodDays: 686.98,
    rotationPeriodHours: 24.623,
    axialTiltDeg: 25.19,
    phaseAtJ2000Deg: 355.45,
    orbitInclinationDeg: 1.85,
    longitudeOfPerihelionDeg: 336.04
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    category: 'planet',
    parentId: 'sun',
    radiusKm: 69_911,
    color: '#d7b38a',
    summary: 'Gas giant whose mass dominates the planetary system and shapes asteroid and comet dynamics.',
    defaultVisible: true,
    semiMajorAxisAu: 5.2028,
    eccentricity: 0.0489,
    orbitalPeriodDays: 4332.59,
    rotationPeriodHours: 9.925,
    axialTiltDeg: 3.13,
    phaseAtJ2000Deg: 34.4,
    orbitInclinationDeg: 1.3,
    longitudeOfPerihelionDeg: 14.72
  },
  {
    id: 'io',
    name: 'Io',
    category: 'moon',
    parentId: 'jupiter',
    radiusKm: 1_821.6,
    color: '#e8cf72',
    summary: 'Innermost Galilean moon and the most volcanically active body in the Solar System.',
    defaultVisible: true,
    semiMajorAxisKm: 421_700,
    orbitalPeriodDays: 1.769,
    rotationPeriodHours: 42.456,
    phaseAtJ2000Deg: 17,
    orbitInclinationDeg: 0.04
  },
  {
    id: 'europa',
    name: 'Europa',
    category: 'moon',
    parentId: 'jupiter',
    radiusKm: 1_560.8,
    color: '#bcd5f0',
    summary: 'Ice-covered Galilean moon with a high-priority subsurface ocean astrobiology target.',
    defaultVisible: true,
    semiMajorAxisKm: 671_100,
    orbitalPeriodDays: 3.551,
    rotationPeriodHours: 85.224,
    phaseAtJ2000Deg: 110,
    orbitInclinationDeg: 0.47
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    category: 'moon',
    parentId: 'jupiter',
    radiusKm: 2_634.1,
    color: '#c0c7d8',
    summary: 'Largest moon in the Solar System and the only moon known to sustain a global magnetic field.',
    defaultVisible: true,
    semiMajorAxisKm: 1_070_400,
    orbitalPeriodDays: 7.155,
    rotationPeriodHours: 171.72,
    phaseAtJ2000Deg: 215,
    orbitInclinationDeg: 0.2
  },
  {
    id: 'callisto',
    name: 'Callisto',
    category: 'moon',
    parentId: 'jupiter',
    radiusKm: 2_410.3,
    color: '#9ea6ba',
    summary: 'Heavily cratered outer Galilean moon that preserves a long-term impact record.',
    defaultVisible: true,
    semiMajorAxisKm: 1_882_700,
    orbitalPeriodDays: 16.689,
    rotationPeriodHours: 400.536,
    phaseAtJ2000Deg: 287,
    orbitInclinationDeg: 0.19
  },
  {
    id: 'saturn',
    name: 'Saturn',
    category: 'planet',
    parentId: 'sun',
    radiusKm: 58_232,
    color: '#d7c18a',
    summary: 'Ringed gas giant with complex satellite resonances and a dynamically active magnetosphere.',
    defaultVisible: true,
    semiMajorAxisAu: 9.5388,
    eccentricity: 0.0565,
    orbitalPeriodDays: 10_759.22,
    rotationPeriodHours: 10.7,
    axialTiltDeg: 26.73,
    phaseAtJ2000Deg: 49.94,
    orbitInclinationDeg: 2.49,
    longitudeOfPerihelionDeg: 92.43
  },
  {
    id: 'titan',
    name: 'Titan',
    category: 'moon',
    parentId: 'saturn',
    radiusKm: 2_574.7,
    color: '#d9aa5e',
    summary: 'Saturn\u2019s largest moon and the only moon with a thick nitrogen atmosphere and methane cycle.',
    defaultVisible: true,
    semiMajorAxisKm: 1_221_870,
    orbitalPeriodDays: 15.945,
    rotationPeriodHours: 382.68,
    phaseAtJ2000Deg: 75,
    orbitInclinationDeg: 0.35
  },
  {
    id: 'uranus',
    name: 'Uranus',
    category: 'planet',
    parentId: 'sun',
    radiusKm: 25_362,
    color: '#8fe0f3',
    summary: 'Ice giant with an extreme axial tilt that effectively rotates on its side.',
    defaultVisible: true,
    semiMajorAxisAu: 19.1914,
    eccentricity: 0.0472,
    orbitalPeriodDays: 30_688.5,
    rotationPeriodHours: -17.24,
    axialTiltDeg: 97.77,
    phaseAtJ2000Deg: 313.23,
    orbitInclinationDeg: 0.77,
    longitudeOfPerihelionDeg: 170.96
  },
  {
    id: 'neptune',
    name: 'Neptune',
    category: 'planet',
    parentId: 'sun',
    radiusKm: 24_622,
    color: '#4e7fff',
    summary: 'Outer ice giant with strong zonal winds and a major moon captured into retrograde orbit.',
    defaultVisible: true,
    semiMajorAxisAu: 30.069,
    eccentricity: 0.0086,
    orbitalPeriodDays: 60_182,
    rotationPeriodHours: 16.11,
    axialTiltDeg: 28.32,
    phaseAtJ2000Deg: 304.88,
    orbitInclinationDeg: 1.77,
    longitudeOfPerihelionDeg: 44.97
  }
];

const HORIZONS_CONFIG: Record<string, HorizonsConfig> = {
  mercury: { command: '199', center: '500@10' },
  venus: { command: '299', center: '500@10' },
  earth: { command: '399', center: '500@10' },
  moon: { command: '301', center: '500@399' },
  mars: { command: '499', center: '500@10' },
  jupiter: { command: '599', center: '500@10' },
  io: { command: '501', center: '500@599' },
  europa: { command: '502', center: '500@599' },
  ganymede: { command: '503', center: '500@599' },
  callisto: { command: '504', center: '500@599' },
  saturn: { command: '699', center: '500@10' },
  titan: { command: '606', center: '500@699' },
  uranus: { command: '799', center: '500@10' },
  neptune: { command: '899', center: '500@10' }
};

const stateCache = new Map<string, CachedBodyState>();
let horizonsQueue = Promise.resolve();

function getBodyById(bodyId: string) {
  const body = BODY_CATALOG.find((candidate) => candidate.id === bodyId);
  if (!body) {
    throw new Error(`Unknown celestial body: ${bodyId}`);
  }
  return body;
}

function toAu(km: number) {
  return km / AU_IN_KM;
}

function daysSinceJ2000(epoch: Date) {
  return (epoch.getTime() - J2000_UTC_MS) / 86_400_000;
}

function cacheKey(bodyId: string, epochIso: string) {
  return `${bodyId}:${epochIso.slice(0, 16)}`;
}

function formatHorizonsEpoch(epoch: Date) {
  return epoch.toISOString().slice(0, 19).replace('T', ' ');
}

async function enqueueHorizons<T>(task: () => Promise<T>) {
  const run = horizonsQueue.then(task, task);
  horizonsQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function parseHorizonsVector(result: string) {
  const start = result.indexOf('$$SOE');
  const end = result.indexOf('$$EOE');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Invalid Horizons response envelope');
  }

  const lines = result
    .slice(start + 5, end)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const sample = lines[0];
  if (!sample) {
    throw new Error('Horizons response is empty');
  }

  const numericValues = sample
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));

  if (numericValues.length < 7) {
    throw new Error('Horizons vector line is missing expected values');
  }

  const [, x, y, z, vx, vy, vz] = numericValues;
  return {
    positionKm: { x, y, z },
    velocityKmS: { x: vx, y: vy, z: vz }
  };
}

async function fetchHorizonsRelativeVector(bodyId: string, epoch: Date) {
  const config = HORIZONS_CONFIG[bodyId];
  if (!config) {
    throw new Error(`No Horizons configuration for body ${bodyId}`);
  }

  return enqueueHorizons(async () => {
    const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
    const start = formatHorizonsEpoch(epoch);
    const stop = formatHorizonsEpoch(new Date(epoch.getTime() + 60_000));

    url.searchParams.set('format', 'json');
    url.searchParams.set('COMMAND', config.command);
    url.searchParams.set('OBJ_DATA', 'NO');
    url.searchParams.set('MAKE_EPHEM', 'YES');
    url.searchParams.set('EPHEM_TYPE', 'VECTORS');
    url.searchParams.set('CENTER', config.center);
    url.searchParams.set('START_TIME', start);
    url.searchParams.set('STOP_TIME', stop);
    url.searchParams.set('STEP_SIZE', '1 m');
    url.searchParams.set('VEC_TABLE', '2');
    url.searchParams.set('REF_SYSTEM', 'ICRF');
    url.searchParams.set('OUT_UNITS', 'KM-S');
    url.searchParams.set('CSV_FORMAT', 'YES');

    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_500)
    });
    if (!response.ok) {
      throw new Error(`Horizons request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      result?: string;
      error?: string;
    };
    if (payload.error) {
      throw new Error(payload.error);
    }
    if (!payload.result) {
      throw new Error('Horizons returned no vector content');
    }

    return parseHorizonsVector(payload.result);
  });
}

function combineVectors(
  body: CelestialBodyDescriptor,
  epoch: Date,
  source: BodyStateVector['source'],
  parentState: BodyStateVector | null,
  relativePositionKm: { x: number; y: number; z: number },
  relativeVelocityKmS: { x: number; y: number; z: number }
): BodyStateVector {
  const parentPositionKm = parentState?.positionKm ?? { x: 0, y: 0, z: 0 };
  const parentVelocityKmS = parentState?.velocityKmS ?? { x: 0, y: 0, z: 0 };

  const positionKm = {
    x: parentPositionKm.x + relativePositionKm.x,
    y: parentPositionKm.y + relativePositionKm.y,
    z: parentPositionKm.z + relativePositionKm.z
  };
  const velocityKmS = {
    x: parentVelocityKmS.x + relativeVelocityKmS.x,
    y: parentVelocityKmS.y + relativeVelocityKmS.y,
    z: parentVelocityKmS.z + relativeVelocityKmS.z
  };

  const positionAu = {
    x: toAu(positionKm.x),
    y: toAu(positionKm.y),
    z: toAu(positionKm.z)
  };

  return {
    bodyId: body.id,
    parentId: body.parentId,
    epochIso: epoch.toISOString(),
    source,
    positionKm,
    positionAu,
    velocityKmS,
    distanceFromSunAu: Math.sqrt(positionAu.x ** 2 + positionAu.y ** 2 + positionAu.z ** 2)
  };
}

/**
 * Solve Kepler's equation M = E - e·sin(E) for eccentric anomaly E
 * using Newton-Raphson iteration.
 */
function solveKeplerEquation(meanAnomalyRad: number, eccentricity: number): number {
  let E = meanAnomalyRad;
  for (let i = 0; i < 15; i++) {
    const dE = (E - eccentricity * Math.sin(E) - meanAnomalyRad) / (1 - eccentricity * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/**
 * Compute the orbital position (km) of a body at a given time offset from J2000,
 * using Keplerian orbital mechanics instead of a circular approximation.
 *
 * For bodies without eccentricity data (e.g. some moons), e defaults to 0
 * and the equation degenerates to the circular case.
 */
function keplerPositionKm(body: CelestialBodyDescriptor, days: number): { x: number; y: number; z: number } {
  const periodDays = body.orbitalPeriodDays ?? 1;
  const e = body.eccentricity ?? 0;
  const inclinationRad = ((body.orbitInclinationDeg ?? 0) * Math.PI) / 180;
  const semiMajorAxisKm =
    body.parentId && body.parentId !== 'sun'
      ? (body.semiMajorAxisKm ?? 0)
      : (body.semiMajorAxisAu ?? 0) * AU_IN_KM;

  // Mean longitude at the given epoch
  const meanLongitudeDeg = (body.phaseAtJ2000Deg ?? 0) + (days / periodDays) * 360;
  const perihelionDeg = body.longitudeOfPerihelionDeg ?? 0;

  // Mean anomaly: M = L - ϖ
  const meanAnomalyRad = ((meanLongitudeDeg - perihelionDeg) % 360) * (Math.PI / 180);

  // Solve Kepler's equation for eccentric anomaly E
  const E = solveKeplerEquation(meanAnomalyRad, e);

  // True anomaly ν
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );

  // Radial distance
  const r = semiMajorAxisKm * (1 - e * Math.cos(E));

  // True longitude (angle in ecliptic-like plane)
  const trueLongitude = (perihelionDeg * Math.PI) / 180 + nu;

  return {
    x: r * Math.cos(trueLongitude),
    y: r * Math.sin(trueLongitude) * Math.cos(inclinationRad),
    z: r * Math.sin(trueLongitude) * Math.sin(inclinationRad)
  };
}

function approximateState(body: CelestialBodyDescriptor, epoch: Date, parentState: BodyStateVector | null): BodyStateVector {
  const days = daysSinceJ2000(epoch);
  const position = keplerPositionKm(body, days);

  // Velocity via symmetric finite differences (±30 seconds)
  const dt = 30 / 86_400;
  const before = keplerPositionKm(body, days - dt);
  const after = keplerPositionKm(body, days + dt);
  const velocity = {
    x: (after.x - before.x) / 60,
    y: (after.y - before.y) / 60,
    z: (after.z - before.z) / 60
  };

  return combineVectors(body, epoch, 'fallback_model', parentState, position, velocity);
}

async function resolveBodyState(
  bodyId: string,
  epoch: Date,
  resolved: Map<string, BodyStateVector>
): Promise<BodyStateVector> {
  if (resolved.has(bodyId)) {
    return resolved.get(bodyId)!;
  }

  const body = getBodyById(bodyId);
  if (body.id === 'sun') {
    const zeroState: BodyStateVector = {
      bodyId: 'sun',
      epochIso: epoch.toISOString(),
      source: 'fallback_model',
      positionKm: { x: 0, y: 0, z: 0 },
      positionAu: { x: 0, y: 0, z: 0 },
      velocityKmS: { x: 0, y: 0, z: 0 },
      distanceFromSunAu: 0
    };
    resolved.set(bodyId, zeroState);
    return zeroState;
  }

  const cached = stateCache.get(cacheKey(bodyId, epoch.toISOString()));
  if (cached && cached.expiresAt > Date.now()) {
    const value = { ...cached.value, source: 'cached_horizons' as const };
    resolved.set(bodyId, value);
    return value;
  }

  const parentState =
    body.parentId && body.parentId !== 'sun' ? await resolveBodyState(body.parentId, epoch, resolved) : null;

  const state = approximateState(body, epoch, parentState);
  resolved.set(bodyId, state);
  return state;
}

export function getSolarSystemCatalog() {
  return BODY_CATALOG;
}

export function getDefaultBodyIds() {
  return BODY_CATALOG.filter((body) => body.defaultVisible).map((body) => body.id);
}

export function getBodyMetadata(bodyId: string) {
  return getBodyById(bodyId);
}

export async function getBodyState(bodyId: string, epochIso?: string) {
  const epoch = epochIso ? new Date(epochIso) : new Date();
  if (Number.isNaN(epoch.getTime())) {
    throw new Error(`Invalid epochIso: ${epochIso}`);
  }
  const resolved = new Map<string, BodyStateVector>();
  return resolveBodyState(bodyId, epoch, resolved);
}

export async function getSystemSnapshot(bodyIds?: string[], epochIso?: string): Promise<SystemSnapshot> {
  const epoch = epochIso ? new Date(epochIso) : new Date();
  if (Number.isNaN(epoch.getTime())) {
    throw new Error(`Invalid epochIso: ${epochIso}`);
  }

  const targets = bodyIds?.length ? bodyIds : getDefaultBodyIds();
  const resolved = new Map<string, BodyStateVector>();

  for (const bodyId of targets) {
    await resolveBodyState(bodyId, epoch, resolved);
  }

  return {
    epochIso: epoch.toISOString(),
    bodies: targets.map((bodyId) => resolved.get(bodyId)!)
  };
}
