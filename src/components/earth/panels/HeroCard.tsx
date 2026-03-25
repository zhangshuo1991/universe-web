'use client';

import { useViewerStore } from '@/store/viewerStore';

export function HeroCard() {
  const sidebarCollapsed = useViewerStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useViewerStore((s) => s.setSidebarCollapsed);

  return (
    <div className="sidebarTopbar">
      <section className="heroCard">
        <p className="eyebrow">Earth Observer</p>
        <h1>地球观测站</h1>
        <p className="heroCopy">
          CesiumJS 真实地球渲染 · 实时卫星追踪 · USGS 地震 · NASA GIBS 气象 · NOAA 空间天气 · AI 智能分析
        </p>
        <div className="statRow">
          <div>
            <span>数据源</span>
            <strong>8+</strong>
          </div>
          <div>
            <span>图层</span>
            <strong>14</strong>
          </div>
          <div>
            <span>卫星</span>
            <strong>8</strong>
          </div>
        </div>
      </section>
      <button
        type="button"
        className="sidebarToggle"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        aria-expanded={!sidebarCollapsed}
      >
        {sidebarCollapsed ? '展开' : '收起'}
      </button>
    </div>
  );
}
