# FRAMEWORKS.md — Phuebus Framework Alternatives Research

> **Purpose:** Full alternatives evaluation for every major framework and methodology decision.
> Each section documents what was researched, what was evaluated, and why the final choice was made.
> Supplements [DECISIONS.md](DECISIONS.md) with deeper technical detail.
>
> **Instructions for the agent:** Before starting any new phase prompt that introduces a library/framework/API choice,
> add a new section here with the Scoring Table filled in. Link the winning row to the corresponding DEC-NNN entry.

---

## Scoring Rubric

Each alternative is scored 1–5 on four dimensions:

| Dimension | What it measures |
|---|---|
| **Fit** | How well it matches the exact technical requirement (not a general "good library") |
| **Perf** | Runtime performance characteristics (latency, throughput, CPU/GPU overhead) |
| **DX** | Developer experience: API ergonomics, documentation quality, community size |
| **Phase Fit** | How well it supports all 3 phases without requiring a rewrite |

**Total = Fit + Perf + DX + Phase Fit (max 20)**

---

## 1. 3D / Shader Rendering Engine

**Requirement:** Multi-pass WebGL2 post-processing pipeline with per-frame `VideoTexture` for live camera feeds, custom GLSL `ShaderMaterial`, and `WebGLRenderTarget` ping-pong buffers.

| Alternative | Fit | Perf | DX | Phase Fit | **Total** | Notes |
|---|---|---|---|---|---|---|
| **Three.js r165+** ✅ | 5 | 4 | 5 | 5 | **19** | VideoTexture, RenderTarget, ShaderMaterial all built-in. Huge ecosystem. WebGPU path available for Phase 2+ |
| Babylon.js 7 | 3 | 4 | 4 | 3 | **14** | PostProcess system less flexible for custom GLSL chains. Heavier bundle (~800KB). Game engine orientation |
| Raw WebGL2 | 4 | 5 | 2 | 3 | **14** | Max performance, no abstraction overhead, but extreme boilerplate for VAOs, framebuffers, program management |
| PIXI.js 8 | 1 | 5 | 4 | 1 | **11** | 2D renderer only — no 3D scene graph, no ShaderMaterial for multi-pass GLSL |
| WebGPU (raw) | 3 | 5 | 1 | 4 | **13** | Future-proof but Chrome-only (2024), massive complexity, no VideoTexture equivalent yet |

