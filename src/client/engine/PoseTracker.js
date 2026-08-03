// PoseTracker.js — MediaPipe PoseLandmarker Integration
//
// Responsibilities:
// - Loads @mediapipe/tasks-vision PoseLandmarker via FilesetResolver (CDN).
// - Runs GPU-delegated pose detection in VIDEO runningMode.
// - Returns normalized [0,1] {x, y}[33] landmarks per frame.
// - Y coordinates are flipped (rawY = 1 - mediaPipeY) for WebGL UV space.
// - Fails gracefully: init() errors log a warning; detectFrame() returns null silently.
// - destroy() closes the landmarker and frees GPU resources.

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm';

export class PoseTracker {
  constructor() {
    this.landmarker = null;
    this.isInitialized = false;
    this._lastTimestamp = -1;
  }

  async init() {
    try {
      // Dynamic import so the bundle does not include tasks-vision at compile time
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);

      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1
      });

      this.isInitialized = true;
      console.log('[PoseTracker] PoseLandmarker initialized successfully.');
    } catch (err) {
      console.warn('[PoseTracker] Failed to initialize PoseLandmarker:', err);
      this.isInitialized = false;
    }
  }

  /**
   * Run pose detection on the current video frame.
   * @param {HTMLVideoElement} videoElement
   * @param {number} timestamp - performance.now() value in ms
   * @returns {{ x: number, y: number }[33] | null}
   */
  detectFrame(videoElement, timestamp) {
    if (!this.isInitialized || !this.landmarker) return null;
    if (!videoElement || videoElement.readyState < 2) return null;

    // MediaPipe VIDEO mode requires strictly increasing timestamps
    if (timestamp <= this._lastTimestamp) return null;
    this._lastTimestamp = timestamp;

    try {
      const results = this.landmarker.detectForVideo(videoElement, timestamp);
      
      if (!results.landmarks || results.landmarks.length === 0) return null;

      const rawLandmarks = results.landmarks[0]; // first person only

      // Normalize: MediaPipe uses top-left origin (x right, y down).
      // WebGL UV uses bottom-left origin (y up), so flip Y.
      return rawLandmarks.map(lm => ({
        x: lm.x,
        y: 1.0 - lm.y  // Y-flip for UV space
      }));
    } catch (err) {
      console.warn('[PoseTracker] detectFrame error:', err);
      return null;
    }
  }

  destroy() {
    if (this.landmarker) {
      try { this.landmarker.close(); } catch (_) {}
      this.landmarker = null;
    }
    this.isInitialized = false;
    this._lastTimestamp = -1;
    console.log('[PoseTracker] Destroyed.');
  }
}
