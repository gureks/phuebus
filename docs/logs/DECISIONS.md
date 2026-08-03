# DECISIONS.md — Phuebus Architectural Decision Log

> **Purpose:** Every significant architectural, framework, or design decision made during the Phuebus build is logged here with its rationale, alternatives considered, and who/what prompted the decision.
>
> **Instructions for the agent:** After every Stage 3 (ASK) answer received from the user, and after any research-driven choice, append a new entry to this log using the template below. Never overwrite existing entries — always append.

---

## Decision Log Template

```
## DEC-NNN — [Short Title]
- **Date:** YYYY-MM-DD
- **Prompt:** [Prompt number or description that triggered this]
- **Phase:** Phase 1 / 2 / 3 / Planning
- **Status:** ✅ Decided | 🔄 Revisiting | ❌ Rejected

### Context
[What problem or choice this addresses.]

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| Option A | ... | ... | 4 |
| Option B | ... | ... | 2 |

### Decision
**Chosen: Option A**

### Rationale
[Why this option won — technical, practical, or strategic reasons.]

### Consequences
- [What this enables]
- [What this locks us out of, or makes harder]

### References
- [Link or source that informed this decision]
```

---
---

## DEC-001 — 3D / Shader Engine: Three.js over Babylon.js / raw WebGL2

- **Date:** 2026-08-03
- **Prompt:** Initial planning session (PROMPT.md architecture review)
- **Phase:** Planning
- **Status:** ✅ Decided

### Context
The core rendering pipeline requires a GPU-accelerated shader pass chain with per-frame `WebGLRenderTarget` ping-pong buffers, `VideoTexture` for live camera feeds, and `ShaderMaterial` for GLSL custom shaders. A framework or direct API choice was needed.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **Three.js r165+** | Mature RenderTarget API, VideoTexture built-in, massive community, excellent GLSL ShaderMaterial, OrthographicCamera fullscreen quad pattern well-documented | Slightly more abstraction overhead than raw WebGL | **5** |
| Babylon.js | Good enterprise support, GUI built-in | Much heavier bundle (~800KB), PostProcess system less flexible for custom GLSL | **2** |
| Raw WebGL2 | Absolute minimum overhead, total control | Massive boilerplate for every operation (VAOs, framebuffers, program management), error-prone | **3** |
| PIXI.js | Fast 2D renderer | 2D only — no proper 3D scene graph or ShaderMaterial equivalent for multi-pass pipelines | **1** |

### Decision
**Chosen: Three.js r165+**

### Rationale
Three.js provides the exact primitives needed (`WebGLRenderTarget`, `VideoTexture`, `ShaderMaterial`, `OrthographicCamera`) with well-documented patterns and the highest number of code examples in Context7. The overhead vs raw WebGL2 is negligible at our pass count (4 passes). Babylon.js is oriented toward game engines, not VJ tools.

### Consequences
- Enables multi-pass RenderTarget chain (AutoGain → Shader → Feedback)
- `VideoTexture` handles `requestVideoFrameCallback` automatically
- Bundle size ~600KB (acceptable for a desktop/display app, not a public web page)

### References
- Context7 query: `/mrdoob/three.js` — VideoTexture, RenderTarget, ShaderMaterial patterns
- SPEC.md Section 3.1

---

## DEC-002 — Real-Time Signaling: Socket.IO v4 (WebSocket-only transport)

- **Date:** 2026-08-03
- **Prompt:** Initial planning session
- **Phase:** Planning
- **Status:** ✅ Decided

### Context
Bidirectional control events (preset changes, slider updates, engine switches) must flow between mobile remote and display host with <10ms LAN latency. A reliable real-time signaling layer was needed.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **Socket.IO v4 (WebSocket-only)** | Room management built-in, auto-reconnect, event namespace, sub-5ms on LAN when polling disabled | Overhead vs raw ws | **5** |
| `ws` raw WebSocket | Minimal overhead, no abstraction | No rooms, no reconnection, no event namespacing — need to implement all manually | **3** |
| Server-Sent Events (SSE) | Simple server → client push | One-directional — cannot push from client to server without a second HTTP endpoint | **1** |
| WebTransport (HTTP/3) | Very low latency, modern | Browser support still inconsistent (2024); Node.js server requires QUIC setup | **2** |

### Decision
**Chosen: Socket.IO v4 with `transports: ['websocket']`**

### Rationale
Socket.IO rooms allow clean multi-session isolation (4-char codes). Disabling polling transport removes the HTTP overhead. Auto-reconnect handles flaky event Wi-Fi at venues. Context7 `/websites/socket_io_v4` confirmed WebSocket-only mode works correctly.

