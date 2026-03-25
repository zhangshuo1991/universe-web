'use client';

import { useViewerStore } from '@/store/viewerStore';

const GLOBAL_VIEW = {
  lat: 18,
  lon: 15,
  altitude: 24_000_000,
  heading: 4,
  pitch: -85
};

export function GlobeControls() {
  const controller = useViewerStore((s) => s.controller);

  return (
    <div className="globeControls" role="toolbar" aria-label="地球导航控件">
      <button
        type="button"
        className="globeControlBtn"
        title="指北"
        aria-label="重置朝北"
        onClick={() => controller?.resetNorth?.()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2L8 11h3v9h2v-9h3L12 2Z" />
        </svg>
      </button>

      <button
        type="button"
        className="globeControlBtn"
        title="回到全球"
        aria-label="回到全球视图"
        onClick={() => controller?.flyTo(GLOBAL_VIEW)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5Z" />
        </svg>
      </button>

      <div className="globeControlDivider" />

      <button
        type="button"
        className="globeControlBtn"
        title="放大"
        aria-label="放大"
        onClick={() => controller?.zoomIn?.()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z" />
        </svg>
      </button>

      <button
        type="button"
        className="globeControlBtn"
        title="缩小"
        aria-label="缩小"
        onClick={() => controller?.zoomOut?.()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 13H5v-2h14v2Z" />
        </svg>
      </button>
    </div>
  );
}
