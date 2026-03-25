'use client';

import { useViewerStore } from '@/store/viewerStore';

export function SmallBodyPanel() {
  const smallBodyEvents = useViewerStore((s) => s.smallBodyEvents);

  if (smallBodyEvents.length === 0) {
    return (
      <section className="infoPanel">
        <div className="panelHeader">
          <h2>近地天体</h2>
          <strong>JPL CNEOS</strong>
        </div>
        <p className="emptyState">暂无近地接近事件数据</p>
      </section>
    );
  }

  return (
    <section className="infoPanel">
      <div className="panelHeader">
        <h2>近地天体</h2>
        <strong>{smallBodyEvents.length} 个事件</strong>
      </div>
      <div className="smallBodyList" role="region" aria-label="近地天体" tabIndex={0}>
        {smallBodyEvents.slice(0, 8).map((event, index) => {
          const designation = typeof event.designation === 'string' ? event.designation : `NEO #${index + 1}`;
          const missAu = Number(event.missDistanceAu);
          const velocity = Number(event.relativeVelocityKmS);

          return (
            <article key={`${designation}-${index}`} className="smallBodyRow">
              <strong>{designation}</strong>
              <div className="smallBodyMeta">
                <span>掠过距离</span>
                <strong>{Number.isFinite(missAu) ? `${missAu.toFixed(5)} AU` : '—'}</strong>
              </div>
              <div className="smallBodyMeta">
                <span>相对速度</span>
                <strong>{Number.isFinite(velocity) ? `${velocity.toFixed(2)} km/s` : '—'}</strong>
              </div>
              {typeof event.closeApproachTimeUtc === 'string' && (
                <div className="smallBodyMeta">
                  <span>接近时刻</span>
                  <strong>{event.closeApproachTimeUtc}</strong>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
