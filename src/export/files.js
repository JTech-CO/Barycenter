import { ValidationError } from '../core/errors.js';

/** @param {string} filename @param {string} content @param {string} type */
export function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Start a user-triggered Canvas WebM recording. The returned function stops it.
 * @param {HTMLCanvasElement} canvas
 * @param {(blob: Blob) => void} onComplete
 */
export function startCanvasWebmRecording(canvas, onComplete) {
  if (
    typeof canvas.captureStream !== 'function' ||
    typeof MediaRecorder === 'undefined'
  ) {
    throw new ValidationError('이 브라우저는 Canvas WebM 캡처를 지원하지 않습니다.');
  }
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  /** @type {Blob[]} */
  const chunks = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  recorder.addEventListener('stop', () => {
    for (const track of stream.getTracks()) track.stop();
    onComplete(new Blob(chunks, { type: 'video/webm' }));
  });
  recorder.start();
  return () => recorder.stop();
}
