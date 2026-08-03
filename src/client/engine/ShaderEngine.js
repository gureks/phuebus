// ShaderEngine.js — Three.js WebGL2 Pipeline Wrapper
//
// Core Responsibilities:
// - Initializes WebGL2 renderer on target canvas.
// - Binds HTMLVideoElement camera stream to a THREE.VideoTexture.
// - Implements dual off-screen passes:
//   1. Luma measurement pass: renders to a 1x1 RenderTarget and reads back luma.
//   2. Auto-gain pass: equalizes scene illumination based on average luma.
// - Supports dynamic resizing of the viewport and render targets.
// - Throttles render execution according to ufpsCap.
// - Cleanly disposes of all GPU resources on destroy to prevent memory leaks.

import * as THREE from 'three';
import { VERT_GLSL } from './shaders/fullscreen.vert';
import { LUMA_DOWN_FRAG, AUTOGAIN_FRAG } from './shaders/AutoGainPrepass';

export class ShaderEngine {
  constructor(canvas, videoElement, options = {}) {
    if (!canvas || !videoElement) {
      throw new Error('[ShaderEngine] canvas and videoElement are required');
    }

    this.canvas = canvas;
    this.videoElement = videoElement;
    
    // Configurations
    this.fpsCap = options.fpsCap || 60;
    this.maxGain = options.maxGain || 3.0;
    this.antialias = options.antialias !== undefined ? options.antialias : false;
    this.aspectMode = options.aspectMode || 'fit';
    this.resolutionMode = options.resolutionMode || 'window';
    this.dprCap = options.dprCap || 2.0;
    this.lumaSmoothing = options.lumaSmoothing !== undefined ? options.lumaSmoothing : 0.95;
    this.onFpsUpdate = options.onFpsUpdate || null;

    // Temporal smoothing state
    this.avgLuma = 0.5; // Starts at mid-gray
    this.lumaBuffer = new Uint8Array(4);

    // Frame gating state
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.lastFpsUpdateTime = 0;

    // WebGL Pipeline properties
    this.renderer = null;
    this.videoTexture = null;
    this.quadGeometry = null;
    this.quadCamera = null;
    this.quadScene = null;
    this.quadMesh = null;

    // Materials
    this.lumaDownMaterial = null;
    this.autoGainMaterial = null;
    this.copyMaterial = null;

    // Render Targets
    this.lumaTarget = null;
    this.prepassTarget = null;

    this.isPaused = false;
    this.animationFrameId = null;

    this.init();
  }

