# Decision Log — AI Engine Architecture Decision

This document details the evaluation of options for real-time AI diffusion to power the projection engine in Phuebus.

## Options Evaluated

We score each alternative on a scale of 1–5 across 4 dimensions:
1. **Fit:** Precision in solving the stated technical requirement (real-time camera-reactive styling).
2. **Perf:** Latency, throughput, and GPU/CPU overhead.
3. **DX:** API ergonomics, developer experience, community support, and ease of local integration.
4. **Phase Fit:** Suitability across Phase 2 (hybrid local/cloud) and Phase 3 (standalone Tauri packaging).

### Alternatives Scoring Table

| Alternative | Fit | Perf | DX | Phase Fit | Total | Notes |
|---|---|---|---|---|---|---|
| **Option A: MLX SDXL Turbo / LCM (Local) + StreamDiffusion (Cloud)** ✅ | 5 | 5 | 4 | 5 | **19** | Highest rating. MLX offers native Apple Silicon performance for local mode. StreamDiffusion offers sub-150ms cloud latency. |
| Option B: ComfyUI API | 4 | 3 | 3 | 3 | **13** | Great DX, but ComfyUI pipeline overhead is too high for sub-100ms real-time generation. |
| Option C: A1111 WebUI API | 3 | 2 | 2 | 2 | **9** | Too heavy, high latency, poor API for streaming frames. |

## Decision
**Chosen: Option A** - A hybrid approach using a local Python sidecar running MLX (SDXL Turbo / LCM) and a cloud option connecting to a remote StreamDiffusion WebSocket server.

## Rationale
- **Performance:** MLX yields native 10-15fps inference on Apple Silicon (M-series) using unified memory. StreamDiffusion cloud gives sub-150ms latency using TensorRT.
- **Tauri Integration:** The Python sidecar can be compiled via PyInstaller and shipped as a native Tauri sidecar in Phase 3.
- **Dynamic Switch:** Both options share the `DiffusionEngine.js` interface contract, making them hot-swappable at runtime.

---

## DiffusionEngine Interface Contract

The `DiffusionEngine` class must expose the following interface to `EngineRouter`:

```javascript
class DiffusionEngine {
  constructor() {}
  
  // Set local or cloud mode with target server URL
  setMode(mode, serverUrl = null) {}
  
  // Check if connection is active and model is loaded
  isReady() {}
  
  // Submit a frame (Blob/ImageData) and retrieve the styled frame as an ImageBitmap
  async generate(frameBlob, prompt, strength) {}
  
  // Clean up WebSockets, sidecars, or models
  destroy() {}
}
```
