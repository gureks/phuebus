# SPEC.md — Phuebus Technical Specification

> **Status:** Living document · Phase 1 build focus  
> **Last Updated:** 2026-08-03  
> **Sections:** 1 Architecture Overview · 2 Module Contracts · **3 Framework Reference** · **4 Implementation Guidance & Best Practices**

---

## Section 1 — Architecture Overview

*(Derived from PRD.md — see PRD for full diagram)*

```
Mobile Controller (WebRTC + Socket.IO)
         │
         ▼
Phuebus Engine Host (Node.js + Express)
   ├── Socket.IO Signaling Server
   ├── PeerJS Signaling Relay
   └── Static Asset Server (/public)
         │
         ▼
Browser Display Engine
   ├── VideoIngestion.js  ← WebRTC (PeerJS) | UVC/USB (MediaDevices API)
   ├── AudioAnalyzer.js   ← Web Audio API (AnalyserNode FFT)
   ├── ShaderEngine.js    ← Three.js + WebGL2 ShaderMaterial pipeline
   │     ├── AutoGainPrepass.js   (RenderTarget pass 1)
   │     ├── ToonShader.js        (RenderTarget pass 2)
   │     ├── NeonAura.js          (RenderTarget pass 3)
   │     └── FeedbackTrails.js    (feedback buffer pass)
   ├── PoseTracker.js     ← @mediapipe/tasks-vision PoseLandmarker
   └── EngineRouter.js    ← Hot-swap between ShaderEngine ↔ DiffusionEngine
```

---

## Section 2 — Module Contracts

| Module | Input | Output | Latency Budget |
|---|---|---|---|
| VideoIngestion | MediaStream (WebRTC/UVC) | `HTMLVideoElement` ready | <5ms |
| AudioAnalyzer | MediaStream (audio) | `Uint8Array` FFT data @ rAF | <2ms |
| ShaderEngine | VideoTexture + AudioData | `WebGLRenderTarget` | <16ms (60fps) |
| PoseTracker | `HTMLVideoElement` | Landmark array (normalized) | <8ms (GPU delegate) |
| EngineRouter | mode string | routes to engine | <1ms |
| Socket.IO | control events | broadcast to room | <10ms |

---

## Section 3 — Framework Quick Reference

### 3.1 Three.js (r165+) — WebGL2 Shader Pipeline

**Library ID (Context7):** `/mrdoob/three.js`
**Install:** `npm install three` or CDN `https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js`

#### Core Pipeline Pattern (multi-pass post-processing)

```javascript
// 1. Renderer setup — always request WebGL2
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap at 2x for perf
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(renderLoop);

// 2. Off-screen RenderTarget for each shader pass
function createRenderTarget(w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  rt.texture.generateMipmaps = false;
  return rt;
}

// 3. Full-screen quad (the "blit" geometry)
const quadGeo = new THREE.PlaneGeometry(2, 2);
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// 4. ShaderMaterial — uniforms carry textures + audio data
const shaderMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse:    { value: null },   // input texture (set per-frame)
    uTime:       { value: 0.0 },
    uBass:       { value: 0.0 },    // audio reactivity
    uResolution: { value: new THREE.Vector2(w, h) },
  },
  vertexShader:   VERT_GLSL,
  fragmentShader: FRAG_GLSL,
  depthWrite:  false,
  depthTest:   false,
});

// 5. Per-frame render of a pass
function renderPass(mat, inputTex, outputTarget) {
  mat.uniforms.tDiffuse.value = inputTex;
  renderer.setRenderTarget(outputTarget); // null = screen
  renderer.render(quadScene, quadCam);
}
```

#### VideoTexture (live camera feed → GPU texture)

```javascript
// Create once — Three.js calls .update() automatically via requestVideoFrameCallback
const videoTex = new THREE.VideoTexture(videoElement);
videoTex.colorSpace = THREE.SRGBColorSpace;
videoTex.minFilter = THREE.LinearFilter;
videoTex.magFilter = THREE.LinearFilter;
videoTex.format    = THREE.RGBAFormat;
// Assign as uniform:  shaderMat.uniforms.tDiffuse.value = videoTex;
```

