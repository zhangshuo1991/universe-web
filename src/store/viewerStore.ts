'use client';

import { create } from 'zustand';

import type { AgentMessage, ViewerLayerId } from '@/types/agent';

export type SelectedLocation = {
  lat: number;
  lon: number;
  label?: string;
};

export type Annotation = {
  id: string;
  text: string;
  lat: number;
  lon: number;
  color?: string;
};

export type ViewerController = {
  flyTo: (target: {
    lat: number;
    lon: number;
    altitude?: number;
    heading?: number;
    pitch?: number;
    label?: string;
  }) => void;
};

type ViewerStore = {
  currentTimeMs: number;
  isPlaying: boolean;
  playbackSpeed: number;
  inertialMode: boolean;
  selectedLocation: SelectedLocation | null;
  annotations: Annotation[];
  layers: Record<ViewerLayerId, boolean>;
  controller: ViewerController | null;
  chatHistory: AgentMessage[];
  setCurrentTime: (time: number) => void;
  advanceTime: (deltaMs: number) => void;
  setPlayback: (playing: boolean, speed?: number) => void;
  setInertialMode: (enabled: boolean) => void;
  setSelectedLocation: (location: SelectedLocation | null) => void;
  toggleLayer: (layerId: ViewerLayerId, visible?: boolean) => void;
  setController: (controller: ViewerController | null) => void;
  addAnnotation: (annotation: Annotation) => void;
  replaceAnnotations: (annotations: Annotation[]) => void;
  clearAnnotations: () => void;
  pushChatMessage: (message: AgentMessage) => void;
};

const now = Date.now();

export const useViewerStore = create<ViewerStore>((set) => ({
  currentTimeMs: now,
  isPlaying: true,
  playbackSpeed: 7200,
  inertialMode: false,
  selectedLocation: {
    lat: 31.2304,
    lon: 121.4737,
    label: 'Shanghai'
  },
  annotations: [],
  layers: {
    dayNight: true,
    atmosphere: true,
    cityMarkers: true,
    moon: true,
    satellites: true,
    weatherClouds: false,
    weatherTemperature: false
  },
  controller: null,
  chatHistory: [],
  setCurrentTime: (time) => set({ currentTimeMs: time }),
  advanceTime: (deltaMs) =>
    set((state) => ({
      currentTimeMs: state.currentTimeMs + deltaMs
    })),
  setPlayback: (playing, speed) =>
    set((state) => ({
      isPlaying: playing,
      playbackSpeed: speed ?? state.playbackSpeed
    })),
  setInertialMode: (enabled) => set({ inertialMode: enabled }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  toggleLayer: (layerId, visible) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [layerId]: visible ?? !state.layers[layerId]
      }
    })),
  setController: (controller) => set({ controller }),
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations.filter((item) => item.id !== annotation.id), annotation]
    })),
  replaceAnnotations: (annotations) => set({ annotations }),
  clearAnnotations: () => set({ annotations: [] }),
  pushChatMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message]
    }))
}));
