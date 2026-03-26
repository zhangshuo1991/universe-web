export type AgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ViewerLayerId =
  | 'dayNight'
  | 'atmosphere'
  | 'cityMarkers'
  | 'moon'
  | 'satellites'
  | 'earthquakes'
  | 'weatherClouds'
  | 'weatherTemperature'
  | 'planetOrbits'
  | 'planetLabels'
  | 'majorMoons'
  | 'spaceWeather'
  | 'surfaceOverlays'
  | 'smallBodies';

export type SolarViewPresetId = 'inner' | 'outer' | 'full' | 'earthMoon';

export type InterfaceMode = 'explore' | 'analysis';

export type FlyToAction = {
  type: 'fly_to';
  payload: {
    lat: number;
    lon: number;
    altitude?: number;
    heading?: number;
    pitch?: number;
    label?: string;
  };
};

export type SetTimeAction = {
  type: 'set_time';
  payload: {
    iso: string;
  };
};

export type PlayTimeAction = {
  type: 'play_time';
  payload: {
    speed: number;
  };
};

export type PauseTimeAction = {
  type: 'pause_time';
  payload: Record<string, never>;
};

export type SetInertialModeAction = {
  type: 'set_inertial_mode';
  payload: {
    enabled: boolean;
  };
};

export type FocusBodyAction = {
  type: 'focus_body';
  payload: {
    bodyId: string;
  };
};

export type SetViewPresetAction = {
  type: 'set_view_preset';
  payload: {
    presetId: SolarViewPresetId;
  };
};

export type SetInterfaceModeAction = {
  type: 'set_interface_mode';
  payload: {
    mode: InterfaceMode;
  };
};

export type ToggleLayerAction = {
  type: 'toggle_layer';
  payload: {
    layerId: ViewerLayerId;
    visible: boolean;
  };
};

export type AddAnnotationAction = {
  type: 'add_annotation';
  payload: {
    text: string;
    lat: number;
    lon: number;
    color?: string;
  };
};

export type ClearAnnotationsAction = {
  type: 'clear_annotations';
  payload: Record<string, never>;
};

export type ShowRouteAction = {
  type: 'show_route';
  payload: {
    from: {
      lat: number;
      lon: number;
      label: string;
    };
    to: {
      lat: number;
      lon: number;
      label: string;
    };
    color?: string;
  };
};

export type CompleteTaskAction = {
  type: 'complete_task';
  payload: {
    summary: string;
  };
};

export type AgentAction =
  | FlyToAction
  | SetTimeAction
  | PlayTimeAction
  | PauseTimeAction
  | SetInertialModeAction
  | FocusBodyAction
  | SetViewPresetAction
  | SetInterfaceModeAction
  | ToggleLayerAction
  | AddAnnotationAction
  | ClearAnnotationsAction
  | ShowRouteAction
  | CompleteTaskAction;

export type AgentContext = {
  simulationTimeIso: string;
  inertialMode: boolean;
  selectedLocation?: {
    lat: number;
    lon: number;
    label?: string;
  } | null;
  selectedBodyId?: string | null;
  activePreset?: SolarViewPresetId | null;
  interfaceMode?: InterfaceMode | null;
  layers: Record<ViewerLayerId, boolean>;
};

export type AgentCitation = {
  providerId: string;
  title: string;
  url: string;
  retrievedAtIso: string;
};

export type AgentArtifact = {
  kind: 'query_result' | 'comparison' | 'note';
  title: string;
  content: string;
};

export type AgentResponsePayload = {
  reply: string;
  provider: 'openai' | 'fallback';
  actions: AgentAction[];
  citations?: AgentCitation[];
  artifacts?: AgentArtifact[];
};