> **Key:** `THREE.VideoTexture` internally uses `requestVideoFrameCallback` when available (Chromium 94+). No manual `needsUpdate = true` required.

#### Standard Fullscreen Vertex Shader (all passes share this)

```glsl
// fullscreen.vert.glsl — no MVP transform needed for post-process quads
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0); // already in clip space
}
```

#### EffectComposer vs Manual RenderTargets

| Approach | Pros | Cons |
|---|---|---|
| `EffectComposer` (Three.js addon) | High-level, built-in FXAA/OutputPass | Extra dependency, less control |
| Manual `WebGLRenderTarget` chain | Full control, minimal overhead | More boilerplate |

**Decision for Phuebus:** Use **manual RenderTarget chain** — gives us precise control over the auto-gain pre-pass, shader chain order, and feedback buffer for `FeedbackTrails`.

---

### 3.2 Socket.IO v4 — Real-Time Control Plane

**Library ID (Context7):** `/websites/socket_io_v4`
**Install:** `npm install socket.io` (server) + CDN script for clients

#### Server Setup (server.js pattern)

```javascript
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import express from 'express';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket'], // skip polling for lower latency
});

// Room-based session pairing (4-char code)
io.on('connection', (socket) => {
  socket.on('join_room', ({ roomCode }) => {
    socket.join(roomCode);
  });

  // Broadcast control events to all in room EXCEPT sender
  const CONTROL_EVENTS = [
    'preset_change', 'slider_update', 'engine_switch',
    'prompt_update', 'audio_source_change', 'fps_cap_change'
  ];
  CONTROL_EVENTS.forEach(event => {
    socket.on(event, (data) => {
      socket.to(data.roomCode).emit(event, data);
    });
  });
});
```

#### Client Usage (display.js / remote.js)

```javascript
const socket = io({ transports: ['websocket'] });
socket.emit('join_room', { roomCode: SESSION_CODE });

// Listen for any control event
socket.on('preset_change', ({ presetId }) => {
  engineRouter.applyPreset(presetId);
});

// Emit from remote (mobile)
socket.emit('slider_update', { roomCode: SESSION_CODE, param: 'bass', value: 0.7 });
```

> **Latency:** Force `transports: ['websocket']` to skip HTTP long-polling handshake — measured <5ms on local Wi-Fi.

---

### 3.3 PeerJS — WebRTC Video Streaming

**Library ID (Context7):** `/peers/peerjs`
**Install:** `npm install peerjs` (client) + `npm install peer` (server-side signaling)

#### Embedded PeerServer (no external service needed)

```javascript
// server.js — add alongside Express/Socket.IO
import { ExpressPeerServer } from 'peer';
const peerServer = ExpressPeerServer(httpServer, { path: '/peerjs', debug: true });
app.use('/peerjs', peerServer);
```

#### Mobile → Display call flow

```javascript
// ── remote.js (CALLER — mobile) ──────────────────────────────
const peer = new Peer({ host: window.location.hostname, port: PORT, path: '/peerjs' });

peer.on('open', (id) => {
  socket.emit('register_peer', { roomCode: SESSION_CODE, peerId: id });
  // Start camera capture
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      const call = peer.call(DISPLAY_PEER_ID, stream);
    });
});

// ── display.js (RECEIVER — host) ─────────────────────────────
const peer = new Peer({ host: window.location.hostname, port: PORT, path: '/peerjs' });

peer.on('call', (call) => {
  call.answer(); // no outgoing media needed
  call.on('stream', (remoteStream) => {
    videoElement.srcObject = remoteStream;
    videoElement.play();
    videoTexture.needsUpdate = true; // VideoTexture picks up new source
  });
});
```

> **Important:** Use `sdpSemantics: 'unified-plan'` in PeerJS config for proper multi-track support.
> Set ICE servers to local STUN only for LAN-only Phase 1 operation.

---

### 3.4 Web Audio API — FFT Beat Detection

**No external library** — native browser API
**MDN Reference:** `AnalyserNode`, `AudioContext`

#### Device-selectable audio routing

