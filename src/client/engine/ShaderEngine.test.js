import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShaderEngine } from './ShaderEngine';

// Mock Three.js to run in headless test environment
const mockRenderer = {
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
  setRenderTarget: vi.fn(),
  readRenderTargetPixels: vi.fn((target, x, y, w, h, buffer) => {
    // Simulate rendering a mid-brightness scene (luma = 0.4)
    buffer[0] = 102; // 102/255 = 0.4
  }),
  render: vi.fn(),
  setAnimationLoop: vi.fn((cb) => {
    mockRenderer._loopCallback = cb;
  }),
  capabilities: { isWebGL2: true },
  dispose: vi.fn()
};

vi.mock('three', () => {
  class MockWebGLRenderer {
    constructor(options) {
      this.options = options;
      return mockRenderer;
    }
  }

  class MockWebGLRenderTarget {
    constructor(w, h, options) {
      this.width = w;
      this.height = h;
      this.texture = { generateMipmaps: false };
      this.dispose = vi.fn();
      this.setSize = vi.fn((width, height) => {
        this.width = width;
        this.height = height;
      });
    }
  }

  class MockShaderMaterial {
    constructor(options) {
      this.uniforms = options.uniforms || {};
      this.vertexShader = options.vertexShader;
      this.fragmentShader = options.fragmentShader;
      this.dispose = vi.fn();
    }
  }

  class MockVideoTexture {
    constructor(video) {
      this.video = video;
      this.dispose = vi.fn();
    }
  }

  class MockPlaneGeometry {
    constructor() {
      this.dispose = vi.fn();
    }
  }

  class MockScene {
    constructor() {
      this.add = vi.fn();
      this.remove = vi.fn();
    }
  }

  class MockMesh {
    constructor(geo, mat) {
      this.geometry = geo;
      this.material = mat;
    }
  }

  class MockOrthographicCamera {
    constructor() {}
  }

  return {
    WebGLRenderer: MockWebGLRenderer,
    WebGLRenderTarget: MockWebGLRenderTarget,
    ShaderMaterial: MockShaderMaterial,
    VideoTexture: MockVideoTexture,
    PlaneGeometry: MockPlaneGeometry,
    OrthographicCamera: MockOrthographicCamera,
    Scene: MockScene,
    Mesh: MockMesh,
    SRGBColorSpace: 'srgb',
    LinearFilter: 1006,
    RGBAFormat: 1023,
    UnsignedByteType: 1012
  };
});

describe('ShaderEngine class', () => {
  let mockCanvas;
  let mockVideo;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas = {
      clientWidth: 800,
      clientHeight: 600
    };
    mockVideo = {};
  });

  it('should initialize renderer, scene, targets and materials correctly', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    expect(engine.canvas).toBe(mockCanvas);
    expect(engine.videoElement).toBe(mockVideo);
    expect(engine.fpsCap).toBe(60);
    expect(engine.maxGain).toBe(3.0);
    expect(engine.avgLuma).toBe(0.5);

    expect(engine.renderer).toBeDefined();
    expect(engine.lumaTarget).toBeDefined();
    expect(engine.prepassTarget).toBeDefined();
    expect(engine.autoGainMaterial).toBeDefined();
  });

  it('should correctly update FPS cap and max gain parameters', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    engine.setFpsCap(30);
    expect(engine.fpsCap).toBe(30);

    engine.setMaxGain(5.0);
    expect(engine.maxGain).toBe(5.0);
    expect(engine.autoGainMaterial.uniforms.uMaxGain.value).toBe(5.0);
  });

  it('should handle resizing appropriately', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);
    
    mockCanvas.clientWidth = 1024;
    mockCanvas.clientHeight = 768;

    engine.resize();

    expect(engine.renderer.setSize).toHaveBeenCalledWith(1024, 768, false);
    expect(engine.prepassTarget.width).toBe(1024);
    expect(engine.prepassTarget.height).toBe(768);
  });

  it('should execute luma readback and auto-gain passes inside render loop', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    // Call render manually (representing setAnimationLoop callback trigger)
    engine.render(1000);

    // Renderer readRenderTargetPixels should have been called on lumaTarget (Pass 1)
    expect(engine.renderer.readRenderTargetPixels).toHaveBeenCalledWith(
      engine.lumaTarget,
      0,
      0,
      1,
      1,
      engine.lumaBuffer
    );

    // Verify avgLuma was smoothed: 0.5 * 0.95 + 0.4 * 0.05 = 0.495
    expect(engine.avgLuma).toBeCloseTo(0.495, 4);
    expect(engine.autoGainMaterial.uniforms.uAvgLuma.value).toBeCloseTo(0.495, 4);

    // WebGLRenderer render must be called for each pass: lumaDown, autoGain, copy
    expect(engine.renderer.render).toHaveBeenCalledTimes(3);
  });

  it('should respect FPS cap using delta gating', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo, { fpsCap: 30 });

    engine.render(1000); // Frame 1: lastFrameTime set to 1000
    engine.renderer.render.mockClear();

    // 10ms later: frame budget for 30fps is 33.3ms, so this frame should be gated/skipped
    engine.render(1010);
    expect(engine.renderer.render).not.toHaveBeenCalled();

    // 35ms later (total 45ms): should execute
    engine.render(1045);
    expect(engine.renderer.render).toHaveBeenCalled();
  });

  it('should cleanly dispose of GPU resources on destroy', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    const disposeRenderer = engine.renderer.dispose;
    const disposeTarget1 = engine.lumaTarget.dispose;
    const disposeTarget2 = engine.prepassTarget.dispose;
    const disposeMaterial = engine.autoGainMaterial.dispose;

    engine.destroy();

    expect(engine.isPaused).toBe(true);
    expect(disposeRenderer).toHaveBeenCalled();
    expect(disposeTarget1).toHaveBeenCalled();
    expect(disposeTarget2).toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalled();

    expect(engine.renderer).toBeNull();
    expect(engine.lumaTarget).toBeNull();
    expect(engine.prepassTarget).toBeNull();
  });
});
