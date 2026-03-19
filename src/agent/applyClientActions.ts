'use client';

import type { AgentAction } from '@/types/agent';
import { useViewerStore } from '@/store/viewerStore';

function annotationId(lat: number, lon: number, text: string) {
  return `annotation:${lat.toFixed(3)}:${lon.toFixed(3)}:${text}`;
}

export function applyClientActions(actions: AgentAction[]) {
  const state = useViewerStore.getState();

  for (const action of actions) {
    switch (action.type) {
      case 'fly_to': {
        state.controller?.flyTo(action.payload);
        if (action.payload.label) {
          state.setSelectedLocation({
            lat: action.payload.lat,
            lon: action.payload.lon,
            label: action.payload.label
          });
        }
        break;
      }
      case 'set_time':
        state.setCurrentTime(Date.parse(action.payload.iso));
        break;
      case 'play_time':
        state.setPlayback(true, action.payload.speed);
        break;
      case 'pause_time':
        state.setPlayback(false);
        break;
      case 'set_inertial_mode':
        state.setInertialMode(action.payload.enabled);
        break;
      case 'toggle_layer':
        state.toggleLayer(action.payload.layerId, action.payload.visible);
        break;
      case 'add_annotation':
        state.addAnnotation({
          id: annotationId(action.payload.lat, action.payload.lon, action.payload.text),
          text: action.payload.text,
          lat: action.payload.lat,
          lon: action.payload.lon,
          color: action.payload.color
        });
        break;
      case 'clear_annotations':
        state.clearAnnotations();
        break;
      case 'complete_task':
        break;
    }
  }
}
