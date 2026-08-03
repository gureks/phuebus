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
- `PLAN_PHASE1.md` — Created (10 structured prompts with Research/Plan/Ask/Verify/Commit)
- `PLAN_PHASE2.md` — Created (6 structured prompts for AI diffusion engine)
- `PLAN_PHASE3.md` — Created (5 structured prompts for distribution/SaaS)
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
