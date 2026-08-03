# **Master Antigravity Build Prompt: Phuebus Interactive Projection Engine**

## **Role & System Instructions**

You are an expert real-time graphics and full-stack engineer building **Phuebus**—a full-stack WebGL and WebRTC live visual projection system structured for Phase 1 (Local Shaders \+ Low-Light Gain \+ Multi-Camera USB/WebRTC Ingestion) with technical hooks and modular abstractions for Phase 2 (Real-Time Diffusion AI Engine) and Phase 3 (Self-Serve Desktop App & Expandable Model Packs).

## **Tech Stack & Core Dependencies**

* **Backend Runtime:** Node.js \+ Express  
* **Real-Time Communication:** socket.io for bidirectional control signals; peerjs / native WebRTC for mobile camera streaming.  
* **Graphics & Ingestion:** Three.js / WebGL2, MediaDevices UVC/USB Camera Ingestion API, @mediapipe/pose, @mediapipe/camera\_utils.  
* **Audio Reactivity:** Web Audio API with configurable device input routing (Aux line-in, USB Interface, Mic).  
* **UI Framework:** HeroUI v3 (previously NextUI) (Dark Mode, touch-optimized, mobile bottomsheet components).

## **Architecture Requirements**

Create the repository structure as follows:

/  
├── server.js                   \# Express, Socket.io, and WebRTC Signaling Server  
├── package.json  
├── public/  
│   ├── index.html              \# Landing Page & Mode Switcher  
│   ├── display.html            \# Secondary Monitor / Projector Canvas Output View \+ Presets UI  
│   ├── remote.html             \# Mobile Camera Streamer & Touch Control Surface UI  
│   ├── css/  
│   │   └── app.css             \# Dark-theme Mobile Touch Controls & Bottomsheet CSS  
│   └── js/  
│       ├── display.js          \# Master Render Engine & Display Controller  
│       ├── remote.js           \# Mobile Streamer, Socket Emitter & UI Controller  
│       ├── engine/  
│       │   ├── EngineRouter.js \# Switcher between WebGL Engine & AI Engine  
│       │   ├── ShaderEngine.js \# Three.js Shader Pipeline \+ Auto-Gain Equalizer  
│       │   ├── DiffusionEngine.js \# Abstract Interface for Cloud/Local Diffusion  
│       │   ├── ModelPackManager.js\# Modular Model Pack Extensibility Hook (Phase 3\)  
│       │   ├── AudioAnalyzer.js \# Configurable Audio Input & Beat Detector  
│       │   ├── VideoIngestion.js\# WebRTC & USB/UVC (GoPro, Sony, FPV) Manager  
│       │   └── PoseTracker.js  \# MediaPipe Pose Tracking Pipeline  
│       ├── shaders/  
│       │   ├── AutoGainPrepass.js\# Low-light Equalization & Strobe Compensator  
│       │   ├── ToonShader.js   \# Sobel Edge \+ Posterization Vector Comic Shader  
│       │   ├── NeonAura.js     \# Body Skeleton Tracking & Particle Aura  
│       │   └── FeedbackTrails.js \# Trailing Fluid Displacement Shader  
│       └── recorder.js         \# Canvas Stream MediaRecorder Utility

## **Detailed Build Instructions**

### **1\. Server (server.js)**

* Express web server serving /public.  
* Integrated socket.io server handling room pairing via 4-character session code / QR code.  
* Broadcast bidirectional control parameter changes (preset\_change, slider\_update, engine\_switch, prompt\_update, audio\_source\_change, fps\_cap\_change) between /remote and /display with sub-10ms latency.

### **2\. Multi-Camera & Audio Ingestion (VideoIngestion.js & AudioAnalyzer.js)**

* **Video Ingestion:** Support switching between WebRTC wireless phone stream and USB UVC camera capture devices (GoPro, Sony DSLR capture card, FPV drone receiver) using navigator.mediaDevices.enumerateDevices().  
* **Audio Routing:** Enumerate audio input devices (Aux Line-in, USB Interface, Microphone) allowing the user to pick the exact audio input driver for FFT beat detection.

### **3\. Mobile Remote Controller & Sync (/remote.html & remote.js)**

* Render dark-mode UI structured as follows:  
  * **Top Bar:** Prominent Preset Grid (MPC-style high-contrast touch tiles for instant style switching) \+ AI Prompt Bar with quick-trigger chips.  
  * **Expandable Bottomsheet:** Swipe-up modal containing mixing sliders:  
    * Render Frame Rate Cap (15 FPS, 30 FPS, 60 FPS cap/throttle).  
    * Auto-Gain / Night Boost Intensity.  
    * Edge Sensitivity, Color Quantization, Beat Reactivity, Motion Decay.  
  * Bidirectional sync: Selecting a preset on mobile updates the /display UI instantly, and vice versa.

### **4\. Core Render Engine & Shaders (ShaderEngine.js & shaders/)**

* **Auto-Gain Prepass Shader (AutoGainPrepass.js):** Process incoming camera frames through dynamic brightness equalization to keep visuals stable in dark nightclubs or flashing strobe lighting.  
* **Vector Toon Shader (ToonShader.js):** Sobel edge detection \+ color posterization with audio beat-modulated line glow.  
* **Engine Router (EngineRouter.js):** Allow runtime switching between ShaderEngine and DiffusionEngine without unmounting video textures or dropping frames.  
* **Model Pack Manager Hook (ModelPackManager.js):** Modular abstraction interface to load local/cloud diffusion packages (e.g., SDXL Turbo, LCM, Toon LoRAs) for Phase 3 extensibility.

## **Execution Guardrails**

1. Ensure all code is production-ready, fully written out without placeholder comments.  
2. Phase 1 must run completely locally on single-machine hardware without third-party cloud API keys.  
3. Mobile interface controls must use touch event listeners for zero-delay tactile response.