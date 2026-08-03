// EngineRouter.js — Hot-Swap Engine Mode Router
//
// Responsibilities:
// - Routes rendering calls to the active engine (ShaderEngine | DiffusionEngine).
// - Switches modes without unmounting or recreating the VideoTexture.
// - Applies preset config objects atomically to the active ShaderEngine.
// - Exposes a mode_change callback for HUD/UI updates.
//
// Supported modes:
//   'shader'    → delegates to ShaderEngine (Phase 1)
//   'diffusion' → delegates to DiffusionEngine local (Phase 2)
//   'cloud'     → delegates to DiffusionEngine cloud (Phase 2)
//
// Latency budget: switchTo() < 1ms (SPEC.md Section 2)

export class EngineRouter {
  /**
   * @param {import('./ShaderEngine').ShaderEngine} shaderEngine
   * @param {import('./DiffusionEngine').DiffusionEngine} diffusionEngine
   * @param {(mode: string) => void} [onModeChange] - callback for HUD updates
   */
  constructor(shaderEngine, diffusionEngine, onModeChange = null) {
    this._shaderEngine    = shaderEngine;
    this._diffusionEngine = diffusionEngine;
    this._onModeChange    = onModeChange;

    // Valid modes: 'shader' | 'diffusion' | 'cloud'
    this._mode = 'shader';

    // State machine: 'idle' | 'switching' | 'warming-up' | 'active'
    this._state = 'active';
  }

  /** Current engine mode string */
  get mode() { return this._mode; }

  /** Current state machine state */
  get state() { return this._state; }

  /**
   * Switch to the specified engine mode.
   * Hard cut (no crossfade) in Phase 1; async warm-up added in Phase 2.
   * @param {'shader' | 'diffusion' | 'cloud'} mode
   */
  switchTo(mode) {
    if (mode === this._mode) return;

    const prevMode = this._mode;
    this._mode  = mode;
    this._state = 'switching';

    if (mode === 'shader') {
      this.setDiffusionMode(false);
      if (this._shaderEngine) this._shaderEngine.resume();
      this._state = 'active';
    } else if (mode === 'diffusion' || mode === 'cloud') {
      this.setDiffusionMode(true);
      if (this._shaderEngine) this._shaderEngine.resume();
      if (this._diffusionEngine) {
        if (mode === 'cloud' && this._diffusionEngine._serverUrl) {
          this._diffusionEngine.setMode('cloud', this._diffusionEngine._serverUrl);
        } else {
          this._diffusionEngine.setMode('local');
        }
        this._state = this._diffusionEngine.isReady() ? 'active' : 'warming-up';
      } else {
        this._state = 'active';
      }
    } else {
      console.warn(`[EngineRouter] Unknown mode: '${mode}'. No-op.`);
      this._mode  = prevMode;
      this._state = 'active';
      return;
    }

    console.log(`[EngineRouter] Switched: ${prevMode} → ${this._mode}`);
    if (this._onModeChange) this._onModeChange(this._mode);
  }

  /**
   * Apply a preset config object atomically to the active ShaderEngine.
   * @param {import('./presets').Preset} preset
   */
  applyPreset(preset) {
    if (!this._shaderEngine) return;
    const e = this._shaderEngine;

    // Switch engine mode first
    if (preset.engineMode && preset.engineMode !== this._mode) {
      this.switchTo(preset.engineMode);
    }

    // Apply all shader params
    if (e.setActiveShader)             e.setActiveShader(preset.activeShader);
    if (e.setTrailsEnabled)            e.setTrailsEnabled(preset.trailsEnabled);
    if (e.setEdgeSensitivity)          e.setEdgeSensitivity(preset.edgeSensitivity);
    if (e.setColorSteps)               e.setColorSteps(preset.colorSteps);
    if (e.setDecay)                    e.setDecay(preset.decay);
    if (e.setDispersion)               e.setDispersion(preset.dispersion);
    if (e.setGlowRadius)               e.setGlowRadius(preset.glowRadius);
    if (e.setHue)                      e.setHue(preset.hue);
    if (e.setToonOutlineMode)          e.setToonOutlineMode(preset.toonOutlineMode);
    if (e.setAudioHueSensitivity)      e.setAudioHueSensitivity(preset.audioHueSensitivity);
    if (e.setAudioDispersionSensitivity) e.setAudioDispersionSensitivity(preset.audioDispersionSensitivity);
    if (e.setMotionFlowScale)          e.setMotionFlowScale(preset.motionFlowScale);

    console.log(`[EngineRouter] Applied preset: ${preset.id}`);
  }

  /**
   * Pause all engines (call when Display is backgrounded or engine is reinitializing).
   */
  pause() {
    if (this._shaderEngine) this._shaderEngine.pause();
  }

  /**
   * Resume the active engine.
   */
  resume() {
    if (this._shaderEngine) this._shaderEngine.resume();
    this._state = 'active';
  }

  /**
   * Set the FPS cap on the active ShaderEngine.
   * @param {number} fps
   */
  setFpsCap(fps) {
    if (this._shaderEngine && this._shaderEngine.setFpsCap) {
      this._shaderEngine.setFpsCap(fps);
    }
  }

  /**
   * Set audio data on the active ShaderEngine.
   * @param {number} bass
   * @param {number} mid
   * @param {number} high
   */
  setAudioData(bass, mid, high) {
    if (this._shaderEngine) this._shaderEngine.setAudioData(bass, mid, high);
  }

  /**
   * Set pose landmarks on the active ShaderEngine.
   * @param {Array<{x:number, y:number}> | null} landmarks
   */
  setLandmarks(landmarks) {
    if (this._shaderEngine) this._shaderEngine.setLandmarks(landmarks);
  }

  /**
   * Enable/disable diffusion mode in the shader engine.
   * @param {boolean} enabled
   */
  setDiffusionMode(enabled) {
    if (this._shaderEngine && this._shaderEngine.setDiffusionMode) {
      this._shaderEngine.setDiffusionMode(enabled);
    }
  }

  /**
   * Send a styled ImageBitmap to the shader engine.
   * @param {ImageBitmap} imageBitmap
   */
  setDiffusionFrame(imageBitmap) {
    if (this._shaderEngine && this._shaderEngine.setDiffusionFrame) {
      this._shaderEngine.setDiffusionFrame(imageBitmap);
    }
  }

  destroy() {
    // ShaderEngine is owned by the caller (Display.jsx) — do not destroy here
    this._shaderEngine    = null;
    this._diffusionEngine = null;
    console.log('[EngineRouter] Destroyed.');
  }
}