### Consequences
- Control latency <5ms on LAN (measured behavior per docs)
- Room architecture supports future multi-display / multi-remote configurations
- Canonical event names locked into AGENTS.md — all code must use them

### References
- Context7 query: `/websites/socket_io_v4` — broadcasting, rooms, server API
- SPEC.md Section 3.2, AGENTS.md Quick Reference table

---

## DEC-003 — WebRTC P2P: PeerJS + Embedded PeerServer

- **Date:** 2026-08-03
- **Prompt:** Initial planning session
- **Phase:** Planning
- **Status:** ✅ Decided

### Context
Mobile camera stream needs to reach the display host with <80ms LAN latency. WebRTC is the only browser API capable of direct P2P media streaming. A signaling approach was needed.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **PeerJS + ExpressPeerServer (embedded)** | Simple API (`call`, `answer`, `stream`), embedded signaling server = no external cloud dependency, Phase 1 LAN-only compliant | PeerJS adds ~50KB client bundle | **5** |
| Raw `RTCPeerConnection` | Absolute control, no library | Full SDP offer/answer/ICE exchange must be hand-rolled — complex and error-prone | **3** |
| mediasoup | Production SFU, multi-party | Heavyweight server (Rust native addons), far exceeds Phase 1 scope | **2** |
| Janus Gateway | Full WebRTC server | Requires separate server process, C installation — overkill for single LAN session | **1** |

### Decision
**Chosen: PeerJS client + `ExpressPeerServer` embedded in server.js**

### Rationale
PeerJS reduces the WebRTC peer connection to `peer.call(id, stream)` / `peer.on('call')`. Embedding `ExpressPeerServer` on the same Node.js HTTP server keeps Phase 1 as a zero-external-dependency local server. ICE servers configured to LAN-only (`iceTransportPolicy: 'all'`, no TURN).

### Consequences
- Phase 1: LAN-only — no TURN server needed
- Phase 3 (SaaS): will require adding public STUN/TURN for NAT traversal (logged in docs/plan/PHASE3.md)
- Mobile must use HTTPS or `localhost` for `getUserMedia` — self-signed cert via `mkcert` needed for iPhone Safari

### References
- Context7 query: `/peers/peerjs` — call, answer, stream patterns
- SPEC.md Section 3.3

---

## DEC-004 — Pose Tracking: @mediapipe/tasks-vision (PoseLandmarker)

- **Date:** 2026-08-03
- **Prompt:** Initial planning session
- **Phase:** Planning
- **Status:** ✅ Decided

### Context
NeonAura shader requires skeleton landmark data to overlay neon joint particles on detected human bodies in the camera feed.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **@mediapipe/tasks-vision (PoseLandmarker)** | Official current SDK (2025+), GPU delegate via WebGL, unified `FilesetResolver` API, `VIDEO` runningMode for per-frame detection | Requires WASM assets served alongside app | **5** |
| @mediapipe/pose (legacy) | Familiar, many tutorials | **Officially deprecated** as of 2024 — no new features/fixes | **0** |
| TensorFlow.js BlazePose | Pure JS, no WASM | Slower than MediaPipe GPU delegate; TF.js model format different | **3** |
| MoveNet (TF.js) | Very fast (30fps+) | 17 keypoints only (vs 33 in PoseLandmarker), less detail for particle overlays | **3** |

### Decision
**Chosen: @mediapipe/tasks-vision PoseLandmarker**

### Rationale
Web research (2026) confirmed `tasks-vision` is the current unified SDK. GPU delegate enables <8ms detection per frame. 33 landmarks provide richer joint data for the NeonAura particle overlay vs MoveNet's 17 points.

### Consequences
- WASM files must be served from app server or CDN at `/wasm`
- `delegate: 'GPU'` must always be set — falls back to CPU if GPU unavailable (acceptable graceful degradation)
- `runningMode: 'VIDEO'` requires `detectForVideo(videoEl, timestamp)` — timestamp must be in ms

### References
- Web search: MediaPipe tasks-vision 2024/2026 best practices
- SPEC.md Section 3.5

---

## DEC-005 — Desktop Packaging (Phase 3): Tauri v2 over Electron

- **Date:** 2026-08-03
- **Prompt:** Initial planning session
- **Phase:** Planning (Phase 3 scope)
- **Status:** ✅ Decided

### Context
Phase 3 requires a standalone installable desktop app for one-time license purchase distribution.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **Tauri v2** | ~3–6MB binary, native OS WebView, Rust security model, built-in updater, sidecar support for Python AI process | WebView differences across macOS/Windows (minor CSS inconsistencies) | **5** |
| Electron | Ships its own Chromium (guaranteed rendering consistency), huge ecosystem | ~120MB+ installer, high RAM usage, security surface | **2** |
| NW.js | Node.js + Chromium, similar to Electron | Less maintained, smaller community | **1** |
| PWA (Progressive Web App) | No packaging needed | No filesystem access, limited OS integration, no offline model packs | **2** |

