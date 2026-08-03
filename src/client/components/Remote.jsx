import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import VideoIngestion from '../engine/VideoIngestion';
import { Button, Card, Input } from '@heroui/react';
import { Smartphone, FlipHorizontal, Camera, VideoOff, Settings, LogOut, Check, Wifi } from 'lucide-react';

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

  const socketRef = useRef(null);
  const ingestionRef = useRef(null);
  const videoPreviewRef = useRef(null);

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

    // Connect Socket.IO
    const socket = io({ transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketStatus('connected');
      setIsSocketConnected(true);
      socket.emit('join_room', { roomCode });
      
      // Initialize Video Ingestion
      initializeIngestion(socket);
    });

    socket.on('disconnect', () => {
      setSocketStatus('disconnected');
      setIsSocketConnected(false);
    });
  };

  const initializeIngestion = async (socket) => {
    const ingestion = new VideoIngestion(
      socket,
      roomCode,
      'remote',
      (stream) => {
        // Local stream captured: play in preview
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.play().catch(e => console.warn(e));
        }
        setStreamActive(true);
      },
      (devices) => {
        setCameras(devices);
      }
    );
    ingestionRef.current = ingestion;

    try {
      await ingestion.init();
      setPeerStatus('connected');
      
      // Capture default stream
      const stream = await ingestion.startRemoteStream();
      
      // Enumerate cameras for switcher dropdown
      await ingestion.enumerateVideoDevices();
      
      // Listen to room_state updates. When a display peer ID appears, dial it!
      socket.on('room_state', (state) => {
        console.log('[Remote] Room state updated:', state);
        if (state.displayPeerId) {
          ingestion.callDisplay(state.displayPeerId);
        }
      });

      setIsJoined(true);
    } catch (err) {
      console.error('[Remote] Failed to setup camera ingestion:', err);
      setJoinStatus('Failed to access camera.');
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
      setSelectedCamera(''); // Clear active device selection to show it uses facingMode
    }
  };

  const leaveSession = () => {
    if (socketRef.current) socketRef.current.disconnect();
    if (ingestionRef.current) ingestionRef.current.destroy();
    setIsJoined(false);
    setStreamActive(false);
    setJoinStatus('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (ingestionRef.current) ingestionRef.current.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 font-sans p-6 text-center select-none touch-none">
      
      {/* ── JOIN SCREEN ──────────────────────────────────────────────────────── */}
      {!isJoined && (
        <div className="max-w-xs w-full flex flex-col gap-6 items-center animate-in">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 to-violet-400 bg-clip-text text-transparent">
              Phuebus
            </h1>
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mt-1 block">
              Mobile Remote
            </span>
          </div>

          <div className="w-full flex flex-col gap-4 text-left">
            <div>
              <label htmlFor="code" className="text-xs font-semibold text-zinc-500 uppercase tracking-wide block mb-1">
                Session Code
              </label>
              <Input
                id="code"
                placeholder="XXXX"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                className="w-full font-mono text-xl tracking-widest uppercase border-zinc-800 focus-within:border-pink-500 text-center"
              />
            </div>
            
            <Button
              className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold h-12 rounded-2xl shadow-lg glow-pink mt-2"
              onPress={joinSession}
            >
              Join Session
            </Button>
          </div>

          {joinStatus && <p className="text-xs text-red-400 font-medium">{joinStatus}</p>}
        </div>
      )}

      {/* ── MAIN REMOTE CONTROL SURFACE ───────────────────────────────────────── */}
      {isJoined && (
        <div className="flex flex-col w-full h-screen absolute inset-0 bg-zinc-950 animate-in">
          
          {/* Status bar */}
          <div className="flex items-center justify-between p-3.5 bg-zinc-900 border-b border-zinc-800/80 text-xs text-zinc-400">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isSocketConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span>Socket</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${peerStatus === 'connected' ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                <span>Peer</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-500">Code:</span>
              <span className="font-mono text-pink-400 font-extrabold tracking-wider">{roomCode}</span>
            </div>
          </div>

          {/* Camera preview window */}
          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden m-4 rounded-3xl border border-zinc-800">
            <video
              ref={videoPreviewRef}
              muted
              playsInline
              className={`w-full h-full object-cover ${streamActive ? 'block' : 'hidden'}`}
            />

            {!streamActive && (
              <div className="flex flex-col items-center gap-2 text-zinc-600">
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
          <Card className="mx-4 mb-4 bg-zinc-900 border-zinc-800/80 rounded-3xl p-5 flex flex-col gap-4">
            
            {/* Camera switcher */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">
                Select Camera Source
              </label>
              <select
                value={selectedCamera}
                onChange={handleCameraChange}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-pink-500 cursor-pointer w-full"
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
            <div className="flex items-center justify-between py-2 border-t border-zinc-800 text-[11px] text-zinc-500">
              <div className="flex items-center gap-1">
                <Smartphone className="size-3.5 text-zinc-400" />
                <span>PHASE 1 ACTIVE</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded-xl"
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
