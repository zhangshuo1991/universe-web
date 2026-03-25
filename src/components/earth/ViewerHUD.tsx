'use client';

import { useViewerStore } from '@/store/viewerStore';
import type { EarthState } from '@/simulation/astronomy';

export function ViewerHUD({
  earthState,
  landmarkCount
}: {
  earthState: EarthState;
  landmarkCount: number;
}) {
  const currentTimeMs = useViewerStore((s) => s.currentTimeMs);
  const isPlaying = useViewerStore((s) => s.isPlaying);
  const playbackSpeed = useViewerStore((s) => s.playbackSpeed);
  const selectedLocation = useViewerStore((s) => s.selectedLocation);

  const timeStr = new Date(currentTimeMs).toLocaleString('zh-CN', {
    timeZone: 'UTC',
    hour12: false
  });

  return (
    <div className="viewerOverlay">
      <div>
        <span>UTC 时间</span>
        <strong>{timeStr}</strong>
      </div>
      <div>
        <span>季节</span>
        <strong>{earthState.seasonLabel}</strong>
      </div>
      <div>
        <span>探索地标</span>
        <strong>{landmarkCount}</strong>
      </div>
      {selectedLocation && (
        <div>
          <span>当前地点</span>
          <strong>{selectedLocation.label ?? `${selectedLocation.lat.toFixed(2)}°, ${selectedLocation.lon.toFixed(2)}°`}</strong>
        </div>
      )}
      <div>
        <span>时间流速</span>
        <strong>{isPlaying ? `${playbackSpeed}×` : '暂停'}</strong>
      </div>
    </div>
  );
}
