# PLAN — Phase 2: Hybrid Real-Time Diffusion & Model Switching

> **Phase:** 2 of 3  
> **Pre-condition:** Phase 1 fully complete and verified per docs/plan/PHASE1.md exit criteria.  
> **Goal:** Seamlessly integrate a local AI diffusion engine (SDXL Turbo / LCM on Apple Silicon MPS/MLX) and a cloud StreamDiffusion GPU option, hot-swappable with the Phase 1 WebGL shader engine at runtime.  
> **Flow for each prompt:** Research → Plan → Ask for choices/decisions → Write code → Verify → Commit → Push

---

## Prompt 1 — AI Engine Architecture Research & Decision

### Research
- [ ] Benchmark StreamDiffusion vs ComfyUI API vs A1111 API for latency at 512×512 generation
- [ ] Confirm MLX-LM / MLX Stable Diffusion performance on M3 Pro/Max (10-15fps expectation)
- [ ] Evaluate ControlNet Depth vs LineArt conditioning approach for camera-reactive generation
- [ ] Evaluate `img2img` strength tradeoff: low strength (0.3) = fast, high fidelity to input; high (0.7) = more creative

### Plan
- [ ] Define DiffusionEngine.js interface contract: `generate(frameImageData, prompt, strength) → ImageBitmap`
- [ ] Plan local Python sidecar architecture: FastAPI server receiving frames via HTTP or Unix socket
- [ ] Plan cloud architecture: WebSocket connection to remote GPU server running StreamDiffusion
- [ ] Plan frame interpolation layer: WebGL optical flow blending between diffusion frames

### Ask Before Writing
- Local AI: Python sidecar process (FastAPI) or ONNX/WebGPU direct in-browser?
- Cloud GPU: self-hosted (e.g., RunPod) or API service (e.g., Replicate)?
- ControlNet: Depth (better structure preservation) or LineArt (more stylized)?
- Target generation resolution: 512×512 upscaled to display, or native display res?

### Verify
- [ ] Architecture diagram approved
- [ ] DiffusionEngine interface contract reviewed and signed off

### Commit Message
```
docs(phase2): DiffusionEngine interface contract + architecture decision
```

---

## Prompt 2 — Local AI Sidecar (Python FastAPI + MLX/SDXL Turbo)

### Research
- [ ] `mlx-community/sdxl-turbo-fp16` model availability and MLX pipeline API
- [ ] FastAPI `WebSocket` endpoint for streaming frame delivery (avoid HTTP overhead per frame)
- [ ] PIL / OpenCV frame encoding: JPEG to minimize socket payload

### Plan
- [ ] `ai_engine/server.py`: FastAPI app, WebSocket endpoint `/ws/generate`
- [ ] Pipeline: receive JPEG bytes → decode → ControlNet conditioning → SDXL Turbo → encode JPEG → send back
- [ ] `DiffusionEngine.js`: WebSocket client to `ws://localhost:8080/ws/generate`, sends frames, receives results
- [ ] Startup: `server.js` spawns Python sidecar via `child_process.spawn`

### Ask Before Writing
- Python environment: assume `uv` managed venv, or document conda/pip setup?
- Frame sending rate: 4fps to AI (render result + interpolate to 60fps) or higher?
- ControlNet model: bundled with app or downloaded on first run?

### Verify
- [ ] Python sidecar starts successfully alongside Node.js server
- [ ] WebSocket delivers generated frames back to display.js
- [ ] 10-15fps generation confirmed on M3 Pro/Max
- [ ] No memory leak in Python after 30min continuous generation

### Commit Message
```
feat(phase2): Local AI sidecar — FastAPI + MLX SDXL Turbo + ControlNet
```

---

## Prompt 3 — Frame Interpolation (WebGL Optical Flow)

### Research
- [ ] Review Three.js optical flow shader implementation patterns
- [ ] Evaluate RIFE vs simple linear blend for frame interpolation at runtime
- [ ] Confirm EffectComposer compatibility with our manual RenderTarget approach

### Plan
- [ ] `FrameInterpolator.js`: WebGL shader that blends between two diffusion frames using motion vectors
- [ ] Motion vector estimation: simple block matching in GLSL (fast) or temporal reprojection
- [ ] Output: 60fps-equivalent canvas output from 10-15fps diffusion input

### Ask Before Writing
- Interpolation quality vs performance: simple linear blend (fast) or optical flow (better but heavier)?
- Visible artifact tolerance: should ghosting/smearing be configurable by user?

