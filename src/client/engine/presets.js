// presets.js — Phuebus Phase 1 Preset Definitions
//
// Each preset is a plain config object that can be applied atomically
// to the ShaderEngine via EngineRouter.applyPreset(preset).
//
// Fields mirror the ShaderEngine setter API:
//   activeShader   : 'passthrough' | 'toon' | 'neon'
//   trailsEnabled  : boolean
//   edgeSensitivity: float [0.02, 0.4]
//   colorSteps     : float [2, 16]
//   decay          : float [0.8, 0.99]
//   dispersion     : float [0.0, 0.006]
//   glowRadius     : float [0.02, 0.4]
//   hue            : float [0, 360] degrees
//   toonOutlineMode: 0 = comic black | 1 = neon glow
//   audioHueSensitivity       : float [0.0, 3.0]
//   audioDispersionSensitivity: float [0.0, 5.0]
//   motionFlowScale           : float [0.0, 20.0]

export const PRESETS = [
  {
    id: 'default',
    name: 'Default',
    icon: '🎬',
    description: 'Clean passthrough with auto-gain pre-pass',
    engineMode: 'shader',
    activeShader: 'passthrough',
    trailsEnabled: false,
    edgeSensitivity: 0.15,
    colorSteps: 5,
    decay: 0.9,
    dispersion: 0.002,
    glowRadius: 0.08,
    hue: 0,
    toonOutlineMode: 0,
    audioHueSensitivity: 1.0,
    audioDispersionSensitivity: 2.0,
    motionFlowScale: 5.0,
  },
  {
    id: 'toon-comic',
    name: 'ToonComic',
    icon: '💥',
    description: 'Black comic-book outlines with posterized cel shading',
    engineMode: 'shader',
    activeShader: 'toon',
    trailsEnabled: false,
    edgeSensitivity: 0.18,
    colorSteps: 6,
    decay: 0.9,
    dispersion: 0.002,
    glowRadius: 0.08,
    hue: 0,
    toonOutlineMode: 0,
    audioHueSensitivity: 1.5,
    audioDispersionSensitivity: 2.0,
    motionFlowScale: 5.0,
  },
  {
    id: 'neon-cyberpunk',
    name: 'NeonCyberpunk',
    icon: '🌆',
    description: 'Sobel edge neon wireframe on dark backdrop',
    engineMode: 'shader',
    activeShader: 'neon',
    trailsEnabled: false,
    edgeSensitivity: 0.12,
    colorSteps: 5,
    decay: 0.9,
    dispersion: 0.002,
    glowRadius: 0.10,
    hue: 200,
    toonOutlineMode: 1,
    audioHueSensitivity: 2.0,
    audioDispersionSensitivity: 2.0,
    motionFlowScale: 5.0,
  },
  {
    id: 'feedback-ghost',
    name: 'FeedbackGhost',
    icon: '👻',
    description: 'Persistent motion trails with bass-kick dispersion',
    engineMode: 'shader',
    activeShader: 'passthrough',
    trailsEnabled: true,
    edgeSensitivity: 0.15,
    colorSteps: 5,
    decay: 0.92,
    dispersion: 0.004,
    glowRadius: 0.08,
    hue: 270,
    toonOutlineMode: 0,
    audioHueSensitivity: 1.0,
    audioDispersionSensitivity: 3.5,
    motionFlowScale: 8.0,
  },
  {
    id: 'audio-pulse',
    name: 'AudioPulse',
    icon: '🎵',
    description: 'Toon shader with maximum audio hue reactivity',
    engineMode: 'shader',
    activeShader: 'toon',
    trailsEnabled: true,
    edgeSensitivity: 0.20,
    colorSteps: 8,
    decay: 0.88,
    dispersion: 0.003,
    glowRadius: 0.08,
    hue: 120,
    toonOutlineMode: 1,
    audioHueSensitivity: 3.0,
    audioDispersionSensitivity: 4.0,
    motionFlowScale: 10.0,
  },
  {
    id: 'raw-camera',
    name: 'RawCamera',
    icon: '📷',
    description: 'Unprocessed camera feed, no effects',
    engineMode: 'shader',
    activeShader: 'passthrough',
    trailsEnabled: false,
    edgeSensitivity: 0.15,
    colorSteps: 5,
    decay: 0.9,
    dispersion: 0.002,
    glowRadius: 0.08,
    hue: 0,
    toonOutlineMode: 0,
    audioHueSensitivity: 0.0,
    audioDispersionSensitivity: 0.0,
    motionFlowScale: 0.0,
  },
];

// Map for quick lookup by id
export const PRESET_MAP = Object.fromEntries(PRESETS.map(p => [p.id, p]));

export const DEFAULT_PRESET_ID = 'default';
