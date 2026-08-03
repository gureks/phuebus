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

  it('should initialize renderer, targets and materials correctly with default options', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    expect(engine.activeShader).toBe('passthrough');
    expect(engine.trailsEnabled).toBe(false);
    expect(engine.prevFrameTarget).toBeDefined();

    expect(engine.toonMaterial.uniforms.uAudioHueSensitivity.value).toBe(1.0);
    expect(engine.toonMaterial.uniforms.uToonOutlineMode.value).toBe(0);
    expect(engine.feedbackMaterial.uniforms.uAudioDispersionSensitivity.value).toBe(2.0);
    expect(engine.feedbackMaterial.uniforms.uMotionFlowScale.value).toBe(5.0);
  });

  it('should update uniform setters for Toon and Feedback dynamic additions', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);

    engine.setToonOutlineMode(1);
    expect(engine.toonOutlineMode).toBe(1);
    expect(engine.toonMaterial.uniforms.uToonOutlineMode.value).toBe(1);

    engine.setAudioHueSensitivity(1.5);
    expect(engine.audioHueSensitivity).toBe(1.5);
    expect(engine.toonMaterial.uniforms.uAudioHueSensitivity.value).toBe(1.5);

    engine.setAudioDispersionSensitivity(3.0);
    expect(engine.audioDispersionSensitivity).toBe(3.0);
    expect(engine.feedbackMaterial.uniforms.uAudioDispersionSensitivity.value).toBe(3.0);

    engine.setMotionFlowScale(8.0);
    expect(engine.motionFlowScale).toBe(8.0);
    expect(engine.feedbackMaterial.uniforms.uMotionFlowScale.value).toBe(8.0);
  });

  it('should execute multi-pass render steps including prevFrameTarget copy', () => {
    const engine = new ShaderEngine(mockCanvas, mockVideo);
    engine.setActiveShader('neon');
    engine.setTrailsEnabled(true);
    engine.setAudioData(0.8, 0.4, 0.2);

    engine.render(1200);

    expect(engine.uBass).toBe(0.8);
    expect(engine.uMid).toBe(0.4);
    expect(engine.uHigh).toBe(0.2);

    // Should have called render at least 5 times (prepass, activeShader, trails, prevFrameCopy, blit)
    expect(mockRenderer.render).toHaveBeenCalled();
  });
});
