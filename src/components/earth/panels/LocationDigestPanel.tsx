'use client';

import { useState } from 'react';

import type { ProviderDescriptor } from '@/types/observation';
import type { Landmark, LocationDigest, LocationHotspot } from '@/types/explorer';
import type { SelectedLocation } from '@/store/viewerStore';
import type { SidebarSection } from '@/components/earth/ExplorerSidebar';
import type { ViewerLayerId } from '@/types/agent';

type LocationDigestPanelProps = {
  activeSection: SidebarSection;
  landmarks: Landmark[];
  hotspots: LocationHotspot[];
  selectedLocation: SelectedLocation | null;
  locationDigest: LocationDigest | null;
  locationLoading: boolean;
  locationHotspotsLoading: boolean;
  providers: ProviderDescriptor[];
  layers: Record<ViewerLayerId, boolean>;
  satelliteCategories: Record<'stations' | 'weather' | 'science', boolean>;
  onSelectLandmark: (landmark: Landmark) => void;
  onSelectHotspot: (hotspot: LocationHotspot) => void;
  onClearSelection: () => void;
  onToggleLayer: (layerId: ViewerLayerId) => void;
  onToggleSatelliteCategory: (category: 'stations' | 'weather' | 'science') => void;
  onLocateMoon?: () => void;
  onLocateSatellite?: (catnr: number) => void;
};

const LAYER_OPTIONS: Array<{
  id: ViewerLayerId;
  label: string;
  description: string;
}> = [
  { id: 'cityMarkers', label: '地标标签', description: '显示著名地标和地名' },
  { id: 'dayNight', label: '昼夜光照', description: '用昼夜界线增加地球层次' },
  { id: 'atmosphere', label: '大气层', description: '保持地球边缘发光和气层' },
  { id: 'earthquakes', label: '地震热点', description: '叠加 USGS 近期地震事件' },
  { id: 'satellites', label: '卫星轨迹', description: '查看当前卫星位置与标注' },
  { id: 'moon', label: '月球', description: '在天空中显示月球天体' }
];

const SATELLITE_SUB_CATEGORIES: Array<{
  id: 'stations' | 'weather' | 'science';
  label: string;
}> = [
  { id: 'stations', label: '空间站' },
  { id: 'weather', label: '气象' },
  { id: 'science', label: '科学' }
];

const LOCATE_SATELLITES: Array<{
  catnr: number;
  label: string;
}> = [
  { catnr: 25544, label: '定位 ISS' },
  { catnr: 48274, label: '定位天宫' }
];

