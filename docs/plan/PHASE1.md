# PLAN — Phase 1: Local Shader Engine, Multi-Input Ingestion & Low-Latency Foundation

> **Phase:** 1 of 3  
> **Goal:** Fully working local projection engine — 60fps WebGL shaders, WebRTC + USB camera ingestion, audio reactivity, mobile touch remote, bidirectional Socket.IO sync — all running entirely on a single local machine.  
> **Flow for each prompt:** Research → Plan → Ask for choices/decisions → Write code → Verify → Commit → Push

---

## Pre-conditions Before Starting

- [ ] Node.js 20 LTS installed
- [ ] Chrome / Chromium latest (WebGL2 + WebRTC)
- [ ] macOS (primary dev target — UVC native support)
- [ ] Git repo initialized at `/phuebus`
- [ ] SPEC.md reviewed and understood

---

## Prompt 1 — Project Scaffold & Server Foundation

### Research
- [ ] Confirm Express 5 vs Express 4 differences for `serve-static` and `http.createServer` integration
- [ ] Confirm Socket.IO v4 `transports: ['websocket']` eliminates polling correctly
- [ ] Confirm PeerServer embedding pattern (ExpressPeerServer vs standalone peer server)

### Plan
- [ ] Create `package.json` with all Phase 1 dependencies (three, socket.io, peer, express)
- [ ] Create `server.js`: Express static server + Socket.IO signaling + PeerServer relay
- [ ] Create room code generation utility (4-char alphanumeric)
- [ ] Wire all 6 control events: `preset_change`, `slider_update`, `engine_switch`, `prompt_update`, `audio_source_change`, `fps_cap_change`
- [ ] Create `public/index.html` landing page with mode switcher (Display / Remote links)

### Ask Before Writing
- WebSocket port: default `3000` or configurable via `.env`?
- Room code: auto-generated or user-entered? QR code display on `/display`?
- PeerServer: embedded in same process or separate port?

### Verify
- [ ] `npm start` serves `localhost:3000`
- [ ] `/display` and `/remote` load without errors
- [ ] Socket.IO connection confirmed in browser DevTools Network tab (WebSocket frame)
- [ ] PeerServer responds at `/peerjs`

### Commit Message
```
feat(server): scaffold Express + Socket.IO + PeerServer foundation
```

---

## Prompt 2 — Video Ingestion (UVC + WebRTC)

### Research
- [ ] Verify `navigator.mediaDevices.enumerateDevices()` returns UVC capture cards on macOS Chrome
- [ ] Confirm PeerJS `call.answer()` without local stream on the display side works correctly
- [ ] Check `videoElement.srcObject` hot-swap (switching from WebRTC to UVC without page reload)

### Plan
- [ ] `VideoIngestion.js`: `enumerateDevices()`, `openCamera(deviceId)`, `startWebRTCReceiver()`
- [ ] PeerJS: display registers as receiver, remote calls with camera stream
- [ ] `remote.js`: camera switcher UI (front/back/environment facing mode)
- [ ] `display.js`: populate device selector dropdown from enumerated UVC devices
- [ ] Socket.IO: relay remote's PeerJS peer ID to display via `register_peer` event

### Ask Before Writing
- Should the mobile remote support switching between front and back camera mid-session?
- Should the display page show a live thumbnail preview of ingested video (before shader)?
- Multiple simultaneous WebRTC streams (Phase 1 scope or defer to Phase 2)?

### Verify
- [ ] iPhone navigates to `/remote`, camera starts streaming
- [ ] Display at `/display` receives WebRTC stream in `<video>` element
- [ ] USB UVC capture card (or built-in webcam) appears in device selector on display page
- [ ] Switching between WebRTC and UVC sources without refresh

### Commit Message
```
feat(ingestion): VideoIngestion.js — WebRTC PeerJS + UVC/USB MediaDevices support
```

---

## Prompt 3 — Three.js Shader Engine Foundation

### Research
- [ ] Verify `THREE.WebGLRenderTarget` ping-pong buffer for feedback trails
- [ ] Confirm `THREE.VideoTexture` auto-update behavior on Chrome (requestVideoFrameCallback)
- [ ] Confirm `OrthographicCamera(-1, 1, 1, -1, 0, 1)` + `PlaneGeometry(2, 2)` clip-space quad pattern

