import { ValidationError } from '../core/errors.js';
import { elementsToState } from '../core/kepler.js';
import { runtimeStateToBodies } from '../core/state.js';
import {
  createWorld,
  resetWorld,
  setWorldStatus,
  stepWorld,
} from '../core/world.js';
import { validateScenario } from '../scenarios/schema.js';
import { DiagnosticsRingBuffer, TrailRingBuffer } from './ring-buffer.js';

/** @typedef {import('../scenarios/schema.js').Scenario} Scenario */
/** @typedef {ReturnType<SimulationRuntime['createSnapshot']>} RuntimeSnapshot */

/** @param {import('../core/state.js').RuntimeState} state */
function firstMassiveSeparation(state) {
  const massive = [];
  for (let body = 0; body < state.count && massive.length < 2; body += 1) {
    if (state.masses[body] > 0) massive.push(body);
  }
  if (massive.length < 2) return 0;
  const left = massive[0] * 3;
  const right = massive[1] * 3;
  return Math.hypot(
    state.positions[right] - state.positions[left],
    state.positions[right + 1] - state.positions[left + 1],
    state.positions[right + 2] - state.positions[left + 2],
  );
}

/** @param {Scenario} scenario */
function cloneScenario(scenario) {
  return validateScenario(JSON.parse(JSON.stringify(scenario)));
}

export class SimulationRuntime {
  /** @param {Scenario | unknown} scenario */
  constructor(scenario) {
    this.listeners = new Set();
    this.accumulator = 0;
    this.maxStepsPerFrame = 512;
    this.fps = 0;
    this.revision = 0;
    this.scenario = cloneScenario(validateScenario(scenario));
    this.world = createWorld(this.scenario.bodies, this.scenario.config);
    this.trails = new TrailRingBuffer(
      this.world.state.ids,
      this.scenario.config.rendering.trailLength,
    );
    this.diagnosticsSeries = new DiagnosticsRingBuffer(
      Math.max(256, this.scenario.config.rendering.trailLength),
    );
    this.trails.append(this.world.state);
    this.diagnosticsSeries.append(
      this.world.diagnostics,
      firstMassiveSeparation(this.world.state),
    );
    this.revision = 1;
    this.snapshot = this.createSnapshot();
  }

  /** @param {(snapshot: RuntimeSnapshot) => void} listener */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish() {
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener(this.snapshot);
  }

  createSnapshot() {
    const diagnostics = this.world.diagnostics;
    return {
      revision: this.revision,
      scenarioId: this.scenario.id,
      title: this.scenario.title,
      status: this.world.status,
      time: this.world.time,
      step: this.world.step,
      fps: this.fps,
      bodies: runtimeStateToBodies(this.world.state),
      config: this.scenario.config,
      frame: this.scenario.frame,
      diagnostics: {
        energy: diagnostics.energy,
        energySignedError: diagnostics.energySignedError,
        energyError: diagnostics.energyError,
        angularMomentumError: diagnostics.angularMomentumError,
        centerOfMassDrift: diagnostics.centerOfMassDrift,
        constrained: diagnostics.constrained,
      },
      diagnosticsSeries: this.diagnosticsSeries.snapshot(),
      trails: this.trails.snapshot(),
      lastError: this.world.lastError,
      accumulator: this.accumulator,
    };
  }

  getSnapshot() {
    return this.snapshot;
  }

  /** @param {Scenario | unknown} scenario @param {boolean} [notify] */
  loadScenario(scenario, notify = true) {
    this.scenario = cloneScenario(validateScenario(scenario));
    this.world = createWorld(this.scenario.bodies, this.scenario.config);
    this.trails = new TrailRingBuffer(
      this.world.state.ids,
      this.scenario.config.rendering.trailLength,
    );
    this.diagnosticsSeries = new DiagnosticsRingBuffer(
      Math.max(256, this.scenario.config.rendering.trailLength),
    );
    this.accumulator = 0;
    this.trails.append(this.world.state);
    this.diagnosticsSeries.append(
      this.world.diagnostics,
      firstMassiveSeparation(this.world.state),
    );
    this.revision += 1;
    this.snapshot = this.createSnapshot();
    if (notify) this.publish();
  }

  play() {
    if (this.world.status === 'error') return false;
    setWorldStatus(this.world, 'running');
    this.revision += 1;
    this.publish();
    return true;
  }

  pause() {
    if (this.world.status === 'error') return false;
    setWorldStatus(this.world, 'paused');
    this.revision += 1;
    this.publish();
    return true;
  }

