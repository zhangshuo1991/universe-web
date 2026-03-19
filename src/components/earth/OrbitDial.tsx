import type { EarthState } from '@/simulation/astronomy';

const SIZE = 220;
const CENTER = SIZE / 2;
const ORBIT_RADIUS = 72;

export function OrbitDial({ earthState }: { earthState: EarthState }) {
  const earthX = CENTER + Math.cos(earthState.orbitAngleRadians) * ORBIT_RADIUS;
  const earthY = CENTER + Math.sin(earthState.orbitAngleRadians) * ORBIT_RADIUS;

  return (
    <div className="orbitDial">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="orbitSvg" aria-label="Earth orbit dial">
        <defs>
          <radialGradient id="sun-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff5bf" />
            <stop offset="65%" stopColor="#f7b955" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.1" />
          </radialGradient>
        </defs>
        <circle cx={CENTER} cy={CENTER} r={ORBIT_RADIUS} className="orbitPath" />
        <circle cx={CENTER} cy={CENTER} r="18" fill="url(#sun-glow)" />
        <circle cx={earthX} cy={earthY} r="10" className="earthMarker" />
        <line x1={CENTER} y1={CENTER} x2={earthX} y2={earthY} className="orbitVector" />
      </svg>
      <div className="orbitDialMeta">
        <span>公转位置</span>
        <strong>{earthState.seasonLabel}</strong>
        <span>{earthState.orbitDistanceAu.toFixed(3)} AU</span>
      </div>
    </div>
  );
}
