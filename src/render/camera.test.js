import { describe, expect, it } from 'vitest';
import { ValidationError } from '../core/errors.js';
import { createCamera, focusCamera } from './camera.js';

describe('focusCamera', () => {
  it('centers the camera on a body and restores a readable scale', () => {
    const camera = createCamera();
    camera.centerX = -12;
    camera.centerY = 8;
    camera.scale = 24;

    expect(focusCamera(camera, { x: 3.5, y: -2.25 })).toBe(camera);
    expect(camera).toEqual({ centerX: 3.5, centerY: -2.25, scale: 180 });
  });

  it('preserves a closer zoom level', () => {
    const camera = { centerX: 0, centerY: 0, scale: 720 };

    focusCamera(camera, { x: 1, y: 2 });

    expect(camera).toEqual({ centerX: 1, centerY: 2, scale: 720 });
  });

  it('rejects invalid focus coordinates and scales', () => {
    const camera = createCamera();

    expect(() => focusCamera(camera, { x: Number.NaN, y: 0 })).toThrow(
      ValidationError,
    );
    expect(() => focusCamera(camera, { x: 0, y: 0 }, 0)).toThrow(
      ValidationError,
    );
  });
});
