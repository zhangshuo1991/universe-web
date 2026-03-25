'use client';

import { useViewerStore } from '@/store/viewerStore';

const SPEED_OPTIONS = [1, 60, 3600, 86400] as const;
const SPEED_LABELS = ['1×', '1分钟/秒', '1小时/秒', '1天/秒'];

export function TimeControls() {
  const currentTimeMs = useViewerStore((s) => s.currentTimeMs);
  const isPlaying = useViewerStore((s) => s.isPlaying);
  const playbackSpeed = useViewerStore((s) => s.playbackSpeed);
  const setCurrentTime = useViewerStore((s) => s.setCurrentTime);
  const setPlayback = useViewerStore((s) => s.setPlayback);

  const timeStr = new Date(currentTimeMs).toLocaleString('zh-CN', {
    timeZone: 'UTC',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <section className="infoPanel">
      <div className="panelHeader">
        <h2>模拟时钟</h2>
        <strong>{isPlaying ? `${playbackSpeed}×` : '暂停'}</strong>
      </div>
      <strong className="timeReadout">{timeStr} UTC</strong>
      <div className="buttonRow" style={{ marginTop: 14 }}>
        <button type="button" onClick={() => setCurrentTime(Date.now())}>
          现在
        </button>
        <button type="button" onClick={() => setPlayback(!isPlaying)}>
          {isPlaying ? '暂停' : '继续'}
        </button>
      </div>
      <div className="buttonRow compact" style={{ marginTop: 8 }}>
        {SPEED_OPTIONS.map((speed, i) => (
          <button
            key={speed}
            type="button"
            className={playbackSpeed === speed && isPlaying ? 'active' : ''}
            onClick={() => setPlayback(true, speed)}
            style={playbackSpeed === speed && isPlaying ? { borderColor: 'rgba(94, 234, 212, 0.5)' } : undefined}
          >
            {SPEED_LABELS[i]}
          </button>
        ))}
      </div>
    </section>
  );
}
