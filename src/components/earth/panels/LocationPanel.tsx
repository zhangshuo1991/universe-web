'use client';

import { useViewerStore } from '@/store/viewerStore';

export function LocationPanel() {
  const selectedLocation = useViewerStore((s) => s.selectedLocation);
  const locationData = useViewerStore((s) => s.locationData);
  const locationLoading = useViewerStore((s) => s.locationLoading);

  if (!selectedLocation) {
    return (
      <section className="infoPanel">
        <div className="panelHeader">
          <h2>位置信息</h2>
        </div>
        <p className="emptyState">点击地球上的任意位置查看详细数据</p>
      </section>
    );
  }

  const weather = locationData?.weather;
  const solar = locationData?.solar;
  const placeName = locationData?.placeName;

  return (
    <section className="infoPanel">
      <div className="panelHeader">
        <h2>位置信息</h2>
        <strong>{selectedLocation.label}</strong>
      </div>

      {placeName && (
        <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: '0.82rem' }}>
          {placeName}
        </p>
      )}

      <div className="fieldGrid">
        <div className="fieldGroup">
          <span>纬度</span>
          <strong>{selectedLocation.lat.toFixed(4)}°</strong>
        </div>
        <div className="fieldGroup">
          <span>经度</span>
          <strong>{selectedLocation.lon.toFixed(4)}°</strong>
        </div>
      </div>

      {locationLoading && (
        <p className="emptyState">加载数据中...</p>
      )}

      {weather && (
        <>
          <div className="panelHeader panelHeaderSpaced">
            <h3>天气</h3>
          </div>
          <div className="fieldGrid">
            {weather.temperature !== undefined && (
              <div className="fieldGroup">
                <span>温度</span>
                <strong>{weather.temperature.toFixed(1)}°C</strong>
              </div>
            )}
            {weather.humidity !== undefined && (
              <div className="fieldGroup">
                <span>湿度</span>
                <strong>{weather.humidity}%</strong>
              </div>
            )}
            {weather.windSpeed !== undefined && (
              <div className="fieldGroup">
                <span>风速</span>
                <strong>{weather.windSpeed.toFixed(1)} m/s</strong>
              </div>
            )}
            {weather.description && (
              <div className="fieldGroup">
                <span>天气</span>
                <strong>{weather.description}</strong>
              </div>
            )}
          </div>
        </>
      )}

      {solar && (
        <>
          <div className="panelHeader panelHeaderSpaced">
            <h3>太阳位置</h3>
          </div>
          <div className="fieldGrid">
            {solar.altitudeDegrees != null && (
              <div className="fieldGroup">
                <span>高度角</span>
                <strong>{solar.altitudeDegrees.toFixed(1)}°</strong>
              </div>
            )}
            {solar.azimuthDegrees != null && (
              <div className="fieldGroup">
                <span>方位角</span>
                <strong>{solar.azimuthDegrees.toFixed(1)}°</strong>
              </div>
            )}
            {solar.daylight != null && (
              <div className="fieldGroup">
                <span>状态</span>
                <strong style={{ color: solar.daylight ? 'var(--warm)' : 'var(--aqua)' }}>
                  {solar.daylight ? '白天' : '夜晚'}
                </strong>
              </div>
            )}
            {solar.localSolarTimeHours != null && (
              <div className="fieldGroup">
                <span>地方太阳时</span>
                <strong>
                  {Math.floor(solar.localSolarTimeHours)}:{String(Math.floor((solar.localSolarTimeHours % 1) * 60)).padStart(2, '0')}
                </strong>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
