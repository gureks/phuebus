// Recorder.js — WebM Canvas Stream Recording
//
// Responsibilities:
// - Captures a real-time stream from a canvas element.
// - Records using MediaRecorder with webm codecs fallback.
// - Auto-downloads the recorded video as a .webm file upon stopping.

export class Recorder {
  constructor(canvasElement, fps = 60) {
    this.canvas = canvasElement;
    this.fps = fps;
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
  }

  start() {
    if (this.isRecording) return;
    this.chunks = [];

    // Capture stream
    const stream = this.canvas.captureStream(this.fps);

    // Negotiate formats
    let options = { mimeType: 'video/webm;codecs=vp9' };
    if (typeof MediaRecorder !== 'undefined') {
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp8' };
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (err) {
      console.warn('[Recorder] MediaRecorder creation failed, falling back to default:', err);
      if (typeof MediaRecorder !== 'undefined') {
        this.mediaRecorder = new MediaRecorder(stream);
      } else {
        throw new Error('MediaRecorder is not supported in this environment.');
      }
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phuebus-projection-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    this.mediaRecorder.start(1000); // Slice every 1s
    this.isRecording = true;
    console.log('[Recorder] Canvas recording started.');
  }

  stop() {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.mediaRecorder.stop();
    this.isRecording = false;
    console.log('[Recorder] Canvas recording stopped.');
  }
}
