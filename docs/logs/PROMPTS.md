# PROMPTS.md — Phuebus Prompt History Log

> **Purpose:** Chronological record of every prompt given to the development agent. Each entry documents what was requested, when, what decisions it triggered, and what artifacts it produced.
>
> **Instructions for the agent:** At the START of processing each new user prompt, append a new entry to this log using the template below. Fill in the Outputs and Decisions Triggered sections AFTER completing the work.

---

## Log Entry Template

```
## P-NNN — [Short Title]
- **Date:** YYYY-MM-DD HH:MM (IST)
- **Phase:** Planning / Phase 1 / Phase 2 / Phase 3
- **Type:** Architecture | Feature | Fix | Research | Documentation | Refactor

### Prompt (verbatim)
> [Paste the exact user prompt]

### Decisions Triggered
- [DEC-NNN] [Decision title] — [Brief outcome]

### Outputs Produced
- [File created/modified]
- [Document updated]

### Notes
[Any important context, gotchas discovered, or follow-up items]
```

---
---

## P-001 — Initial Architecture Planning & Document Generation

- **Date:** 2026-08-03 19:39 (IST)
- **Phase:** Planning
- **Type:** Architecture + Documentation

### Prompt (verbatim)
> First consume both @[PRD.md] and @[PROMPT.md] to understand the goal of this project.
>
> Then, build a structured executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification. Default flow: Research (if needed) → Plan → Verify → Done
>
> Then, research on the chosen frameworks for each component of the proposed architecture. Answer: "How do I correctly implement this system with the chosen framework?" Write Sections 3–4 in SPEC.md: framework quick reference, implementation guidance, and systems best practices. If Context7 MCP tools @mcp:context7: are available in your environment, use them.
>
> Lastly, establish rules for development agent to do following after every prompt I give: research -> plan -> ask me for choices / decisions -> write code -> verify -> commit -> push
>
> Guardrail Instructions:
> 1. Ask clarifying questions if any before proceeding.
> 2. The documents attached are the proposed architecture, better alternatives can be utilized as per your research weighing pros and cons.
> 3. Write code only when prompted to proceed after verification and weighing choices.

### Research Performed
- Context7 MCP: Resolved Three.js (`/mrdoob/three.js`) — queried VideoTexture, RenderTarget, ShaderMaterial, post-processing patterns
- Context7 MCP: Resolved Socket.IO v4 (`/websites/socket_io_v4`) — queried rooms, broadcasting, WebSocket-only transport
- Context7 MCP: Resolved PeerJS (`/peers/peerjs`) — queried media call, stream, signaling
- Web search: "mediapipe pose tracking javascript 2024 best practices" — confirmed `@mediapipe/tasks-vision` as current SDK
- Web search: "Web Audio API FFT analyser node audio device routing 2024 best practices" — confirmed `AnalyserNode` patterns

### Decisions Triggered
- [DEC-001] Three.js chosen over Babylon.js / raw WebGL2
- [DEC-002] Socket.IO v4 (WebSocket-only) chosen over raw ws / SSE / WebTransport
- [DEC-003] PeerJS + embedded PeerServer chosen over raw RTCPeerConnection / mediasoup
- [DEC-004] @mediapipe/tasks-vision chosen over legacy @mediapipe/pose / TF.js BlazePose
- [DEC-005] Tauri v2 chosen over Electron for Phase 3 desktop packaging
- [DEC-006] rAF + frame-time gate chosen over setInterval for FPS throttling
- [DEC-007] Vanilla CSS + custom properties chosen over Tailwind CSS

### Outputs Produced
- `SPEC.md` — Created (Sections 1–4: Architecture, Module Contracts, Framework Reference, Implementation Guidance)
- `docs/plan/PHASE1.md` — Created (10 structured prompts with Research/Plan/Ask/Verify/Commit)
- `docs/plan/PHASE2.md` — Created (6 structured prompts for AI diffusion engine)
- `docs/plan/PHASE3.md` — Created (5 structured prompts for distribution/SaaS)
- `AGENTS.md` — Created (mandatory 7-stage dev workflow rules)

### Notes
- No code written — planning-only session per user guardrail instruction #3
- Context7 MCP tools successfully used for Three.js, Socket.IO, PeerJS research
- MediaPipe legacy package (`@mediapipe/pose`) identified as deprecated — corrected to `@mediapipe/tasks-vision`

---

