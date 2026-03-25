'use client';

import { useViewerStore } from '@/store/viewerStore';
import type { ViewerLayerId } from '@/types/agent';

const LAYER_ITEMS: Array<{
  id: ViewerLayerId;
  label: string;
}> = [
  { id: 'dayNight', label: '昼夜光照' },
  { id: 'atmosphere', label: '大气层' },
  { id: 'moon', label: '月球' },
  { id: 'satellites', label: '卫星' },
  { id: 'earthquakes', label: '地震' },
  { id: 'weatherClouds', label: '云层' },
  { id: 'weatherTemperature', label: '温度' },
  { id: 'spaceWeather', label: '空间天气' },
  { id: 'smallBodies', label: '小天体' },
  { id: 'cityMarkers', label: '城市标记' },
  { id: 'surfaceOverlays', label: '地表叠加' }
];

export function LayerToggles() {
  const layers = useViewerStore((s) => s.layers);
  const toggleLayer = useViewerStore((s) => s.toggleLayer);

  const activeCount = LAYER_ITEMS.filter((item) => layers[item.id]).length;

  return (
    <section className="infoPanel">
      <div className="panelHeader">
        <h2>图层控制</h2>
        <strong>{activeCount} 个活跃</strong>
      </div>
      <div className="toggleGrid dense">
        {LAYER_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={layers[item.id] ? 'toggle active' : 'toggle'}
            onClick={() => toggleLayer(item.id)}
            aria-pressed={layers[item.id]}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}
