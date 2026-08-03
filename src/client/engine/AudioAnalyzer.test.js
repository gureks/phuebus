import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioAnalyzer } from './AudioAnalyzer';

// Mock Web Audio API globals
const mockAnalyser = {
  fftSize: 0,
  smoothingTimeConstant: 0,
  frequencyBinCount: 1024,
  getByteFrequencyData: vi.fn((arr) => {
    // Fill with mid-level signal (128/255 ≈ 0.5 normalized)
    arr.fill(128);
  }),
  disconnect: vi.fn(),
  connect: vi.fn()
};

const mockSource = {
  connect: vi.fn(),
  disconnect: vi.fn()
};

const mockAudioContext = {
  state: 'running',
  sampleRate: 44100,
  createAnalyser: vi.fn(() => mockAnalyser),
  createMediaStreamSource: vi.fn(() => mockSource),
  resume: vi.fn(),
  close: vi.fn()
};

const mockStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }])
};

vi.stubGlobal('AudioContext', function MockAudioContext() {
  Object.assign(this, mockAudioContext);
});
vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn(async () => mockStream),
    enumerateDevices: vi.fn(async () => [])
  }
});

describe('AudioAnalyzer class', () => {
  let analyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyser.frequencyBinCount = 1024;
    analyzer = new AudioAnalyzer();
  });

  afterEach(() => {
    analyzer.destroy();
  });

  it('should construct with default state', () => {
    expect(analyzer.audioContext).toBeNull();
    expect(analyzer.stream).toBeNull();
    expect(analyzer.frequencyData).toBeNull();
    expect(analyzer._smoothedBass).toBe(0.0);
  });

  it('should call getUserMedia and build audio chain on setInputDevice()', async () => {
    await analyzer.setInputDevice();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    expect(mockAudioContext.createAnalyser).toHaveBeenCalledOnce();
    expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
    expect(mockSource.connect).toHaveBeenCalledWith(mockAnalyser);
    expect(analyzer.frequencyData).toBeDefined();
  });

  it('should open a device-specific stream when deviceId is passed', async () => {
    await analyzer.setInputDevice('test-device-id');
    const callArg = navigator.mediaDevices.getUserMedia.mock.calls[0][0];
    expect(callArg.audio.deviceId.exact).toBe('test-device-id');
  });

  it('should normalize energy values to [0, 1] range', async () => {
    await analyzer.setInputDevice();

    // getByteFrequencyData fills with 128 → average ≈ 128/255 ≈ 0.502
    analyzer.tick();
    const bass = analyzer.getBassEnergy();
    const mid  = analyzer.getMidEnergy();
    const high = analyzer.getHighEnergy();

    expect(bass).toBeGreaterThan(0);
    expect(bass).toBeLessThanOrEqual(1);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThanOrEqual(1);
    expect(high).toBeGreaterThan(0);
    expect(high).toBeLessThanOrEqual(1);
  });

  it('should detect a beat when bass crosses 1.3x smoothed threshold', async () => {
    await analyzer.setInputDevice();

    // Warm up smoothed bass slowly to ~0.0 by calling tick with quiet data
    mockAnalyser.getByteFrequencyData = vi.fn((arr) => arr.fill(0));
    for (let i = 0; i < 20; i++) {
      analyzer.tick();
      analyzer.getBassEnergy();
    }

    // Now spike to loud signal (255 → 1.0 normalized)
    mockAnalyser.getByteFrequencyData = vi.fn((arr) => arr.fill(255));
    analyzer.tick();

    const beat = analyzer.isBeat();
    expect(beat).toBe(true);
  });

  it('should respect beat cooldown frames', async () => {
    await analyzer.setInputDevice();

    // Spike to trigger first beat
    mockAnalyser.getByteFrequencyData = vi.fn((arr) => arr.fill(255));
    analyzer.tick();
    analyzer.getBassEnergy();
    analyzer.isBeat(); // first beat consumed

    // Immediately call again — should be false (cooldown active)
    const beat = analyzer.isBeat();
    expect(beat).toBe(false);
  });

  it('should return null frequencyArray before initialization', () => {
    expect(analyzer.getFrequencyArray()).toBeNull();
  });

  it('should clean up stream and context on destroy()', async () => {
    await analyzer.setInputDevice();
    analyzer.destroy();

    expect(mockStream.getTracks).toHaveBeenCalled();
    expect(mockAudioContext.close).toHaveBeenCalled();
    expect(analyzer.audioContext).toBeNull();
    expect(analyzer.stream).toBeNull();
  });
});
