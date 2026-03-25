'use client';

import { useViewerStore } from '@/store/viewerStore';

export function SpaceWeatherCard() {
  const spaceWeather = useViewerStore((s) => s.spaceWeather);

  const kpValue = spaceWeather?.latestKp?.kpIndex;
  const kpTime = spaceWeather?.latestKp?.timeTag;

  function kpLevel(kp: number): string {
    if (kp >= 7) return '极端风暴';
    if (kp >= 5) return '地磁风暴';
    if (kp >= 4) return '不稳定';
    return '平静';
  }

  function kpColor(kp: number): string {
    if (kp >= 7) return 'var(--danger)';
    if (kp >= 5) return 'var(--warm)';
    return 'var(--aqua)';
  }

  return (
    <section className="infoPanel">
      <div className="panelHeader">
        <h2>空间天气</h2>
        <strong>NOAA SWPC</strong>
      </div>
      <div className="metricList">
        <div>
          <span>当前 Kp 指数</span>
          <strong style={kpValue != null ? { color: kpColor(kpValue) } : undefined}>
            {kpValue != null ? kpValue.toFixed(2) : '—'}
          </strong>
          {kpValue != null && (
            <small>{kpLevel(kpValue)}</small>
          )}
        </div>
        {kpTime && (
          <div>
            <span>更新时间</span>
            <strong>{kpTime}</strong>
          </div>
        )}
      </div>
      {!spaceWeather && (
        <p className="emptyState">空间天气数据加载中...</p>
      )}
    </section>
  );
}