  init() {
    // 1. Initialize WebGL2 WebGLRenderer with user antialiasing preference
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      depth: false,
      stencil: false
    });
    
    // Enforce WebGL2 compatibility check
    if (!this.renderer.capabilities.isWebGL2) {
      console.warn('[ShaderEngine] WebGL2 not natively supported. Falling back to WebGL1.');
    }

    // Call resize to set initial sizes correctly
    this.prepassTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false
    });
    this.prepassTarget.texture.generateMipmaps = false;

    this.resize();

    // 2. Fullscreen blitting orthographic camera & geometry
    this.quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    
    // 3. Create VideoTexture
    this.videoTexture = new THREE.VideoTexture(this.videoElement);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.format = THREE.RGBAFormat;

    // 4. Create Off-screen Render Targets
    this.lumaTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false
    });
    this.lumaTarget.texture.generateMipmaps = false;

    // 5. Shader Materials
    this.lumaDownMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.videoTexture }
      },
      vertexShader: VERT_GLSL,
      fragmentShader: LUMA_DOWN_FRAG,
      depthWrite: false,
      depthTest: false
    });

    this.autoGainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.videoTexture },
        uAvgLuma: { value: this.avgLuma },
        uMaxGain: { value: this.maxGain },
        uVideoScale: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader: VERT_GLSL,
      fragmentShader: AUTOGAIN_FRAG,
      depthWrite: false,
      depthTest: false
    });

    // Copy Material for final blit
    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }
      },
      vertexShader: VERT_GLSL,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `,
      depthWrite: false,
      depthTest: false
    });

    // Create a mesh that we update per pass
    this.quadMesh = new THREE.Mesh(this.quadGeometry, this.lumaDownMaterial);
    this.quadScene.add(this.quadMesh);

    // Bind event handlers
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);

    // Start render loop
    this.lastFpsUpdateTime = performance.now();
    this.renderer.setAnimationLoop((timestamp) => this.render(timestamp));
  }

  setFpsCap(fps) {
    this.fpsCap = fps;
  }

  setMaxGain(gain) {
    this.maxGain = gain;
    if (this.autoGainMaterial) {
      this.autoGainMaterial.uniforms.uMaxGain.value = gain;
    }
  }

  setAspectMode(mode) {
    this.aspectMode = mode;
  }

  setResolutionMode(mode) {
    this.resolutionMode = mode;
    this.resize();
  }

  setDprCap(dpr) {
    this.dprCap = dpr;
    this.resize();
  }

  setLumaSmoothing(smoothing) {
    this.lumaSmoothing = smoothing;
  }

  resize() {
    if (!this.canvas || !this.renderer) return;

    let width = this.canvas.clientWidth || window.innerWidth;
    let height = this.canvas.clientHeight || window.innerHeight;

    if (this.resolutionMode === '1080p') {
      width = 1920;
      height = 1080;
    } else if (this.resolutionMode === '720p') {
      width = 1280;
      height = 720;
    }

    // Set pixel ratio: use cap for fluid window, 1.0 for fixed resolutions
    const pixelRatio = this.resolutionMode === 'window' 
      ? Math.min(window.devicePixelRatio, this.dprCap) 
      : 1.0;

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    if (this.prepassTarget) {
      this.prepassTarget.setSize(width, height);
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    this.lastFrameTime = performance.now();
  }

  render(timestamp) {
    if (this.isPaused) return;

    // Frame-time gating for FPS cap
    const frameBudget = 1000 / this.fpsCap;
    const delta = timestamp - this.lastFrameTime;
    if (delta < frameBudget) return;
    
    // If delta is extremely large (e.g. tab backgrounded), reset
    if (delta > 1000) {
      this.lastFrameTime = timestamp;
    } else {
      // Keep alignment with target frame times, avoiding floating-point modulo precision bugs
      const excess = delta % frameBudget;
      this.lastFrameTime = timestamp - (excess >= frameBudget - 0.001 ? 0 : excess);
    }

    // --- Pass 1: Luma Extraction ---
    // Update active shader material to Luma Downsample
    this.quadMesh.material = this.lumaDownMaterial;
    this.lumaDownMaterial.uniforms.tDiffuse.value = this.videoTexture;
    
    this.renderer.setRenderTarget(this.lumaTarget);
    this.renderer.render(this.quadScene, this.quadCamera);

    // Read 1x1 pixel back
    this.renderer.readRenderTargetPixels(this.lumaTarget, 0, 0, 1, 1, this.lumaBuffer);
    const measuredLuma = this.lumaBuffer[0] / 255.0;

    // Exponential smoothing: avgLuma = avgLuma * smoothing + measuredLuma * (1 - smoothing)
    this.avgLuma = this.avgLuma * this.lumaSmoothing + measuredLuma * (1.0 - this.lumaSmoothing);

    // --- Pass 2: Auto-Gain Equalization (including Aspect Ratio Scaling) ---
    const vWidth = this.videoElement.videoWidth || 1920;
    const vHeight = this.videoElement.videoHeight || 1080;
    const vAspect = vWidth / vHeight;

    const cWidth = this.renderer.domElement.width;
    const cHeight = this.renderer.domElement.height;
    const cAspect = cWidth / cHeight;

    let scaleX = 1.0;
    let scaleY = 1.0;

    if (this.aspectMode === 'fit') {
      if (cAspect > vAspect) {
        scaleX = cAspect / vAspect;
      } else {
        scaleY = vAspect / cAspect;
      }
    } else if (this.aspectMode === 'cover') {
      if (cAspect > vAspect) {
        scaleY = vAspect / cAspect;
      } else {
        scaleX = cAspect / vAspect;
      }
    }

    this.quadMesh.material = this.autoGainMaterial;
    this.autoGainMaterial.uniforms.tDiffuse.value = this.videoTexture;
    this.autoGainMaterial.uniforms.uAvgLuma.value = this.avgLuma;
    this.autoGainMaterial.uniforms.uMaxGain.value = this.maxGain;
    this.autoGainMaterial.uniforms.uVideoScale.value.set(scaleX, scaleY);

    this.renderer.setRenderTarget(this.prepassTarget);
    this.renderer.render(this.quadScene, this.quadCamera);

    // --- Pass 3: Final Blit to screen ---
    this.quadMesh.material = this.copyMaterial;
    this.copyMaterial.uniforms.tDiffuse.value = this.prepassTarget.texture;

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);

    // Calculate FPS and trigger callback
    this.frameCount++;
    const now = performance.now();
    const fpsDelta = now - this.lastFpsUpdateTime;
    if (fpsDelta >= 1000) {
      const calculatedFps = Math.round((this.frameCount * 1000) / fpsDelta);
      if (this.onFpsUpdate) {
        this.onFpsUpdate(calculatedFps);
      }
      this.frameCount = 0;
      this.lastFpsUpdateTime = now;
    }
  }

  destroy() {
    this.pause();
    window.removeEventListener('resize', this.resize);
    
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      this.renderer.dispose();
    }

    if (this.videoTexture) this.videoTexture.dispose();
    if (this.quadGeometry) this.quadGeometry.dispose();
    
    if (this.lumaDownMaterial) this.lumaDownMaterial.dispose();
    if (this.autoGainMaterial) this.autoGainMaterial.dispose();
    if (this.copyMaterial) this.copyMaterial.dispose();

    if (this.lumaTarget) this.lumaTarget.dispose();
    if (this.prepassTarget) this.prepassTarget.dispose();

    this.renderer = null;
    this.videoTexture = null;
    this.quadGeometry = null;
    this.lumaDownMaterial = null;
    this.autoGainMaterial = null;
    this.copyMaterial = null;
    this.lumaTarget = null;
    this.prepassTarget = null;
    this.quadScene = null;
  }
}