export function LocationDigestPanel({
  activeSection,
  landmarks,
  hotspots,
  selectedLocation,
  locationDigest,
  locationLoading,
  locationHotspotsLoading,
  providers,
  layers,
  satelliteCategories,
  onSelectLandmark,
  onSelectHotspot,
  onClearSelection,
  onToggleLayer,
  onToggleSatelliteCategory,
  onLocateMoon,
  onLocateSatellite
}: LocationDigestPanelProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  if (selectedLocation) {
    return (
      <aside className="detailPanel" aria-label="地点详情">
        <div className="detailPanelHeader">
          <div>
            <span className="panelEyebrow">选中地点</span>
            <h2>{selectedLocation.label ?? '已选地点'}</h2>
            {(selectedLocation.region || selectedLocation.country) && (
              <p>{[selectedLocation.region, selectedLocation.country].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <button type="button" className="ghostButton" onClick={onClearSelection}>
            返回
          </button>
        </div>

        <div className="detailMetaGrid">
          <div>
            <span>纬度</span>
            <strong>{selectedLocation.lat.toFixed(2)}°</strong>
          </div>
          <div>
            <span>经度</span>
            <strong>{selectedLocation.lon.toFixed(2)}°</strong>
          </div>
        </div>

        {selectedLocation.description && (
          <div className="detailStoryBlock">
            <span className="panelEyebrow">概览</span>
            <p>{selectedLocation.description}</p>
          </div>
        )}

        {locationLoading && (
          <div className="loadingSkeleton">
            <div className="detailMetrics">
              <article className="skeletonCard">
                <span>天气</span>
                <div className="skeletonLine wide" />
                <div className="skeletonLine" />
              </article>
              <article className="skeletonCard">
                <span>太阳状态</span>
                <div className="skeletonLine wide" />
                <div className="skeletonLine" />
              </article>
            </div>
          </div>
        )}

        {locationDigest && (
          <>
            <div className="detailMetrics">
              <article>
                <span>天气</span>
                <strong>
                  {locationDigest.weather?.temperature != null
                    ? `${locationDigest.weather.temperature.toFixed(1)}°C`
                    : '暂无'}
                </strong>
                <p>{locationDigest.weather?.description ?? '未返回天气文本'}</p>
              </article>
              <article>
                <span>太阳状态</span>
                <strong>{locationDigest.solar?.daylight ? '白天' : '夜间'}</strong>
                <p>
                  {locationDigest.solar
                    ? `高度角 ${locationDigest.solar.altitudeDegrees.toFixed(1)}°`
                    : '未返回太阳状态'}
                </p>
              </article>
              <article>
                <span>热点分</span>
                <strong>{locationDigest.hotspotScore}</strong>
                <p>综合新闻密度、来源分布与 Geo Hub 命中</p>
              </article>
              <article>
                <span>新鲜度</span>
                <strong>{locationDigest.freshnessScore}</strong>
                <p>根据最近标题发布时间估算</p>
              </article>
            </div>

            <div className="detailStoryBlock">
              <button
                type="button"
                className="panelBlockToggle"
                onClick={() => setSummaryExpanded((prev) => !prev)}
                aria-expanded={summaryExpanded}
              >
                <span className="panelEyebrow">地点情报摘要</span>
                <span className="toggleArrow">{summaryExpanded ? '收起' : '展开'}</span>
              </button>
              {summaryExpanded && <p>{locationDigest.summary.text}</p>}
            </div>

            {locationDigest.summary.whyItMatters && locationDigest.summary.whyItMatters.length > 0 && (
              <div className="detailStoryBlock">
                <div className="panelBlockHeader">
                  <span className="panelEyebrow">为什么值得关注</span>
                  <strong>{locationDigest.summary.whyItMatters.length} 条</strong>
                </div>
                <div className="intelReasonList">
                  {locationDigest.summary.whyItMatters.map((reason) => (
                    <div key={reason} className="intelReasonItem">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {locationDigest.geoHubMatches.length > 0 && (
              <div className="detailStoryBlock">
                <div className="panelBlockHeader">
                  <span className="panelEyebrow">Geo Hub 命中</span>
                  <strong>{locationDigest.geoHubMatches.length} 个</strong>
                </div>
                <div className="tagList">
                  {locationDigest.geoHubMatches.map((match) => (
                    <span key={match.hubId} className={`intelTag priority-${match.priority}`}>
                      {match.hubName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {locationDigest.sourceBreakdown.length > 0 && (
              <div className="detailStoryBlock">
                <div className="panelBlockHeader">
                  <span className="panelEyebrow">来源分布</span>
                  <strong>{locationDigest.sourceBreakdown.length} 项</strong>
                </div>
                <div className="sourceBreakdownList">
                  {locationDigest.sourceBreakdown.map((entry) => (
                    <div key={entry.label} className="sourceBreakdownItem">
                      <span>{entry.label}</span>
                      <strong>{entry.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="detailStoryBlock">
              <div className="panelBlockHeader">
                <span className="panelEyebrow">源状态</span>
                <strong>4 项</strong>
              </div>
              <div className="tagList">
                {Object.entries(locationDigest.sourceStatus).map(([key, status]) => (
                  <span key={key} className={`intelTag status-${status}`}>
                    {formatSourceStatusLabel(key, status)}
                  </span>
                ))}
              </div>
            </div>

            {locationDigest.citations.length > 0 && (
              <div className="detailStoryBlock">
                <div className="panelBlockHeader">
                  <span className="panelEyebrow">数据来源</span>
                  <strong>{locationDigest.citations.length} 项</strong>
                </div>
                <ol className="citationList">
                  {locationDigest.citations.map((citation, index) => (
                    <li key={`${citation.providerId}-${citation.url}`} className="citationItem">
                      <span className="citationIndex">{index + 1}</span>
                      <a href={citation.url} target="_blank" rel="noreferrer">
                        {citation.title}
                      </a>
                      <span className="citationProvider">{citation.providerId}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="detailStoryBlock">
              <div className="panelBlockHeader">
                <span className="panelEyebrow">地区新闻</span>
                <strong>{locationDigest.newsItems.length} 条</strong>
              </div>
              <div className="newsList">
                {locationDigest.newsItems.length > 0 ? (
                  locationDigest.newsItems.map((item) => (
                    <a
                      key={`${item.url}-${item.title}`}
                      className="newsCard"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>{item.title}</strong>
                      <div>
                        <span>{item.source}</span>
                        {item.publishedAt && <span>{formatSeenAt(item.publishedAt)}</span>}
                      </div>
                    </a>
                  ))
                ) : (
                  <p className="emptyState">暂无地区新闻</p>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    );
  }

  if (activeSection === 'layers') {
    return (
      <aside className="detailPanel" aria-label="图层控制">
        <div className="detailPanelHeader">
          <div>
            <span className="panelEyebrow">图层</span>
            <h2>图层控制</h2>
          </div>
        </div>

        <div className="layerCardList">
          {LAYER_OPTIONS.map((layer) => (
            <div key={layer.id}>
              <button
                type="button"
                className={`layerCard ${layers[layer.id] ? 'active' : ''}`}
                onClick={() => onToggleLayer(layer.id)}
              >
                <div>
                  <strong>{layer.label}</strong>
                  <p>{layer.description}</p>
                </div>
                <span>{layers[layer.id] ? '开启' : '关闭'}</span>
              </button>
              {layer.id === 'moon' && layers.moon && onLocateMoon && (
                <div className="layerSubOptions">
                  <button
                    type="button"
                    className="locateAction"
                    onClick={onLocateMoon}
                  >
                    定位月球
                  </button>
                </div>
              )}
              {layer.id === 'satellites' && layers.satellites && (
                <div className="layerSubOptions">
                  {SATELLITE_SUB_CATEGORIES.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      className={`layerSubToggle ${satelliteCategories[sub.id] ? 'active' : ''}`}
                      onClick={() => onToggleSatelliteCategory(sub.id)}
                    >
                      {sub.label}
                    </button>
                  ))}
                  {onLocateSatellite && LOCATE_SATELLITES.map((sat) => (
                    <button
                      key={sat.catnr}
                      type="button"
                      className="locateAction"
                      onClick={() => onLocateSatellite(sat.catnr)}
                    >
                      {sat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  if (activeSection === 'about') {
    return (
      <aside className="detailPanel" aria-label="关于项目">
        <div className="detailPanelHeader">
          <div>
            <span className="panelEyebrow">关于</span>
            <h2>地球探索台</h2>
          </div>
        </div>

        <div className="detailStoryBlock">
          <span className="panelEyebrow">数据接入</span>
          <div className="providerPillGrid">
            {providers.map((provider) => (
              <div key={provider.id} className="providerPill">
                <strong>{provider.name}</strong>
                <span>{provider.category}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="detailPanel" aria-label="探索发现">
      <div className="detailPanelHeader">
        <div>
          <span className="panelEyebrow">{activeSection === 'highlights' ? '热点' : '地标'}</span>
          <h2>{activeSection === 'highlights' ? '热点地点' : '精选地标'}</h2>
        </div>
      </div>

      {activeSection === 'highlights' && (
        <div className="detailStoryBlock">
          <div className="panelBlockHeader">
            <span className="panelEyebrow">推荐观察</span>
            <strong>{hotspots.length} 个</strong>
          </div>
          {locationHotspotsLoading ? (
            <p className="emptyState">正在生成热点地点...</p>
          ) : hotspots.length > 0 ? (
            <div className="hotspotList">
              {hotspots.slice(0, 8).map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className="hotspotCard"
                  onClick={() => onSelectHotspot(hotspot)}
                >
                  <div className="hotspotCardTop">
                    <strong>{hotspot.name}</strong>
                    <span>{hotspot.score}</span>
                  </div>
                  <p>{hotspot.reason}</p>
                  <div className="hotspotCardMeta">
                    <span>{hotspot.region}</span>
                    <span>{hotspot.country}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="emptyState">暂未生成热点地点，可稍后重试。</p>
          )}
        </div>
      )}

      <div className="landmarkList">
        {(activeSection === 'highlights' ? landmarks.slice(0, 8) : landmarks).map((landmark) => (
          <button
            key={landmark.id}
            type="button"
            className="landmarkListItem"
            onClick={() => onSelectLandmark(landmark)}
          >
            <div>
              <strong>{landmark.name}</strong>
              <p>{landmark.regionName} · {landmark.country}</p>
            </div>
            <span>{landmark.category}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function formatSeenAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatSourceStatusLabel(key: string, status: string) {
  const name =
    key === 'gdelt'
      ? 'GDELT'
      : key === 'rss'
        ? 'RSS'
        : key === 'geoHub'
          ? 'Geo Hub'
          : '天气';

  const suffix = status === 'ok' ? '正常' : status === 'empty' ? '空' : '异常';
  return `${name} · ${suffix}`;
}
