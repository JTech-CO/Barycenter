// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile, startCanvasWebmRecording } from './files.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('release export adapters', () => {
  it('downloads UTF-8 CSV through a temporary object URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:diagnostics');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => {},
    );
    downloadTextFile('diagnostics.csv', 'time_yr,energy_error\n0,0\n', 'text/csv');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostics');
  });

  it('fails WebM explicitly when browser capture APIs are unavailable', () => {
    const canvas = document.createElement('canvas');
    expect(() => startCanvasWebmRecording(canvas, vi.fn())).toThrow(
      /WebM 캡처를 지원하지 않습니다/,
    );
  });

  it('records WebM only after a user-started adapter and stops stream tracks', () => {
    const listeners = new Map();
    const track = { stop: vi.fn() };
    const stream = {
      getTracks: () => [track],
    };
    const canvas = document.createElement('canvas');
    canvas.captureStream = vi.fn().mockReturnValue(stream);

    class FakeMediaRecorder {
      /** @param {MediaStream} receivedStream @param {{mimeType: string}} options */
      constructor(receivedStream, options) {
        this.stream = receivedStream;
        this.options = options;
        this.start = vi.fn();
      }

      /** @param {string} name @param {(event: any) => void} listener */
      addEventListener(name, listener) {
        listeners.set(name, listener);
      }

      stop() {
        listeners.get('dataavailable')?.({
          data: new Blob(['frame'], { type: 'video/webm' }),
        });
        listeners.get('stop')?.({});
      }
    }
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const onComplete = vi.fn();
    const stop = startCanvasWebmRecording(canvas, onComplete);
    stop();
    expect(canvas.captureStream).toHaveBeenCalledWith(30);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toBeInstanceOf(Blob);
  });
});
