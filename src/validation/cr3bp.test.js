import { describe, expect, it } from 'vitest';
import { BODY_KIND } from '../core/state.js';
import { createCr3bpPresets } from '../scenarios/cr3bp.js';
import { runCr3bpJacobiExperiment } from './cr3bp.js';

describe('CR3BP reference presets', () => {
  it('defines two deterministic scenarios with massless tracers', () => {
    const presets = createCr3bpPresets();

    expect(presets).toHaveLength(2);
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(2);
    for (const preset of presets) {
      expect(preset.bodies[preset.tracerIndex].kind).toBe('tracer');
      expect(preset.bodies[preset.tracerIndex].mass).toBe(0);
      expect(preset.normalization.mu).toBeGreaterThan(0);
      expect(preset.referenceJacobi).toBeGreaterThan(0);
      expect(BODY_KIND.TRACER).toBe(0);
    }
  });

  it.each(createCr3bpPresets())(
    '$id keeps Jacobi error and geometry bounded',
    (preset) => {
      const result = runCr3bpJacobiExperiment(preset);

      expect(result.maximumJacobiError).toBeLessThanOrEqual(
        preset.tolerances.jacobiAbsolute,
      );
      expect(result.maximumRadius).toBeLessThanOrEqual(
        preset.tolerances.maximumRadius,
      );
      expect(result.minimumPrimaryDistance).toBeGreaterThanOrEqual(
        preset.tolerances.minimumPrimaryDistance,
      );
      expect(result.recurrenceError).toBeLessThanOrEqual(
        preset.tolerances.recurrence,
      );
      expect(result.finite).toBe(true);
    },
    120_000,
  );
});
