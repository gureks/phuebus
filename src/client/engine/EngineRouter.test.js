import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EngineRouter } from './EngineRouter';
import { PRESETS } from './presets';

// Mock ShaderEngine
const createMockShaderEngine = () => ({
  resume: vi.fn(),
  pause: vi.fn(),
  setFpsCap: vi.fn(),
  setAudioData: vi.fn(),
  setLandmarks: vi.fn(),
  setActiveShader: vi.fn(),
  setTrailsEnabled: vi.fn(),
  setEdgeSensitivity: vi.fn(),
  setColorSteps: vi.fn(),
  setDecay: vi.fn(),
  setDispersion: vi.fn(),
  setGlowRadius: vi.fn(),
  setHue: vi.fn(),
  setToonOutlineMode: vi.fn(),
  setAudioHueSensitivity: vi.fn(),
  setAudioDispersionSensitivity: vi.fn(),
  setMotionFlowScale: vi.fn(),
});

// Mock DiffusionEngine (stub — isReady always false in Phase 1)
const createMockDiffusionEngine = (ready = false) => ({
  isReady: vi.fn(() => ready),
  setMode: vi.fn(),
  generate: vi.fn(async () => null),
  _mode: 'local',
  _serverUrl: null,
  destroy: vi.fn(),
});

describe('EngineRouter class', () => {
  let shaderEngine;
  let diffusionEngine;
  let router;

  beforeEach(() => {
    shaderEngine    = createMockShaderEngine();
    diffusionEngine = createMockDiffusionEngine(false);
    router = new EngineRouter(shaderEngine, diffusionEngine);
  });

  it('should initialize in shader mode', () => {
    expect(router.mode).toBe('shader');
    expect(router.state).toBe('active');
  });

  it('should be a no-op when switching to the current mode', () => {
    router.switchTo('shader');
    expect(shaderEngine.resume).not.toHaveBeenCalled();
    expect(router.mode).toBe('shader');
  });

  it('should call onModeChange callback on mode switch', () => {
    const onModeChange = vi.fn();
    const r = new EngineRouter(shaderEngine, diffusionEngine, onModeChange);
    // Note: diffusionEngine.isReady() returns false, so it falls back to shader
    r.switchTo('diffusion');
    expect(onModeChange).toHaveBeenCalledWith('shader');
  });

  it('should fall back to shader mode when DiffusionEngine stub isReady = false', () => {
    router.switchTo('diffusion');
    expect(router.mode).toBe('shader');
    expect(shaderEngine.resume).toHaveBeenCalled();
  });

  it('should stay in diffusion mode when DiffusionEngine isReady = true', () => {
    const readyDiffusion = createMockDiffusionEngine(true);
    const r = new EngineRouter(shaderEngine, readyDiffusion);
    r.switchTo('diffusion');
    expect(r.mode).toBe('diffusion');
    expect(shaderEngine.pause).toHaveBeenCalled();
  });

  it('should apply all preset fields to ShaderEngine', () => {
    const preset = PRESETS.find(p => p.id === 'toon-comic');
    router.applyPreset(preset);

    expect(shaderEngine.setActiveShader).toHaveBeenCalledWith('toon');
    expect(shaderEngine.setTrailsEnabled).toHaveBeenCalledWith(false);
    expect(shaderEngine.setColorSteps).toHaveBeenCalledWith(6);
    expect(shaderEngine.setToonOutlineMode).toHaveBeenCalledWith(0);
    expect(shaderEngine.setAudioHueSensitivity).toHaveBeenCalledWith(1.5);
  });

  it('should delegate setAudioData to ShaderEngine', () => {
    router.setAudioData(0.8, 0.4, 0.1);
    expect(shaderEngine.setAudioData).toHaveBeenCalledWith(0.8, 0.4, 0.1);
  });

  it('should delegate setLandmarks to ShaderEngine', () => {
    const landmarks = [{ x: 0.5, y: 0.5 }];
    router.setLandmarks(landmarks);
    expect(shaderEngine.setLandmarks).toHaveBeenCalledWith(landmarks);
  });

  it('should delegate setFpsCap to ShaderEngine', () => {
    router.setFpsCap(30);
    expect(shaderEngine.setFpsCap).toHaveBeenCalledWith(30);
  });

  it('should null out engine refs on destroy', () => {
    router.destroy();
    expect(router._shaderEngine).toBeNull();
    expect(router._diffusionEngine).toBeNull();
  });

  it('should handle unknown mode gracefully without throwing', () => {
    expect(() => router.switchTo('quantum')).not.toThrow();
    expect(router.mode).toBe('shader'); // unchanged
  });
});
