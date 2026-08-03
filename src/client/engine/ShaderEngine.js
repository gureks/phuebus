// ShaderEngine.js — Three.js WebGL2 Pipeline Wrapper
//
// Core Responsibilities:
// - Initializes WebGL2 renderer on target canvas.
// - Binds HTMLVideoElement camera stream to a THREE.VideoTexture.
// - Implements a multi-pass pipeline:
//   1. Auto-Gain prepass: equalizes light levels.
//   2. Active Shader pass: runs passthrough (original), Toon, or Neon skeleton aura.
//   3. Feedback Trails pass: accumulates frames using ping-pong targets with wavy wave dispersion.
//   4. Screen Blit: outputs the final composited frame to the canvas.
// - Manages and updates GLSL uniforms (Time, Resolution, Audio levels, Pose landmarks, tuning variables).
// - Throttles render execution according to fpsCap.
// - Cleanly disposes of all GPU resources on destroy.

import * as THREE from 'three';
import { VERT_GLSL } from './shaders/fullscreen.vert';
import { LUMA_DOWN_FRAG, AUTOGAIN_FRAG } from './shaders/AutoGainPrepass';
import { TOON_FRAG } from './shaders/ToonShader';
import { TRAILS_FRAG } from './shaders/FeedbackTrails';
import { NEON_FRAG } from './shaders/NeonAura';

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

    // Shader Pack Tuning Variables
    this.activeShader = options.activeShader || 'passthrough'; // 'passthrough' | 'toon' | 'neon'
    this.trailsEnabled = options.trailsEnabled !== undefined ? options.trailsEnabled : false;
    this.edgeSensitivity = options.edgeSensitivity !== undefined ? options.edgeSensitivity : 0.15;
    this.colorSteps = options.colorSteps || 5.0;
    this.decay = options.decay !== undefined ? options.decay : 0.9;
    this.dispersion = options.dispersion !== undefined ? options.dispersion : 0.002;
    this.glowRadius = options.glowRadius !== undefined ? options.glowRadius : 0.005;
    this.hue = options.hue || 0.0; // In radians

    // Real-time audio energy stubs
    this.uBass = 0.0;
    this.uMid = 0.0;
    this.uHigh = 0.0;

    // Pose Landmarks (33 points) initialized to (-1, -1)
    this.landmarksList = Array.from({ length: 33 }, () => new THREE.Vector2(-1, -1));

    // Temporal smoothing state
    this.avgLuma = 0.5;
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
    this.toonMaterial = null;
    this.neonMaterial = null;
    this.feedbackMaterial = null;
    this.copyMaterial = null;

    // Render Targets
    this.lumaTarget = null;
    this.prepassTarget = null;
    this.activeShaderTarget = null;
    this.feedbackTargetA = null;
    this.feedbackTargetB = null;

    this.isPaused = false;

    this.init();
  }

  init() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;

    // 1. Initialize WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      depth: false,
      stencil: false
    });
    
    if (!this.renderer.capabilities.isWebGL2) {
      console.warn('[ShaderEngine] WebGL2 not natively supported. Falling back to WebGL1.');
    }

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

    // Screen-sized Render Targets
    const createTarget = (w, h) => {
      const rt = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false
      });
      rt.texture.generateMipmaps = false;
      return rt;
    };

    this.prepassTarget = createTarget(width, height);
    this.activeShaderTarget = createTarget(width, height);
    this.feedbackTargetA = createTarget(width, height);
    this.feedbackTargetB = createTarget(width, height);

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

    this.toonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(width, height) },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uEdgeSensitivity: { value: this.edgeSensitivity },
        uColorSteps: { value: this.colorSteps },
        uHue: { value: this.hue }
      },
      vertexShader: VERT_GLSL,
      fragmentShader: TOON_FRAG,
      depthWrite: false,
      depthTest: false
    });

    this.neonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uLandmarks: { value: this.landmarksList },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uGlowRadius: { value: this.glowRadius },
        uHue: { value: this.hue }
      },
      vertexShader: VERT_GLSL,
      fragmentShader: NEON_FRAG,
      depthWrite: false,
      depthTest: false
    });

    this.feedbackMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tCurrent: { value: null },
        tPrev: { value: null },
        uDecay: { value: this.decay },
        uTime: { value: 0 },
        uDispersion: { value: this.dispersion }
      },
      vertexShader: VERT_GLSL,
      fragmentShader: TRAILS_FRAG,
      depthWrite: false,
      depthTest: false
    });

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

    // Create rendering quad Mesh
    this.quadMesh = new THREE.Mesh(this.quadGeometry, this.copyMaterial);
    this.quadScene.add(this.quadMesh);

    // Bind and set size
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();

    // Start loop
    this.lastFpsUpdateTime = performance.now();
    this.renderer.setAnimationLoop((timestamp) => this.render(timestamp));
  }

  // --- Configuration Mutators ---

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

  setActiveShader(type) {
    this.activeShader = type; // 'passthrough' | 'toon' | 'neon'
  }

  setTrailsEnabled(enabled) {
    this.trailsEnabled = enabled;
  }

  setEdgeSensitivity(val) {
    this.edgeSensitivity = val;
    if (this.toonMaterial) {
      this.toonMaterial.uniforms.uEdgeSensitivity.value = val;
    }
  }

  setColorSteps(val) {
    this.colorSteps = val;
    if (this.toonMaterial) {
      this.toonMaterial.uniforms.uColorSteps.value = val;
    }
  }

  setDecay(val) {
    this.decay = val;
    if (this.feedbackMaterial) {
      this.feedbackMaterial.uniforms.uDecay.value = val;
    }
  }

  setDispersion(val) {
    this.dispersion = val;
    if (this.feedbackMaterial) {
      this.feedbackMaterial.uniforms.uDispersion.value = val;
    }
  }

  setGlowRadius(val) {
    this.glowRadius = val;
    if (this.neonMaterial) {
      this.neonMaterial.uniforms.uGlowRadius.value = val;
    }
  }

  setHue(degrees) {
    const rad = (degrees * Math.PI) / 180.0;
    this.hue = rad;
    if (this.toonMaterial) this.toonMaterial.uniforms.uHue.value = rad;
    if (this.neonMaterial) this.neonMaterial.uniforms.uHue.value = rad;
  }

  setAudioData(bass, mid, high = 0) {
    this.uBass = bass;
    this.uMid = mid;
    this.uHigh = high;
  }

  setLandmarks(landmarks) {
    if (!landmarks || landmarks.length === 0) {
      // Invalidate all landmarks
      for (let i = 0; i < 33; i++) {
        this.landmarksList[i].set(-1, -1);
      }
      return;
    }
    // Update matching indices in-place
    for (let i = 0; i < 33; i++) {
      if (landmarks[i]) {
        this.landmarksList[i].set(landmarks[i].x, landmarks[i].y);
      } else {
        this.landmarksList[i].set(-1, -1);
      }
    }
  }

  // --- Pipeline Resizing ---

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

    const pixelRatio = this.resolutionMode === 'window' 
      ? Math.min(window.devicePixelRatio, this.dprCap) 
      : 1.0;

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    // Resize targets
    if (this.prepassTarget) this.prepassTarget.setSize(width, height);
    if (this.activeShaderTarget) this.activeShaderTarget.setSize(width, height);
    if (this.feedbackTargetA) this.feedbackTargetA.setSize(width, height);
    if (this.feedbackTargetB) this.feedbackTargetB.setSize(width, height);

    if (this.toonMaterial) {
      this.toonMaterial.uniforms.uResolution.value.set(width, height);
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    this.lastFrameTime = performance.now();
  }

  // --- Render execution ---

  render(timestamp) {
    if (this.isPaused) return;

    const frameBudget = 1000 / this.fpsCap;
    const delta = timestamp - this.lastFrameTime;
    if (delta < frameBudget) return;
    
    if (delta > 1000) {
      this.lastFrameTime = timestamp;
    } else {
      const excess = delta % frameBudget;
      this.lastFrameTime = timestamp - (excess >= frameBudget - 0.001 ? 0 : excess);
    }

    const timeSec = timestamp * 0.001;

    // --- Pass 1: Luma Extraction ---
    this.quadMesh.material = this.lumaDownMaterial;
    this.lumaDownMaterial.uniforms.tDiffuse.value = this.videoTexture;
    
    this.renderer.setRenderTarget(this.lumaTarget);
    this.renderer.render(this.quadScene, this.quadCamera);

    this.renderer.readRenderTargetPixels(this.lumaTarget, 0, 0, 1, 1, this.lumaBuffer);
    const measuredLuma = this.lumaBuffer[0] / 255.0;
    this.avgLuma = this.avgLuma * this.lumaSmoothing + measuredLuma * (1.0 - this.lumaSmoothing);

    // --- Pass 2: Auto-Gain prepass ---
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

    // --- Pass 3: Active Shader (Passthrough / Toon / Neon) ---
    let activeMat = this.copyMaterial;
    if (this.activeShader === 'toon') {
      activeMat = this.toonMaterial;
      this.toonMaterial.uniforms.tDiffuse.value = this.prepassTarget.texture;
      this.toonMaterial.uniforms.uTime.value = timeSec;
      this.toonMaterial.uniforms.uBass.value = this.uBass;
    } else if (this.activeShader === 'neon') {
      activeMat = this.neonMaterial;
      this.neonMaterial.uniforms.tDiffuse.value = this.prepassTarget.texture;
      this.neonMaterial.uniforms.uTime.value = timeSec;
      this.neonMaterial.uniforms.uBass.value = this.uBass;
      this.neonMaterial.uniforms.uMid.value = this.uMid;
    } else {
      // passthrough
      this.copyMaterial.uniforms.tDiffuse.value = this.prepassTarget.texture;
    }

    this.quadMesh.material = activeMat;
    this.renderer.setRenderTarget(this.activeShaderTarget);
    this.renderer.render(this.quadScene, this.quadCamera);

    // --- Pass 4: Feedback Trails ---
    let finalSourceTarget = this.activeShaderTarget;

    if (this.trailsEnabled) {
      this.quadMesh.material = this.feedbackMaterial;
      this.feedbackMaterial.uniforms.tCurrent.value = this.activeShaderTarget.texture;
      this.feedbackMaterial.uniforms.tPrev.value = this.feedbackTargetA.texture;
      this.feedbackMaterial.uniforms.uTime.value = timeSec;

      this.renderer.setRenderTarget(this.feedbackTargetB);
      this.renderer.render(this.quadScene, this.quadCamera);

      // Swap buffers
      const temp = this.feedbackTargetA;
      this.feedbackTargetA = this.feedbackTargetB;
      this.feedbackTargetB = temp;

      finalSourceTarget = this.feedbackTargetA;
    }

    // --- Pass 5: Final screen blit ---
    this.quadMesh.material = this.copyMaterial;
    this.copyMaterial.uniforms.tDiffuse.value = finalSourceTarget.texture;

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
    if (this.toonMaterial) this.toonMaterial.dispose();
    if (this.neonMaterial) this.neonMaterial.dispose();
    if (this.feedbackMaterial) this.feedbackMaterial.dispose();
    if (this.copyMaterial) this.copyMaterial.dispose();

    if (this.lumaTarget) this.lumaTarget.dispose();
    if (this.prepassTarget) this.prepassTarget.dispose();
    if (this.activeShaderTarget) this.activeShaderTarget.dispose();
    if (this.feedbackTargetA) this.feedbackTargetA.dispose();
    if (this.feedbackTargetB) this.feedbackTargetB.dispose();

    this.renderer = null;
    this.videoTexture = null;
    this.quadGeometry = null;
    this.lumaDownMaterial = null;
    this.autoGainMaterial = null;
    this.toonMaterial = null;
    this.neonMaterial = null;
    this.feedbackMaterial = null;
    this.copyMaterial = null;
    this.lumaTarget = null;
    this.prepassTarget = null;
    this.activeShaderTarget = null;
    this.feedbackTargetA = null;
    this.feedbackTargetB = null;
    this.quadScene = null;
  }
}