**Winner: Three.js r165+** → [DEC-001](../logs/DECISIONS.md#dec-001)

---

## 2. Real-Time Signaling (Control Plane)

**Requirement:** Bidirectional event messaging between mobile remote and display host with <10ms LAN round-trip. Room isolation for multi-session support.

| Alternative | Fit | Perf | DX | Phase Fit | **Total** | Notes |
|---|---|---|---|---|---|---|
| **Socket.IO v4 (WebSocket-only)** ✅ | 5 | 5 | 5 | 5 | **20** | Rooms built-in. Auto-reconnect for venue Wi-Fi drops. WebSocket-only transport = <5ms LAN. Scales to SaaS in Phase 3 |
| `ws` (raw WebSocket) | 4 | 5 | 3 | 3 | **15** | Minimal overhead but no rooms, no reconnect, no event namespacing — all must be hand-rolled |
| Server-Sent Events (SSE) | 2 | 4 | 4 | 2 | **12** | One-directional (server → client) — requires second HTTP endpoint for reverse; not truly bidirectional |
| WebTransport (HTTP/3) | 4 | 5 | 1 | 3 | **13** | Lowest theoretical latency, but inconsistent browser support (2024) and complex QUIC server setup |
| Ably / Pusher (cloud) | 3 | 4 | 5 | 2 | **14** | Excellent DX but Phase 1 must be LAN-only / zero cloud — violates guardrail |

**Winner: Socket.IO v4 (WebSocket-only)** → [DEC-002](../logs/DECISIONS.md#dec-002)

---

## 3. WebRTC P2P Video Streaming

**Requirement:** Mobile camera stream → display host, <80ms LAN, without external cloud signaling servers. Phase 3 must support public TURN for SaaS.

| Alternative | Fit | Perf | DX | Phase Fit | **Total** | Notes |
|---|---|---|---|---|---|---|
| **PeerJS + ExpressPeerServer** ✅ | 5 | 5 | 5 | 4 | **19** | Simple call/answer API. Embedded signaling = zero cloud. Phase 3 TURN added to PeerJS config |
| Raw `RTCPeerConnection` | 5 | 5 | 2 | 3 | **15** | Total control, but full SDP offer/answer/ICE candidate exchange must be hand-rolled — 200+ lines of boilerplate |
| mediasoup (SFU) | 3 | 5 | 3 | 5 | **16** | Production SFU for multi-party (Phase 3 SaaS) but Rust native addons, heavyweight — overkill for Phase 1 |
| Janus Gateway | 2 | 4 | 2 | 4 | **12** | Full WebRTC server but requires separate C process install — ops overhead not justified |
| Agora.io / Daily.co (cloud) | 3 | 5 | 5 | 2 | **15** | Excellent DX but paid cloud API — violates Phase 1 LAN-only / zero cloud guardrail |

**Winner: PeerJS + ExpressPeerServer** → [DEC-003](../logs/DECISIONS.md#dec-003)

---

## 4. Human Pose Tracking

**Requirement:** 33 skeleton landmarks at <8ms per frame for NeonAura shader overlay. Must use GPU acceleration and be actively maintained.

| Alternative | Fit | Perf | DX | Phase Fit | **Total** | Notes |
|---|---|---|---|---|---|---|
| **@mediapipe/tasks-vision PoseLandmarker** ✅ | 5 | 5 | 4 | 5 | **19** | Current official SDK (2025+). GPU delegate. 33 landmarks. `VIDEO` mode for per-frame. Actively maintained |
| @mediapipe/pose (legacy) | 5 | 4 | 4 | 0 | **13** | **Officially deprecated 2024** — no new features/fixes. Should not be used in new projects |
| TF.js BlazePose | 4 | 3 | 4 | 4 | **15** | Pure JS, no WASM complexity. Slower than MediaPipe GPU (15–25ms vs <8ms). Different coordinate system |
| MoveNet (TF.js) | 3 | 5 | 4 | 4 | **16** | Very fast (30fps+) but only 17 keypoints — too few for detailed NeonAura particle overlay |
| Detectron2 (server-side) | 2 | 3 | 2 | 2 | **9** | Server-side Python inference — adds Python sidecar in Phase 1 (Phase 2 scope). Too early |

**Winner: @mediapipe/tasks-vision** → [DEC-004](../logs/DECISIONS.md#dec-004)

---

## 5. Audio Analysis / FFT

**Requirement:** Real-time FFT from configurable audio device input (USB interface, aux-in, mic). Extract bass/mid/high energy per rAF frame.

| Alternative | Fit | Perf | DX | Phase Fit | **Total** | Notes |
|---|---|---|---|---|---|---|
| **Web Audio API (AnalyserNode, native)** ✅ | 5 | 5 | 4 | 5 | **19** | Zero dependencies. `AnalyserNode` is exactly the right primitive. Device routing via `getUserMedia({ deviceId })` |
| Meyda.js | 4 | 4 | 5 | 5 | **18** | Excellent library for audio feature extraction (spectral flux, MFCC, etc.). Adds 60KB dependency. Overkill for bass/mid/high |
| Tone.js | 2 | 3 | 5 | 3 | **13** | Designed for music synthesis and scheduling, not real-time analysis. AudioNode wrapper is a poor fit |
| AudioWorklet (custom) | 5 | 5 | 2 | 4 | **16** | Runs on separate audio thread — would give best performance for beat detection, but requires more complex setup. Future optimization |

**Winner: Web Audio API (native AnalyserNode)** — no DEC entry needed (native API, no alternatives dispute)

---

## 6. Desktop Packaging (Phase 3)

**Requirement:** Installable app for one-time license purchase. Must support WebGL2, MediaDevices API, WebRTC. Bundle Python AI sidecar. <50MB download.

| Alternative | Fit | Perf | DX | Phase Fit | **Total** | Notes |
|---|---|---|---|---|---|---|
| **Tauri v2** ✅ | 5 | 5 | 4 | 5 | **19** | ~3–6MB binary. Native OS WebView (macOS WebKit). Rust security model. Sidecar plugin for Python. Built-in updater |
| Electron | 5 | 3 | 5 | 4 | **17** | Ships own Chromium = guaranteed rendering consistency. ~120MB+ installer. High RAM. Security surface. Too large for paid download |
| NW.js | 4 | 3 | 3 | 3 | **13** | Node.js + Chromium, similar to Electron. Less maintained, smaller community, ~90MB installer |
| PWA (Progressive Web App) | 2 | 4 | 5 | 2 | **13** | No install needed. But limited filesystem access, no offline model packs, no sidecar process management |
| Flutter Desktop | 3 | 4 | 3 | 2 | **12** | Full custom renderer. Would require rewriting entire UI in Dart. Not a migration-friendly option |

**Winner: Tauri v2** → [DEC-005](../logs/DECISIONS.md#dec-005)

---

## 7. CSS Methodology (Mobile Remote UI)

**Requirement:** Dark-mode, touch-optimized mobile UI with smooth bottom sheet animations. Must work in vanilla HTML/JS environment (no build step in Phase 1).

| Alternative | Fit | Perf | DX | Phase Fit | **Total** | Notes |
|---|---|---|---|---|---|---|
| **Vanilla CSS + Custom Properties** ✅ | 5 | 5 | 4 | 5 | **19** | No build step. Full control of `touch-action`, transforms, animations. Custom properties for design tokens |
| Tailwind CSS (v3) | 4 | 5 | 5 | 3 | **17** | Fastest to write. But requires PostCSS build pipeline. `touch-action: none` not a default utility. PurgeCSS config needed |
| CSS Modules | 4 | 5 | 4 | 2 | **15** | Scoped styles prevent conflicts. Requires bundler (Vite/Webpack) — adds complexity for vanilla JS Phase 1 |
| Bootstrap 5 | 2 | 4 | 5 | 2 | **13** | Heavy (>100KB). Dark mode customization requires significant overriding. Not touch-first |

**Winner: Vanilla CSS + CSS Custom Properties** → [DEC-007](../logs/DECISIONS.md#dec-007)

---

## 8. FPS Throttle / Render Loop Timing

**Requirement:** Support 15 / 30 / 60 FPS cap selectable at runtime without GPU vsync desynchronization.

| Alternative | Fit | Perf | DX | Phase Fit | **Total** | Notes |
|---|---|---|---|---|---|---|
| **rAF + frame-time gate (via `setAnimationLoop`)** ✅ | 5 | 5 | 4 | 5 | **19** | GPU vsync aligned. Pauses in hidden tabs. Three.js `setAnimationLoop` wraps rAF natively |
| `setInterval(render, 1000/fps)` | 3 | 2 | 5 | 2 | **12** | Simple code but desyncs from GPU vsync causing tearing; does not pause when tab is hidden |
| `setTimeout` recursive | 2 | 2 | 4 | 2 | **10** | Same problems as setInterval with additional stack depth |
| WASM timing (AudioWorklet clock) | 4 | 5 | 1 | 3 | **13** | Sub-millisecond precision but massive complexity — not justified for a visual FPS cap |

**Winner: rAF + frame-time gate** → [DEC-006](../logs/DECISIONS.md#dec-006)

---

## Research Summary: Libraries Not in Context7

The following were researched via web search (not Context7) due to Context7 gaps:

| Library / API | Research Method | Key Finding |
|---|---|---|
| @mediapipe/tasks-vision | Web search | Legacy `@mediapipe/pose` deprecated 2024; use tasks-vision with `delegate: 'GPU'` |
| Web Audio API AnalyserNode | Web search | Create one `AudioContext` per app; resume after user gesture; do NOT connect analyser to destination |
| MediaDevices API (UVC) | Web search (confirmed) | UVC capture cards appear as standard `videoinput` in `enumerateDevices()` on macOS Chrome |
| Tauri v2 | Web search | WebView2 (Windows) and WebKit (macOS) both support WebGL2 and MediaDevices; confirmed sidecar plugin available |
