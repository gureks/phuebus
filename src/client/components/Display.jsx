import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import VideoIngestion from '../engine/VideoIngestion';
import { ShaderEngine } from '../engine/ShaderEngine';
import { Card, Button, Spinner, Switch, Slider, Select, Label, ListBox } from '@heroui/react';
import { 
  Monitor, Camera, Wifi, Settings, LogOut, VideoOff, 
  Sliders, Shield, RefreshCw, Layers, SlidersHorizontal, Info, Eye, EyeOff
} from 'lucide-react';

function Display() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get('code')?.toUpperCase().trim() || '----';

  // Network & Camera states
  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('waiting');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('webrtc');
  const [activeStream, setActiveStream] = useState(null);
  
  // Render stats
  const [engineMode, setEngineMode] = useState('shader');
  const [fps, setFps] = useState(0);

  // User Configured Variables (Tuning Panel)
  const [resolutionMode, setResolutionMode] = useState('window');
  const [antialias, setAntialias] = useState(false);
  const [dprCap, setDprCap] = useState(2.0);
  const [aspectMode, setAspectMode] = useState('fit');
  const [maxGain, setMaxGain] = useState(3.0);
  const [lumaSmoothing, setLumaSmoothing] = useState(0.95);

  // Shader Pack States (Phase 1.4 + revised)
  const [activeShader, setActiveShader] = useState('passthrough'); // 'passthrough' | 'toon' | 'neon'
  const [trailsEnabled, setTrailsEnabled] = useState(false);
  const [edgeSensitivity, setEdgeSensitivity] = useState(0.15);
  const [colorSteps, setColorSteps] = useState(5.0);
  const [decay, setDecay] = useState(0.9);
  const [dispersion, setDispersion] = useState(0.002);
  const [glowRadius, setGlowRadius] = useState(0.08); // Neon Sobel threshold
  const [hue, setHue] = useState(0.0); // 0-360 degrees
  const [toonOutlineMode, setToonOutlineMode] = useState(0); // 0 = comic black, 1 = neon glow
  const [audioHueSensitivity, setAudioHueSensitivity] = useState(1.0);
  const [audioDispersionSensitivity, setAudioDispersionSensitivity] = useState(2.0);
  const [motionFlowScale, setMotionFlowScale] = useState(5.0);
  
  // UI controls
  const [sidebarsOpen, setSidebarsOpen] = useState(true);

  // Refs
  const socketRef = useRef(null);
  const ingestionRef = useRef(null);
  const engineRef = useRef(null);
  
  const renderCanvasRef = useRef(null);
  const monitorVideoRef = useRef(null); // Ref for raw camera stream monitoring preview
  const hiddenVideoRef = useRef(null);  // Hidden video element for Three.js VideoTexture input

  // Hook 1: Socket.IO & Video Ingestion (runs once on roomCode mount)
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('Socket: connected');
      setIsSocketConnected(true);
      socket.emit('join_room', { roomCode });
    });

    socket.on('disconnect', () => {
      setSocketStatus('Socket: disconnected');
      setIsSocketConnected(false);
    });

    // Initialize VideoIngestion
    const ingestion = new VideoIngestion(
      socket,
      roomCode,
      'display',
      (stream) => {
        console.log('[Display] Camera stream received:', stream);
        if (monitorVideoRef.current) {
          monitorVideoRef.current.srcObject = stream;
          monitorVideoRef.current.play().catch(e => console.warn(e));
        }
        if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = stream;
          hiddenVideoRef.current.play().catch(e => console.warn(e));
        }
        setCameraStatus('live');
        setActiveStream(stream);
      },
      (devices) => {
        setAvailableCameras(devices);
      }
    );
    ingestionRef.current = ingestion;
    ingestion.init();
    ingestion.enumerateVideoDevices();

    // Listen to control events
    socket.on('room_state', (state) => {
      console.log('[Display] room_state updated:', state);
    });

    socket.on('preset_change', (d) => console.log('[Display] preset_change:', d));
    socket.on('slider_update', (d) => console.log('[Display] slider_update:', d));
    socket.on('engine_switch', (d) => {
      setEngineMode(d.mode ?? 'shader');
    });
    socket.on('prompt_update', (d) => console.log('[Display] prompt_update:', d));
    socket.on('audio_source_change', (d) => console.log('[Display] audio_source:', d));
    socket.on('fps_cap_change', (d) => {
      console.log('[Display] fps_cap:', d);
      if (engineRef.current && d.fps) {
        engineRef.current.setFpsCap(d.fps);
      }
    });

    return () => {
      socket.disconnect();
      ingestion.destroy();
      setActiveStream(null);
    };
  }, [roomCode]);

  // Hook 2: ShaderEngine Context Lifecycle (recreates WebGL context when antialias, resolution or DPR changes)
  useEffect(() => {
    if (!renderCanvasRef.current || !hiddenVideoRef.current || !activeStream) return;

    console.log('[Display] Initializing/Recreating ShaderEngine');
    const engine = new ShaderEngine(
      renderCanvasRef.current,
      hiddenVideoRef.current,
      {
        fpsCap: 60,
        antialias: antialias,
        aspectMode: aspectMode,
        resolutionMode: resolutionMode,
        dprCap: dprCap,
        lumaSmoothing: lumaSmoothing,
        maxGain: maxGain,
        
        // Shader pack init options
        activeShader: activeShader,
        trailsEnabled: trailsEnabled,
        edgeSensitivity: edgeSensitivity,
        colorSteps: colorSteps,
        decay: decay,
        dispersion: dispersion,
        glowRadius: glowRadius,
        hue: hue,
        toonOutlineMode: toonOutlineMode,
        audioHueSensitivity: audioHueSensitivity,
        audioDispersionSensitivity: audioDispersionSensitivity,
        motionFlowScale: motionFlowScale,

        onFpsUpdate: (fpsVal) => {
          setFps(fpsVal);
        }
      }
    );
    engineRef.current = engine;
    
    if (cameraStatus === 'live' && engineMode === 'shader') {
      engine.resume();
    } else {
      engine.pause();
    }

    return () => {
      if (engineRef.current) {
        console.log('[Display] Cleaning up ShaderEngine context');
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [antialias, resolutionMode, dprCap, activeStream]);

  // Hook 3: Propagate lightweight parameters dynamically to active engine
  useEffect(() => {
    if (engineRef.current) engineRef.current.setAspectMode(aspectMode);
  }, [aspectMode]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setMaxGain(maxGain);
  }, [maxGain]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setLumaSmoothing(lumaSmoothing);
  }, [lumaSmoothing]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setActiveShader(activeShader);
  }, [activeShader]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setTrailsEnabled(trailsEnabled);
  }, [trailsEnabled]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setEdgeSensitivity(edgeSensitivity);
  }, [edgeSensitivity]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setColorSteps(colorSteps);
  }, [colorSteps]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setDecay(decay);
  }, [decay]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setDispersion(dispersion);
  }, [dispersion]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setGlowRadius(glowRadius);
  }, [glowRadius]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setHue(hue);
  }, [hue]);

  useEffect(() => {
    if (engineRef.current) {
      if (engineMode === 'shader' && cameraStatus === 'live') {
        engineRef.current.resume();
      } else {
        engineRef.current.pause();
      }
    }
  }, [engineMode, cameraStatus]);

  // Hook 4: Simulated audio energy (stub for Phase 1.5 real AudioAnalyzer)
  // Drives uBass/uMid to test audio-reactive uniforms without mic access
  useEffect(() => {
    let animId = null;
    const tick = (timestamp) => {
      if (engineRef.current) {
        const t = timestamp * 0.001;
        const bassVal = 0.3 + Math.max(0, Math.sin(t * 4.5)) * 0.7;
        const midVal  = 0.2 + Math.max(0, Math.sin(t * 7.0)) * 0.5;
        engineRef.current.setAudioData(bassVal, midVal, 0.0);
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, []);

  // Hook 5: Propagate new revised shader params
  useEffect(() => {
    if (engineRef.current) engineRef.current.setToonOutlineMode(toonOutlineMode);
  }, [toonOutlineMode]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setAudioHueSensitivity(audioHueSensitivity);
  }, [audioHueSensitivity]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setAudioDispersionSensitivity(audioDispersionSensitivity);
  }, [audioDispersionSensitivity]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setMotionFlowScale(motionFlowScale);
  }, [motionFlowScale]);

  // Handle local camera selection via HeroUI Select
  const handleCameraChangeDirect = async (deviceId) => {
    setSelectedCamera(deviceId);
    if (deviceId === 'webrtc') {
      setCameraStatus('waiting');
      if (monitorVideoRef.current) monitorVideoRef.current.srcObject = null;
      if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = null;
      setActiveStream(null);
      ingestionRef.current.stopLocalStream();
      if (engineRef.current) {
        engineRef.current.pause();
      }
    } else if (deviceId) {
      setCameraStatus('loading');
      try {
        const stream = await ingestionRef.current.startDisplayLocalCamera(deviceId);
        setActiveStream(stream);
      } catch (err) {
        setCameraStatus('error');
      }
    }
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      
      {/* ── LEFT SIDEBAR (INGESTION & RENDERER) ────────────────────────────────── */}
      {sidebarsOpen && (
        <div className="w-80 border-r border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-5 flex flex-col gap-6 overflow-y-auto z-10 animate-in fade-in slide-in-from-left-5">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sliders className="size-5 text-primary" />
              Ingestion & Renderer
            </h1>
            <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">Render Engine Settings</p>
          </div>

          {/* Camera Ingestion Card */}
          <Card className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
              <Camera className="size-4 text-zinc-400" />
              Camera Ingestion
            </div>
            
            <div className="space-y-1">
              <Select
                placeholder="Ingestion Source"
                value={selectedCamera}
                onChange={(key) => handleCameraChangeDirect(key)}
              >
                <Select.Trigger className="w-full bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-xs">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-zinc-900 border-zinc-800">
                  <ListBox>
                    <ListBox.Item id="webrtc" textValue="WebRTC Wireless Camera">
                      📱 WebRTC Phone (Wireless)
                    </ListBox.Item>
                    {availableCameras.map((device) => (
                      <ListBox.Item key={device.deviceId} id={device.deviceId} textValue={device.label || 'USB Camera'}>
                        🔌 {device.label || `USB Camera (${device.deviceId.slice(0, 5)})`}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </Card>

          {/* WebGL Resolution & Pipeline Card */}
          <Card className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
              <Layers className="size-4 text-zinc-400" />
              WebGL Output Resolution
            </div>

            {/* Resolution dropdown */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Resolution Mode</Label>
              <Select
                value={resolutionMode}
                onChange={(key) => setResolutionMode(key)}
              >
                <Select.Trigger className="w-full bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-xs">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-zinc-900 border-zinc-800">
                  <ListBox>
                    <ListBox.Item id="window" textValue="Match Window (Fluid)">🖥️ Match Window (Fluid)</ListBox.Item>
                    <ListBox.Item id="1080p" textValue="Fixed 1080p (1920x1080)">📺 Fixed 1080p (1920x1080)</ListBox.Item>
                    <ListBox.Item id="720p" textValue="Fixed 720p (1280x720)">🎬 Fixed 720p (1280x720)</ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            {/* Anti-aliasing toggler */}
            <div className="flex items-center justify-between py-1.5 border-t border-zinc-800">
              <span className="text-[11px] text-zinc-300 font-medium">WebGL Anti-aliasing (MSAA)</span>
              <Switch 
                isSelected={antialias} 
                onChange={setAntialias}
                size="sm"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>

            {/* DPR capping slider */}
            {resolutionMode === 'window' && (
              <div className="space-y-1 border-t border-zinc-800 pt-3">
                <Slider
                  minValue={1.0}
                  maxValue={3.0}
                  step={0.1}
                  value={dprCap}
                  onChange={setDprCap}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">DPR / DPI Capping</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── CENTER DISPLAY PORT (WebGL Canvas) ─────────────────────────────────── */}
      <div className="flex-1 h-full relative flex items-center justify-center bg-black">
        {/* WebGL Target Canvas */}
        <canvas ref={renderCanvasRef} className="w-full h-full block z-0" />

        {/* Hidden video tag for VideoTexture binding */}
        <video ref={hiddenVideoRef} muted playsInline className="hidden" />

        {/* HUD control overlays */}
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          <Button
            size="sm"
            onPress={() => setSidebarsOpen(!sidebarsOpen)}
            className="bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-200 backdrop-blur-md rounded-xl px-3 py-1.5 font-bold shadow-lg min-w-0"
          >
            {sidebarsOpen ? <EyeOff className="size-4 mr-1.5 inline" /> : <Eye className="size-4 mr-1.5 inline" />}
            {sidebarsOpen ? 'Hide Panels' : 'Show Controls'}
          </Button>
        </div>

        {/* Waiting placeholder */}
        {cameraStatus === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/95 z-5 text-center p-6">
            <Spinner size="lg" />
            <p className="text-sm text-zinc-400">
              Waiting for camera feed stream...
            </p>
            <div className="text-xs text-zinc-500 max-w-sm">
              Open the <strong className="text-zinc-200">Remote Control</strong> page on a smartphone or client device and join using code:
              <span className="block font-mono text-2xl text-primary font-bold tracking-widest mt-2">{roomCode}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT SIDEBAR (TUNING & TELEMETRY) ─────────────────────────────────── */}
      {sidebarsOpen && (
        <div className="w-80 border-l border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-5 flex flex-col gap-6 overflow-y-auto z-10 animate-in fade-in slide-in-from-right-5">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-primary" />
              Tuning & Stats
            </h1>
            <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">Live Calibrations</p>
          </div>

          {/* Telemetry card */}
          <Card className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
              <Info className="size-4 text-zinc-400" />
              System Telemetry
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400">
              <div className="bg-zinc-900/50 p-2 rounded-xl border border-zinc-900">
                <span className="text-[8px] text-zinc-500 block">SESSION CODE</span>
                <span className="text-primary font-extrabold text-xs">{roomCode}</span>
              </div>
              <div className="bg-zinc-900/50 p-2 rounded-xl border border-zinc-900">
                <span className="text-[8px] text-zinc-500 block">FRAME RATE</span>
                <span className="text-zinc-100 font-extrabold text-xs">{fps} FPS</span>
              </div>
              <div className="bg-zinc-900/50 p-2 rounded-xl border border-zinc-900">
                <span className="text-[8px] text-zinc-500 block">RENDER SIZE</span>
                <span className="text-zinc-100 font-extrabold text-[10px]">
                  {engineRef.current?.renderer?.domElement?.width || 0}×{engineRef.current?.renderer?.domElement?.height || 0}
                </span>
              </div>
              <div className="bg-zinc-900/50 p-2 rounded-xl border border-zinc-900">
                <span className="text-[8px] text-zinc-500 block">AVG LUMINANCE</span>
                <span className="text-zinc-100 font-extrabold text-xs">
                  {Math.round(engineRef.current?.avgLuma * 100) || 0}%
                </span>
              </div>
            </div>

            {/* Connection and Camera details */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-800 text-[10px]">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Signaling Server:</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${isSocketConnected ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {isSocketConnected ? 'CONNECTED' : 'OFFLINE'}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Camera Stream:</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${cameraStatus === 'live' ? 'bg-success/10 text-success' : 'bg-zinc-800 text-zinc-500'}`}>
                  {cameraStatus.toUpperCase()}
                </span>
              </div>
            </div>
          </Card>

          {/* Active Projection Shader presets Card */}
          <Card className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
              <Layers className="size-4 text-zinc-400" />
              Visual Projection
            </div>
            
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant={activeShader === 'passthrough' ? 'solid' : 'flat'}
                color={activeShader === 'passthrough' ? 'primary' : 'default'}
                className="w-full justify-start rounded-xl font-bold"
                onPress={() => setActiveShader('passthrough')}
              >
                📹 Raw Feed (Passthrough)
              </Button>
              <Button
                size="sm"
                variant={activeShader === 'toon' ? 'solid' : 'flat'}
                color={activeShader === 'toon' ? 'primary' : 'default'}
                className="w-full justify-start rounded-xl font-bold"
                onPress={() => setActiveShader('toon')}
              >
                🎨 Toon Render (Cel-Shaded)
              </Button>
              <Button
                size="sm"
                variant={activeShader === 'neon' ? 'solid' : 'flat'}
                color={activeShader === 'neon' ? 'primary' : 'default'}
                className="w-full justify-start rounded-xl font-bold"
                onPress={() => setActiveShader('neon')}
              >
                ⚡ Neon Aura (Skeletal Glow)
              </Button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-zinc-800 mt-2">
              <span className="text-[11px] text-zinc-300 font-medium">Feedback Trails</span>
              <Switch 
                isSelected={trailsEnabled} 
                onChange={setTrailsEnabled}
                size="sm"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
          </Card>

          {/* Aspect Ratio & Auto-Gain Tuning Card */}
          <Card className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
              <Settings className="size-4 text-zinc-400" />
              Post-Process Calibrations
            </div>

            {/* Aspect Mode select */}
            <div className="space-y-1.5">
              <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Aspect Ratio Mode</Label>
              <Select
                value={aspectMode}
                onChange={(key) => setAspectMode(key)}
              >
                <Select.Trigger className="w-full bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-xs">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-zinc-900 border-zinc-800">
                  <ListBox>
                    <ListBox.Item id="fit" textValue="Fit (Letterbox)">🎥 Fit (Letterbox)</ListBox.Item>
                    <ListBox.Item id="cover" textValue="Cover (Crop & Fill)">✂️ Cover (Crop & Fill)</ListBox.Item>
                    <ListBox.Item id="stretch" textValue="Stretch (Fill)">📐 Stretch (Fill)</ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            {/* Max gain slider */}
            <div className="space-y-1 border-t border-zinc-800 pt-3">
              <Slider
                minValue={1.0}
                maxValue={10.0}
                step={0.5}
                value={maxGain}
                onChange={setMaxGain}
                className="w-full"
              >
                <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Auto-Gain Max Threshold</Label>
                <Slider.Output className="text-xs text-zinc-400 font-mono" />
                <Slider.Track className="bg-zinc-800">
                  <Slider.Fill className="bg-primary" />
                  <Slider.Thumb className="bg-primary" />
                </Slider.Track>
              </Slider>
            </div>

            {/* Luma smoothing slider */}
            <div className="space-y-1 border-t border-zinc-800 pt-3">
              <Slider
                minValue={0.5}
                maxValue={0.99}
                step={0.01}
                value={lumaSmoothing}
                onChange={setLumaSmoothing}
                className="w-full"
              >
                <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Temporal Adaptation Speed</Label>
                <Slider.Output className="text-xs text-zinc-400 font-mono" />
                <Slider.Track className="bg-zinc-800">
                  <Slider.Fill className="bg-primary" />
                  <Slider.Thumb className="bg-primary" />
                </Slider.Track>
              </Slider>
            </div>

            {/* Conditional Toon shader settings */}
            {activeShader === 'toon' && (
              <div className="space-y-3 border-t border-zinc-800 pt-3">
                {/* Outline style toggle */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-zinc-300 font-medium">Neon Outlines</span>
                  <Switch
                    isSelected={toonOutlineMode === 1}
                    onChange={(v) => setToonOutlineMode(v ? 1 : 0)}
                    size="sm"
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>
                <p className="text-[9px] text-zinc-500 -mt-1">{toonOutlineMode === 0 ? 'Comic black multiply outlines' : 'Glowing neon coloured outlines'}</p>

                <Slider
                  minValue={0.02}
                  maxValue={0.4}
                  step={0.01}
                  value={edgeSensitivity}
                  onChange={setEdgeSensitivity}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Edge Sensitivity</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>

                <Slider
                  minValue={2.0}
                  maxValue={16.0}
                  step={1.0}
                  value={colorSteps}
                  onChange={setColorSteps}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Cel Levels</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>

                <Slider
                  minValue={0.0}
                  maxValue={3.0}
                  step={0.1}
                  value={audioHueSensitivity}
                  onChange={setAudioHueSensitivity}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Audio Hue Sensitivity</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>
              </div>
            )}

            {/* Conditional Neon shader settings */}
            {activeShader === 'neon' && (
              <div className="space-y-3 border-t border-zinc-800 pt-3">
                <Slider
                  minValue={0.02}
                  maxValue={0.4}
                  step={0.01}
                  value={glowRadius}
                  onChange={setGlowRadius}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Edge Threshold (Neon)</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>
              </div>
            )}

            {/* Aura/Edge Hue Color settings */}
            {(activeShader === 'toon' || activeShader === 'neon') && (
              <div className="space-y-1 border-t border-zinc-800 pt-3">
                <Slider
                  minValue={0}
                  maxValue={360}
                  step={5}
                  value={hue}
                  onChange={setHue}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Neon Hue Shift</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono">{hue}°</Slider.Output>
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>
              </div>
            )}

            {/* Trails tuning */}
            {trailsEnabled && (
              <div className="space-y-3 border-t border-zinc-800 pt-3">
                <Slider
                  minValue={0.5}
                  maxValue={0.99}
                  step={0.01}
                  value={decay}
                  onChange={setDecay}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Trails Persistence</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>

                <Slider
                  minValue={0.0}
                  maxValue={0.006}
                  step={0.0005}
                  value={dispersion}
                  onChange={setDispersion}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Smoke Dispersion</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>

                <Slider
                  minValue={0.0}
                  maxValue={5.0}
                  step={0.1}
                  value={audioDispersionSensitivity}
                  onChange={setAudioDispersionSensitivity}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Bass Kick Dispersion</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>

                <Slider
                  minValue={0.0}
                  maxValue={20.0}
                  step={0.5}
                  value={motionFlowScale}
                  onChange={setMotionFlowScale}
                  className="w-full"
                >
                  <Label className="text-[10px] text-zinc-400 font-semibold uppercase">Motion Flow Push</Label>
                  <Slider.Output className="text-xs text-zinc-400 font-mono" />
                  <Slider.Track className="bg-zinc-800">
                    <Slider.Fill className="bg-primary" />
                    <Slider.Thumb className="bg-primary" />
                  </Slider.Track>
                </Slider>
              </div>
            )}
          </Card>

          {/* Quick Page Exit */}
          <Button
            size="sm"
            variant="ghost"
            className="w-full rounded-2xl border border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-xs py-2 mt-auto"
            onPress={() => navigate('/')}
          >
            <LogOut className="size-4 mr-2" />
            Exit display mode
          </Button>
        </div>
      )}

      {/* Raw Camera Monitor overlay (stays visible when sidebars are closed, but slides into view) */}
      <div className="absolute bottom-4 right-4 z-20 w-48 h-32 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-b border-zinc-800 text-[9px] font-semibold text-zinc-400">
          <div className="flex items-center gap-1">
            <Camera className="size-3" />
            <span>RAW MONITOR FEED</span>
          </div>
          {cameraStatus === 'live' && <span className="text-[8px] bg-success/20 text-success px-1 rounded animate-pulse">LIVE</span>}
        </div>
        <div className="flex-1 relative flex items-center justify-center bg-black">
          <video
            ref={monitorVideoRef}
            muted
            playsInline
            className={`w-full h-full object-cover ${cameraStatus === 'live' ? 'block' : 'hidden'}`}
          />
          {cameraStatus !== 'live' && (
            <div className="flex flex-col items-center gap-1.5 text-zinc-600">
              <VideoOff className="size-5" />
              <span className="text-[8px] tracking-wide uppercase">No Signal</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default Display;
