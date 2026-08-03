import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShaderEngine } from './ShaderEngine';

// Mock Three.js to run in headless test environment
const mockRenderer = {
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
  setRenderTarget: vi.fn(),
  readRenderTargetPixels: vi.fn((target, x, y, w, h, buffer) => {
    buffer[0] = 128; // luma = 0.5
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
    expect(engine.activeShader).toBe('passthrough');
    expect(engine.trailsEnabled).toBe(false);

    expect(engine.renderer).toBeDefined();
    expect(engine.lumaTarget).toBeDefined();
    expect(engine.prepassTarget).toBeDefined();
    expect(engine.activeShaderTarget).toBeDefined();
    expect(engine.feedbackTargetA).toBeDefined();
    expect(engine.feedbackTargetB).toBeDefined();
    expect(engine.toonMaterial).toBeDefined();
    expect(engine.neonMaterial).toBeDefined();
    expect(engine.feedbackMaterial).toBeDefined();
  });

  it('should apply and update active shader and trails parameters', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    engine.setActiveShader('toon');
    expect(engine.activeShader).toBe('toon');

    engine.setTrailsEnabled(true);
    expect(engine.trailsEnabled).toBe(true);
  });

  it('should update uniform setters for the shader pack', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    engine.setEdgeSensitivity(0.25);
    expect(engine.edgeSensitivity).toBe(0.25);
    expect(engine.toonMaterial.uniforms.uEdgeSensitivity.value).toBe(0.25);

    engine.setColorSteps(8.0);
    expect(engine.colorSteps).toBe(8.0);
    expect(engine.toonMaterial.uniforms.uColorSteps.value).toBe(8.0);

    engine.setDecay(0.85);
    expect(engine.decay).toBe(0.85);
    expect(engine.feedbackMaterial.uniforms.uDecay.value).toBe(0.85);

    engine.setDispersion(0.005);
    expect(engine.dispersion).toBe(0.005);
    expect(engine.feedbackMaterial.uniforms.uDispersion.value).toBe(0.005);

    engine.setGlowRadius(0.012);
    expect(engine.glowRadius).toBe(0.012);
    expect(engine.neonMaterial.uniforms.uGlowRadius.value).toBe(0.012);

    engine.setHue(180);
    expect(engine.hue).toBeCloseTo(Math.PI, 4);
    expect(engine.toonMaterial.uniforms.uHue.value).toBeCloseTo(Math.PI, 4);
    expect(engine.neonMaterial.uniforms.uHue.value).toBeCloseTo(Math.PI, 4);
  });

  it('should correctly set and invalidate landmarks Vector2 coordinates', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    // Initial state: all set to (-1, -1)
    expect(engine.landmarksList[0].x).toBe(-1);
    expect(engine.landmarksList[0].y).toBe(-1);

    // Set active landmarks array
    const testLandmarks = [
      { x: 0.5, y: 0.5 },
      { x: 0.2, y: 0.8 }
    ];
    engine.setLandmarks(testLandmarks);
    expect(engine.landmarksList[0].x).toBe(0.5);
    expect(engine.landmarksList[0].y).toBe(0.5);
    expect(engine.landmarksList[1].x).toBe(0.2);
    expect(engine.landmarksList[1].y).toBe(0.8);
    // Unspecified items should remain (-1, -1)
    expect(engine.landmarksList[2].x).toBe(-1);
    expect(engine.landmarksList[2].y).toBe(-1);

    // Invalidate landmarks
    engine.setLandmarks(null);
    expect(engine.landmarksList[0].x).toBe(-1);
    expect(engine.landmarksList[0].y).toBe(-1);
  });

  it('should execute multi-pass render steps and update uniforms', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);
    engine.setActiveShader('neon');
    engine.setTrailsEnabled(true);
    engine.setAudioData(0.8, 0.4, 0.2);

    engine.render(1200);

    expect(engine.uBass).toBe(0.8);
    expect(engine.uMid).toBe(0.4);
    expect(engine.uHigh).toBe(0.2);

    expect(mockRenderer.render).toHaveBeenCalled();
  });
});