## P-002 — Repository Structure, Logging, and Enhanced Research Instructions

- **Date:** 2026-08-03 20:10 (IST)
- **Phase:** Planning
- **Type:** Documentation + Architecture

### Prompt (verbatim)
> 1. Structure the repository with all this documentation properly.
>
> 2. Add documentation instructions for logging all the decisions taken, prompts provided, and task done. Populate the logs with progress so far.
>
> 3. Add instructions for research - to weigh alternatives, pro and cons and choose framework / methodology accordingly.

### Decisions Triggered
- No new architectural decisions — this prompt is documentation/structure only

### Outputs Produced
- `README.md` — Created (project overview, all doc links, repo structure map, phase status)
- `docs/logs/DECISIONS.md` — Created (DEC-001 through DEC-007 populated from P-001 session)
- `docs/logs/PROMPTS.md` — Created (this file; P-001 and P-002 entries populated)
- `docs/logs/PROGRESS.md` — Created (phase tracking across all prompts)
- `docs/research/FRAMEWORKS.md` — Created (full alternatives matrix with pros/cons scoring)
- `AGENTS.md` — Updated (Stage 1 RESEARCH expanded with formal Alternatives Scoring Table protocol)
- `.gitignore` — Created
- `src/` directory scaffold — Created (empty placeholder structure)

### Notes
- Git repository initialized with initial commit covering P-001 outputs
- No code written — documentation pass only per user guardrail instruction #3

---

## P-003 — Repo Restructure: Move Plan Files + Phase 1 Kickoff

- **Date:** 2026-08-03 20:19 (IST)
- **Phase:** Planning → Phase 1
- **Type:** Refactor + Documentation

### Prompt (verbatim)
> I've updated README with changed dir structure for plan_phase* files. Update the repo accordingly.
>
> Added the git origin manually for future usage.
>
> Now we can move to scaffolding phase 1.

### Decisions Triggered
- No new architectural decisions — structural refactor only

### Outputs Produced
- `PLAN_PHASE1.md` → `docs/plan/PHASE1.md` — Moved
- `PLAN_PHASE2.md` → `docs/plan/PHASE2.md` — Moved
- `PLAN_PHASE3.md` → `docs/plan/PHASE3.md` — Moved
- `AGENTS.md` — Updated (plan file paths in Stage 1.1 and logging table)
- `README.md` — Updated (stale dev setup link fixed)
- `docs/plan/PHASE2.md` — Updated (pre-condition ref updated)
- `docs/plan/PHASE3.md` — Updated (pre-condition ref updated)
- `docs/logs/PROGRESS.md` — Updated (plan file task names updated; P-003 change log entry)
- `docs/logs/PROMPTS.md` — Updated (this entry; P-002 output list updated)
- `docs/logs/DECISIONS.md` — Updated (PLAN_PHASE3 ref → docs/plan/PHASE3.md)
- Commit + push to `origin/main`

### Notes
- git remote `origin` set to `https://github.com/gureks/phuebus.git` by user (already pushed)
- Zero stale `PLAN_PHASE*` references confirmed after restructure
- Phase 1 scaffolding begins next prompt

---

## P-004 — Phase 1 Scaffolding: Server & App Foundations

- **Date:** 2026-08-03 20:35 (IST)
- **Phase:** Phase 1
- **Type:** Feature

### Prompt (verbatim)
> continue where the process was interuppted (after selecting 1A, 2C, 3A for decisions)

### Decisions Triggered
- [DEC-008] Express static HTML routing extension configuration — enabled extensionless HTML file resolution for Display/Remote URLs.

### Outputs Produced
- `src/package.json` — Created package definition and stable peer/socket.io dependencies
- `src/server.js` — Created backend server with Socket.IO signaling, Express routes and PeerJS middleware
- `src/public/css/app.css` — Created core dark-mode CSS design system
- `src/public/index.html` — Created landing page with automatic and manual session routing
- `src/public/display.html` — Created display page with Socket.IO signaling stubs
- `src/public/remote.html` — Created remote page with connection UI and signal emitters
- `src/.env.example` — Created environment variable template
- `src/.env` — Created active environment configuration

### Notes
- Fixed `peer` version package naming from non-existent `^9.0.1` to latest stable `^1.0.2` in package.json.
- Discovered and resolved a routing issue where extensionless static requests (like `/display`) returned 404 by adding explicit routes and configuration in `server.js`.