### Verify
- [ ] 10fps diffusion output visually smoothed to 30-60fps equivalent on display
- [ ] No visible tearing at interpolation boundaries
- [ ] Interpolation overhead < 2ms per frame

### Commit Message
```
feat(phase2): FrameInterpolator.js — WebGL optical flow blending
```

---

## Prompt 4 — Cloud AI Engine (StreamDiffusion Remote)

### Research
- [ ] StreamDiffusion WebSocket API protocol and frame format
- [ ] Cloud GPU provider setup: RunPod serverless vs persistent instance for latency
- [ ] Latency budget: < 150ms end-to-end for cloud mode

### Plan
- [ ] `DiffusionEngine.js`: add cloud mode via `setMode('cloud', serverUrl)` — connects to remote StreamDiffusion WS
- [ ] Adaptive frame dropping: if cloud response > 200ms, drop and use interpolated frame
- [ ] UI: cloud server URL input in settings panel; connection status indicator on HUD

### Ask Before Writing
- Cloud auth: API key in `.env` or user-entered at runtime?
- Fallback: if cloud connection drops, auto-switch to local AI or back to shader engine?
- Frame encoding for cloud: JPEG (smaller) or raw ImageData (lower CPU overhead)?

### Verify
- [ ] Cloud connection to StreamDiffusion server < 150ms latency confirmed
- [ ] Auto-fallback triggers correctly on simulated connection drop
- [ ] Cloud mode selection in EngineRouter works without shader pipeline disruption

### Commit Message
```
feat(phase2): Cloud AI engine — StreamDiffusion WebSocket client
```

---

## Prompt 5 — Prompt Deck UI

### Research
- [ ] Confirm socket event debounce strategy for rapid prompt chip tapping
- [ ] Review prompt engineering patterns for SDXL Turbo (short, strong style keywords work best)

### Plan
- [ ] `remote.html` additions: AI Prompt Bar with free-text input + 8 quick-tap style chips
- [ ] Quick-tap chips: "Anime", "Cyberpunk", "Watercolor", "Glitch", "Vaporwave", "Dark Fantasy", "Minimal", "Neon"
- [ ] Each chip tap appends/replaces style modifier in active prompt → emits `prompt_update`
- [ ] Prompt deck synced to display HUD (shows active prompt)

### Ask Before Writing
- Chip behavior: replace entire prompt or append to user's base text?
- Prompt character limit: 150 chars max (SDXL works best with concise prompts)?
- Negative prompt: expose or hardcode sensible defaults?

### Verify
- [ ] Tapping chips updates DiffusionEngine prompt within 1 socket round-trip (<10ms LAN)
- [ ] Visual feedback on tapped chip (active state)
- [ ] Prompt update reflected on display HUD

### Commit Message
```
feat(phase2): Prompt deck UI — quick-tap style chips + AI prompt bar
```

---

## Prompt 6 — Engine Router Enhancement & Phase 2 Integration

### Research
- [ ] Verify VideoTexture remains alive across all three engine modes (shader / local AI / cloud AI)
- [ ] Confirm EngineRouter.switchTo handles async DiffusionEngine warm-up

### Plan
- [ ] `EngineRouter.js`: extend `switchTo()` to handle async mode transitions (local AI needs warm-up time)
- [ ] Add transition states: `switching`, `warming-up`, `active` — display loading indicator during warm-up
- [ ] Mode 3: `'cloud'` — delegates to cloud DiffusionEngine
- [ ] Preset system: add AI-mode presets (include prompt + style chip state in preset config)

### Ask Before Writing
- Warm-up time acceptable: show spinner for up to 5s while AI model loads?
- AI presets: separate preset grid section or integrated with shader presets?

### Verify
- [ ] Switching shader → local AI → cloud AI → shader works without page reload
- [ ] VideoTexture consistent across all mode switches
- [ ] Loading state displayed and dismissed correctly

### Commit Message
```
feat(phase2): EngineRouter Phase 2 — three-mode hot-swap with async warm-up
```

---

## Phase 2 Exit Criteria (Definition of Done)

| Criterion | Status |
|---|---|
| Local SDXL Turbo @ 10-15fps on Apple Silicon | [ ] |
| ControlNet conditioning from live camera frame | [ ] |
| Frame interpolation to 60fps equivalent | [ ] |
| Cloud StreamDiffusion @ <150ms latency | [ ] |
| Prompt deck with quick-tap chips functional | [ ] |
| Three-mode engine switching (shader / local AI / cloud AI) | [ ] |
| AI presets in preset system | [ ] |
| Phase 1 functionality unbroken | [ ] |
