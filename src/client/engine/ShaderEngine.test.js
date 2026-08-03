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
  dispose: vi.fn(),
  domElement: { width: 800, height: 600 }
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
    UnsignedByteType: 1012,
    Vector2: class {
      constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
      }
      set(x, y) {
        this.x = x;
        this.y = y;
        return this;
      }
    }
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
    mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080
    };
    mockRenderer.domElement.width = 800;
    mockRenderer.domElement.height = 600;
  });

  it('should initialize renderer, scene, targets and materials correctly with default options', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    expect(engine.canvas).toBe(mockCanvas);
    expect(engine.videoElement).toBe(mockVideo);
    expect(engine.fpsCap).toBe(60);
    expect(engine.maxGain).toBe(3.0);
    expect(engine.antialias).toBe(false);
    expect(engine.aspectMode).toBe('fit');
    expect(engine.resolutionMode).toBe('window');
    expect(engine.dprCap).toBe(2.0);
    expect(engine.lumaSmoothing).toBe(0.95);

    expect(engine.renderer).toBeDefined();
    expect(engine.lumaTarget).toBeDefined();
    expect(engine.prepassTarget).toBeDefined();
    expect(engine.autoGainMaterial).toBeDefined();
  });

  it('should apply initialization options correctly', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo, {
      antialias: true,
      aspectMode: 'cover',
      resolutionMode: '1080p',
      dprCap: 1.5,
      lumaSmoothing: 0.8
    });

    expect(engine.antialias).toBe(true);
    expect(engine.aspectMode).toBe('cover');
    expect(engine.resolutionMode).toBe('1080p');
    expect(engine.dprCap).toBe(1.5);
    expect(engine.lumaSmoothing).toBe(0.8);
  });

  it('should update and apply runtime configuration changes', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    engine.setFpsCap(24);
    expect(engine.fpsCap).toBe(24);

    engine.setMaxGain(4.0);
    expect(engine.maxGain).toBe(4.0);
    expect(engine.autoGainMaterial.uniforms.uMaxGain.value).toBe(4.0);

    engine.setAspectMode('cover');
    expect(engine.aspectMode).toBe('cover');

    engine.setLumaSmoothing(0.9);
    expect(engine.lumaSmoothing).toBe(0.9);
  });

  it('should handle resize configurations for fluid and fixed resolution modes', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    // 1. Window fluid resolution mode
    mockCanvas.clientWidth = 1024;
    mockCanvas.clientHeight = 768;
    engine.setDprCap(1.5); // calls resize internally
    expect(mockRenderer.setSize).toHaveBeenCalledWith(1024, 768, false);

    // 2. Fixed 1080p resolution mode
    engine.setResolutionMode('1080p');
    expect(mockRenderer.setSize).toHaveBeenCalledWith(1920, 1080, false);
    expect(mockRenderer.setPixelRatio).toHaveBeenLastCalledWith(1.0);

    // 3. Fixed 720p resolution mode
    engine.setResolutionMode('720p');
    expect(mockRenderer.setSize).toHaveBeenCalledWith(1280, 720, false);
    expect(mockRenderer.setPixelRatio).toHaveBeenLastCalledWith(1.0);
  });

  it('should compute uVideoScale aspect scaling factors in Fit mode', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    // Canvas is 800x600 (aspect 1.333), Video is 1920x1080 (aspect 1.777)
    // Canvas is taller than video (cAspect < vAspect), so Fit requires letterboxing (scaleY > 1.0)
    engine.setAspectMode('fit');
    engine.render(1000);

    const scale = engine.autoGainMaterial.uniforms.uVideoScale.value;
    expect(scale.x).toBe(1.0);
    expect(scale.y).toBeCloseTo(1.777 / 1.333, 2);
  });

  it('should compute uVideoScale aspect scaling factors in Cover mode', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    // Canvas is 800x600 (aspect 1.333), Video is 1920x1080 (aspect 1.777)
    // Canvas is taller than video (cAspect < vAspect), so Cover requires cropping sides (scaleX < 1.0)
    engine.setAspectMode('cover');
    engine.render(1000);

    const scale = engine.autoGainMaterial.uniforms.uVideoScale.value;
    expect(scale.x).toBeCloseTo(1.333 / 1.777, 2);
    expect(scale.y).toBe(1.0);
  });

  it('should respect FPS cap using delta gating', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo, { fpsCap: 30 });

    engine.render(1000);
    mockRenderer.render.mockClear();

    // 10ms later (budget is 33.3ms), should be skipped
    engine.render(1010);
    expect(mockRenderer.render).not.toHaveBeenCalled();

    // 40ms later, should execute
    engine.render(1045);
    expect(mockRenderer.render).toHaveBeenCalled();
  });

  it('should cleanly dispose of GPU resources on destroy', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    const disposeRenderer = engine.renderer.dispose;
    const disposeTarget1 = engine.lumaTarget.dispose;
    const disposeTarget2 = engine.prepassTarget.dispose;

    engine.destroy();

    expect(engine.isPaused).toBe(true);
    expect(disposeRenderer).toHaveBeenCalled();
    expect(disposeTarget1).toHaveBeenCalled();
    expect(disposeTarget2).toHaveBeenCalled();
  });
});
