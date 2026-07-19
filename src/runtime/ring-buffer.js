import { ValidationError } from '../core/errors.js';

/** @typedef {ReturnType<typeof import('../core/diagnostics.js').measureDiagnostics>} DiagnosticsMeasurement */

export const MAX_TOTAL_TRAIL_POINTS = 32_768;

/**
 * Keeps trail allocation and draw work bounded across body counts while
 * preserving the requested history for small systems.
 *
 * @param {number} requestedPerBody
 * @param {number} bodyCount
 * @param {number} [maximumTotalPoints]
 */
export function resolveTrailCapacity(
  requestedPerBody,
  bodyCount,
  maximumTotalPoints = MAX_TOTAL_TRAIL_POINTS,
) {
  if (!Number.isInteger(requestedPerBody) || requestedPerBody < 2) {
    throw new ValidationError('Requested trail capacity must be an integer ≥ 2.');
  }
  if (!Number.isInteger(bodyCount) || bodyCount < 1) {
    throw new ValidationError('Trail body count must be a positive integer.');
  }
  if (!Number.isInteger(maximumTotalPoints) || maximumTotalPoints < 2) {
    throw new ValidationError('Total trail point budget must be an integer ≥ 2.');
  }
  return Math.max(
    2,
    Math.min(requestedPerBody, Math.floor(maximumTotalPoints / bodyCount)),
  );
}

/** @param {number} bodyCount @param {number} capacity */
export function estimateTrailStorageBytes(bodyCount, capacity) {
  return bodyCount * capacity * 3 * Float64Array.BYTES_PER_ELEMENT +
    bodyCount * Int32Array.BYTES_PER_ELEMENT;
}

/** @param {number} capacity */
export function estimateDiagnosticsStorageBytes(capacity) {
  return capacity * 6 * Float64Array.BYTES_PER_ELEMENT;
}

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
