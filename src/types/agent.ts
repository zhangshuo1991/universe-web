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
  | 'weatherClouds'
  | 'weatherTemperature';

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
  | ToggleLayerAction
  | AddAnnotationAction
  | ClearAnnotationsAction
  | CompleteTaskAction;

export type AgentContext = {
  simulationTimeIso: string;
  inertialMode: boolean;
  selectedLocation?: {
    lat: number;
    lon: number;
    label?: string;
  } | null;
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
