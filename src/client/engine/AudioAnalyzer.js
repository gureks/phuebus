// AudioAnalyzer.js — Web Audio API FFT Beat Detection + Device Routing
//
// Responsibilities:
// - Opens a microphone/line-in audio stream via getUserMedia.
// - Pipes it through an AnalyserNode (FFT size 2048) without connecting to destination (no feedback).
// - Exposes getBassEnergy(), getMidEnergy(), getHighEnergy() → normalized [0, 1].
// - Exposes isBeat() → adaptive threshold crossing on bass band.
// - Exposes getFrequencyArray() → raw Uint8Array for visualization.
// - setInputDevice(deviceId) hot-swaps the audio source without reloading.

export class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyserNode = null;
    this.sourceNode = null;
    this.stream = null;
    this.frequencyData = null;

    // FFT parameters
    this.FFT_SIZE = 2048;
    this.SAMPLE_RATE = 44100; // default; updated from AudioContext after init

    // Bass bins: 0 – 172 Hz → bins 0 – 5 at 44.1 kHz / 2048
    // Mid  bins: 172 – 1720 Hz → bins 6 – 59
    // High bins: 1720 – 3700 Hz → bins 60 – 127
    this.BASS_END   = 5;
    this.MID_END    = 59;
    this.HIGH_END   = 127;

    // Adaptive beat state
    this._smoothedBass = 0.0;
    this._smoothing    = 0.88;
    this._beatCooldown = 0;   // frames remaining in cooldown
    this._COOLDOWN_FRAMES = 8;
  }

  async setInputDevice(deviceId = null) {
    // Stop existing stream
    this._stopStream();

    const constraints = {
      audio: deviceId ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false } : true,
      video: false
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Create or reuse AudioContext
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    // Resume if suspended (Chrome autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.SAMPLE_RATE = this.audioContext.sampleRate;

    // Recalculate bin boundaries based on actual sample rate
    const nyquist = this.SAMPLE_RATE / 2;
    const binHz = nyquist / (this.FFT_SIZE / 2);
    this.BASS_END  = Math.floor(172  / binHz);
    this.MID_END   = Math.floor(1720 / binHz);
    this.HIGH_END  = Math.floor(3700 / binHz);

    // Build the analysis chain
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.FFT_SIZE;
    this.analyserNode.smoothingTimeConstant = 0.75;

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyserNode);
    // NOTE: analyserNode is NOT connected to destination — prevents audio feedback

    this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
  }

  // Pull the latest frequency data from the analyser into the internal buffer
  _update() {
    if (this.analyserNode && this.frequencyData) {
      this.analyserNode.getByteFrequencyData(this.frequencyData);
    }
  }

  // Average a range of bins and normalize to [0, 1]
  _binAverage(start, end) {
    if (!this.frequencyData) return 0;
    let sum = 0;
    const count = Math.max(1, end - start + 1);
    for (let i = start; i <= end && i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return sum / (count * 255);
  }

  // Call once per animation frame BEFORE querying energy values
  tick() {
    this._update();
    if (this._beatCooldown > 0) this._beatCooldown--;
  }

  getBassEnergy() {
    const raw = this._binAverage(0, this.BASS_END);
    this._smoothedBass = this._smoothedBass * this._smoothing + raw * (1 - this._smoothing);
    return raw;
  }

  getMidEnergy() {
    return this._binAverage(this.BASS_END + 1, this.MID_END);
  }

  getHighEnergy() {
    return this._binAverage(this.MID_END + 1, this.HIGH_END);
  }

  /**
   * Adaptive beat detector:
   * A beat is declared when bassEnergy > 1.3 × smoothedBass AND bassEnergy > 0.15,
   * subject to a per-beat cooldown of 8 frames to avoid double-triggering.
   */
  isBeat() {
    const raw = this._binAverage(0, this.BASS_END);
    if (this._beatCooldown > 0) return false;
    const hit = raw > 1.3 * this._smoothedBass && raw > 0.15;
    if (hit) this._beatCooldown = this._COOLDOWN_FRAMES;
    return hit;
  }

  // Returns the raw Uint8Array for visualization (caller must not mutate it)
  getFrequencyArray() {
    return this.frequencyData;
  }

  _stopStream() {
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (_) {}
      this.sourceNode = null;
    }
    if (this.analyserNode) {
      try { this.analyserNode.disconnect(); } catch (_) {}
      this.analyserNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  destroy() {
    this._stopStream();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.frequencyData = null;
  }
}
