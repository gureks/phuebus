// Remote.jsx — Mobile Control Surface
//
// Responsibilities:
// - Room code entry, Socket.IO join, and local camera setup.
// - Overhauled layout with 2x3 preset grid and sliding bottom sheet drawer.
// - Sliders emit debounced/throttled pointer actions back to the host session.
// - Handles bidirectional socket sync (displays updating presets update remote).

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import VideoIngestion from '../engine/VideoIngestion';
import { Button, Card, Input } from '@heroui/react';
import { 
  Smartphone, FlipHorizontal, Camera, VideoOff, LogOut, 
  Check, Maximize2, Minimize2, Sliders, Activity, Sparkles 
} from 'lucide-react';
import { PRESETS, PRESET_MAP } from '../engine/presets';

function Remote() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [joinStatus, setJoinStatus] = useState('');

  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  const [peerStatus, setPeerStatus] = useState('disconnected');
  const [streamActive, setStreamActive] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [logs, setLogs] = useState([]);

  // Remote Tuning Variables
  const [activePresetId, setActivePresetId] = useState('default');
  const [engineMode, setEngineMode] = useState('shader');
  const [fpsCap, setFpsCap] = useState(60);
  const [edgeSensitivity, setEdgeSensitivity] = useState(0.15);
  const [audioHueSensitivity, setAudioHueSensitivity] = useState(1.0);
  const [decay, setDecay] = useState(0.9);
  const [colorSteps, setColorSteps] = useState(5.0);

  // Drawer status
  const [drawerOpen, setDrawerOpen] = useState(false);

  const socketRef = useRef(null);
  const ingestionRef = useRef(null);
  const videoPreviewRef = useRef(null);

  // Helper to add logs to screen for easy on-device debugging
  const addLog = (msg) => {
    console.log(msg);
    setLogs(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // Auto-fill code from URL if present
  useEffect(() => {
    const codeFromUrl = searchParams.get('code')?.toUpperCase().trim();
    if (codeFromUrl) {
      setRoomCode(codeFromUrl);
    }
  }, [searchParams]);

  const joinSession = async () => {
    if (roomCode.length !== 4) {
      setJoinStatus('Enter a 4-character code.');
      return;
    }
    
    setJoinStatus('Connecting...');
    addLog(`Initiating connection for room: ${roomCode}`);

    // Connect Socket.IO
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      addLog('Socket connected successfully');
      setSocketStatus('connected');
      setIsSocketConnected(true);
      socket.emit('join_room', { roomCode });
      
      // Initialize Video Ingestion
      initializeIngestion(socket);
    });

    socket.on('connect_error', (err) => {
      addLog(`Socket connection error: ${err.message}`);
      setJoinStatus(`Connection failed: ${err.message}`);
    });

    socket.on('disconnect', () => {
      addLog('Socket disconnected');
      setSocketStatus('disconnected');
      setIsSocketConnected(false);
    });
  };

  const initializeIngestion = async (socket) => {
    addLog('Initializing Video Ingestion...');
    const ingestion = new VideoIngestion(
      socket,
      roomCode,
      'remote',
      (stream) => {
        addLog('Local camera stream captured');
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.play().catch(e => addLog(`Video play error: ${e.message}`));
        }
        setStreamActive(true);
      },
      (devices) => {
        addLog(`Found ${devices.length} camera(s)`);
        setCameras(devices);
      }
    );
    ingestionRef.current = ingestion;

    try {
      addLog('Starting PeerJS connection...');
      await ingestion.init();
      setPeerStatus('connected');
      addLog('PeerJS opened');
      
      // Check secure context
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('Insecure context! Camera disabled. Use HTTPS.');
        throw new Error('Insecure Context (Requires HTTPS or localhost)');
      }

      addLog('Requesting camera stream...');
      await ingestion.startRemoteStream();
      
      addLog('Enumerating cameras...');
      await ingestion.enumerateVideoDevices();
      
      // Listen to room_state updates
      socket.on('room_state', (state) => {
        addLog(`Room state updated displayPeerId: ${state.displayPeerId}`);
        if (state.displayPeerId) {
          ingestion.callDisplay(state.displayPeerId);
        }
      });

      // Synchronize control state changes from other controllers/display
      socket.on('preset_change', (d) => {
        if (d.presetId) {
          setActivePresetId(d.presetId);
          const preset = PRESET_MAP[d.presetId];
          if (preset) {
            setEdgeSensitivity(preset.edgeSensitivity);
            setAudioHueSensitivity(preset.audioHueSensitivity);
            setDecay(preset.decay);
            setColorSteps(preset.colorSteps);
            setEngineMode(preset.engineMode);
          }
        }
      });

      socket.on('slider_update', (d) => {
        if (d.param && d.value !== undefined) {
          const val = parseFloat(d.value);
          switch (d.param) {
            case 'edgeSensitivity': setEdgeSensitivity(val); break;
            case 'audioHueSensitivity': setAudioHueSensitivity(val); break;
            case 'decay': setDecay(val); break;
            case 'colorSteps': setColorSteps(val); break;
            default: break;
          }
        }
      });

      socket.on('engine_switch', (d) => {
        if (d.mode) setEngineMode(d.mode);
      });

      socket.on('fps_cap_change', (d) => {
        if (d.fps) setFpsCap(d.fps);
      });

      setIsJoined(true);
      addLog('Joined successfully!');
    } catch (err) {
      addLog(`Setup failed: ${err.message}`);
      setJoinStatus(`Failed: ${err.message}`);
      leaveSession();
    }
  };

  const handleCameraChange = async (e) => {
    const deviceId = e.target.value;
    setSelectedCamera(deviceId);
    if (ingestionRef.current) {
      await ingestionRef.current.startRemoteStream(deviceId);
    }
  };

  const flipCamera = async () => {
    if (ingestionRef.current) {
      await ingestionRef.current.flipCamera();
      setSelectedCamera(''); 
    }
  };

  const leaveSession = () => {
    if (socketRef.current) socketRef.current.disconnect();
    if (ingestionRef.current) ingestionRef.current.destroy();
    setIsJoined(false);
    setStreamActive(false);
  };

  const handlePresetSelect = (presetId) => {
    setActivePresetId(presetId);
    const preset = PRESET_MAP[presetId];
    if (preset) {
      setEdgeSensitivity(preset.edgeSensitivity);
      setAudioHueSensitivity(preset.audioHueSensitivity);
      setDecay(preset.decay);
      setColorSteps(preset.colorSteps);
      setEngineMode(preset.engineMode);
    }
    if (socketRef.current) {
      socketRef.current.emit('preset_change', { roomCode, presetId });
    }
  };

  const updateFpsCap = (fps) => {
    setFpsCap(fps);
    if (socketRef.current) {
      socketRef.current.emit('fps_cap_change', { roomCode, fps });
    }
  };

  const updateSlider = (param, value) => {
    const val = parseFloat(value);
    switch (param) {
      case 'edgeSensitivity': setEdgeSensitivity(val); break;
      case 'audioHueSensitivity': setAudioHueSensitivity(val); break;
      case 'decay': setDecay(val); break;
      case 'colorSteps': setColorSteps(val); break;
      default: break;
    }
    if (socketRef.current) {
      socketRef.current.emit('slider_update', { roomCode, param, value: val });
    }
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (ingestionRef.current) ingestionRef.current.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 text-center select-none touch-none overflow-hidden">
      
      {/* ── JOIN SCREEN ──────────────────────────────────────────────────────── */}
      {!isJoined && (
        <div className="max-w-xs w-full flex flex-col gap-6 items-center animate-in">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="size-8 text-primary" />
              Phuebus
            </h1>
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mt-1 block">
              Mobile Remote
            </span>
          </div>

          <div className="w-full flex flex-col gap-4 text-left">
            <div>
              <label htmlFor="code" className="text-xs font-semibold text-zinc-400 uppercase tracking-wide block mb-1">
                Session Code
              </label>
              <Input
                id="code"
                placeholder="XXXX"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                className="w-full font-mono text-xl tracking-widest uppercase text-center bg-zinc-900 border-zinc-800 rounded-2xl"
              />
            </div>
            
            <Button
              color="primary"
              className="w-full font-bold h-12 rounded-2xl mt-2"
              onPress={joinSession}
            >
              Join Session
            </Button>
          </div>

          {joinStatus && <p className="text-xs text-danger font-medium">{joinStatus}</p>}

          {/* On-screen logs for on-device troubleshooting */}
          {logs.length > 0 && (
            <div className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-[10px] font-mono text-zinc-500 mt-4 select-text max-h-36 overflow-y-auto">
              <div className="font-bold text-[9px] uppercase tracking-wider text-zinc-400 mb-1">Debug Output</div>
              {logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap leading-tight">{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN REMOTE CONTROL SURFACE ───────────────────────────────────────── */}
      {isJoined && (
        <div className="flex flex-col w-full h-screen absolute inset-0 bg-zinc-950 animate-in overflow-hidden">
          
          {/* Status bar */}
          <div className="flex items-center justify-between p-3.5 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isSocketConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                <span>Socket</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${peerStatus === 'connected' ? 'bg-success animate-pulse' : 'bg-zinc-700'}`} />
                <span>WebRTC</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-500">Room:</span>
              <span className="font-mono text-primary font-extrabold tracking-wider">{roomCode}</span>
            </div>
          </div>

          {/* Camera preview window */}
          <div className={`relative flex items-center justify-center bg-black overflow-hidden ${
            isFullscreenPreview 
              ? 'fixed inset-0 z-40 w-screen h-screen rounded-none border-none m-0' 
              : 'h-[30%] m-4 rounded-3xl border border-zinc-800'
          }`}>
            <video
              ref={videoPreviewRef}
              muted
              playsInline
              className={`w-full h-full object-cover ${streamActive ? 'block' : 'hidden'}`}
            />

            {!streamActive && (
              <div className="flex flex-col items-center gap-2 text-zinc-600">
                <VideoOff className="size-8 animate-pulse" />
                <span className="text-xs tracking-wider uppercase font-semibold">No Camera Feed</span>
              </div>
            )}

            {/* Quick Actions (camera flip + fullscreen toggle) */}
            {streamActive && (
              <div className="absolute bottom-4 right-4 flex gap-2 z-50">
                <Button
                  size="sm"
                  onPress={flipCamera}
                  className="bg-black/60 hover:bg-zinc-800/80 text-zinc-200 backdrop-blur-md rounded-xl p-2 min-w-0"
                >
                  <FlipHorizontal className="size-4" />
                </Button>
                <Button
                  size="sm"
                  onPress={() => setIsFullscreenPreview(!isFullscreenPreview)}
                  className="bg-black/60 hover:bg-zinc-800/80 text-zinc-200 backdrop-blur-md rounded-xl p-2 min-w-0"
                  aria-label="Toggle Fullscreen Preview"
                >
                  {isFullscreenPreview ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>
              </div>
            )}
          </div>

          {/* 2x3 Preset Grid */}
          <div className="flex-1 px-4 overflow-y-auto pb-14">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block text-left mb-2 pl-1">
              Select Projection Preset
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  size="md"
                  variant={activePresetId === preset.id ? 'solid' : 'flat'}
                  color={activePresetId === preset.id ? 'primary' : 'default'}
                  className="rounded-2xl h-18 font-bold flex flex-col items-center justify-center p-2 text-center transition-all"
                  onPress={() => handlePresetSelect(preset.id)}
                >
                  <span className="text-xl mb-0.5">{preset.icon}</span>
                  <span className="text-[10px] truncate max-w-full font-bold">{preset.name}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Bottom Sheet Drawer */}
          <div 
            className={`fixed bottom-0 left-0 right-0 bg-zinc-900/95 border-t border-zinc-800 rounded-t-3xl transition-transform duration-300 z-50 p-6 flex flex-col gap-4 select-none touch-none ${
              drawerOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'
            }`}
            style={{ height: '55%' }}
          >
            {/* Handle bar */}
            <div 
              className="flex flex-col items-center gap-1 cursor-pointer py-1"
              onPointerDown={() => setDrawerOpen(!drawerOpen)}
            >
              <div className="w-12 h-1.5 bg-zinc-700 rounded-full" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                {drawerOpen ? 'Drag or tap to close parameters' : 'Swipe up for calibration parameters'}
              </span>
            </div>

            {/* Sliders Container (Scrollable) */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-5 pt-3">
              {/* FPS Cap */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">FPS Limiter</span>
                  <span className="text-xs font-mono font-bold text-primary">{fpsCap} FPS</span>
                </div>
                <div className="flex gap-2">
                  {[15, 30, 60].map(fps => (
                    <Button
                      key={fps}
                      size="sm"
                      variant={fpsCap === fps ? 'solid' : 'flat'}
                      color={fpsCap === fps ? 'primary' : 'default'}
                      className="flex-1 rounded-xl font-bold font-mono"
                      onPress={() => updateFpsCap(fps)}
                    >
                      {fps}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Edge Sensitivity */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Edge Sensitivity</span>
                  <span className="text-xs font-mono font-bold text-primary">{edgeSensitivity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.4}
                  step={0.01}
                  value={edgeSensitivity}
                  onChange={(e) => updateSlider('edgeSensitivity', e.target.value)}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Beat Reactivity */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Beat Reactivity</span>
                  <span className="text-xs font-mono font-bold text-primary">{audioHueSensitivity.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={3.0}
                  step={0.1}
                  value={audioHueSensitivity}
                  onChange={(e) => updateSlider('audioHueSensitivity', e.target.value)}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Motion Decay */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Motion Decay</span>
                  <span className="text-xs font-mono font-bold text-primary">{decay.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={0.99}
                  step={0.01}
                  value={decay}
                  onChange={(e) => updateSlider('decay', e.target.value)}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Color Steps */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between">
                  <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Color Steps</span>
                  <span className="text-xs font-mono font-bold text-primary">{colorSteps} Levels</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={16}
                  step={1}
                  value={colorSteps}
                  onChange={(e) => updateSlider('colorSteps', e.target.value)}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Exit/Leave Button */}
              <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 font-mono">PHASE 1 MOBILE CLIENT</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-xs py-1"
                  onPress={leaveSession}
                >
                  <LogOut className="size-3.5 mr-1" />
                  Leave Session
                </Button>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

export default Remote;
