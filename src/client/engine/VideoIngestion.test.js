import { describe, it, expect, vi, beforeEach } from 'vitest';
import VideoIngestion from './VideoIngestion';

// Mock PeerJS since it uses native WebRTC APIs
vi.mock('peerjs', () => {
  class MockPeer {
    constructor() {
      this.on = vi.fn((event, cb) => {
        if (event === 'open') {
          cb('mocked-peer-id');
        }
      });
      this.call = vi.fn(() => ({
        on: vi.fn(),
        close: vi.fn()
      }));
      this.destroy = vi.fn();
    }
  }
  return {
    default: MockPeer
  };
});

describe('VideoIngestion class', () => {
  let mockSocket;
  let onStream;
  let onDevices;

  beforeEach(() => {
    mockSocket = {
      emit: vi.fn(),
      on: vi.fn()
    };
    onStream = vi.fn();
    onDevices = vi.fn();
  });

  it('should initialize state correctly', () => {
    const ingestion = new VideoIngestion(
      mockSocket,
      'ABCD',
      'remote',
      onStream,
      onDevices
    );

    expect(ingestion.roomCode).toBe('ABCD');
    expect(ingestion.role).toBe('remote');
    expect(ingestion.facingMode).toBe('environment');
    expect(ingestion.localStream).toBeNull();
  });

  it('should establish PeerJS and register socket details on init', async () => {
    const ingestion = new VideoIngestion(
      mockSocket,
      'TEST',
      'display',
      onStream,
      onDevices
    );

    await ingestion.init();
    
    expect(ingestion.peer).toBeDefined();
    expect(mockSocket.emit).toHaveBeenCalledWith('register_peer', {
      roomCode: 'TEST',
      peerId: 'mocked-peer-id',
      role: 'display'
    });
  });

  it('should cleanly stop local media stream tracks', () => {
    const ingestion = new VideoIngestion(
      mockSocket,
      'TEST',
      'remote',
      onStream,
      onDevices
    );

    const mockTrack = { stop: vi.fn() };
    ingestion.localStream = {
      getTracks: () => [mockTrack]
    };

    ingestion.stopLocalStream();

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(ingestion.localStream).toBeNull();
  });
});
