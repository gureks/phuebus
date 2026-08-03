import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiffusionEngine } from './DiffusionEngine';

describe('DiffusionEngine class', () => {
  let mockWebSocketInstance;
  let mockWebSocketSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWebSocketInstance = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    mockWebSocketSpy = vi.fn(function MockWebSocket(url) {
      Object.assign(this, mockWebSocketInstance);
      this.addEventListener = (event, cb) => mockWebSocketInstance.addEventListener(event, cb);
      this.removeEventListener = (event, cb) => mockWebSocketInstance.removeEventListener(event, cb);
      setTimeout(() => {
        if (this.onopen) this.onopen();
      }, 0);
    });
    mockWebSocketSpy.OPEN = 1;
    mockWebSocketSpy.CLOSED = 3;

    vi.stubGlobal('WebSocket', mockWebSocketSpy);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 100 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize and connect with default local URL', async () => {
    const engine = new DiffusionEngine();
    await new Promise(r => setTimeout(r, 10)); // wait for socket connection
    expect(mockWebSocketSpy).toHaveBeenCalledWith('ws://localhost:8080/ws/generate');
    expect(engine.isReady()).toBe(true);
    engine.destroy();
  });

  it('should handle setMode with cloud URL correctly', async () => {
    const engine = new DiffusionEngine();
    engine.setMode('cloud', 'ws://remote-server:9000/ws');
    expect(mockWebSocketSpy).toHaveBeenLastCalledWith('ws://remote-server:9000/ws');
    engine.destroy();
  });

  it('should send configs and frame blobs on generate()', async () => {
    const engine = new DiffusionEngine();
    await new Promise(r => setTimeout(r, 10)); // wait for connect

    // Setup active message listener simulation
    let onMessageCallback;
    mockWebSocketInstance.addEventListener = vi.fn((event, cb) => {
      if (event === 'message') onMessageCallback = cb;
    });

    const mockBlob = new Blob(['dummy-jpeg'], { type: 'image/jpeg' });
    const genPromise = engine.generate(mockBlob, 'anime style', 0.5);

    // Verify it sent prompt configs and frame blob
    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(JSON.stringify({ prompt: 'anime style', strength: 0.5 }));
    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(mockBlob);

    // Simulate response back
    onMessageCallback({ data: new Blob(['dummy-styled-jpeg'], { type: 'image/jpeg' }) });

    const result = await genPromise;
    expect(result).toEqual({ width: 100, height: 100 });
    engine.destroy();
  });
});
