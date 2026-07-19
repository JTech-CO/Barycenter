import { describe, expect, it } from 'vitest';
import { drawOrbitScene } from '../render/graphics.js';
import { MAX_TOTAL_TRAIL_POINTS } from '../runtime/ring-buffer.js';
import {
  PERFORMANCE_RENDER_OPTIONS,
  createCountingCanvasContext,
  createFilledPerformanceTrails,
  createPerformanceCamera,
  createPerformanceSnapshot,
  createPerformanceState,
} from './performance-fixtures.js';

describe('M7 deterministic performance fixtures', () => {
  it('recreates the same 3D distribution byte-for-byte', () => {
    const first = createPerformanceState(100);
    const second = createPerformanceState(100);
    expect([...second.positions]).toEqual([...first.positions]);
    expect([...second.velocities]).toEqual([...first.velocities]);
    expect([...second.masses]).toEqual([...first.masses]);
  });

  it('uses the total trail budget for high body counts', () => {
    const state = createPerformanceState(2_000);
    const trails = createFilledPerformanceTrails(state);
    const snapshot = createPerformanceSnapshot(state, trails);
    expect(snapshot.limits.trails.effectivePerBody).toBe(16);
    expect(snapshot.limits.trails.totalPointCapacity).toBeLessThanOrEqual(
      MAX_TOTAL_TRAIL_POINTS,
    );
  });

  it('batches each body trail into one Canvas stroke', () => {
    const state = createPerformanceState(100);
    const trails = createFilledPerformanceTrails(state);
    const snapshot = createPerformanceSnapshot(state, trails);
    const { context, counters } = createCountingCanvasContext();
    const result = drawOrbitScene(
      context,
      snapshot,
      createPerformanceCamera(),
      PERFORMANCE_RENDER_OPTIONS,
    );
    expect(result.hitTargets).toHaveLength(100);
    expect(counters.lines).toBeGreaterThan(30_000);
    expect(counters.strokes).toBeLessThan(140);
  });
});
