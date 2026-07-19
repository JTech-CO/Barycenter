import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeRuntimePerformance } from './performance-monitor.js';

describe('browser performance monitor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a no-op when PerformanceObserver is unavailable', () => {
    vi.stubGlobal('PerformanceObserver', undefined);
    const callback = vi.fn();
    const cleanup = observeRuntimePerformance(callback);
    cleanup();
    expect(callback).not.toHaveBeenCalled();
  });

  it('reports LCP candidates and tasks at least 50ms', () => {
    const instances = /** @type {FakePerformanceObserver[]} */ ([]);
    class FakePerformanceObserver {
      static supportedEntryTypes = ['largest-contentful-paint', 'longtask'];

      /** @param {(list: {getEntries: () => PerformanceEntry[]}) => void} callback */
      constructor(callback) {
        this.callback = callback;
        this.type = '';
        this.disconnect = vi.fn();
        instances.push(this);
      }

      /** @param {{type: string}} options */
      observe(options) {
        this.type = options.type;
      }
    }
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
    const callback = vi.fn();
    const cleanup = observeRuntimePerformance(callback);
    const lcp = instances.find((instance) => instance.type === 'largest-contentful-paint');
    const tasks = instances.find((instance) => instance.type === 'longtask');
    if (!lcp || !tasks) {
      throw new Error('Expected both performance observer types.');
    }
    lcp.callback({
      getEntries: () => [
        /** @type {PerformanceEntry} */ ({
          name: 'candidate',
          entryType: 'largest-contentful-paint',
          startTime: 1_234,
          duration: 0,
          toJSON: () => ({}),
        }),
      ],
    });
    tasks.callback({
      getEntries: () => [
        /** @type {PerformanceEntry} */ ({
          name: 'short',
          entryType: 'longtask',
          startTime: 20,
          duration: 49,
          toJSON: () => ({}),
        }),
        /** @type {PerformanceEntry} */ ({
          name: 'long',
          entryType: 'longtask',
          startTime: 30,
          duration: 51,
          toJSON: () => ({}),
        }),
      ],
    });
    expect(callback).toHaveBeenNthCalledWith(1, {
      name: 'lcp',
      valueMs: 1_234,
      startTimeMs: 1_234,
    });
    expect(callback).toHaveBeenNthCalledWith(2, {
      name: 'long-task',
      valueMs: 51,
      startTimeMs: 30,
    });
    cleanup();
    expect(instances.every((instance) => instance.disconnect.mock.calls.length === 1)).toBe(
      true,
    );
  });
});
