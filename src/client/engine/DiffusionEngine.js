// DiffusionEngine.js — Phase 2 AI Diffusion Engine (Phase 1 Stub)
//
// This stub satisfies the EngineRouter interface contract so Phase 1 code
// can reference it without Phase 2 being implemented.
//
// Interface contract:
//   generate(frameBlob, prompt, strength) → Promise<ImageBitmap | null>
//   setMode(mode, serverUrl)              → void
//   isReady()                             → boolean
//   destroy()                             → void
//
// All methods log a Phase 2 warning and return null/false.
// > Note: Real implementation arrives in Phase 2, Prompt 2.

export class DiffusionEngine {
  constructor() {
    this._mode = 'local'; // 'local' | 'cloud'
    this._serverUrl = null;
    console.log('[DiffusionEngine] Stub initialized — Phase 2 not yet implemented');
  }

  /**
   * Generate an AI-diffused frame from the given camera frame.
   * @param {Blob} frameBlob - JPEG-encoded camera frame
   * @param {string} prompt - Text prompt for style conditioning
   * @param {number} strength - img2img strength [0.0, 1.0]
   * @returns {Promise<ImageBitmap | null>}
   */
  async generate(frameBlob, prompt, strength = 0.4) {
    console.warn('[DiffusionEngine] generate() called — Phase 2 not implemented. Returning null.');
    return null;
  }

  /**
   * Switch between local and cloud diffusion mode.
   * @param {'local' | 'cloud'} mode
   * @param {string | null} serverUrl - Required when mode === 'cloud'
   */
  setMode(mode, serverUrl = null) {
    console.warn(`[DiffusionEngine] setMode('${mode}') called — Phase 2 not implemented. No-op.`);
    this._mode = mode;
    this._serverUrl = serverUrl;
  }

  /** Returns true when the engine is ready to generate frames */
  isReady() {
    return false; // Phase 1 stub always returns false
  }

  destroy() {
    console.log('[DiffusionEngine] destroy() — Phase 2 not implemented. No-op.');
  }
}