### Plan
- [ ] `ShaderEngine.js`: renderer init, RenderTarget chain, VideoTexture binding, renderLoop
- [ ] `AutoGainPrepass.js` (GLSL): luminance sampling, adaptive gain, highlight clamp
- [ ] Standard shared `fullscreen.vert.glsl` passthrough vertex shader
- [ ] Wire `uTime`, `uResolution` uniforms
- [ ] Output to `renderer.domElement` in `display.html` as fullscreen canvas

### Ask Before Writing
- Canvas resolution: match display resolution or render at fixed 1920×1080?
- Anti-aliasing on WebGLRenderer: disabled by default for perf or user-toggleable?
- DPR capping: hardcoded at `Math.min(devicePixelRatio, 2)` or user-configurable?

### Verify
- [ ] Camera feed appears fullscreen in display canvas
- [ ] Auto-gain pre-pass visibly brightens a dark scene (test with dim room lighting)
- [ ] No console errors; WebGL2 confirmed via `renderer.capabilities.isWebGL2`
- [ ] Frame rate at 60fps on MacBook M-series (verify via Stats.js overlay)

### Commit Message
```
feat(engine): ShaderEngine.js + AutoGainPrepass — Three.js WebGL2 pipeline
```

---

## Prompt 4 — Shader Pack: ToonShader + FeedbackTrails + NeonAura

### Research
- [ ] Review Sobel edge detection kernel implementation in GLSL (3×3 convolution)
- [ ] Review color posterization / quantization in GLSL
- [ ] Review ping-pong feedback buffer decay technique for trails

### Plan
- [ ] `ToonShader.js` (GLSL): Sobel edge detection + posterization + audio-modulated line glow
- [ ] `FeedbackTrails.js` (GLSL): frame buffer decay + particle dispersion using ping-pong RTs
- [ ] `NeonAura.js` (GLSL): skeleton landmark overlay (input: PoseTracker landmarks) + bloom glow
- [ ] All shaders expose uniform hooks: `uBass`, `uMid`, `uTime`, `uEdgeSensitivity`, `uColorSteps`

### Ask Before Writing
- ToonShader color palette: user-selectable hue or algorithmic?
- FeedbackTrails: decay multiplier range (e.g., 0.8–0.99)?
- NeonAura: glow color fixed (cyan/magenta) or reactive to audio frequency?

### Verify
- [ ] ToonShader produces visible cartoon edge lines on camera feed
- [ ] FeedbackTrails shows persistent ghost trails on motion
- [ ] NeonAura overlays skeleton joints as neon particles (requires PoseTracker — can stub landmarks for now)
- [ ] All shaders react to simulated bass value (inject test value to confirm uniform binding)

### Commit Message
```
feat(shaders): ToonShader, FeedbackTrails, NeonAura — Phase 1 shader pack
```

---

## Prompt 5 — Audio Reactivity Engine

### Research
- [ ] Confirm `AudioContext.resume()` user-gesture requirement on Chrome
- [ ] Confirm `navigator.mediaDevices.enumerateDevices()` reliably lists USB audio interfaces
- [ ] Verify `AnalyserNode` frequency bin mapping for bass/mid/high at 44.1kHz / 2048 FFT

### Plan
- [ ] `AudioAnalyzer.js`: `setInputDevice(deviceId)`, `getBassEnergy()`, `getMidEnergy()`, `getHighEnergy()`, `isBeat()`
- [ ] `display.html`: audio device selector dropdown (populated from enumerateDevices)
- [ ] `remote.html`: UI for changing audio source → emits `audio_source_change` event
- [ ] Wire bass/mid/high uniforms into ShaderEngine on each rAF

### Ask Before Writing
- Beat detector: simple threshold crossing or more sophisticated onset detection (e.g., spectral flux)?
- Audio visualization: show waveform/bar mini-visualization on display or remote UI?
- Default device: first USB audio interface found, or always prompt user to select?

