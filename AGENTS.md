# Phuebus — Development Agent Rules (AGENTS.md)

> These rules govern every development prompt in this project.  
> The agent (Antigravity) MUST follow this workflow for every user prompt, without exception.

---

## Mandatory Workflow: Every Prompt

```
RESEARCH → PLAN → ASK → CODE → VERIFY → COMMIT → PUSH
```

The agent must complete all 7 stages in order. No stage may be skipped.

---

## Stage 1: RESEARCH

Before writing a single line of code, the agent MUST:

1. **Check SPEC.md** — Review the relevant section(s) for the task (framework references, module contracts, performance targets).
2. **Check the PLAN file** for the current phase (PLAN_PHASE1.md, PLAN_PHASE2.md, PLAN_PHASE3.md) — find the exact prompt being worked on and read its Research section.
3. **Use Context7 MCP** (`resolve-library-id` + `query-docs`) to fetch the latest API docs for any library involved. Do not rely on training data alone — library APIs evolve.
4. **Search the web** (`search_web`) if any of the following are true:
   - The task involves hardware interaction (UVC, WebRTC, audio devices)
   - The task involves a library not in Context7
   - The task involves a "best practice" that may have changed since training
5. **Read existing source files** before modifying them — never assume file contents.

> Failure to research before coding is a hard violation of these rules.

---

## Stage 2: PLAN

After research, the agent MUST produce a written plan as a short artifact or inline response:

- List every **file that will be created or modified**
- List every **function / class that will be added or changed**
- Note any **side effects** (server restarts required, new dependencies, env vars needed)
- Flag any **risk areas** (browser API compatibility, timing, race conditions)

The plan must be concise but complete — enough for the user to understand what is about to happen without reading the code.

---

## Stage 3: ASK

Before writing code, the agent MUST surface any unresolved decisions:

- Any design choice that cannot be uniquely determined from PRD.md, SPEC.md, or PLAN files
- Any tradeoff where there are two reasonable options with different implications
- Any assumption about user preferences (naming, layout, behavior, config)

**Format for questions:**
```
### Decisions needed before I proceed:
1. [Question 1] — Options: A) ... B) ... (I recommend A because ...)
2. [Question 2] — Options: A) ... B) ...
```

**The agent MUST STOP and wait for answers before writing any code.**

> Exception: If the task is a trivially small follow-up (e.g., "fix this typo", "change this color") with no real decisions involved, the agent may skip the Ask stage and note "No decisions required."

---

## Stage 4: CODE

Only after receiving answers to all questions from Stage 3:

- Write complete, production-ready code — **no placeholder comments**, no TODOs in implementation code
- Every file must be fully written — no "fill in the rest" or "implement similarly"
- Code must follow the architecture in SPEC.md Section 1 and module contracts in Section 2
- GLSL shaders must include all required uniforms as documented in SPEC.md Section 3.1
- Socket.IO events must use the canonical event names defined in SPEC.md Section 3.2
- Audio energy methods must match the signatures in `AudioAnalyzer` (SPEC.md 3.4)
- Performance-critical paths must include comments referencing the latency budget from SPEC.md Section 2

---

## Stage 5: VERIFY

After writing code, the agent MUST verify correctness by:

1. **Build check:** Run `npm install` + start the server — confirm no startup errors
2. **Console check:** Open browser and confirm no console errors in DevTools
3. **Functional check:** Test the specific feature just implemented against the Verify checklist in the PLAN file
4. **Performance check:** For any render-path code, confirm the GPU timer / `performance.now()` measurement is within the budget defined in SPEC.md Section 4.9
5. **Regression check:** Confirm previously working features still work after the change

If verification fails:
- Debug the issue without asking the user unless the root cause requires a design decision
- Fix and re-verify
- Document the fix in the commit message

---

## Stage 6: COMMIT

After passing verification:

- Write a **Conventional Commit** message following the format in PLAN files:
  - `feat(scope): description` for new features
  - `fix(scope): description` for bug fixes
  - `refactor(scope): description` for refactors
  - `docs(scope): description` for documentation
  - `chore(scope): description` for config, deps, build