### Decision
**Chosen: Tauri v2**

### Rationale
App binary size is a UX concern for paid downloads. Tauri's 3–6MB vs Electron's 120MB+ is a significant distribution advantage. macOS WebKit (used by Tauri) fully supports WebGL2, WebRTC, and MediaDevices API. The Tauri `sidecar` plugin enables bundling the Python AI server for Phase 2 local diffusion.

### Consequences
- Must verify WebGL2 + MediaDevices API support in macOS WebKit before Phase 3 start
- Windows build requires separate testing (WebView2 — Edge-based, should support WebGL2)
- Python AI sidecar requires PyInstaller pre-compilation for each platform

### References
- SPEC.md Section 4.7

---

## DEC-006 — Render Throttle Pattern: rAF + Frame-Time Gate (no setInterval)

- **Date:** 2026-08-03
- **Prompt:** Initial planning session
- **Phase:** Planning
- **Status:** ✅ Decided

### Context
The display page must support user-selectable FPS caps (15 / 30 / 60 FPS) for performance tuning at events.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **requestAnimationFrame + frame-time gate** | GPU vsync-aligned, no timer drift, rAF handles visibility (pauses in background tabs) | Slightly more code than setInterval | **5** |
| `setInterval(render, 1000/fps)` | Simple | Desynchronizes from GPU vsync, causes tearing artifacts; does not pause when tab is hidden | **1** |
| `renderer.setAnimationLoop()` with external fps gate | Three.js native, still rAF-based | Wraps rAF — equivalent outcome | **4** |

### Decision
**Chosen: `renderer.setAnimationLoop()` with internal frame-time gate**

### Rationale
`renderer.setAnimationLoop()` is Three.js's preferred API (internally uses rAF). Adding a frame-time gate (`if (ts - lastFrameTime < budget) return;`) implements FPS capping without `setInterval`.

### Consequences
- FPS cap is an approximation (rAF fires at display Hz, not exactly at cap boundary)
- Render loop pauses when display tab is hidden — prevents GPU thrashing
- `setInterval` is explicitly prohibited in AGENTS.md standing rules

### References
- SPEC.md Section 4.6

---

## DEC-007 — CSS Approach: Vanilla CSS + Custom Properties (no Tailwind)

- **Date:** 2026-08-03
- **Prompt:** Initial planning session
- **Phase:** Planning
- **Status:** ✅ Decided

### Context
The mobile remote UI needs a dark-mode, touch-optimized interface. A CSS methodology choice was needed.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **Vanilla CSS + CSS custom properties** | No build step, instant dev iteration, full control of `touch-action`, no utility-class overhead in bundle | More lines of CSS to write | **5** |
| Tailwind CSS | Utility-first speed, dark-mode built-in | Requires PostCSS build pipeline; `touch-action: none` not a first-class utility in older versions | **3** |
| CSS Modules | Scoped styles | Requires bundler (Vite/Webpack) — adds complexity for a simple vanilla JS project | **2** |

### Decision
**Chosen: Vanilla CSS + CSS custom properties**

### Rationale
The project is vanilla HTML + JS (no framework, no bundler in Phase 1). A build pipeline adds unnecessary complexity. Custom properties (`--color-bg`, `--accent`, etc.) provide the same DRY benefits as design tokens. Dark mode is trivially handled with `color-scheme: dark`.

### Consequences
- Single `public/css/app.css` file contains all styles
- If project migrates to Vite/framework in Phase 3, CSS can be adopted into a module system without rewriting

### References
- SPEC.md Section 4.7

---

## DEC-008 — Static Page Routing: Express Static Extensions vs Explicit File Send

- **Date:** 2026-08-03
- **Prompt:** P-004 — Phase 1 Scaffolding
- **Phase:** Phase 1
- **Status:** ✅ Decided

### Context
When using `express.static` with raw HTML files, requests to `/display` and `/remote` result in 404 because the server searches for directories or specific file paths rather than mapping them directly to `/display.html` and `/remote.html`.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **Configure static extensions (`extensions: ['html']`) + Explicit SendFile fallback** | Bulletproof, handles both extensionless requests and any future router mapping. Cleanest URL structure. | Minor redundancy in server code | **5** |
| Configure static extensions only | Simple configuration | No explicit catch/handling if routing rules change | **4** |
| Force users to include `.html` extension (e.g. `/display.html`) | Zero server configuration | Poor UX, not aligned with typical modern web app routes | **1** |