```javascript
class AudioAnalyzer {
  constructor() {
    this.ctx      = null;
    this.analyser = null;
    this.freqData = null;
    this.source   = null;
  }

  async setInputDevice(deviceId) {
    if (this.source) { this.source.disconnect(); this.source = null; }
    if (!this.ctx) this.ctx = new AudioContext();
    await this.ctx.resume();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined },
    });

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;               // 1024 bins
    this.analyser.smoothingTimeConstant = 0.8;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    // DO NOT connect analyser to destination — avoids feedback loop
  }

  getBassEnergy() {
    this.analyser.getByteFrequencyData(this.freqData);
    // Bass bins 0-8 (~0-172 Hz at 44.1kHz / 2048 FFT)
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += this.freqData[i];
    return sum / (8 * 255); // normalized 0-1
  }

  getMidEnergy() {
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    for (let i = 9; i < 40; i++) sum += this.freqData[i];
    return sum / (31 * 255);
  }

  getHighEnergy() {
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    for (let i = 41; i < 128; i++) sum += this.freqData[i];
    return sum / (87 * 255);
  }
}
```

> **Best Practice:** Create exactly **one** `AudioContext` per app. Resume only after a user gesture (browser autoplay policy).

---

### 3.5 MediaPipe Tasks Vision — Pose Tracking

**Package:** `@mediapipe/tasks-vision` (replaces legacy `@mediapipe/pose` — do not use legacy)
**CDN WASM:** `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm`

#### Modern API (2025+)

```javascript
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

// Initialize once (async — do this at app startup, not per-frame)
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
);

const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: '/models/pose_landmarker_lite.task',
    delegate: 'GPU',   // WebGL acceleration — critical for <8ms target
  },
  runningMode:                    'VIDEO',
  numPoses:                       2,
  minPoseDetectionConfidence:     0.5,
  minTrackingConfidence:          0.5,
});

// Per-frame call (inside requestAnimationFrame)
function detectPose(videoEl, timestamp) {
  const result = poseLandmarker.detectForVideo(videoEl, timestamp);
  return result.landmarks; // array of { x, y, z, visibility } normalized 0-1
}
```

> **Avoid:** Legacy `@mediapipe/pose` — deprecated as of 2024. Use `@mediapipe/tasks-vision` exclusively.

---

### 3.6 MediaDevices API — UVC/USB Camera Enumeration

**Native browser API** — no library needed

```javascript
// Enumerate all connected video/audio devices
async function enumerateDevices() {
  await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); // permission grant first
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter(d => d.kind === 'videoinput');
  const mics    = devices.filter(d => d.kind === 'audioinput');
  return { cameras, mics };
}

// Open specific UVC camera by deviceId
async function openCamera(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: deviceId },
      width:     { ideal: 1920 },
      height:    { ideal: 1080 },
      frameRate: { ideal: 60, max: 60 },
    },
  });
}
```

> **Note:** UVC/USB capture cards (GoPro HDMI out, DJI grabbers, Sony clean HDMI) appear as standard
> `videoinput` devices on macOS — no custom driver needed. The browser lists them in `enumerateDevices()`.

---

### 3.7 MediaRecorder — Canvas Recording

```javascript
// Capture canvas stream at high bitrate
const canvasStream = renderer.domElement.captureStream(60); // 60fps
const recorder = new MediaRecorder(canvasStream, {
  mimeType: 'video/webm;codecs=vp9',
  videoBitsPerSecond: 12_000_000, // 12 Mbps
});

const chunks = [];
recorder.ondataavailable = e => chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url  = URL.createObjectURL(blob);
  // trigger <a> download
  const a = document.createElement('a');
  a.href = url;
  a.download = `phuebus_${Date.now()}.webm`;
  a.click();
};

recorder.start(1000); // collect in 1-second chunks
```

---

## Section 4 — Implementation Guidance & System Best Practices

### 4.1 Rendering Pipeline Order (Phase 1)

