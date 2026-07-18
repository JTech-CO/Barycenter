import { ValidationError } from '../core/errors.js';

/** @typedef {ReturnType<typeof import('../core/diagnostics.js').measureDiagnostics>} DiagnosticsMeasurement */

/** Fixed-capacity synchronized 3D trails for a deterministic body order. */
export class TrailRingBuffer {
  /** @param {Int32Array} ids @param {number} capacity */
  constructor(ids, capacity) {
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new ValidationError('Trail capacity must be an integer ≥ 2.');
    }
    this.ids = ids.slice();
    this.capacity = capacity;
    this.start = 0;
    this.length = 0;
    this.buffers = Array.from(
      { length: ids.length },
      () => new Float64Array(capacity * 3),
    );
  }

  clear() {
    this.start = 0;
    this.length = 0;
  }

  /** @param {import('../core/state.js').RuntimeState} state */
  append(state) {
    if (state.count !== this.ids.length) {
      throw new ValidationError('Trail state body count changed unexpectedly.');
    }
    const slot = (this.start + this.length) % this.capacity;
    for (let body = 0; body < state.count; body += 1) {
      if (state.ids[body] !== this.ids[body]) {
        throw new ValidationError('Trail state body order changed unexpectedly.');
      }
      const sourceOffset = body * 3;
      const targetOffset = slot * 3;
      this.buffers[body][targetOffset] = state.positions[sourceOffset];
      this.buffers[body][targetOffset + 1] = state.positions[sourceOffset + 1];
      this.buffers[body][targetOffset + 2] = state.positions[sourceOffset + 2];
    }
    if (this.length < this.capacity) this.length += 1;
    else this.start = (this.start + 1) % this.capacity;
  }

  snapshot() {
    return this.buffers.map((buffer, body) => {
      const points = new Float64Array(this.length * 3);
      for (let index = 0; index < this.length; index += 1) {
        const source = ((this.start + index) % this.capacity) * 3;
        const target = index * 3;
        points[target] = buffer[source];
        points[target + 1] = buffer[source + 1];
        points[target + 2] = buffer[source + 2];
      }
      return { id: this.ids[body], points };
    });
  }
}

/** Windowed conservation series used by figures and CSV export. */
export class DiagnosticsRingBuffer {
  /** @param {number} capacity */
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 2) {
      throw new ValidationError('Diagnostics capacity must be an integer ≥ 2.');
    }
    this.capacity = capacity;
    this.start = 0;
    this.length = 0;
    this.time = new Float64Array(capacity);
    this.energySignedError = new Float64Array(capacity);
    this.energyError = new Float64Array(capacity);
    this.angularMomentumError = new Float64Array(capacity);
    this.centerOfMassDrift = new Float64Array(capacity);
    this.separation = new Float64Array(capacity);
  }

  clear() {
    this.start = 0;
    this.length = 0;
  }

  /** @param {DiagnosticsMeasurement} diagnostics @param {number} separation */
  append(diagnostics, separation) {
    const slot = (this.start + this.length) % this.capacity;
    this.time[slot] = diagnostics.time;
    this.energySignedError[slot] = diagnostics.energySignedError;
    this.energyError[slot] = diagnostics.energyError;
    this.angularMomentumError[slot] = diagnostics.angularMomentumError;
    this.centerOfMassDrift[slot] = diagnostics.centerOfMassDrift;
    this.separation[slot] = separation;
    if (this.length < this.capacity) this.length += 1;
    else this.start = (this.start + 1) % this.capacity;
  }

  /** @param {Float64Array} source */
  ordered(source) {
    const result = new Float64Array(this.length);
    for (let index = 0; index < this.length; index += 1) {
      result[index] = source[(this.start + index) % this.capacity];
    }
    return result;
  }

  snapshot() {
    return {
      time: this.ordered(this.time),
      energySignedError: this.ordered(this.energySignedError),
      energyError: this.ordered(this.energyError),
      angularMomentumError: this.ordered(this.angularMomentumError),
      centerOfMassDrift: this.ordered(this.centerOfMassDrift),
      separation: this.ordered(this.separation),
    };
  }
}
