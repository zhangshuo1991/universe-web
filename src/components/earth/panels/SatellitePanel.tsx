'use client';

import { useViewerStore } from '@/store/viewerStore';
import type { SatelliteCategoryId } from '@/server/satellites';
import { useState } from 'react';

const CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  stations: '空间站',
  weather: '气象',
  science: '科学'
};

export function SatellitePanel() {
  const satellites = useViewerStore((s) => s.satellites);
  const selectedSatelliteId = useViewerStore((s) => s.selectedSatelliteId);
  const setSelectedSatelliteId = useViewerStore((s) => s.setSelectedSatelliteId);
  const [filter, setFilter] = useState<SatelliteCategoryId>('all');

  const filtered = satellites.filter((sat) => {
    if (filter === 'all') return true;
    if (filter === 'stations') return [25544, 48274].includes(sat.catnr);
    if (filter === 'weather') return [43013, 33591, 37849].includes(sat.catnr);
    return [20580, 25994, 27424].includes(sat.catnr);
  });

  return (
    <section className="infoPanel">
      <div className="panelHeader">
        <h2>卫星追踪</h2>
        <strong>{satellites.length} 颗</strong>
      </div>
      <div className="chipRow">
        {(['all', 'stations', 'weather', 'science'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            className={filter === cat ? 'chip active' : 'chip'}
            onClick={() => setFilter(cat)}
            aria-pressed={filter === cat}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
      <div className="satelliteList" role="region" aria-label="卫星列表" tabIndex={0}>
        {filtered.map((sat) => (
          <button
            key={sat.catnr}
            type="button"
            className={`resultItem satelliteItem ${selectedSatelliteId === sat.catnr ? 'active' : ''}`}
            onClick={() => {
              setSelectedSatelliteId(selectedSatelliteId === sat.catnr ? null : sat.catnr);
            }}
            style={selectedSatelliteId === sat.catnr ? { borderColor: `${sat.color}80` } : undefined}
          >
            <strong style={{ color: sat.color }}>{sat.label}</strong>
            <span>NORAD {sat.catnr} · Epoch: {sat.omm.EPOCH.slice(0, 10)}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="emptyState">暂无卫星数据</p>
        )}
      </div>
    </section>
  );
}
