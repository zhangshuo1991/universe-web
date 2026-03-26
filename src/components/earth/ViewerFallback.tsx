'use client';

import type { SelectedLocation, RoutePreview } from '@/store/viewerStore';
import type { Landmark, LocationHotspot } from '@/types/explorer';

export type FallbackCamera = {
  centerLat: number;
  centerLon: number;
  zoom: number;
};

type ViewerFallbackProps = {
  issue: string;
  camera: FallbackCamera;
  landmarks: Landmark[];
  hotspots: LocationHotspot[];
  selectedLocation: SelectedLocation | null;
  routePreview: RoutePreview | null;
  showCityLabels: boolean;
  onHotspotSelect: (hotspot: LocationHotspot) => void;
};

export function ViewerFallback({
  issue,
  camera,
  landmarks,
  hotspots,
  selectedLocation,
  routePreview,
  showCityLabels,
  onHotspotSelect
}: ViewerFallbackProps) {
  const width = 1200;
  const height = 640;
  const fallbackLabels = showCityLabels ? landmarks.slice(0, camera.zoom >= 1.6 ? landmarks.length : 8) : [];
  const fallbackHotspots = hotspots.slice(0, camera.zoom >= 1.45 ? hotspots.length : 5);
  const routePath = routePreview ? buildFallbackRoutePath(routePreview, camera, width, height) : null;
  const routeSummary = routePreview ? `${routePreview.from.label} → ${routePreview.to.label}` : null;
  const selectedPoint = selectedLocation && selectedLocation.kind !== 'space-object'
    ? projectFallbackPoint(selectedLocation.lat, selectedLocation.lon, camera, width, height)
    : null;

  return (
    <div className="viewerFallback" aria-label="2D 地球预览模式">
      <div className="viewerFallbackNotice">
        <strong>2D 预览模式</strong>
        <p>{issue}</p>
      </div>

      <svg className="viewerFallbackMap" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="二维世界示意图">
        <defs>
          <linearGradient id="fallbackRouteStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f7b955" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} className="viewerFallbackSea" />
        {[-120, -60, 0, 60, 120].map((lon) => {
          const { x } = projectFallbackPoint(0, lon, camera, width, height);
          return <line key={`lon-${lon}`} x1={x} y1="0" x2={x} y2={height} className="viewerFallbackGrid" />;
        })}
        {[-60, -30, 0, 30, 60].map((lat) => {
          const { y } = projectFallbackPoint(lat, 0, camera, width, height);
          return <line key={`lat-${lat}`} x1="0" y1={y} x2={width} y2={y} className="viewerFallbackGrid" />;
        })}

        {routePath && <path d={routePath.d} className="viewerFallbackRoute" />}

        {fallbackLabels.map((landmark) => {
          const point = projectFallbackPoint(landmark.lat, landmark.lon, camera, width, height);
          return (
            <g key={landmark.id} transform={`translate(${point.x}, ${point.y})`} className="viewerFallbackLandmark">
              <circle r={camera.zoom >= 1.6 ? 5 : 4} />
              <text x={10} y={4}>{landmark.name}</text>
            </g>
          );
        })}

        {fallbackHotspots.map((hotspot) => {
          const point = projectFallbackPoint(hotspot.lat, hotspot.lon, camera, width, height);
          return (
            <g
              key={hotspot.id}
              transform={`translate(${point.x}, ${point.y})`}
              className="viewerFallbackEndpoint"
              onClick={() => onHotspotSelect(hotspot)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onHotspotSelect(hotspot);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`查看热点地点 ${hotspot.name}`}
            >
              <circle r="6" />
              <text x="12" y="-10">{hotspot.name}</text>
            </g>
          );
        })}

        {selectedPoint && (
          <g transform={`translate(${selectedPoint.x}, ${selectedPoint.y})`} className="viewerFallbackSelected">
            <circle r="7" />
            <text x="14" y="5">{selectedLocation?.label ?? '当前地点'}</text>
          </g>
        )}

        {routePath?.from && (
          <g transform={`translate(${routePath.from.x}, ${routePath.from.y})`} className="viewerFallbackEndpoint">
            <circle r="6" />
            <text x="12" y="-10">{routePreview?.from.label}</text>
          </g>
        )}
        {routePath?.to && (
          <g transform={`translate(${routePath.to.x}, ${routePath.to.y})`} className="viewerFallbackEndpoint">
            <circle r="6" />
            <text x="12" y="-10">{routePreview?.to.label}</text>
          </g>
        )}
      </svg>

      <div className="viewerFallbackLegend">
        <span>缩放 {camera.zoom.toFixed(1)}×</span>
        {routeSummary && <strong>{routeSummary}</strong>}
      </div>
    </div>
  );
}

function projectFallbackPoint(
  lat: number,
  lon: number,
  camera: FallbackCamera,
  width: number,
  height: number
) {
  const wrappedLon = normalizeRelativeLongitude(lon, camera.centerLon);
  const x = ((wrappedLon - camera.centerLon) / 360) * width * camera.zoom + width / 2;
  const y = ((camera.centerLat - lat) / 180) * height * camera.zoom + height / 2;

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2))
  };
}

function normalizeRelativeLongitude(lon: number, anchorLon: number) {
  let nextLon = lon;
  while (nextLon - anchorLon > 180) nextLon -= 360;
  while (nextLon - anchorLon < -180) nextLon += 360;
  return nextLon;
}

function buildFallbackRoutePath(
  routePreview: RoutePreview,
  camera: FallbackCamera,
  width: number,
  height: number
) {
  const from = projectFallbackPoint(routePreview.from.lat, routePreview.from.lon, camera, width, height);
  let to = projectFallbackPoint(routePreview.to.lat, routePreview.to.lon, camera, width, height);

  if (Math.abs(to.x - from.x) > width / 2) {
    to = {
      x: to.x > from.x ? to.x - width : to.x + width,
      y: to.y
    };
  }

  const midX = (from.x + to.x) / 2;
  const midY = Math.min(from.y, to.y) - Math.max(54, Math.abs(to.x - from.x) * 0.18);

  return {
    d: `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`,
    from,
    to
  };
}
