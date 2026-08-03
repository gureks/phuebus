import Peer from 'peerjs';

class VideoIngestion {
  constructor(socket, roomCode, role, onStreamCallback, onDevicesCallback) {
    this.socket = socket;
    this.roomCode = roomCode;
    this.role = role;
    this.onStream = onStreamCallback;
    this.onDevices = onDevicesCallback;

    this.peer = null;
    this.localStream = null;
    this.currentCall = null;
    this.activeCameraId = null;
    this.facingMode = 'environment'; // default to back camera for remote
  }

  /**
   * Initializes PeerJS and Socket.IO peer registration
   */
  async init() {
    const peerConfig = {
      host: window.location.hostname,
      port: window.location.port ? parseInt(window.location.port, 10) : 80,
      path: '/peerjs',
      debug: 1, // log errors
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        sdpSemantics: 'unified-plan'
      }
    };

    // Instantiate PeerJS
    this.peer = new Peer(peerConfig);

    this.peer.on('open', (id) => {
      console.log(`[VideoIngestion] PeerJS opened. My ID: ${id}`);
      this.socket.emit('register_peer', {
        roomCode: this.roomCode,
        peerId: id,
        role: this.role
      });
    });

    this.peer.on('error', (err) => {
      console.error('[VideoIngestion] PeerJS Error:', err);
    });

    if (this.role === 'display') {
      // Display acts as receiver: listen for incoming PeerJS calls
      this.peer.on('call', (call) => {
        console.log('[VideoIngestion] Incoming PeerJS call from:', call.peer);
        call.answer(); // answer without sending local video
        this.handleCall(call);
      });
    }
  }

  /**
   * Enumerate available video input devices (UVC cameras, DS LRs, built-in cameras)
   */
  async enumerateVideoDevices() {
    try {
      // Request permission first to get labels
      await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {});
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      if (this.onDevices) {
        this.onDevices(videoDevices);
      }
      return videoDevices;
    } catch (err) {
      console.error('[VideoIngestion] Failed to enumerate devices:', err);
      return [];
    }
  }

  /**
   * Starts capturing and streaming camera from Remote
   */
  async startRemoteStream(deviceId = null) {
    if (this.role !== 'remote') return;

    this.stopLocalStream();

    const constraints = {
      audio: false,
      video: deviceId 
        ? { deviceId: { exact: deviceId } } 
        : { facingMode: this.facingMode }
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[VideoIngestion] Captured local media stream:', this.localStream);

      if (this.onStream) {
        this.onStream(this.localStream);
      }

      return this.localStream;
    } catch (err) {
      console.error('[VideoIngestion] Failed to capture remote stream:', err);
      throw err;
    }
  }

  /**
   * Starts capturing local UVC input on the Display Host side
   */
  async startDisplayLocalCamera(deviceId) {
    if (this.role !== 'display') return;

    this.stopLocalStream();
    
    // Disconnect any active WebRTC calls if we switch to a local UVC camera
    if (this.currentCall) {
      this.currentCall.close();
      this.currentCall = null;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 }
        }
      });

      if (this.onStream) {
        this.onStream(this.localStream);
      }
      
      this.activeCameraId = deviceId;
      return this.localStream;
    } catch (err) {
      console.error('[VideoIngestion] Failed to open local UVC camera:', err);
      throw err;
    }
  }

  /**
   * Initiates a PeerJS WebRTC call from Remote to Display
   */
  callDisplay(displayPeerId) {
    if (this.role !== 'remote' || !this.localStream || !displayPeerId) return;

    if (this.currentCall) {
      this.currentCall.close();
    }

    console.log(`[VideoIngestion] Calling Display Peer: ${displayPeerId}`);
    const call = this.peer.call(displayPeerId, this.localStream);
    this.handleCall(call);
  }

  /**
   * Handles stream events on active WebRTC media call
   */
  handleCall(call) {
    this.currentCall = call;

    call.on('stream', (remoteStream) => {
      console.log('[VideoIngestion] Received remote stream:', remoteStream);
      if (this.onStream) {
        this.onStream(remoteStream);
      }
    });

    call.on('close', () => {
      console.log('[VideoIngestion] PeerJS call closed');
      this.currentCall = null;
    });

    call.on('error', (err) => {
      console.error('[VideoIngestion] Call error:', err);
      this.currentCall = null;
    });
  }

  /**
   * Flips camera facing mode (front/back) on Remote
   */
  async flipCamera() {
    if (this.role !== 'remote') return;
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    console.log('[VideoIngestion] Toggled camera facing mode to:', this.facingMode);
    return this.startRemoteStream();
  }

  /**
   * Stops local stream tracks
   */
  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Cleans up PeerJS and media streams
   */
  destroy() {
    this.stopLocalStream();
    if (this.currentCall) {
      this.currentCall.close();
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

export default VideoIngestion;
