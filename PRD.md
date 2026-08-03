# **Product Requirement Document (PRD): Phuebus (Live Visual Engine)**

## **1\. Executive Summary**

**Phuebus** (a play on *Hue* \+ *Phoebus*, the Greek god of light) is an interactive, real-time visual projection engine designed for event spaces, DJs, and experiential creators. The platform converts live camera feeds (smartphones, GoPros, mirrorless cameras, FPV drones via USB/UVC or wireless WebRTC) into stylized interactive visuals projected in real time. It offers sub-30ms latency, mobile remote control, audio reactivity, and seamless switching between local WebGL shaders and real-time AI diffusion models.

## **2\. Platform Architecture & Evolution Roadmap**

  ┌─────────────────────────────────────────────────────────┐  
  │                 Phuebus Mobile Controller               │  
  │  \- Camera Capture (WebRTC Stream)                       │  
  │  \- Prominent Preset Grid \+ AI Prompt Bar                │  
  │  \- Expandable Bottom Sheet (Mixing Sliders & FPS Ctrl)  │  
  └────────────────────────────┬────────────────────────────┘  
                               │ (WebRTC / Sockets)  
                               ▼  
  ┌─────────────────────────────────────────────────────────┐  
  │              Phuebus Engine Host (Mac / PC)             │  
  │                                                         │  
  │  Ingestion Engine: WebRTC | USB Capture (GoPro/Sony/FPV)│  
  │  Audio Analyzer:   Configurable Audio Input (Aux/Mic)   │  
  │                                                         │  
  │  ┌───────────────────────┐   ┌───────────────────────┐  │  
  │  │ Phase 1: WebGL/Shaders│   │ Phase 2: Diffusion AI │  │  
  │  │ \- 60+ FPS, 0ms Lag    │◄─►│ \- Cloud / Local Engine│  │  
  │  │ \- Auto-Gain / LowLight│   │ \- ControlNet / SDXL   │  │  
  │  │ \- Audio Reactivity    │   │ \- Frame Interpolation │  │  
  │  └───────────────────────┘   └───────────────────────┘  │  
  └────────────────────────────┬────────────────────────────┘  
                               │  
                               ▼  
  ┌─────────────────────────────────────────────────────────┐  
  │ Phase 3: Distribution & Commercial Model                │  
  │ \- Web SaaS Cloud Host (Monthly Subscription)            │  
  │ \- Standalone Desktop App (One-Time License Fee)         │  
  │ \- Downloadable Model Packs (Expandable Model Store)    │  
  └─────────────────────────────────────────────────────────┘

## **3\. Detailed Technical Requirements Across Phases**

### **Phase 1: Local Shader Engine, Multi-Input Ingestion & Low-Latency Foundation**

* **Target Latency:** Sub-30ms total pipeline delay.  
* **Multi-Camera Ingestion Layer:**  
  * Wireless WebRTC peer-to-peer streaming via local Wi-Fi router.  
  * Wired USB / UVC Capture Card ingestion support (GoPro, Sony Alpha clean HDMI, DJI FPV analog/digital video grabbers, wired USB-C mobile input).  
* **Nightclub Vision Pre-Processor:**  
  * Integrated **Auto-Gain Boost & Contrast Equalization Shader** pre-pass to prevent blackouts or blinding strobe flashover in dark event environments.  
* **Audio Reactivity Engine:**  
  * System Audio Input Selector: Configurable dropdown to route live audio from external USB audio interfaces, DJ mixer Aux line-in, or room mics via Web Audio API FFT analysis.  
* **Shader Pipeline:**  
  * **Vector Toon / Comic Shader:** Sobel edge detection combined with posterization/color quantization.  
  * **Cyberpunk Wireframe:** Skeletal tracking overlay with neon glow effects.  
  * **Feedback Fluid/Trails:** Frame buffer decay with particle dispersion.  
* **UI & Control Architecture (Mobile & Mac Host):**  
  * Integrated Presets on both devices (Mobile Controller and Host Display UI stay bidirectionally synced via WebSockets).  
  * **Mobile Layout:**  
    * **Top Section:** Prominent Preset Grid (MPC-style high-contrast touch tiles) \+ AI Prompt Text Bar.  
    * **Expandable Bottom Sheet:** Houses granular mixing sliders, parameter tuning, and **Render Frame Rate Control** (15 FPS, 30 FPS, 60 FPS cap / throttle).  
* **Output & Recording:** Borderless fullscreen output for secondary screen/projector; local high-bitrate canvas recording (MediaRecorder).

### **Phase 2: Hybrid Real-Time Diffusion & Model Switching**

* **Engine Router:** Interface allowing seamless runtime toggling between:  
  1. **Local Shader Mode** (0ms latency, 60 FPS on Apple Silicon M-series/WebGPU).  
  2. **Local AI Engine** (Local MPS/MLX SDXL Turbo / LCM at 10-15 FPS).  
  3. **Cloud AI Engine** (Remote TensorRT / StreamDiffusion GPU server at 30+ FPS, sub-150ms latency).  
* **AI Control Pipeline:** Depth / LineArt ControlNet driving SDXL Turbo or Latent Consistency Models (LCM).  
* **Prompt Deck:** Real-time prompt input bar with quick-tap prompt modifier chips.  
* **Frame Interpolation Engine:** WebGL optical flow blending to smooth lower-FPS diffusion outputs up to 60 FPS projection rates.

### **Phase 3: Self-Serve App, Distribution & Commercial Model**

* **Self-Serve Distribution Models:**  
  1. **Cloud SaaS Platform:** Web-hosted browser app available on a **Monthly Subscription** tier (includes cloud GPU streaming hours).  
  2. **Standalone Desktop App (Tauri / Electron):** Installable offline desktop application sold for a **One-Time Purchase Cost**.  
* **Base Kit & Modular Model Packs:**  
  * Standalone app installs with a lightweight Base Kit (Local Shaders \+ Base Vision Models).  
  * Expandable downloadable packages for specialized diffusion models (e.g., *Anime LoRA Pack*, *Cyberpunk SDXL Pack*, *Photoreal LCM Pack*, *Custom Fine-Tunes*).

## **4\. Naming & Positioning Strategy**

* **Brand Name:** **Phuebus** (Pronounced *FEE-bus* — combining *Hue* and *Phoebus*, the god of light).  
* **Strategic Tagline:** *"The Interactive Visual Engine for Live Stage & Events."*  
* **Positioning Statement:For:** DJs, event creators, VJs, and venue operators.  
  **Who Need:** High-impact, interactive visual projections without expensive hardware setups or dedicated visual technicians.  
  **Phuebus Is:** An all-in-one real-time visual engine that transforms any camera feed (phone, GoPro, DSLR, FPV) into an interactive visual show via local shaders or generative AI.