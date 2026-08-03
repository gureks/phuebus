import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import VideoIngestion from '../engine/VideoIngestion';
import { Button, Card, Input } from '@heroui/react';
import { Smartphone, FlipHorizontal, Camera, VideoOff, LogOut, Check } from 'lucide-react';

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

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [logs, setLogs] = useState([]);

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

    // Connect Socket.IO with default upgrade path
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
      
      // Check for secure context for getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('Insecure context! Camera disabled. Use HTTPS or chrome://flags.');
        throw new Error('Insecure Context (Requires HTTPS or localhost)');
      }

      addLog('Requesting camera stream...');
      const stream = await ingestion.startRemoteStream();
      
      addLog('Enumerating cameras...');
      await ingestion.enumerateVideoDevices();
      
      // Listen to room_state updates. When a display peer ID appears, dial it!
      socket.on('room_state', (state) => {
        addLog(`Room state updated displayPeerId: ${state.displayPeerId}`);
        if (state.displayPeerId) {
          ingestion.callDisplay(state.displayPeerId);
        }
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

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (ingestionRef.current) ingestionRef.current.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-sans p-6 text-center select-none touch-none">
      
      {/* ── JOIN SCREEN ──────────────────────────────────────────────────────── */}
      {!isJoined && (
        <div className="max-w-xs w-full flex flex-col gap-6 items-center animate-in">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Phuebus
            </h1>
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mt-1 block">
              Mobile Remote
            </span>
          </div>

          <div className="w-full flex flex-col gap-4 text-left">
            <div>
              <label htmlFor="code" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Session Code
              </label>
              <Input
                id="code"
                placeholder="XXXX"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                className="w-full font-mono text-xl tracking-widest uppercase border-border text-center"
              />
            </div>
            
            <Button
              variant="primary"
              className="w-full font-bold h-12 rounded-2xl mt-2"
              onPress={joinSession}
            >
              Join Session
            </Button>
          </div>

          {joinStatus && <p className="text-xs text-danger font-medium">{joinStatus}</p>}

          {/* On-screen logs for on-device troubleshooting */}
          {logs.length > 0 && (
            <div className="w-full text-left bg-muted border border-border rounded-xl p-3 text-[10px] font-mono text-muted-foreground mt-4 select-text max-h-36 overflow-y-auto">
              <div className="font-bold text-[9px] uppercase tracking-wider text-foreground mb-1">Debug Output</div>
              {logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap leading-tight">{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN REMOTE CONTROL SURFACE ───────────────────────────────────────── */}
      {isJoined && (
        <div className="flex flex-col w-full h-screen absolute inset-0 bg-background animate-in">
          
          {/* Status bar */}
          <div className="flex items-center justify-between p-3.5 bg-muted border-b border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isSocketConnected ? 'bg-success' : 'bg-danger'}`} />
                <span>Socket</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${peerStatus === 'connected' ? 'bg-success' : 'bg-muted-foreground'}`} />
                <span>Peer</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-muted-foreground">Code:</span>
              <span className="font-mono text-primary font-extrabold tracking-wider">{roomCode}</span>
            </div>
          </div>

          {/* Camera preview window */}
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden m-4 rounded-3xl border border-border">
            <video
              ref={videoPreviewRef}
              muted
              playsInline
              className={`w-full h-full object-cover ${streamActive ? 'block' : 'hidden'}`}
            />

            {!streamActive && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <VideoOff className="size-8" />
                <span className="text-xs tracking-wider uppercase font-semibold">No Camera Stream</span>
              </div>
            )}

            {/* Quick Actions (camera flip) */}
            {streamActive && (
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  size="sm"
                  onPress={flipCamera}
                  className="bg-black/60 hover:bg-black/80 text-zinc-200 backdrop-blur-md rounded-xl p-2 min-w-0"
                >
                  <FlipHorizontal className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Bottom control panel */}
          <Card className="mx-4 mb-4 rounded-3xl p-5 flex flex-col gap-4">
            
            {/* Camera switcher */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
                Select Camera Source
              </label>
              <select
                value={selectedCamera}
                onChange={handleCameraChange}
                className="bg-background border border-border text-foreground text-xs rounded-xl px-3 py-2.5 outline-none focus:border-primary cursor-pointer w-full"
              >
                <option value="">⚙️ Auto Camera ({ingestionRef.current?.facingMode} mode)</option>
                {cameras.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    📷 {device.label || `Camera (${device.deviceId.slice(0, 5)})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Info */}
            <div className="flex items-center justify-between py-2 border-t border-border text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <Smartphone className="size-3.5" />
                <span>PHASE 1 ACTIVE</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl"
                onPress={leaveSession}
              >
                <LogOut className="size-3.5 mr-1" />
                Leave
              </Button>
            </div>

          </Card>

        </div>
      )}

    </div>
  );
}

export default Remote;
