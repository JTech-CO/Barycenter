import { createContext } from 'react';

export const RuntimeContext = createContext(
  /** @type {import('./simulation-runtime.js').SimulationRuntime | null} */ (null),
);
