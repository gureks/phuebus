import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Recorder } from './Recorder';

describe('Recorder class', () => {
  let mockCanvas;
  let mockStream;
  let mockMediaRecorderInstance;
  let mockURL;
  let mediaRecorderSpy;
  let activeInstance;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStream = {
      getVideoTracks: vi.fn(() => []),
    };

    mockCanvas = {
      captureStream: vi.fn(() => mockStream),
    };

    mockMediaRecorderInstance = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null,
      onstop: null,
    };

    activeInstance = null;
    mediaRecorderSpy = vi.fn(function MockMediaRecorder() {
      Object.assign(this, mockMediaRecorderInstance);
      activeInstance = this;
    });

    // Mock globals
    vi.stubGlobal('MediaRecorder', mediaRecorderSpy);
    MediaRecorder.isTypeSupported = vi.fn(() => true);

    mockURL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    };
    vi.stubGlobal('URL', mockURL);

    // Mock document
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        href: '',
        download: '',
        click: vi.fn(),
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should construct with defaults', () => {
    const recorder = new Recorder(mockCanvas, 30);
    expect(recorder.canvas).toBe(mockCanvas);
    expect(recorder.fps).toBe(30);
    expect(recorder.isRecording).toBe(false);
  });

  it('should start recording successfully', () => {
    const recorder = new Recorder(mockCanvas, 60);
    recorder.start();

    expect(mockCanvas.captureStream).toHaveBeenCalledWith(60);
    expect(mediaRecorderSpy).toHaveBeenCalledWith(mockStream, { mimeType: 'video/webm;codecs=vp9' });
    expect(mockMediaRecorderInstance.start).toHaveBeenCalledWith(1000);
    expect(recorder.isRecording).toBe(true);
  });

  it('should ignore start() if already recording', () => {
    const recorder = new Recorder(mockCanvas);
    recorder.start();
    vi.clearAllMocks();
    recorder.start();

    expect(mockCanvas.captureStream).not.toHaveBeenCalled();
    expect(recorder.isRecording).toBe(true);
  });

  it('should stop recording and trigger file download', () => {
    const recorder = new Recorder(mockCanvas);
    recorder.start();
    
    // Simulate data chunk
    activeInstance.ondataavailable({ data: { size: 100 } });

    recorder.stop();
    expect(mockMediaRecorderInstance.stop).toHaveBeenCalled();
    expect(recorder.isRecording).toBe(false);

    // Trigger stop callback
    activeInstance.onstop();
    expect(mockURL.createObjectURL).toHaveBeenCalled();
    expect(mockURL.revokeObjectURL).toHaveBeenCalled();
  });

  it('should ignore stop() if not recording', () => {
    const recorder = new Recorder(mockCanvas);
    recorder.stop();
    expect(mockMediaRecorderInstance.stop).not.toHaveBeenCalled();
  });
});
