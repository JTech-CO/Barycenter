import { describe, expect, it } from 'vitest';
import { createRuntimeState } from '../core/state.js';
import { createCircularBinaryScenario } from '../scenarios/presets.js';
import {
  DiagnosticsRingBuffer,
  MAX_TOTAL_TRAIL_POINTS,
  TrailRingBuffer,
  estimateDiagnosticsStorageBytes,
  estimateTrailStorageBytes,
  resolveTrailCapacity,
} from './ring-buffer.js';
import { SimulationRuntime } from './simulation-runtime.js';

describe('bounded runtime history', () => {
  it('caps total trail points as body count grows', () => {
    expect(resolveTrailCapacity(768, 2)).toBe(768);
    expect(resolveTrailCapacity(768, 100)).toBe(327);
    expect(resolveTrailCapacity(768, 500)).toBe(65);
    expect(resolveTrailCapacity(768, 2_000)).toBe(16);
    for (const bodyCount of [2, 100, 500, 2_000]) {
      const capacity = resolveTrailCapacity(768, bodyCount);
      expect(capacity * bodyCount).toBeLessThanOrEqual(
        MAX_TOTAL_TRAIL_POINTS,
      );
    }
  });

  it('retains only the newest trail and diagnostic samples', () => {
    const state = createRuntimeState([
      {
        id: 1,
        name: 'Body',
        kind: 'massive',
        mass: 1,
        position: [0, 0, 0],
        velocity: [0, 0, 0],
      },
    ]);
    const trails = new TrailRingBuffer(state.ids, 3);
    const diagnostics = new DiagnosticsRingBuffer(3);
    for (let index = 0; index < 10; index += 1) {
      state.positions[0] = index;
      trails.append(state);
      diagnostics.append(
        /** @type {Parameters<DiagnosticsRingBuffer['append']>[0]} */ ({
          time: index,
          energySignedError: index,
          energyError: index,
          angularMomentumError: index,
          centerOfMassDrift: index,
        }),
        index,
      );
    }
    expect([...trails.snapshot()[0].points]).toEqual([
      7, 0, 0, 8, 0, 0, 9, 0, 0,
    ]);
    expect([...diagnostics.snapshot().time]).toEqual([7, 8, 9]);
  });

  it('reports deterministic typed-array storage upper bounds', () => {
    expect(estimateTrailStorageBytes(500, 65)).toBe(
      500 * 65 * 3 * 8 + 500 * 4,
    );
    expect(estimateDiagnosticsStorageBytes(1_024)).toBe(1_024 * 6 * 8);

    const runtime = new SimulationRuntime(createCircularBinaryScenario());
    const limits = runtime.getSnapshot().limits;
    expect(limits.trails.effectivePerBody).toBe(768);
    expect(limits.trails.totalPointCapacity).toBe(1_536);
    expect(limits.diagnostics.capacity).toBe(768);
  });
});