---

## P-005 — Phase 1.2: Video Ingestion (WebRTC + UVC Ingestion)

- **Date:** 2026-08-03 20:52 (IST)
- **Phase:** Phase 1
- **Type:** Feature

### Prompt (verbatim)
> 1. All 3 pages show 200 OK. The remote is connecting, however desktop display shows a loading and waiting for stream message.
>
> 2. Going forward strictly use HeroUI v3 or ShadCN. Both MCP are available for documentations.
>
> 3. Move to phase1.2 next. Ask clarifying questions if needed.

### Decisions Triggered
- [DEC-009] React/Vite Migration for HeroUI/ShadCN — Migrating frontend pages to a unified React build setup.

### Outputs Produced
- `src/package.json` — Added React 19, Tailwind CSS v4, HeroUI v3, PeerJS client, and build scripts.
- `src/vite.config.js` — Vite setup with proxies.
- `src/index.html` — SPA mount root.
- `src/client/main.jsx`, `App.jsx`, `index.css` — React Router & style entry.
- `src/client/engine/VideoIngestion.js` — Ingestion manager class.
- `src/client/components/Home.jsx`, `Display.jsx`, `Remote.jsx` — React page views.

### Notes
- Standardized package versions and resolved missing peer dependencies (`@react-aria/*`) during Rollup build.
- Express code updated to serve the compiled SPA output folder `dist/` with fallback routing rules.

---

## P-006 — Debugging Remote Connection, Default HeroUI Styling, and Unit Testing

- **Date:** 2026-08-03 21:11 (IST)
- **Phase:** Phase 1
- **Type:** Fix + Testing + Refactor

### Prompt (verbatim)
> 1. All 3 pages show 200 OK. The mobile remote shows a consistent connecting... message.
>
> 2. For UI, strictly use the default theme provided by HeroUI. Remove all extra theme styling(neon glow) and colors added. Use the MCP for documentation. Add these as strict instructions for future as well.
>
> 3. Add testing as a verify step for all future development. The dev done in current step needs to pass through unit tests, coverage tests, and browser based testing. Add these as instructions for future as well.
>
> 4. Video ingestion is not working for remote connection. error unkown. The desktop display shows a loading and waiting for stream message. The mobile remote shows a consistent connecting... message. Stream from same desktop camera is working.
>
> Debug and solve these before proceeding to Phase 1.3

### Decisions Triggered
- [DEC-010] HeroUI styling constraints: enforce default theme, no custom color/glow overrides.
- [DEC-011] Automated testing integration: Vitest and coverage checking for backend endpoints and client logic.

### Outputs Produced
- `src/server.test.js` — Vitest backend integration tests
- `src/client/engine/VideoIngestion.test.js` — Vitest frontend class unit tests
- `src/client/index.css` — Removed all custom classes, glow utilities, and style variables
- `src/client/components/` (Home, Display, Remote) — Cleaned styles to use strictly default HeroUI classes
- `AGENTS.md` — Appended strict guidelines for HeroUI styling and automated testing practices
- `.gitignore` — Ignored coverage directories and local certs/ folder
- `src/generate-certs.js` — Self-signed SSL certificate generation script

### Notes
- Enabled self-signed SSL certificate generation on server startup, converting the host Express process to run as an **HTTPS secure context**. Bypasses mobile browser camera blockers for LAN IP connections (`http://192.168.x.x` → `https://192.168.x.x`).
- Configured PeerJS client in `VideoIngestion.js` to dynamically use SSL options (`secure: true`, `wss` protocol, port `443` default fallback) when the browser protocol is `https:`.
- Removed the explicit `transports: ['websocket']` constraint completely on both the backend and client setups. This restores Socket.IO's default polling-to-websocket upgrade protocol, resolving local network security blocks (such as iOS Local Network Privacy) that trigger `websocket error` on mobile connections.
- Added on-screen log outputs inside `Remote.jsx` to let users see exact client errors on mobile.
- Enforced main module check on server startup to allow clean testing imports without port binding conflicts.
- Built-in Vitest coverage report shows all tests passing successfully.

---

## P-007 — Three.js Shader Engine Foundation

- **Date:** 2026-08-03 22:05 (IST)
- **Phase:** Phase 1
- **Type:** Feature

### Prompt (verbatim)
> Move to working on Prompt 3 — Three.js Shader Engine Foundation as defined in docs/plan/PHASE1.md
> 
> Mark progress as verified and success so far.