### Verify
- [ ] Music playing through speaker/aux-in produces non-zero `getBassEnergy()` values
- [ ] Switching audio device via dropdown changes FFT source without page reload
- [ ] ToonShader edge glow visibly pulses on beat
- [ ] No feedback loop (analyser not connected to `audioContext.destination`)

### Commit Message
```
feat(audio): AudioAnalyzer.js — Web Audio API FFT beat detection + device routing
```

---

## Prompt 6 — Pose Tracker

### Research
- [ ] Confirm `@mediapipe/tasks-vision` PoseLandmarker `VIDEO` runningMode API
- [ ] Confirm GPU delegate availability on Chrome macOS
- [ ] Verify landmark coordinate system (normalized 0-1) and how to project to canvas pixels

### Plan
- [ ] `PoseTracker.js`: `init()` with FilesetResolver, `detectFrame(videoEl, ts)` → landmarks
- [ ] Integrate landmark output into `NeonAura.js` uniform (landmark texture or flat array)
- [ ] Graceful fallback: if MediaPipe fails to load, NeonAura uses motion-based particle system only

### Ask Before Writing
- Pose tracking active for all presets or toggle-able (performance cost consideration)?
- Landmark data: pass as texture uniform or flat array of 33 vec2s?
- Track up to 2 people or more?

### Verify
- [ ] `PoseLandmarker` initializes without error in browser console
- [ ] Standing in front of camera renders skeleton overlay in NeonAura shader
- [ ] Detection latency < 8ms (measure with `performance.mark`)
- [ ] Graceful no-op when no person detected

### Commit Message
```
feat(pose): PoseTracker.js — MediaPipe tasks-vision PoseLandmarker integration
```

---

## Prompt 7 — Engine Router & Preset System

### Research
- [ ] Verify hot-swap pattern between Two.js ShaderEngine modes without frame drop
- [ ] Confirm DiffusionEngine stub interface required for Phase 2 compatibility

### Plan
- [ ] `EngineRouter.js`: `switchTo(mode)`, `render(ts)`, hot-swap without unmounting VideoTexture
- [ ] Preset config object structure: `{ id, name, shader, params: { edgeSens, colorSteps, decay, ... } }`
- [ ] Define 6 initial presets: Default, ToonComic, NeonCyberpunk, FeedbackGhost, AudioPulse, RawCamera
- [ ] `DiffusionEngine.js`: stub-only (returns null, logs "Phase 2 not implemented")
- [ ] `ModelPackManager.js`: stub-only

### Ask Before Writing
- Preset storage: hardcoded JSON in JS or configurable YAML/JSON file users can edit?
- Engine switch animation: crossfade frames or hard cut?
- Custom preset saving: Phase 1 scope or defer?

### Verify
- [ ] Clicking any preset on display page changes active shader
- [ ] `engine_switch` socket event received on remote and display stays in sync
- [ ] Switching engine mode 20 times rapidly causes no memory leaks or frame drops
- [ ] `DiffusionEngine.stub()` logs correctly without throwing

### Commit Message
```
feat(router): EngineRouter.js + preset system + DiffusionEngine stub
```

---

## Prompt 8 — Mobile Remote UI (/remote.html)

### Research
- [ ] Confirm CSS `touch-action: none` effectiveness for 0ms click delay on iOS Safari
- [ ] Confirm `pointer events` API coverage on iOS WebKit
- [ ] Bottom sheet gesture detection best practice (CSS-only vs JS drag handler)

### Plan
- [ ] `remote.html` layout: dark mode, MPC-style preset grid (6 tiles), AI prompt bar at top
- [ ] Expandable bottom sheet: swipe-up → open; swipe-down → close
- [ ] Bottom sheet sliders: FPS cap (15/30/60), Night Boost, Edge Sensitivity, Beat Reactivity, Motion Decay, Color Steps
- [ ] Each slider emits `slider_update` event via Socket.IO on `input` event (debounced 16ms)
- [ ] `remote.js`: camera stream start, peer registration, socket event emitters, bidirectional preset sync

### Ask Before Writing
- Preset tile labels: icon only, text only, or icon + text?
- Bottom sheet: 50% height or full-screen when open?
- QR code for session join: generate on display, scan on mobile, or manual code entry?

