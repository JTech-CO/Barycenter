import { useEffect } from 'react';
import { useBaryStore } from '../state/store.js';
import { RuntimeContext } from './runtime-context.js';

/** @param {{runtime: import('./simulation-runtime.js').SimulationRuntime, children: import('react').ReactNode}} props */
export function RuntimeProvider({ runtime, children }) {
  useEffect(() => {
    const sync = useBaryStore.getState().syncRuntime;
    sync(runtime.getSnapshot());
    return runtime.subscribe((snapshot) =>
      useBaryStore.getState().syncRuntime(snapshot),
    );
  }, [runtime]);

  useEffect(() => {
    let frameId = 0;
    /** @type {number | null} */
    let previousTime = null;
    /** @param {number} timestamp */
    const frame = (timestamp) => {
      if (previousTime == null) previousTime = timestamp;
      const delta = Math.max(0, (timestamp - previousTime) / 1000);
      previousTime = timestamp;
      runtime.advance(delta);
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [runtime]);

  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}
