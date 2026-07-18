export class ValidationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NumericalError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'NumericalError';
  }
}
