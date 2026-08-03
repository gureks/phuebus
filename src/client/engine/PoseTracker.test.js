import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoseTracker } from './PoseTracker';

// Mock @mediapipe/tasks-vision dynamic import
const mockLandmarker = {
  detectForVideo: vi.fn(),
  close: vi.fn()
};

const mockPoseLandmarker = {
  createFromOptions: vi.fn(async () => mockLandmarker)
};

const mockFilesetResolver = {
  forVisionTasks: vi.fn(async () => 'mock-vision-fileset')
};

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: mockFilesetResolver,
  PoseLandmarker: mockPoseLandmarker
}));

describe('PoseTracker class', () => {
  let tracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new PoseTracker();
  });

  it('should construct in uninitialized state', () => {
    expect(tracker.isInitialized).toBe(false);
    expect(tracker.landmarker).toBeNull();
  });

  it('should initialize PoseLandmarker via FilesetResolver', async () => {
    await tracker.init();

    expect(mockFilesetResolver.forVisionTasks).toHaveBeenCalledOnce();
    expect(mockPoseLandmarker.createFromOptions).toHaveBeenCalledOnce();
    expect(tracker.isInitialized).toBe(true);
    expect(tracker.landmarker).toBe(mockLandmarker);
  });

  it('should set isInitialized = false and not throw when init() fails', async () => {
    mockFilesetResolver.forVisionTasks.mockRejectedValueOnce(new Error('CDN timeout'));
    await tracker.init(); // must not throw
    expect(tracker.isInitialized).toBe(false);
  });

  it('should return null when not initialized', () => {
    const result = tracker.detectFrame({}, 100);
    expect(result).toBeNull();
  });

  it('should return null for unready video element', async () => {
    await tracker.init();
    const fakeVideo = { readyState: 1 }; // < HAVE_CURRENT_DATA (2)
    const result = tracker.detectFrame(fakeVideo, 100);
    expect(result).toBeNull();
  });

  it('should return null when no landmarks detected', async () => {
    await tracker.init();
    mockLandmarker.detectForVideo.mockReturnValue({ landmarks: [] });
    const video = { readyState: 4 };
    const result = tracker.detectFrame(video, 100);
    expect(result).toBeNull();
  });

  it('should return 33 normalized landmarks with Y-flipped coordinates', async () => {
    await tracker.init();

    const rawLandmarks = Array.from({ length: 33 }, (_, i) => ({
      x: i / 32,
      y: 0.3
    }));
    mockLandmarker.detectForVideo.mockReturnValue({ landmarks: [rawLandmarks] });

    const video = { readyState: 4 };
    const result = tracker.detectFrame(video, 100);

    expect(result).toHaveLength(33);
    expect(result[0].x).toBeCloseTo(0, 5);
    // Y should be flipped: 1.0 - 0.3 = 0.7
    expect(result[0].y).toBeCloseTo(0.7, 5);
  });

  it('should reject duplicate timestamps (strictly increasing required)', async () => {
    await tracker.init();
    const rawLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
    mockLandmarker.detectForVideo.mockReturnValue({ landmarks: [rawLandmarks] });

    const video = { readyState: 4 };
    tracker.detectFrame(video, 100);  // accepted
    const second = tracker.detectFrame(video, 100); // same timestamp
    expect(second).toBeNull();
  });

  it('should destroy cleanly and reset state', async () => {
    await tracker.init();
    tracker.destroy();

    expect(mockLandmarker.close).toHaveBeenCalledOnce();
    expect(tracker.landmarker).toBeNull();
    expect(tracker.isInitialized).toBe(false);
  });
});
