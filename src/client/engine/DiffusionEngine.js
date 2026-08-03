// DiffusionEngine.js — Real-Time AI Diffusion Engine
//
// Responsibilities:
// - Manages WebSocket connection to local or cloud StreamDiffusion.
// - Transmits frame blobs to style diffusion pipeline.
// - Returns processed styled ImageBitmaps asynchronously.
// - Implements fallback state machine for connection drops.

export class DiffusionEngine {
  constructor() {
    this._mode = 'local'; // 'local' | 'cloud'
    this._serverUrl = 'ws://localhost:8080/ws/generate';
    this.ws = null;
    this._isConnected = false;
    this._lastPrompt = '';
    this._lastStrength = -1;

    // Connect immediately
    this._connect();
  }

  _connect() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }

    const url = this._mode === 'cloud' ? this._serverUrl : 'ws://localhost:8080/ws/generate';
    console.log(`[DiffusionEngine] Connecting to: ${url}`);
    
    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'blob';

      this.ws.onopen = () => {
        console.log('[DiffusionEngine] WebSocket connected.');
        this._isConnected = true;
      };

      this.ws.onclose = () => {
        console.warn('[DiffusionEngine] WebSocket disconnected. Retrying in 3s...');
        this._isConnected = false;
        setTimeout(() => {
          if (!this._isConnected) this._connect();
        }, 3000);
      };

      this.ws.onerror = (err) => {
        console.error('[DiffusionEngine] WebSocket error:', err);
      };
    } catch (e) {
      console.error('[DiffusionEngine] Failed to create WebSocket:', e);
    }
  }

  /**
   * Switch between local and cloud diffusion modes.
   * @param {'local' | 'cloud'} mode
   * @param {string | null} serverUrl
   */
  setMode(mode, serverUrl = null) {
    if (mode === this._mode && serverUrl === this._serverUrl) return;
    this._mode = mode;
    if (serverUrl) this._serverUrl = serverUrl;
    this._connect();
  }

  isReady() {
    return this._isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Style a camera frame using AI Stable Diffusion.
   * @param {Blob} frameBlob - JPEG frame
   * @param {string} prompt - Prompt style
   * @param {number} strength - Style match strength [0, 1]
   * @returns {Promise<ImageBitmap | null>}
   */
  async generate(frameBlob, prompt, strength = 0.4) {
    if (!this.isReady()) {
      return null;
    }

    return new Promise((resolve) => {
      let timeoutId = setTimeout(() => {
        this.ws.removeEventListener('message', onMessage);
        resolve(null); // resolve with null on timeout
      }, 500); // 500ms timeout budget

      const onMessage = async (event) => {
        if (event.data instanceof Blob) {
          clearTimeout(timeoutId);
          this.ws.removeEventListener('message', onMessage);
          try {
            const bitmap = await createImageBitmap(event.data);
            resolve(bitmap);
          } catch (err) {
            console.error('[DiffusionEngine] Bitmap creation failed:', err);
            resolve(null);
          }
        }
      };

      this.ws.addEventListener('message', onMessage);

      // Update prompt/strength parameters on sidecar if changed
      if (prompt !== this._lastPrompt || strength !== this._lastStrength) {
        this.ws.send(JSON.stringify({ prompt, strength }));
        this._lastPrompt = prompt;
        this._lastStrength = strength;
      }

      // Send raw JPEG bytes
      this.ws.send(frameBlob);
    });
  }

  destroy() {
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this._isConnected = false;
    console.log('[DiffusionEngine] Destroyed.');
  }
}