### Decisions Triggered
- [DEC-012] WebGL2 Off-Screen Downsampling for Adaptive Gain — 1x1 RenderTarget grid sampling for zero-latency CPU luma read-back.

### Outputs Produced
- `src/client/engine/shaders/fullscreen.vert.js` — Passthrough vertex shader.
- `src/client/engine/shaders/AutoGainPrepass.js` — Luma downsampling and auto-gain fragment shaders.
- `src/client/engine/ShaderEngine.js` — Core WebGL2 post-processing post-processing manager.
- `src/client/engine/ShaderEngine.test.js` — Mock-based Vitest unit tests (90%+ coverage).
- `src/client/components/Display.jsx` — Updated to integrate ShaderEngine with room events.

### Notes
- Discovered and fixed a floating-point modulo rounding bug in `ShaderEngine.js`'s FPS gating loop: JavaScript's double-precision remainder operation of `1000 % 33.333333333333336` resulted in a non-zero value matching `33.333333333333336` (instead of `0`). Solved by adding a safety epsilon tolerance check before subtracting the excess duration.

---

## P-008 — Render Options Tuning, UI Side Panels & Aspect Ratio Correction

- **Date:** 2026-08-03 22:26 (IST)
- **Phase:** Phase 1
- **Type:** Feature + Refactor

### Prompt (verbatim)
> Debug the following before proceeding to next steps -
> 
> - Canvas resolution: match display resolution or render at fixed 1920×1080 OR user configurable.
> - Anti-aliasing on WebGLRenderer: needs to be user-toggleable
> - DPR / DPI capping: default at Math.min(devicePixelRatio, 2) and make it user-configurable
> - Create left and right side drawers for user configured variables and tuning. They layout should look like the screens attached(ignore the screenshot context, just look at the layout and structure). Use components from HeroUI(MCP available)
> - Mobile camera orientation detection - if the mobile camera is rotated between potrait and landscape, how is that handled? Currently the portrait mode compresses to landscape display, it should be shown as it is. or be a part of canvas resolution configuration panel. 
> - In remote mode, add an option for full screen camera view right next to switch camera button
> 
> Ask clarifying questions IF ANY before proceeding.

### Decisions Triggered
- [DEC-012] WebGL2 Off-Screen Downsampling for Adaptive Gain — 1x1 RenderTarget grid sampling for zero-latency CPU luma read-back.

### Outputs Produced
- `src/client/engine/shaders/AutoGainPrepass.js` — Added UV scaling and letterbox bounds check to `AUTOGAIN_FRAG`.
- `src/client/engine/ShaderEngine.js` — Enhanced constructor options, aspect-ratio logic, and resolution modes.
- `src/client/engine/ShaderEngine.test.js` — Updated unit tests.
- `src/client/components/Display.jsx` — Created Left and Right sidebars with HeroUI components.
- `src/client/components/Remote.jsx` — Added fullscreen overlay preview toggle.
- `docs/logs/PROGRESS.md` — Updated status statistics and checklist items.

### Notes
- Standardized WebGL context recreation (AA toggle) by isolating the VideoIngestion mount lifecycle from the ShaderEngine lifecycle in React hooks.
- Mobile rotation now auto-corrects aspect ratio using dynamic video texture vs. canvas dimensions scale factors.

---

## P-009 — Phase 1.4: Shader Pack (Toon + Trails + Neon)

- **Date:** 2026-08-03 22:56 (IST)
- **Phase:** Phase 1
- **Type:** Feature

### Prompt (verbatim)
> First, Update all the relevant documentation with the progress as instructed in Agents.md and mark phase1.3 as done and verified. 
> 
> Next move to phase 1.4

### Decisions Triggered
- [DEC-004] ToonShader outline mode — multiply-mode comic black (default), hue audio-sensitive via `uAudioHueSensitivity`
- [DEC-005] NeonAura approach — Sobel edge-convolution silhouette on 5% dark bg (no skeleton overlay by default)
- [DEC-006] FeedbackTrails dispersion — bass-reactive wave dispersion + optical-flow motion-vector push