### Verify
- [ ] Mobile opens `/remote` at `192.168.x.x:3000/remote`, camera starts
- [ ] Tapping preset tile emits `preset_change` — display switches shader < 100ms
- [ ] Swiping up opens bottom sheet with smooth animation (no jank, 60fps transition)
- [ ] Dragging FPS slider updates display render cap in real-time
- [ ] Bidirectional sync: changing preset on display updates highlight on mobile remote

### Commit Message
```
feat(remote): Mobile remote UI — preset grid, bottom sheet, Socket.IO sync
```

---

## Prompt 9 — Display Host UI (/display.html)

### Research
- [ ] Confirm `window.open` / secondary window canvas fullscreen approach on macOS
- [ ] Confirm Canvas `captureStream()` + `MediaRecorder` recording pipeline

### Plan
- [ ] `display.html`: fullscreen canvas (projector output) + thin overlay control bar
- [ ] Overlay HUD: current preset name, FPS counter, engine mode indicator, audio input label
- [ ] Preset grid visible on display (mirrored with remote, highlights active preset)
- [ ] Session QR code display on load (generated from local IP + port + room code)
- [ ] `recorder.js`: canvas stream capture, start/stop recording, auto-download WebM

### Ask Before Writing
- HUD: always visible or auto-hide after 3s of inactivity?
- QR code library: lightweight CDN (qrcode.js) or generate as SVG manually?
- Multiple monitors: should display.html automatically move to secondary screen?

### Verify
- [ ] Canvas fills entire browser window without scrollbars
- [ ] FPS counter shows ≥ 55fps on MacBook M-series
- [ ] Recording start → stop → auto-downloads `.webm` file
- [ ] Scanning QR code on phone opens `/remote` pre-filled with session room code
- [ ] Latency end-to-end (camera on phone → projector canvas) < 30ms (measured via `performance.now()`)

### Commit Message
```
feat(display): Display host UI — fullscreen canvas, HUD overlay, QR session join, recorder
```

---

## Prompt 10 — Integration & Polish

### Research
- [ ] Check for known CORS issues between PeerJS and Socket.IO on same Express server
- [ ] Check iOS Safari constraints on `getUserMedia` (requires HTTPS or localhost)

### Plan
- [ ] End-to-end integration test: mobile → socket → display pipeline
- [ ] Error handling: graceful fallback if WebRTC peer fails (fallback to UVC)
- [ ] CSS polish: consistent dark theme across all three pages
- [ ] Performance audit: Chrome DevTools Performance tab, identify any render bottlenecks
- [ ] README.md: setup instructions, LAN usage guide, supported hardware list

### Ask Before Writing
- HTTPS requirement for mobile: self-signed cert + mkcert, or document that LAN HTTP works on Android/Chrome?
- Error handling UI: toast notifications or console-only in Phase 1?

### Verify
- [ ] All SPEC.md Phase 1 performance targets met (see Section 4.9)
- [ ] No memory leaks after 30 minutes of continuous operation (Chrome DevTools Memory tab)
- [ ] Works on iPhone Safari (HTTPS required — implement self-signed cert with mkcert)
- [ ] Works on Android Chrome (HTTP localhost OK)
- [ ] `npm start` → `open http://localhost:3000` → fully functional in < 60s

### Commit Message
```
feat(phase1): Integration, polish, README — Phase 1 complete
```

---

## Phase 1 Exit Criteria (Definition of Done)

| Criterion | Status |
|---|---|
| Sub-30ms end-to-end latency on LAN | [ ] |
| WebRTC mobile stream → display working | [ ] |
| UVC/USB camera selection working | [ ] |
| Auto-gain pre-pass active by default | [ ] |
| All 3 shaders functional (Toon, Trails, Neon) | [ ] |
| Audio FFT device routing functional | [ ] |
| Pose tracking skeleton overlay functional | [ ] |
| Mobile remote bidirectionally synced | [ ] |
| Canvas recording functional | [ ] |
| Zero cloud dependencies | [ ] |
| Phase 2 stubs in place | [ ] |
