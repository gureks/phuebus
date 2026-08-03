import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelPackManager } from './ModelPackManager';

describe('ModelPackManager class', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize with empty list', () => {
    const manager = new ModelPackManager();
    expect(manager.listInstalledPacks()).toEqual([]);
  });

  it('should fall back to web mock when window.__TAURI__ is absent', async () => {
    const manager = new ModelPackManager();
    const manifest = await manager.loadPack('/mock/path');
    expect(manifest.id).toBe('mock-pack');
    expect(manifest.name).toBe('Web Mock Pack');
  });

  it('should mock download successfully on web environment', async () => {
    const manager = new ModelPackManager();
    await manager.downloadPack('https://cdn.example.com/pack1.zip');
    
    const installed = manager.listInstalledPacks();
    expect(installed.length).toBe(1);
    expect(installed[0].presets[0].id).toBe('retro-synth');
    expect(manager.getPresetsFromPacks().length).toBe(1);
    
    manager.destroy();
    expect(manager.listInstalledPacks()).toEqual([]);
  });
});
