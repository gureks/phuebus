// ModelPackManager.js — Phase 3 Model Pack Architecture (Phase 1/2 Stub)
//
// This stub satisfies the EngineRouter + Display interface contract so
// Phase 1/2 code can reference it without Phase 3 being implemented.
//
// Interface contract (Phase 3 real implementation):
//   loadPack(packPath)         → Promise<Pack | null>
//   listInstalledPacks()       → Pack[]
//   downloadPack(url)          → Promise<void>
//   getPresetsFromPacks()      → Preset[]
//
// > Note: Real implementation arrives in Phase 3, Prompt 2.
// > Requires Tauri FS plugin for filesystem access in desktop app.

export class ModelPackManager {
  constructor() {
    this._installedPacks = [];
    console.log('[ModelPackManager] Stub initialized — Phase 3 not yet implemented');
  }

  /**
   * Load a model pack from the given filesystem path.
   * @param {string} packPath - Path to the pack directory
   * @returns {Promise<object | null>}
   */
  async loadPack(packPath) {
    console.warn(`[ModelPackManager] loadPack('${packPath}') — Phase 3 not implemented. Returning null.`);
    return null;
  }

  /**
   * List all installed model packs.
   * @returns {object[]}
   */
  listInstalledPacks() {
    console.warn('[ModelPackManager] listInstalledPacks() — Phase 3 not implemented. Returning [].');
    return [];
  }

  /**
   * Download and install a model pack from a CDN URL.
   * @param {string} url - CDN URL to the pack .zip
   * @returns {Promise<void>}
   */
  async downloadPack(url) {
    console.warn(`[ModelPackManager] downloadPack('${url}') — Phase 3 not implemented. No-op.`);
  }

  /**
   * Get presets contributed by installed model packs.
   * Returns an empty array until Phase 3 is implemented.
   * @returns {object[]}
   */
  getPresetsFromPacks() {
    return [];
  }

  destroy() {
    console.log('[ModelPackManager] destroy() — Phase 3 not implemented. No-op.');
  }
}