- Commit message body should include:
  - What was implemented
  - Any non-obvious technical decisions made
  - Performance result if a perf target was tested

```bash
git add -A
git commit -m "feat(scope): description

- bullet point of what was done
- technical decision note if any
- perf: X ms measured, target was Y ms"
```

---

## Stage 7: PUSH

After committing:

```bash
git push origin main
```

If the push fails (e.g., remote has diverged):
- `git pull --rebase origin main` then retry
- Do NOT force push without explicit user approval

---

## Additional Standing Rules

### On Framework Choices
- Always prefer the choices documented in SPEC.md Section 4.7 (Technology Stack Decisions)
- If a better alternative is found during research, surface it in Stage 3 (Ask) — do not silently switch
- Document any deviation from SPEC.md in a comment in the affected file

### On Phase Boundaries
- Phase 2 code must NOT be implemented in Phase 1 prompts — stubs only
- Phase 3 code must NOT be implemented before Phase 2 is complete
- Stubs must exist and be wired (no-op or logged) — not absent

### On Security
- No API keys, tokens, or credentials in source code — use `.env` with `.gitignore`
- No cloud calls in Phase 1 — all communication is LAN-only
- No `eval()` or dynamic code execution

### On Performance
- Never use `setInterval` for render timing — use `requestAnimationFrame` with frame-time gating (SPEC.md 4.6)
- Never block the main thread with synchronous operations > 1ms in the render loop
- Always call `analyser.getByteFrequencyData()` in the rAF loop, not in event handlers

### On Mobile / Touch
- All interactive elements on `/remote.html` must have `touch-action: none`
- Use Pointer Events API — not `touchstart`/`touchend` — for slider controls
- Bottom sheet animation: `transform: translateY()` only — never `top`/`bottom` properties

### On GLSL Shaders
- Every shader file must have a header comment explaining: input uniforms, output, and algorithm
- All uniforms must be documented with their type, range, and what they control
- Default uniform values must produce a visible (non-black) output for easier debugging

### On Documentation
- After each phase-level prompt (Prompt 10 of Phase 1, etc.), update the Phase PLAN.md to mark completed items
- SPEC.md is a living document — if implementation diverges from spec, update SPEC.md and note the change

---

## Quick Reference: Canonical Event Names (Socket.IO)

| Event | Direction | Payload |
|---|---|---|
| `join_room` | client → server | `{ roomCode: string }` |
| `register_peer` | client → server | `{ roomCode: string, peerId: string }` |
| `preset_change` | bidirectional | `{ roomCode: string, presetId: string }` |
| `slider_update` | bidirectional | `{ roomCode: string, param: string, value: number }` |
| `engine_switch` | bidirectional | `{ roomCode: string, mode: 'shader'|'diffusion'|'cloud' }` |
| `prompt_update` | remote → display | `{ roomCode: string, prompt: string }` |
| `audio_source_change` | remote → display | `{ roomCode: string, deviceId: string }` |
| `fps_cap_change` | remote → display | `{ roomCode: string, fps: 15|30|60 }` |

---

## Quick Reference: Shader Uniform Naming Convention

All shaders must use these uniform names for consistency:

| Uniform | Type | Description |
|---|---|---|
| `tDiffuse` | `sampler2D` | Input frame texture (from previous pass or VideoTexture) |
| `uTime` | `float` | Elapsed time in seconds |
| `uResolution` | `vec2` | Canvas resolution in pixels |
| `uBass` | `float` | Bass energy 0–1 from AudioAnalyzer |
| `uMid` | `float` | Mid energy 0–1 from AudioAnalyzer |
| `uHigh` | `float` | High energy 0–1 from AudioAnalyzer |
| `uAvgLuma` | `float` | Scene average luminance (auto-gain) |
| `uMaxGain` | `float` | Auto-gain maximum multiplier |
| `uEdgeSensitivity` | `float` | Sobel edge detection threshold |
| `uColorSteps` | `float` | Posterization levels |
| `uDecay` | `float` | Feedback trail decay factor |
| `tPrev` | `sampler2D` | Previous frame buffer (ping-pong) |
