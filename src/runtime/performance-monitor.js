/**
 * @typedef {object} RuntimePerformanceMetric
 * @property {'lcp' | 'long-task'} name
 * @property {number} valueMs
 * @property {number} startTimeMs
 */

/**
 * Observes browser-only release metrics without affecting the deterministic
 * simulation clock. Unsupported browsers keep running with a no-op cleanup.
 *
 * @param {(metric: RuntimePerformanceMetric) => void} onMetric
 */
export function observeRuntimePerformance(onMetric) {
  if (
    typeof globalThis.PerformanceObserver !== 'function' ||
    !Array.isArray(globalThis.PerformanceObserver.supportedEntryTypes)
  ) {
    return () => {};
  }
  const supported = new Set(
    globalThis.PerformanceObserver.supportedEntryTypes,
  );
  const observers = /** @type {PerformanceObserver[]} */ ([]);

  if (supported.has('largest-contentful-paint')) {
    const lcp = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const latest = entries[entries.length - 1];
      if (!latest) return;
      onMetric({
        name: 'lcp',
        valueMs: latest.startTime,
        startTimeMs: latest.startTime,
      });
    });
    lcp.observe({ type: 'largest-contentful-paint', buffered: true });
    observers.push(lcp);
  }

  if (supported.has('longtask')) {
    const longTasks = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration < 50) continue;
        onMetric({
          name: 'long-task',
          valueMs: entry.duration,
          startTimeMs: entry.startTime,
        });
      }
    });
    longTasks.observe({ type: 'longtask', buffered: true });
    observers.push(longTasks);
  }

  return () => {
    for (const observer of observers) observer.disconnect();
  };
}
