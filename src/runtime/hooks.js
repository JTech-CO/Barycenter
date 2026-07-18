import { useContext, useSyncExternalStore } from 'react';
import { RuntimeContext } from './runtime-context.js';

export function useRuntime() {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('RuntimeProvider is missing.');
  return runtime;
}

export function useRuntimeSnapshot() {
  const runtime = useRuntime();
  return useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.getSnapshot(),
    () => runtime.getSnapshot(),
  );
}