  /** @param {number} realDeltaSeconds */
  advance(realDeltaSeconds) {
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new ValidationError('Frame delta must be finite and non-negative.');
    }
    if (realDeltaSeconds > 0) {
      const instantFps = 1 / realDeltaSeconds;
      this.fps = this.fps === 0 ? instantFps : this.fps * 0.9 + instantFps * 0.1;
    }
    if (this.world.status !== 'running') return 0;
    const boundedDelta = Math.min(realDeltaSeconds, 0.25);
    this.accumulator += boundedDelta * this.scenario.config.timeScale;
    let completedSteps = 0;
    let failed = false;
    while (
      this.accumulator + Number.EPSILON >= this.world.config.dt &&
      completedSteps < this.maxStepsPerFrame
    ) {
      if (!this.commitStep()) {
        failed = true;
        break;
      }
      this.accumulator -= this.world.config.dt;
      completedSteps += 1;
    }
    if (completedSteps === this.maxStepsPerFrame) {
      this.accumulator = Math.min(this.accumulator, this.world.config.dt);
    }
    if (completedSteps > 0 || failed) {
      this.revision += 1;
      this.publish();
    }
    return completedSteps;
  }

  commitStep() {
    const result = stepWorld(this.world);
    if (!result.ok) return false;
    this.trails.append(this.world.state);
    this.diagnosticsSeries.append(
      this.world.diagnostics,
      firstMassiveSeparation(this.world.state),
    );
    return true;
  }

  stepOnce() {
    if (this.world.status === 'error') return false;
    if (this.world.status === 'running') this.pause();
    const succeeded = this.commitStep();
    this.revision += 1;
    this.publish();
    return succeeded;
  }

  reset() {
    resetWorld(this.world);
    this.accumulator = 0;
    this.trails.clear();
    this.diagnosticsSeries.clear();
    this.trails.append(this.world.state);
    this.diagnosticsSeries.append(
      this.world.diagnostics,
      firstMassiveSeparation(this.world.state),
    );
    this.revision += 1;
    this.publish();
  }

  /** @param {number} id @param {Partial<import('../core/state.js').Body>} patch */
  updateBody(id, patch) {
    if (this.world.status === 'running') this.pause();
    let found = false;
    const bodies = this.scenario.bodies.map((body) => {
      if (body.id !== id) return body;
      found = true;
      return { ...body, ...patch, id: body.id };
    });
    if (!found) throw new ValidationError(`Unknown body id: ${id}`);
    this.loadScenario({ ...this.scenario, bodies });
  }

  /**
   * @param {number} id
   * @param {number} primaryId
   * @param {import('../core/kepler.js').KeplerElements} elements
   */
  updateBodyFromKepler(id, primaryId, elements) {
    const body = this.scenario.bodies.find((candidate) => candidate.id === id);
    const primary = this.scenario.bodies.find(
      (candidate) => candidate.id === primaryId,
    );
    if (!body || !primary || primary.kind !== 'massive' || body.id === primary.id) {
      throw new ValidationError('Kepler editing requires a distinct massive primary.');
    }
    const relative = elementsToState(
      { ...elements, primaryId },
      this.scenario.config.G * (primary.mass + body.mass),
    );
    this.updateBody(id, {
      position: [
        primary.position[0] + relative.position[0],
        primary.position[1] + relative.position[1],
        primary.position[2] + relative.position[2],
      ],
      velocity: [
        primary.velocity[0] + relative.velocity[0],
        primary.velocity[1] + relative.velocity[1],
        primary.velocity[2] + relative.velocity[2],
      ],
    });
  }

  /** @param {Record<string, unknown>} patch */
  updateConfig(patch) {
    if (this.world.status === 'running') this.pause();
    const renderingPatch =
      typeof patch.rendering === 'object' && patch.rendering !== null
        ? patch.rendering
        : {};
    this.loadScenario({
      ...this.scenario,
      config: {
        ...this.scenario.config,
        ...patch,
        rendering: {
          ...this.scenario.config.rendering,
          ...renderingPatch,
        },
      },
    });
  }

  /** @param {Scenario['frame']} frame */
  updateFrame(frame) {
    this.scenario = validateScenario({ ...this.scenario, frame });
    this.revision += 1;
    this.publish();
  }

  exportScenario() {
    return cloneScenario(this.scenario);
  }

  exportDiagnosticsCsv() {
    const series = this.diagnosticsSeries.snapshot();
    const rows = [
      'time_yr,energy_signed_error,energy_error,angular_momentum_error,com_drift,separation_au',
    ];
    for (let index = 0; index < series.time.length; index += 1) {
      rows.push(
        [
          series.time[index],
          series.energySignedError[index],
          series.energyError[index],
          series.angularMomentumError[index],
          series.centerOfMassDrift[index],
          series.separation[index],
        ].join(','),
      );
    }
    return `${rows.join('\n')}\n`;
  }
}