```
[Camera Frame — VideoTexture (Three.js)]
        │
        ▼  Pass 1
[AutoGainPrepass.js]  — brightness equalization → RenderTarget A
        │
        ▼  Pass 2
[Active Shader Pass]  — ToonShader / NeonAura reads RT-A → writes RT-B
        │
        ▼  Pass 3
[FeedbackTrails.js]   — blends RT-B with previous buffer (ping-pong RT-C ↔ RT-D)
        │
        ▼  Final blit
[Screen / Projector Canvas (null render target)]
```

**Ping-pong buffer pattern for feedback trails:**

```javascript
let readTarget  = createRenderTarget(w, h);
let writeTarget = createRenderTarget(w, h);

function renderFeedback(currentFrameRT) {
  feedbackMat.uniforms.tPrev.value    = readTarget.texture;
  feedbackMat.uniforms.tCurrent.value = currentFrameRT.texture;
  renderPass(feedbackMat, null, writeTarget);
  // Swap buffers
  [readTarget, writeTarget] = [writeTarget, readTarget];
  // readTarget now holds the composited output — blit to screen
}
```

---

### 4.2 Auto-Gain Pre-Pass Logic (Low-Light Boost + Strobe Clamp)

The `AutoGainPrepass.js` GLSL fragment shader implements:

1. **Luminance sampling:** `float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));`
2. **Adaptive gain:** `float gain = mix(1.0, uMaxGain, 1.0 - pow(avgLuma, 0.3));` — heavier boost when darker
3. **Highlight clamp:** `vec3 result = clamp(color.rgb * gain, 0.0, 1.0);` — prevents strobe blowout
4. **CPU-side temporal average:** Update `avgLuma` uniform by exponential smoothing each frame:
   ```javascript
   avgLuma = avgLuma * 0.95 + measuredLuma * 0.05;
   autoGainMat.uniforms.uAvgLuma.value = avgLuma;
   ```

---

### 4.3 Audio Reactivity — Binding to Shader Uniforms

```javascript
// In render loop (display.js)
function renderLoop(timestamp) {
  const bass = audioAnalyzer.getBassEnergy();  // 0-1
  const mid  = audioAnalyzer.getMidEnergy();

  // Push to active shader
  activeShaderMat.uniforms.uBass.value = bass;
  activeShaderMat.uniforms.uMid.value  = mid;
  activeShaderMat.uniforms.uTime.value = timestamp * 0.001;

  runPipeline();
}
```

Beat detection — simple threshold crossing (no external lib needed):

```javascript
let prevBass = 0;
function isBeat(bass, threshold = 0.6) {
  const beat = bass > threshold && prevBass <= threshold;
  prevBass = bass;
  return beat;
}
```

---

### 4.4 Engine Router — Hot-Swap Without Frame Drop

`EngineRouter.js` requirements:
1. Keep both `ShaderEngine` and `DiffusionEngine` instantiated — do NOT destroy on switch
2. Keep `VideoTexture` / `HTMLVideoElement` alive — only swap the pipeline receiving it
3. During switch: complete the in-flight frame in the outgoing engine before handing off
4. Expose a single `render(timestamp)` method delegating to active engine

```javascript
class EngineRouter {
  constructor(shaderEngine, diffusionEngine) {
    this.engines = { shader: shaderEngine, diffusion: diffusionEngine };
    this.active  = 'shader';
    this.switching = false;
  }

  async switchTo(mode) {
    if (mode === this.active || this.switching) return;
    this.switching = true;
    this.engines[this.active].pause();
    this.active = mode;
    this.engines[mode].resume();
    this.switching = false;
  }

  render(ts) {
    this.engines[this.active].render(ts);
  }
}
```

---

### 4.5 Mobile Touch Performance Rules

- Add `touch-action: none` on all interactive elements — eliminates 300ms click delay
- Use Pointer Events API (`pointerdown`, `pointermove`, `pointerup`) — unified touch + mouse
- Debounce slider Socket.IO emissions at 16ms (one rAF frame interval)
- Bottom sheet: CSS `transform: translateY()` + `transition` only — **never** animate `top/bottom` (triggers layout reflow → jank)

```css
.bottom-sheet {
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;
}
.bottom-sheet.open {
  transform: translateY(0);
}
```

---

### 4.6 FPS Throttling (15 / 30 / 60 cap)

