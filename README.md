# Phuebus — Interactive Visual Projection Engine

> *"The Interactive Visual Engine for Live Stage & Events."*

**Phuebus** converts live camera feeds (phones, GoPros, DSLRs, FPV drones) into stylized real-time visuals projected at events — sub-30ms latency, audio reactive, mobile-controlled.

---

## Quick Links

| Document | Purpose |
|---|---|
| [PRD.md](PRD.md) | Product Requirements — what we're building and why |
| [PROMPT.md](PROMPT.md) | Master build prompt — original architecture specification |
| [SPEC.md](SPEC.md) | Technical Specification — framework reference + implementation guidance |
| [AGENTS.md](AGENTS.md) | Development rules — mandatory workflow for every coding prompt |

---

## Roadmap Documents

| File | Phase | Description |
|---|---|---|
| [docs/plan/PHASE1.md](docs/plan/PHASE1.md) | Phase 1 | Local Shader Engine · WebRTC/USB Ingestion · Audio Reactivity · Mobile Remote |
| [docs/plan/PHASE2.md](docs/plan/PHASE2.md) | Phase 2 | Hybrid Diffusion AI Engine · ControlNet · Frame Interpolation · Cloud GPU |
| [docs/plan/PHASE3.md](docs/plan/PHASE3.md) | Phase 3 | Tauri Desktop App · Model Store · Cloud SaaS · Licensing |

---

## Decision & Progress Logs

| File | Purpose |
|---|---|
| [docs/logs/DECISIONS.md](docs/logs/DECISIONS.md) | Every architectural/framework/design decision with rationale |
| [docs/logs/PROMPTS.md](docs/logs/PROMPTS.md) | Chronological log of every user prompt given to the agent |
| [docs/logs/PROGRESS.md](docs/logs/PROGRESS.md) | Running task completion log across all phases |

---

## Research Notes

| File | Topic |
|---|---|
| [docs/research/FRAMEWORKS.md](docs/research/FRAMEWORKS.md) | Framework alternatives evaluated with pros/cons scoring |

---

## Repository Structure

```
phuebus/
├── README.md                   ← You are here
├── PRD.md                      ← Product Requirements Document
├── PROMPT.md                   ← Master build prompt / architecture spec
├── SPEC.md                     ← Technical Specification (Sections 1–4)
├── AGENTS.md                   ← Dev agent workflow rules
│
├── docs/
│   ├── logs/
│   │   ├── DECISIONS.md        ← Architectural & design decision log
│   │   ├── PROMPTS.md          ← Prompt history log
│   │   └── PROGRESS.md         ← Task completion tracker
│   └── research/
│       └── FRAMEWORKS.md       ← Alternatives evaluated with pros/cons
│   └── plan/
│       └── PHASE1.md         ← Phase 1 executable prompt plan (10 prompts)
│       └── PHASE2.md         ← Phase 2 executable prompt plan (6 prompts)
│       └── PHASE3.md         ← Phase 3 executable prompt plan (5 prompts)
│
└── src/                        ← Application source (populated during build)
    ├── server.js
    ├── package.json
    └── public/
        ├── index.html
        ├── display.html
        ├── remote.html
        ├── css/
        │   └── app.css
        └── js/
            ├── display.js
            ├── remote.js
            ├── recorder.js
            ├── engine/
            │   ├── EngineRouter.js
            │   ├── ShaderEngine.js
            │   ├── DiffusionEngine.js
            │   ├── ModelPackManager.js
            │   ├── AudioAnalyzer.js
            │   ├── VideoIngestion.js
            │   └── PoseTracker.js
            └── shaders/
                ├── AutoGainPrepass.js
                ├── ToonShader.js
                ├── NeonAura.js
                └── FeedbackTrails.js
```

---

## Phase Status

| Phase | Status | Description |
|---|---|---|
| **Phase 1** | 🟡 Planning | Local shader engine + ingestion + mobile remote |
| **Phase 2** | ⬜ Not Started | Hybrid AI diffusion engine |
| **Phase 3** | ⬜ Not Started | Desktop app + SaaS distribution |

---

## Local Development Setup

> ⚠️ Code scaffold not yet started. See [docs/plan/PHASE1.md](docs/plan/PHASE1.md) — begin with Prompt 1.

```bash
# Once src/ is populated:
cd src
npm install
npm start
# Open http://localhost:3000
```

### Hardware Requirements (Phase 1)
- macOS (UVC native support; Windows supported but untested)
- Chrome / Chromium latest (WebGL2 + WebRTC)
- LAN Wi-Fi for mobile WebRTC streaming
- USB capture card (optional — GoPro, Sony HDMI, DJI grabber)

---

## Key Design Decisions

All decisions are logged in [docs/logs/DECISIONS.md](docs/logs/DECISIONS.md).

| Decision | Choice | Reason |
|---|---|---|
| 3D/Shader Engine | Three.js r165+ | Best WebGLRenderTarget ecosystem |
| Real-Time Signaling | Socket.IO v4 (WebSocket only) | Rooms + sub-5ms LAN |
| WebRTC P2P | PeerJS + embedded PeerServer | No external signaling cloud |
| Pose Tracking | @mediapipe/tasks-vision | Current SDK; GPU delegate |
| Desktop Packaging (Phase 3) | Tauri | ~3MB vs Electron's ~120MB |