### Outputs Produced
- `src/client/engine/shaders/ToonShader.js` — rebuilt with multiply outlines, audio hue shift, outline mode uniform
- `src/client/engine/shaders/NeonAura.js` — rebuilt with Sobel edge convolution, neon colour pulse
- `src/client/engine/shaders/FeedbackTrails.js` — rebuilt with optical flow advection + bass-kick dispersion
- `src/client/engine/ShaderEngine.js` — added `prevFrameTarget`, new uniforms, updated pipeline
- `src/client/engine/ShaderEngine.test.js` — tests updated for new uniforms and pipeline
- `src/client/components/Display.jsx` — toon outline mode switch, audio hue sensitivity slider, Bass Kick Dispersion slider, Motion Flow Push slider; replaced CPU skeleton sim with real audio sim RAF hook
- `docs/logs/PROGRESS.md` — P1-4 marked complete
- Commits: `0af9d5c`, `03b42ac`, `4ad179d`

### Notes
- glowRadius default changed from 0.005 to 0.08 to match Sobel threshold semantics
- Skeleton simulator removed from Display (was Phase 1 stub, replaced by real AudioAnalyzer + PoseTracker in P-010)

---

## P-010 — Phase 1.5 + 1.6: AudioAnalyzer + PoseTracker (Parallel)

- **Date:** 2026-08-03 00:54 (IST)
- **Phase:** Phase 1
- **Type:** Feature

### Prompt (verbatim)
> continue where the process was interrupted

### Decisions Triggered
- [DEC-007] Beat detection strategy — adaptive threshold crossing (1.3× smoothed bass + 8-frame cooldown), not spectral flux
- [DEC-008] Pose tracking default — disabled by default (GPU cost); user-toggleable switch in right sidebar
- [DEC-009] Landmark format — flat `{x,y}[33]` array with Y-flip for WebGL UV space
- [DEC-010] Audio default device — none selected by default; user must pick from dropdown (avoids phantom mic access)

### Outputs Produced
- `src/client/engine/AudioAnalyzer.js` [NEW] — getUserMedia pipeline, FFT 2048, bass/mid/high energy extraction, adaptive beat detector, destroy()
- `src/client/engine/AudioAnalyzer.test.js` [NEW] — 8 tests: energy normalization, beat threshold, cooldown, device switching, cleanup
- `src/client/engine/PoseTracker.js` [NEW] — MediaPipe tasks-vision PoseLandmarker (GPU, VIDEO mode), Y-flip, timestamp guard, graceful fallback
- `src/client/engine/PoseTracker.test.js` [NEW] — 9 tests: init, Y-flip, null fallbacks, duplicate timestamps, destroy
- `src/client/components/Display.jsx` [MODIFIED] — real AudioAnalyzer RAF hook; audio device dropdown card; pose tracking toggle card; Hook 6 (device switching); Hook 7 (pose lifecycle)
- `src/vite.config.js` [MODIFIED] — added `server.deps.external` for @mediapipe/tasks-vision
- Commit: `df78f08`

### Notes
- `@mediapipe/tasks-vision` installed as devDependency (needed for test resolution); dynamic import keeps it out of main bundle chunk
- Vite auto-splits mediapipe WASM into `vision_bundle` chunk in production build
- Tests: 25/25 passing

---

## P-011 — Complete All Remaining Phases (P1-7 through P3-5)

- **Date:** 2026-08-04 00:58 (IST)
- **Phase:** Phase 1 → Phase 2 → Phase 3
- **Type:** Feature / Architecture / Distribution

### Prompt (verbatim)
> Go ahead and complete rest of all the phases. Manual verification for P1-5 onwards will be done all at once.
> Ask clarifying questions if and when they arise.

### Decisions Triggered
- [DEC-011] P1-7 preset storage — hardcoded JS objects, no YAML (user-saved presets deferred to Phase 2)
- [DEC-012] P1-7 engine switch — hard cut (no crossfade in Phase 1)
- [DEC-013] P1-8 bottom sheet — 55% viewport height when open
- [DEC-014] P1-9 HUD — auto-hide after 4s, reappear on mouse move
- [DEC-015] P1-9 QR code — qrcode npm package (3KB)
- [DEC-016] P1-10 HTTPS — mkcert self-signed cert generated at server start
- [DEC-017] P2-1 ControlNet — LineArt conditioning (stylized, projection-oriented)
- [DEC-018] P2-3 interpolation — linear blend (< 1ms), RIFE deferred
- [DEC-019] P3-1 platform — macOS first, Windows follow-up

### Outputs Produced
- (to be filled in as work completes)

### Notes
- Manual verification deferred to single end-to-end session per user request
