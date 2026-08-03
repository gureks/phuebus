import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import VideoIngestion from '../engine/VideoIngestion';
import { ShaderEngine } from '../engine/ShaderEngine';
import { AudioAnalyzer } from '../engine/AudioAnalyzer';
import { PoseTracker } from '../engine/PoseTracker';
import { EngineRouter } from '../engine/EngineRouter';
import { DiffusionEngine } from '../engine/DiffusionEngine';
import { PRESETS, PRESET_MAP } from '../engine/presets';
import { Recorder } from '../engine/Recorder';
import QRCode from 'qrcode';
import { Card, Button, Spinner, Switch, Slider, Select, Label, ListBox } from '@heroui/react';
import { 
  Monitor, Camera, Wifi, Settings, LogOut, VideoOff, 
  Sliders, Shield, RefreshCw, Layers, SlidersHorizontal, Info, Eye, EyeOff,
  Mic, Activity
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
  
  // Audio & Pose states (Phase 1.5 + 1.6)
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState(null);
  const [audioActive, setAudioActive] = useState(false);
  const [poseTrackingEnabled, setPoseTrackingEnabled] = useState(false);

  // Presets, QR, HUD, and Recorder states (Phase 1.7 - 1.9)
  const [activePresetId, setActivePresetId] = useState('default');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [hudVisible, setHudVisible] = useState(true);
  const [recordingActive, setRecordingActive] = useState(false);

  // UI controls
  const [sidebarsOpen, setSidebarsOpen] = useState(true);

  // Refs
  const socketRef = useRef(null);
  const ingestionRef = useRef(null);
  const engineRef = useRef(null);
  const audioAnalyzerRef = useRef(null);
  const poseTrackerRef = useRef(null);
  const routerRef = useRef(null);
  const diffusionEngineRef = useRef(null);
  const recorderRef = useRef(null);
  
  const renderCanvasRef = useRef(null);
  const monitorVideoRef = useRef(null); // Ref for raw camera stream monitoring preview
  const hiddenVideoRef = useRef(null);  // Hidden video element for Three.js VideoTexture input

  const applyPresetById = (presetId, emitToSocket = true) => {
    const preset = PRESET_MAP[presetId];
    if (!preset) return;

    setActivePresetId(presetId);
    
    // Apply parameters to React state (so UI sliders/switches reflect it)
    setActiveShader(preset.activeShader);
    setTrailsEnabled(preset.trailsEnabled);
    setEdgeSensitivity(preset.edgeSensitivity);
    setColorSteps(preset.colorSteps);
    setDecay(preset.decay);
    setDispersion(preset.dispersion);
    setGlowRadius(preset.glowRadius);
    setHue(preset.hue);
    setToonOutlineMode(preset.toonOutlineMode);
    setAudioHueSensitivity(preset.audioHueSensitivity);
    setAudioDispersionSensitivity(preset.audioDispersionSensitivity);
    setMotionFlowScale(preset.motionFlowScale);
    setEngineMode(preset.engineMode);

    // Apply to EngineRouter
    if (routerRef.current) {
      routerRef.current.applyPreset(preset);
    }

    if (emitToSocket && socketRef.current) {
      socketRef.current.emit('preset_change', { roomCode, presetId });
    }
  };

  const startRecording = () => {
    if (!renderCanvasRef.current) return;
    const rec = new Recorder(renderCanvasRef.current, 60);
    recorderRef.current = rec;
    rec.start();
    setRecordingActive(true);
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
      setRecordingActive(false);
    }
  };

  // Mouse move event for HUD visibility auto-hide
  useEffect(() => {
    let timeoutId;
    const handleMouseMove = () => {
      setHudVisible(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setHudVisible(false);
      }, 4000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, []);

  // Fetch session local IP / roomCode and generate QR code
  useEffect(() => {
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        const targetUrl = data.remoteUrl || `${window.location.origin}/remote?code=${roomCode}`;
        QRCode.toDataURL(targetUrl, { width: 200, margin: 2 })
          .then(url => setQrCodeUrl(url))
          .catch(err => console.error('[Display] QR code gen error:', err));
      })
      .catch(err => {
        console.error('[Display] Failed to fetch session info:', err);
        const fallbackUrl = `${window.location.origin}/remote?code=${roomCode}`;
        QRCode.toDataURL(fallbackUrl, { width: 200, margin: 2 })
          .then(url => setQrCodeUrl(url))
          .catch(e => console.error(e));
      });
  }, [roomCode]);

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

    socket.on('preset_change', (d) => {
      console.log('[Display] preset_change:', d);
      if (d.presetId) {
        applyPresetById(d.presetId, false);
      }
    });

    socket.on('slider_update', (d) => {
      console.log('[Display] slider_update:', d);
      if (d.param && d.value !== undefined) {
        const val = parseFloat(d.value);
        switch (d.param) {
          case 'edgeSensitivity': setEdgeSensitivity(val); break;
          case 'colorSteps': setColorSteps(val); break;
          case 'decay': setDecay(val); break;
          case 'dispersion': setDispersion(val); break;
          case 'glowRadius': setGlowRadius(val); break;
          case 'hue': setHue(val); break;
          case 'toonOutlineMode': setToonOutlineMode(val); break;
          case 'audioHueSensitivity': setAudioHueSensitivity(val); break;
          case 'audioDispersionSensitivity': setAudioDispersionSensitivity(val); break;
          case 'motionFlowScale': setMotionFlowScale(val); break;
          default: break;
        }
      }
    });

    socket.on('engine_switch', (d) => {
      console.log('[Display] engine_switch:', d);
      if (d.mode) {
        routerRef.current?.switchTo(d.mode);
        setEngineMode(d.mode);
      }
    });

    socket.on('prompt_update', (d) => console.log('[Display] prompt_update:', d));
    socket.on('audio_source_change', (d) => {
      console.log('[Display] audio_source:', d);
      if (d.deviceId) {
        setSelectedAudioDevice(d.deviceId);
      }
    });

    socket.on('fps_cap_change', (d) => {
      console.log('[Display] fps_cap:', d);
      if (d.fps) {
        routerRef.current?.setFpsCap(d.fps);
      }
    });

    return () => {
      socket.disconnect();
      ingestion.destroy();
      setActiveStream(null);
      // Enumerate audio inputs for the audio device selector
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      }).catch(() => {});
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
    
    const diffEngine = new DiffusionEngine();
    diffusionEngineRef.current = diffEngine;

    const router = new EngineRouter(engine, diffEngine, (newMode) => {
      setEngineMode(newMode);
    });
    routerRef.current = router;

    if (cameraStatus === 'live') {
      router.resume();
      router.switchTo(engineMode);
    } else {
      router.pause();
    }

    return () => {
      if (routerRef.current) {
        console.log('[Display] Cleaning up EngineRouter');
        routerRef.current.destroy();
        routerRef.current = null;
      }
      if (diffusionEngineRef.current) {
        diffusionEngineRef.current.destroy();
        diffusionEngineRef.current = null;
      }
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
    if (routerRef.current) {
      if (cameraStatus === 'live') {
        routerRef.current.resume();
        routerRef.current.switchTo(engineMode);
      } else {
        routerRef.current.pause();
      }
    }
  }, [engineMode, cameraStatus]);

  // Hook 4: Real AudioAnalyzer feeding ShaderEngine uniforms each rAF
  // Falls back gracefully when no device is selected yet
  useEffect(() => {
    // Instantiate once
    const analyzer = new AudioAnalyzer();
    audioAnalyzerRef.current = analyzer;

    let animId = null;

    const tick = (timestamp) => {
      analyzer.tick();
      if (routerRef.current) {
        routerRef.current.setAudioData(
          analyzer.getBassEnergy(),
          analyzer.getMidEnergy(),
          analyzer.getHighEnergy()
        );
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      analyzer.destroy();
      audioAnalyzerRef.current = null;
    };
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

  // Hook 6: Audio device selection → open getUserMedia on the chosen device
  useEffect(() => {
    if (!selectedAudioDevice || !audioAnalyzerRef.current) return;
    audioAnalyzerRef.current.setInputDevice(selectedAudioDevice)
      .then(() => setAudioActive(true))
      .catch((err) => {
        console.warn('[Display] Audio device open failed:', err);
        setAudioActive(false);
      });
  }, [selectedAudioDevice]);

  // Hook 7: PoseTracker lifecycle — init when enabled, destroy when disabled
  useEffect(() => {
    if (poseTrackingEnabled) {
      const tracker = new PoseTracker();
      poseTrackerRef.current = tracker;

      tracker.init().then(() => {
        console.log('[Display] PoseTracker ready');
      });

      let animId = null;
      const poseLoop = (timestamp) => {
        if (poseTrackerRef.current?.isInitialized && hiddenVideoRef.current && routerRef.current) {
          const t0 = performance.now();
          const landmarks = poseTrackerRef.current.detectFrame(hiddenVideoRef.current, timestamp);
          const elapsed = performance.now() - t0;
          if (elapsed > 8) {
            console.warn(`[PoseTracker] detectFrame took ${elapsed.toFixed(1)}ms (budget: 8ms)`);
          }
          routerRef.current.setLandmarks(landmarks);
        }
        animId = requestAnimationFrame(poseLoop);
      };
      animId = requestAnimationFrame(poseLoop);

      return () => {
        if (animId) cancelAnimationFrame(animId);
        tracker.destroy();
        poseTrackerRef.current = null;
        if (routerRef.current) routerRef.current.setLandmarks(null);
      };
    } else {
      if (routerRef.current) routerRef.current.setLandmarks(null);
    }
  }, [poseTrackingEnabled]);

  // Handle local camera selection via HeroUI Select
  const handleCameraChangeDirect = async (deviceId) => {
    setSelectedCamera(deviceId);
    if (deviceId === 'webrtc') {
      setCameraStatus('waiting');
      if (monitorVideoRef.current) monitorVideoRef.current.srcObject = null;
      if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = null;
      setActiveStream(null);
      ingestionRef.current.stopLocalStream();
      if (routerRef.current) {
        routerRef.current.pause();
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

          {/* Audio Input Card */}
          <Card className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
              <Mic className="size-4 text-zinc-400" />
              Audio Input
              {audioActive && <span className="ml-auto text-[8px] bg-success/20 text-success px-1.5 py-0.5 rounded animate-pulse font-semibold">LIVE</span>}
            </div>

            <div className="space-y-1">
              <Select
                placeholder="Select microphone / line-in"
                value={selectedAudioDevice ?? ''}
                onChange={(key) => setSelectedAudioDevice(key || null)}
              >
                <Select.Trigger className="w-full bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-xs">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-zinc-900 border-zinc-800">
                  <ListBox>
                    {audioDevices.length === 0 && (
                      <ListBox.Item id="" textValue="No audio devices found">
                        🎤 No audio devices found
                      </ListBox.Item>
                    )}
                    {audioDevices.map((device) => (
                      <ListBox.Item key={device.deviceId} id={device.deviceId} textValue={device.label || 'Microphone'}>
                        🎤 {device.label || `Microphone (${device.deviceId.slice(0, 6)})`}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <p className="text-[9px] text-zinc-500">Audio is analyzed locally — no cloud processing</p>
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

          {/* Canvas Recording Card */}
          <Card className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
              <Camera className="size-4 text-zinc-400" />
              Canvas Recorder
              {recordingActive && <span className="ml-auto text-[8px] bg-danger/20 text-danger px-1.5 py-0.5 rounded animate-pulse font-semibold">REC</span>}
            </div>

            <div className="flex flex-col gap-2">
              {!recordingActive ? (
                <Button
                  size="sm"
                  color="primary"
                  className="rounded-xl font-bold"
                  onPress={startRecording}
                  disabled={cameraStatus !== 'live'}
                >
                  🔴 Start Recording
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="danger"
                  className="rounded-xl font-bold"
                  onPress={stopRecording}
                >
                  ⬛ Stop & Save Video
                </Button>
              )}
              <p className="text-[9px] text-zinc-500 text-center">Downloads standard high-quality WebM video</p>
            </div>
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

        {/* HUD Overlay */}
        {hudVisible && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-zinc-900/85 border border-zinc-800 text-zinc-200 backdrop-blur-md rounded-2xl px-5 py-2 font-mono text-xs shadow-2xl transition-all duration-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="font-extrabold uppercase text-zinc-100">{PRESET_MAP[activePresetId]?.name || 'Custom'}</span>
            </div>
            <div className="h-4 w-[1px] bg-zinc-800" />
            <div>
              <span>MODE: </span>
              <span className="font-bold text-primary uppercase">{engineMode}</span>
            </div>
            <div className="h-4 w-[1px] bg-zinc-800" />
            <div>
              <span>{fps} FPS</span>
            </div>
            <div className="h-4 w-[1px] bg-zinc-800" />
            <div>
              <span>AUDIO: {audioActive ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        )}

        {/* Waiting placeholder */}
        {cameraStatus === 'waiting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/95 z-5 text-center p-6">
            <Spinner size="lg" />
            <p className="text-sm text-zinc-400">
              Waiting for camera feed stream...
            </p>
            <div className="text-xs text-zinc-500 max-w-sm flex flex-col items-center gap-3">
              <span>Open the <strong className="text-zinc-200">Remote Control</strong> page on a smartphone or client device:</span>
              {qrCodeUrl ? (
                <div className="bg-white p-2 rounded-xl shadow-lg">
                  <img src={qrCodeUrl} alt="Session Join QR Code" className="w-40 h-40" />
                </div>
              ) : (
                <Spinner size="sm" />
              )}
              <span className="text-[10px] text-zinc-600">Scan QR or join manually using code:</span>
              <span className="block font-mono text-2xl text-primary font-bold tracking-widest">{roomCode}</span>
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
            
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  size="sm"
                  variant={activePresetId === preset.id ? 'solid' : 'flat'}
                  color={activePresetId === preset.id ? 'primary' : 'default'}
                  className="rounded-xl font-bold flex flex-col items-center justify-center p-2 h-16 text-center min-w-0"
                  onPress={() => applyPresetById(preset.id)}
                >
                  <span className="text-lg mb-0.5">{preset.icon}</span>
                  <span className="text-[9px] truncate max-w-full tracking-tight">{preset.name}</span>
                </Button>
              ))}
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

          {/* Pose Tracking Card */}
          <Card className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-xs uppercase tracking-wider">
              <Activity className="size-4 text-zinc-400" />
              Pose Tracking
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-zinc-300 font-medium">Enable MediaPipe</span>
              <Switch
                isSelected={poseTrackingEnabled}
                onChange={setPoseTrackingEnabled}
                size="sm"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>
            <p className="text-[9px] text-zinc-500 -mt-1">
              {poseTrackingEnabled
                ? 'Skeleton landmarks fed to NeonAura shader in real-time'
                : 'Disabled — NeonAura uses edge convolution only (better perf)'}
            </p>
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
