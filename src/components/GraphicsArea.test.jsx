// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cameraCalls = vi.hoisted(() => ({
  fit: vi.fn(),
  zoom: vi.fn(),
}));

vi.mock('../render/camera.js', async (importOriginal) => {
  const actual = /** @type {typeof import('../render/camera.js')} */ (
    await importOriginal()
  );
  const fitCamera = /** @type {typeof actual.fitCamera} */ ((...args) => {
    cameraCalls.fit();
    return actual.fitCamera(...args);
  });
  const zoomCamera = /** @type {typeof actual.zoomCamera} */ ((...args) => {
    cameraCalls.zoom();
    return actual.zoomCamera(...args);
  });
  return { ...actual, fitCamera, zoomCamera };
});

import { GraphicsArea } from './GraphicsArea.jsx';
import { RuntimeContext } from '../runtime/runtime-context.js';
import { SimulationRuntime } from '../runtime/simulation-runtime.js';
import { createPresetScenarios } from '../scenarios/presets.js';
import { useBaryStore } from '../state/store.js';

/** @returns {CanvasRenderingContext2D} */
function createCanvasContext() {
  return /** @type {CanvasRenderingContext2D} */ (
    /** @type {unknown} */ ({
      arc: vi.fn(),
      beginPath: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      setLineDash: vi.fn(),
      setTransform: vi.fn(),
      stroke: vi.fn(),
    })
  );
}

describe('GraphicsArea camera commands', () => {
  /** @type {Map<number, FrameRequestCallback>} */
  let frames;
  /** @type {number} */
  let nextFrameId;

  const flushAnimationFrames = () => {
    act(() => {
      const callbacks = Array.from(frames.values());
      frames.clear();
      for (const callback of callbacks) callback(0);
    });
  };

  beforeEach(() => {
    useBaryStore.getState().resetUi();
    cameraCalls.fit.mockClear();
    cameraCalls.zoom.mockClear();
    frames = new Map();
    nextFrameId = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((/** @type {FrameRequestCallback} */ callback) => {
        nextFrameId += 1;
        frames.set(nextFrameId, callback);
        return nextFrameId;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((/** @type {number} */ frameId) => frames.delete(frameId)),
    );
    vi.stubGlobal('ResizeObserver', undefined);
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 1,
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      createCanvasContext(),
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue(
      /** @type {DOMRect} */ ({
        bottom: 500,
        height: 500,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not replay a zoom command as running snapshots arrive', () => {
    const runtime = new SimulationRuntime(createPresetScenarios()[0]);
    render(
      <RuntimeContext.Provider value={runtime}>
        <GraphicsArea />
      </RuntimeContext.Provider>,
    );
    flushAnimationFrames();
    expect(cameraCalls.fit).toHaveBeenCalledTimes(1);

    act(() => useBaryStore.getState().requestCamera('zoom-out'));
    flushAnimationFrames();
    expect(cameraCalls.zoom).toHaveBeenCalledTimes(1);

    act(() => {
      runtime.play();
      runtime.advance(0.25);
      runtime.advance(0.25);
    });
    flushAnimationFrames();

    expect(runtime.getSnapshot().status).toBe('running');
    expect(cameraCalls.fit).toHaveBeenCalledTimes(1);
    expect(cameraCalls.zoom).toHaveBeenCalledTimes(1);
  });
});
