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

  const bodyAliases = [
    ['sun', ['sun', '太阳']],
    ['mercury', ['mercury', '水星']],
    ['venus', ['venus', '金星']],
    ['earth', ['earth', '地球']],
    ['moon', ['moon', '月球', '月亮']],
    ['mars', ['mars', '火星']],
    ['jupiter', ['jupiter', '木星']],
    ['saturn', ['saturn', '土星']],
    ['uranus', ['uranus', '天王星']],
    ['neptune', ['neptune', '海王星']],
    ['io', ['io']],
    ['europa', ['europa']],
    ['ganymede', ['ganymede']],
    ['callisto', ['callisto']],
    ['titan', ['titan']]
  ] as const;

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

  if (includesAny(normalized, ['analysis', '分析模式', 'analysis mode'])) {
    actions.push({ type: 'set_interface_mode', payload: { mode: 'analysis' } });
    notes.push('已切到分析模式。');
  }

  if (includesAny(normalized, ['explore', '探索模式', 'explore mode'])) {
    actions.push({ type: 'set_interface_mode', payload: { mode: 'explore' } });
    notes.push('已切到探索模式。');
  }

  const presetIntents = [
    ['earthMoon', ['earth-moon', 'earth moon', '地月']],
    ['inner', ['inner', 'inner system', '内太阳系']],
    ['outer', ['outer', 'outer system', '外太阳系']],
    ['full', ['full', 'full system', '全太阳系']]
  ] as const;

  presetIntents.forEach(([presetId, aliases]) => {
    if (!includesAny(normalized, aliases)) {
      return;
    }
    actions.push({ type: 'set_view_preset', payload: { presetId } });
    notes.push(`已切换到 ${presetId} 视图。`);
  });

  const focusedBody = bodyAliases.find(([, aliases]) => includesAny(normalized, aliases));
  if (focusedBody) {
    actions.push({ type: 'focus_body', payload: { bodyId: focusedBody[0] } });
    notes.push(`已聚焦 ${focusedBody[0]}。`);
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
      layerId: 'earthquakes',
      label: '地震事件',
      on: ['地震', '地震事件', 'earthquake'],
      off: ['关闭地震', '隐藏地震', '关闭地震事件', '隐藏地震事件']
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
    },
    {
      layerId: 'planetOrbits',
      label: '行星轨道',
      on: ['轨道', 'orbits'],
      off: ['关闭轨道', '隐藏轨道', 'hide orbits']
    },
    {
      layerId: 'planetLabels',
      label: '行星标签',
      on: ['标签', 'labels'],
      off: ['关闭标签', '隐藏标签', 'hide labels']
    },
    {
      layerId: 'majorMoons',
      label: '主要卫星',
      on: ['主要卫星', 'major moons'],
      off: ['关闭主要卫星', '隐藏主要卫星', 'hide major moons']
    },
    {
      layerId: 'spaceWeather',
      label: '空间天气',
      on: ['空间天气', 'space weather'],
      off: ['关闭空间天气', '隐藏空间天气', 'hide space weather']
    },
    {
      layerId: 'surfaceOverlays',
      label: '表面参考层',
      on: ['表面图层', 'surface layers'],
      off: ['关闭表面图层', '隐藏表面图层', 'hide surface layers']
    },
    {
      layerId: 'smallBodies',
      label: '小天体事件层',
      on: ['小天体', 'asteroid', 'neo', 'fireball'],
      off: ['关闭小天体', '隐藏小天体', 'hide small bodies']
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
    notes.push('你可以试试：`聚焦火星`、`切到分析模式`、`显示内太阳系`、`打开轨道图层`、`播放 86400x`。');
  }

  return {
    provider: 'fallback',
    actions,
    reply: notes.join(' ')
  };
}