Do NOT use `setInterval` for render throttling — it desynchronizes with the GPU vsync.
Use `requestAnimationFrame` with frame-time gating:

```javascript
let lastFrameTime = 0;
let fpsCap = 60; // updated by remote slider

renderer.setAnimationLoop((ts) => {
  const frameBudget = 1000 / fpsCap;
  if (ts - lastFrameTime < frameBudget) return; // skip frame
  lastFrameTime = ts;
  // ... render pipeline
});
```

---

### 4.7 Technology Stack Decisions & Alternatives Considered

| Component | Chosen | Alternatives Evaluated | Decision Rationale |
|---|---|---|---|
| 3D / Shader Engine | **Three.js r165+** | Babylon.js, raw WebGL2, PIXI.js | Best RenderTarget + ShaderMaterial ecosystem; PIXI is 2D only; Babylon is heavier |
| Real-Time Signaling | **Socket.IO v4** | ws (raw WebSocket), SSE | Rooms + auto-reconnect; WebSocket-only transport for sub-5ms LAN latency |
| WebRTC P2P | **PeerJS + embedded PeerServer** | raw RTCPeerConnection, mediasoup | PeerJS simplifies offer/answer; embedded server = no external cloud dependency |
| Pose Tracking | **@mediapipe/tasks-vision** | TF.js BlazePose, legacy @mediapipe/pose | Current official SDK; GPU delegate; no deprecated APIs |
| Audio Analysis | **Web Audio API (native)** | Tone.js, Meyda.js | Zero overhead; Tone.js is for synthesis not real-time analysis |
| Desktop Packaging (Phase 3) | **Tauri** | Electron | Tauri: ~3MB binary, native OS webview; Electron: 120MB Chromium bundle |
| CSS Approach | **Vanilla CSS + CSS custom properties** | Tailwind CSS | No build step; dark-mode touch UI is achievable with ~300 lines vanilla CSS |

---

### 4.8 Phase 2 Hooks — Diffusion AI Integration Points

The following interfaces must be **stubbed but not implemented** in Phase 1:

| Hook | File Location | Required Interface |
|---|---|---|
| `DiffusionEngine` | `public/js/engine/DiffusionEngine.js` | `render(videoFrame, prompt) → ImageBitmap` |
| `ModelPackManager` | `public/js/engine/ModelPackManager.js` | `loadPack(url) → model`, `listPacks() → []` |
| Engine mode `'diffusion'` | `EngineRouter.js` | `switchTo('diffusion')` must not throw |
| AI Prompt Bar socket event | `remote.html` + `server.js` | `prompt_update` event already wired in Phase 1 |

---

### 4.9 Performance Targets & Measurement Methods

| Metric | Phase 1 Target | How to Measure |
|---|---|---|
| End-to-end latency (camera → projector) | < 30ms | `performance.now()` at ingestion + composite |
| Shader render time per frame | < 8ms | `EXT_disjoint_timer_query_webgl2` GPU timer |
| Socket.IO round-trip (LAN) | < 10ms | ping/pong echo with `performance.now()` |
| WebRTC stream latency (LAN) | < 80ms | `RTCPeerConnection.getStats()` → `currentRoundTripTime` |
| MediaPipe pose detection | < 8ms (GPU) | `performance.mark` around `detectForVideo()` |
| Frame budget at 60fps | 16.67ms total | Chrome DevTools → Performance tab frame timeline |

---

### 4.10 Security & Local-Only Operation (Phase 1 Guardrail)

- All traffic is **LAN-only** — no STUN/TURN to public internet in Phase 1
- No API keys or cloud calls in any Phase 1 code
- Session room codes: 4-character alphanumeric (65,536 combinations — sufficient for private events)
- WebRTC `iceTransportPolicy: 'relay'` intentionally **NOT** set — pure direct P2P on LAN
- Server listens on `0.0.0.0` for LAN discovery but does not expose any auth surface

---

*End of SPEC.md — Sections 1–4 complete.*
*Section 5 (Phase 2 Diffusion Pipeline) and Section 6 (Phase 3 Desktop Packaging) to be authored when respective phases begin.*
