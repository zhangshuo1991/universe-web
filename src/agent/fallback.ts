import type { AgentContext, AgentResponsePayload } from '@/types/agent';

function extractSpeed(text: string) {
  const match = text.match(/(\d{1,6})\s*x/i);
  return match ? Number(match[1]) : undefined;
}

function includesAny(text: string, patterns: readonly string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

export function runFallbackAgent(message: string, context: AgentContext): AgentResponsePayload {
  const normalized = message.toLowerCase();
  const actions: AgentResponsePayload['actions'] = [];
  const notes: string[] = [];

  if (normalized.includes('暂停')) {
    actions.push({ type: 'pause_time', payload: {} });
    notes.push('已暂停时间流。');
  }

  if (normalized.includes('播放') || normalized.includes('继续')) {
    actions.push({ type: 'play_time', payload: { speed: extractSpeed(message) ?? 7200 } });
    notes.push('已恢复时间播放。');
  }

  if (normalized.includes('现在') || normalized.includes('当前时间')) {
    actions.push({ type: 'set_time', payload: { iso: new Date().toISOString() } });
    notes.push('已将时钟回到当前时刻。');
  }

  if (includesAny(normalized, ['惯性', 'icrf', 'inertial', '地固'])) {
    const enabled = !includesAny(normalized, ['关闭惯性', '退出惯性', '回到地固', 'earth-fixed', '地固']);
    actions.push({ type: 'set_inertial_mode', payload: { enabled } });
    notes.push(enabled ? '已切到惯性参考系。' : '已回到地固参考系。');
  }

  const layerIntents = [
    {
      layerId: 'dayNight',
      label: '昼夜光照',
      on: ['昼夜', '晨昏', '太阳光照'],
      off: ['关闭昼夜', '隐藏昼夜', '关闭晨昏', '隐藏晨昏']
    },
    {
      layerId: 'atmosphere',
      label: '大气层',
      on: ['大气'],
      off: ['关闭大气', '隐藏大气']
    },
    {
      layerId: 'cityMarkers',
      label: '城市标记',
      on: ['城市标记', '锚点城市', '城市点位'],
      off: ['关闭城市标记', '隐藏城市标记', '关闭锚点城市', '隐藏锚点城市']
    },
    {
      layerId: 'moon',
      label: '月球',
      on: ['月球'],
      off: ['关闭月球', '隐藏月球']
    },
    {
      layerId: 'satellites',
      label: '卫星',
      on: ['卫星'],
      off: ['关闭卫星', '隐藏卫星']
    },
    {
      layerId: 'weatherClouds',
      label: '云量层',
      on: ['云层', '云量', '云图', 'cloud'],
      off: ['关闭云层', '隐藏云层', '关闭云量', '隐藏云量', '关闭云图', '隐藏云图']
    },
    {
      layerId: 'weatherTemperature',
      label: '气温层',
      on: ['气温', '温度', 'temperature'],
      off: ['关闭气温', '隐藏气温', '关闭温度', '隐藏温度']
    }
  ] as const;

  layerIntents.forEach((intent) => {
    const visible = includesAny(normalized, intent.off)
      ? false
      : includesAny(normalized, intent.on)
        ? true
        : null;

    if (visible === null) {
      return;
    }

    actions.push({
      type: 'toggle_layer',
      payload: {
        layerId: intent.layerId,
        visible
      }
    });
    notes.push(`已${visible ? '开启' : '关闭'}${intent.label}。`);
  });

  if ((normalized.includes('标注') || normalized.includes('注释')) && context.selectedLocation) {
    actions.push({
      type: 'add_annotation',
      payload: {
        text: context.selectedLocation.label ?? '当前观测点',
        lat: context.selectedLocation.lat,
        lon: context.selectedLocation.lon,
        color: '#f7b955'
      }
    });
    notes.push('已在当前观测点添加标注。');
  }

  if (normalized.includes('清除标注')) {
    actions.push({ type: 'clear_annotations', payload: {} });
    notes.push('已清除所有标注。');
  }

  if (actions.length === 0) {
    notes.push('Agent API 骨架已经接通，但当前未配置 `OPENAI_API_KEY`，所以这里只启用了有限的本地 fallback 指令。');
    notes.push('你可以试试：`暂停时间`、`播放 86400x`、`打开月球和卫星图层`、`切到惯性系`、`给当前点加标注`。');
  }

  return {
    provider: 'fallback',
    actions,
    reply: notes.join(' ')
  };
}
