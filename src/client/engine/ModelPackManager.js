// ModelPackManager.js — Model Pack Architecture
//
// Responsibilities:
// - Manages local installation, listing, and loading of custom style model packs.
// - Utilizes Tauri FS/HTTP plugins in desktop environment.
// - Falls back to memory-store simulation in standard browser environments.

export class ModelPackManager {
  constructor() {
    this._installedPacks = [];
    console.log('[ModelPackManager] Initialized.');
  }

  /**
   * Load a model pack manifest from local filesystem.
   * Uses Tauri FS plugins if available, web mock otherwise.
   * @param {string} packPath
   * @returns {Promise<object | null>}
   */
  async loadPack(packPath) {
    if (window.__TAURI__) {
      try {
        const pkgFS = '@tauri-apps/' + 'plugin-fs';
        const { readTextFile } = await import(/* @vite-ignore */ pkgFS);
        const contents = await readTextFile(`${packPath}/manifest.json`);
        const manifest = JSON.parse(contents);
        console.log('[ModelPackManager] Loaded tauri pack manifest:', manifest);
        return manifest;
      } catch (err) {
        console.error('[ModelPackManager] Failed to load tauri pack:', err);
        return null;
      }
    } else {
      console.log(`[ModelPackManager] Web mock: loading pack at ${packPath}`);
      return { id: 'mock-pack', name: 'Web Mock Pack', presets: [] };
    }
  }

  /**
   * List all installed packs.
   * @returns {object[]}
   */
  listInstalledPacks() {
    return this._installedPacks;
  }

  /**
   * Download and install a model pack.
   * @param {string} url - CDN URL
   * @returns {Promise<void>}
   */
  async downloadPack(url) {
    console.log(`[ModelPackManager] Downloading pack from: ${url}`);
    if (window.__TAURI__) {
      try {
        const pkgHTTP = '@tauri-apps/' + 'plugin-http';
        const pkgFS = '@tauri-apps/' + 'plugin-fs';
        const { fetch } = await import(/* @vite-ignore */ pkgHTTP);
        const { writeBinaryFile, BaseDirectory } = await import(/* @vite-ignore */ pkgFS);
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        await writeBinaryFile('model_pack.zip', new Uint8Array(buffer), { baseDir: BaseDirectory.AppData });
        console.log('[ModelPackManager] Pack downloaded and written to AppData.');
      } catch (err) {
        console.error('[ModelPackManager] Failed downloading pack:', err);
      }
    } else {
      // Simulate download latency
      await new Promise(r => setTimeout(r, 800));
      const newPack = { 
        id: `downloaded-${Date.now()}`, 
        name: `Downloaded Pack (${url.split('/').pop()})`,
        presets: [
          {
            id: 'retro-synth',
            name: 'RetroSynth',
            icon: '👾',
            engineMode: 'shader',
            activeShader: 'neon',
            trailsEnabled: true,
            edgeSensitivity: 0.1,
            colorSteps: 4,
            decay: 0.94,
            dispersion: 0.005,
            glowRadius: 0.15,
            hue: 300,
            toonOutlineMode: 1,
            audioHueSensitivity: 2.0,
            audioDispersionSensitivity: 3.0,
            motionFlowScale: 15.0
          }
        ]
      };
      this._installedPacks.push(newPack);
      console.log('[ModelPackManager] Mock pack download complete.');
    }
  }

  /**
   * Return presets contributed by installed packs.
   * @returns {object[]}
   */
  getPresetsFromPacks() {
    return this._installedPacks.flatMap(p => p.presets || []);
  }

  destroy() {
    this._installedPacks = [];
    console.log('[ModelPackManager] Destroyed.');
  }
}
