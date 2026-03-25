'use client';

import { useViewerStore } from '@/store/viewerStore';

export function MoonCard() {
  const moonEphemeris = useViewerStore((s) => s.moonEphemeris);

  return (
    <section className="infoPanel">
      <div className="panelHeader">
        <h2>月球</h2>
        <strong>{moonEphemeris?.phaseName ?? '—'}</strong>
      </div>
      {moonEphemeris ? (
        <div className="fieldGrid">
          {moonEphemeris.distanceKm != null && (
            <div className="fieldGroup">
              <span>距离</span>
              <strong>{Math.round(moonEphemeris.distanceKm).toLocaleString()} km</strong>
            </div>
          )}
          {moonEphemeris.illumination != null && (
            <div className="fieldGroup">
              <span>照明度</span>
              <strong>{(moonEphemeris.illumination * 100).toFixed(1)}%</strong>
            </div>
          )}
          {moonEphemeris.altitudeDeg != null && (
            <div className="fieldGroup">
              <span>高度角</span>
              <strong>{moonEphemeris.altitudeDeg.toFixed(1)}°</strong>
            </div>
          )}
          {moonEphemeris.azimuthDeg != null && (
            <div className="fieldGroup">
              <span>方位角</span>
              <strong>{moonEphemeris.azimuthDeg.toFixed(1)}°</strong>
            </div>
          )}
        </div>
      ) : (
        <p className="emptyState">月球数据加载中...</p>
      )}
    </section>
  );
}
