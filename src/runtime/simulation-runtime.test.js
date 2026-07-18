import { describe, expect, it } from 'vitest';
import { createCircularBinaryScenario } from '../scenarios/presets.js';
import { SimulationRuntime } from './simulation-runtime.js';

describe('simulation runtime boundary', () => {
  it('consumes real time through a fixed-step accumulator', () => {
    const scenario = createCircularBinaryScenario();
    const runtime = new SimulationRuntime(scenario);
    runtime.play();

    const first = runtime.advance(
      (scenario.config.dt * 0.5) / scenario.config.timeScale,
    );
    const second = runtime.advance(
      (scenario.config.dt * 0.5) / scenario.config.timeScale,
    );

    expect(first).toBe(0);
    expect(second).toBe(1);
    expect(runtime.getSnapshot().step).toBe(1);
  });

  it('keeps deterministic runtime state out of UI consumers', () => {
    const scenario = createCircularBinaryScenario();
    const runtimes = [new SimulationRuntime(scenario), new SimulationRuntime(scenario)];

    for (let step = 0; step < 100; step += 1) {
      for (const runtime of runtimes) expect(runtime.stepOnce()).toBe(true);
    }

    expect(runtimes[1].getSnapshot().bodies).toEqual(
      runtimes[0].getSnapshot().bodies,
    );
    expect(runtimes[1].getSnapshot().diagnostics).toEqual(
      runtimes[0].getSnapshot().diagnostics,
    );
    expect(runtimes[0].getSnapshot()).not.toHaveProperty('world');
  });

  it('treats body editing as a new reset point', () => {
    const runtime = new SimulationRuntime(createCircularBinaryScenario());
    runtime.stepOnce();
    const selected = runtime.getSnapshot().bodies[1];
    runtime.updateBody(selected.id, { name: 'Edited body', mass: selected.mass * 1.1 });

    expect(runtime.getSnapshot().step).toBe(0);
    expect(runtime.getSnapshot().bodies[1].name).toBe('Edited body');
    expect(runtime.getSnapshot().status).toBe('idle');
    runtime.stepOnce();
    runtime.reset();
    expect(runtime.getSnapshot().bodies[1].name).toBe('Edited body');
    expect(runtime.getSnapshot().step).toBe(0);
  });

  it('exports windowed diagnostics as a unit-labelled CSV', () => {
    const runtime = new SimulationRuntime(createCircularBinaryScenario());
    for (let step = 0; step < 4; step += 1) runtime.stepOnce();
    const csv = runtime.exportDiagnosticsCsv();

    expect(csv).toContain('time_yr');
    expect(csv).toContain('separation_au');
    expect(csv.trim().split('\n')).toHaveLength(6);
  });
});