### Decision
**Chosen: Configure static extensions (`extensions: ['html']`) + Explicit SendFile routing**

### Rationale
Express's `serve-static` package allows serving `.html` files without the extension if the `extensions` option is configured. Adding explicit `app.get('/display', ...)` rules makes it absolutely certain that these routing entry points are preserved regardless of directory structure or static middleware placement.

### Consequences
- Requesting `http://localhost:3000/display` serves `public/display.html` correctly without the extension.
- Requesting `http://localhost:3000/remote` serves `public/remote.html` correctly.
- Prevents breaking socket or video stream URL formats.

### References
- Express documentation on static files option

---

## DEC-009 — React/Vite Migration for HeroUI v3 & ShadCN Integration

- **Date:** 2026-08-03
- **Prompt:** P-005 — Phase 1.2
- **Phase:** Phase 1
- **Status:** ✅ Decided

### Context
To strictly use HeroUI v3 and/or ShadCN React component libraries, we need a modern React build pipeline. The vanilla HTML setup does not support the installation and compilation of React compound components with Tailwind CSS easily.

### Options Evaluated
| Option | Pros | Cons | Score (1–5) |
|---|---|---|---|
| **Vite SPA (React + Tailwind + HeroUI/ShadCN)** | Industry standard React setup. Highly optimized production output. Seamless integration with the HeroUI v3 and ShadCN registries/MCPs. Easy to package as Tauri app in Phase 3. | Requires migrating our current index/display/remote pages to React components | **5** |
| Vite MPA (Multi-Page React entries) | Keeps separate static HTML entry points | Complex multi-entry config in Vite, duplicate bundle sizes, harder to maintain route configs | **4** |
| React via CDN / Babel in-browser | No compilation step required | Massive performance lag due to client-side compilation, no direct support for ShadCN/HeroUI components (designed as Node modules) | **1** |

### Decision
**Chosen: Vite SPA (React + Tailwind + HeroUI/ShadCN)**

### Rationale
Migrating the front-end to a unified React SPA using Vite allows us to leverage HeroUI v3 and ShadCN directly. Express will serve the compiled static build output (from `dist/`). This provides an extremely modern dev workflow, unlocks full component code imports via our MCP servers, and is fully compatible with our PeerJS and Socket.IO real-time features.

### Consequences
- Frontend code will move into a unified React structure (e.g. standard `src/` or a separate `src/frontend` folder).
- We'll use a router (like `react-router-dom` or a lightweight custom router) to handle `/`, `/display`, and `/remote` page states.
- The build directory will output to a single static folder (e.g. `src/dist` or `src/public`) served by Express.

### References
- PRD.md / PROMPT.md requirements
- HeroUI v3 Component List

---

## DEC-010 — HeroUI Styling Constraints: Strict Default Theme Enforcement

- **Date:** 2026-08-03
- **Prompt:** P-006 — Debugging Remote Connection, Default HeroUI Styling, and Unit Testing
- **Phase:** Phase 1
- **Status:** ✅ Decided

### Context
Custom styling rules (custom color schemes, neon glows, shadows, custom borders) override the cohesive default theme of HeroUI, leading to maintenance complexity.

### Decision
**Chosen: Enforce strict HeroUI default theme usage.**

### Rationale
Sticking strictly to default semantic variables (`primary`, `secondary`, `success`, `danger`, `warning`, `foreground`, `background`, `border`, `muted-foreground`) ensures visual consistency and eliminates style configuration overhead. All custom glow utilities, color definitions, and dark overrides are prohibited unless explicitly requested.

### Consequences
- Removed all custom styles and color variables from `index.css`.
- Home, Display, and Remote pages updated to default semantic classes.
- Guidelines written in `AGENTS.md`.

---

## DEC-011 — Automated Testing Integration: Unit and Coverage Enforcement

- **Date:** 2026-08-03
- **Prompt:** P-006 — Debugging Remote Connection, Default HeroUI Styling, and Unit Testing
- **Phase:** Phase 1
- **Status:** ✅ Decided

### Context
Assuring software quality and avoiding regression errors requires automated testing as a verify step for both backend server routes and client modules.

### Decision
**Chosen: Implement Vitest + coverage checks as a mandatory verification gate.**

### Rationale
Vitest provides super-fast test execution and native ESM/Vite integration, matching our build environment. Using `supertest` for Express API integration testing and mocking browser APIs for `VideoIngestion` allows robust validation.

### Consequences
- Added `test` and `test:coverage` commands to package scripts.
- Configured coverage parameters in `vite.config.js`.
- Rules enforced in `AGENTS.md` verification workflow.



