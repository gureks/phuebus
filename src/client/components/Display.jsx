import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import VideoIngestion from '../engine/VideoIngestion';
import { Card, Button, Spinner } from '@heroui/react';
import { Monitor, Camera, Wifi, Settings, LogOut, VideoOff } from 'lucide-react';

function Display() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomCode = searchParams.get('code')?.toUpperCase().trim() || '----';

  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  const [cameraStatus, setCameraStatus] = useState('waiting');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  
  const [engineMode, setEngineMode] = useState('shader');
  const [fps, setFps] = useState(0);

  const socketRef = useRef(null);
  const ingestionRef = useRef(null);
  
  const renderCanvasRef = useRef(null);
  const monitorVideoRef = useRef(null); // Ref for raw camera stream monitoring preview
  const hiddenVideoRef = useRef(null);  // Hidden video element for Three.js VideoTexture input

  useEffect(() => {
    // Connect to Socket.IO using WebSocket transport
    const socket = io({ transports: ['websocket'] });
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
        // Stream callback: trigger raw preview and setup texture input
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
    socket.on('fps_cap_change', (d) => console.log('[Display] fps_cap:', d));

    // Simulate simple FPS counter (actual FPS counter is hooked into Three.js in Prompt 3)
    let lastTime = performance.now();
    let frameCount = 0;
    let animId;

    const fpsLoop = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(fpsLoop);
    };
    fpsLoop();

    // Clean up
    return () => {
      cancelAnimationFrame(animId);
      socket.disconnect();
      ingestion.destroy();
    };
  }, [roomCode]);

  // Handle local UVC camera selection
  const handleCameraChange = async (e) => {
    const deviceId = e.target.value;
    setSelectedCamera(deviceId);
    if (deviceId === 'webrtc') {
      setCameraStatus('waiting');
      if (monitorVideoRef.current) monitorVideoRef.current.srcObject = null;
      if (hiddenVideoRef.current) hiddenVideoRef.current.srcObject = null;
      ingestionRef.current.stopLocalStream();
    } else if (deviceId) {
      setCameraStatus('loading');
      try {
        await ingestionRef.current.startDisplayLocalCamera(deviceId);
      } catch (err) {
        setCameraStatus('error');
      }
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none">
      
      {/* Target Canvas for WebGL renderer */}
      <canvas ref={renderCanvasRef} className="absolute inset-0 w-full h-full block z-0" />

      {/* Hidden Video element for Three.js texture input */}
      <video ref={hiddenVideoRef} muted playsInline className="hidden" />

      {/* Top HUD Bar */}
      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-background/80 backdrop-blur-md border-b border-border z-10 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-success' : 'bg-danger'}`} />
            <span>{socketStatus}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${cameraStatus === 'live' ? 'bg-success' : cameraStatus === 'loading' ? 'bg-warning animate-pulse' : 'bg-muted-foreground'}`} />
            <span>Camera: {cameraStatus === 'live' ? 'Live' : cameraStatus === 'loading' ? 'Loading' : 'Waiting'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-semibold text-muted-foreground">
            Session Code: <span className="font-mono text-primary font-extrabold tracking-wider">{roomCode}</span>
          </span>
          <span className="bg-muted text-muted-foreground font-mono px-2 py-0.5 rounded uppercase">
            {engineMode}
          </span>
          <span className="font-mono text-foreground">
            {fps} FPS
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="px-2 min-w-0"
            onPress={() => navigate('/')}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      {/* Waiting screen (shown when no camera stream is active) */}
      {cameraStatus === 'waiting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90 z-5 text-center p-6">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground">
            Waiting for camera feed stream...
          </p>
          <div className="text-xs text-muted-foreground max-w-sm">
            Open the <strong className="text-foreground">Remote Control</strong> page on a smartphone or client device and join using code:
            <span className="block font-mono text-xl text-primary font-bold tracking-widest mt-2">{roomCode}</span>
          </div>
        </div>
      )}

      {/* Local UVC Device Selector overlay */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 pointer-events-auto">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
          Camera Ingestion Source
        </label>
        <select
          value={selectedCamera}
          onChange={handleCameraChange}
          className="border border-border text-foreground text-xs rounded-xl px-3 py-2 outline-none focus:border-primary cursor-pointer shadow-lg bg-background"
        >
          <option value="webrtc">📱 WebRTC Phone Camera (Wireless)</option>
          {availableCameras.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              🔌 {device.label || `USB Camera (${device.deviceId.slice(0, 5)})`}
            </option>
          ))}
        </select>
      </div>

      {/* Display Monitor - Raw Camera Feed Preview (Bottom-Right overlay) */}
      <div className="absolute bottom-4 right-4 z-10 w-48 h-32 rounded-2xl overflow-hidden border border-border bg-background shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-3 py-1 bg-muted/60 border-b border-border text-[9px] font-semibold text-muted-foreground">
          <div className="flex items-center gap-1">
            <Camera className="size-3" />
            <span>RAW MONITOR FEED</span>
          </div>
          {cameraStatus === 'live' && <span className="text-[8px] bg-success-soft text-success px-1 rounded animate-pulse">LIVE</span>}
        </div>
        <div className="flex-1 relative flex items-center justify-center bg-black">
          <video
            ref={monitorVideoRef}
            muted
            playsInline
            className={`w-full h-full object-cover ${cameraStatus === 'live' ? 'block' : 'hidden'}`}
          />
          {cameraStatus !== 'live' && (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
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
