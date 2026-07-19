import { ValidationError } from '../core/errors.js';

/** @typedef {{centerX: number, centerY: number, scale: number}} Camera */

/** @returns {Camera} */
export function createCamera() {
  return { centerX: 0, centerY: 0, scale: 180 };
}

/** @param {Camera} camera @param {number} x @param {number} y @param {number} width @param {number} height */
export function worldToScreen(camera, x, y, width, height) {
  return {
    x: width * 0.5 + (x - camera.centerX) * camera.scale,
    y: height * 0.5 - (y - camera.centerY) * camera.scale,
  };
}

/** @param {Camera} camera @param {number} x @param {number} y @param {number} width @param {number} height */
export function screenToWorld(camera, x, y, width, height) {
  return {
    x: camera.centerX + (x - width * 0.5) / camera.scale,
    y: camera.centerY - (y - height * 0.5) / camera.scale,
  };
}

/** @param {Camera} camera @param {number} dxPixels @param {number} dyPixels */
export function panCamera(camera, dxPixels, dyPixels) {
  camera.centerX -= dxPixels / camera.scale;
  camera.centerY += dyPixels / camera.scale;
}

/**
 * @param {Camera} camera
 * @param {{x: number, y: number}} point
 * @param {number} [minimumScale]
 */
export function focusCamera(camera, point, minimumScale = 180) {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(minimumScale) ||
    !(minimumScale > 0)
  ) {
    throw new ValidationError(
      'Camera focus must use finite coordinates and a positive scale.',
    );
  }
  camera.centerX = point.x;
  camera.centerY = point.y;
  camera.scale = Math.min(20_000, Math.max(camera.scale, minimumScale));
  return camera;
}

/**
 * @param {Camera} camera
 * @param {number} factor
 * @param {number} anchorX
 * @param {number} anchorY
 * @param {number} width
 * @param {number} height
 */
export function zoomCamera(
  camera,
  factor,
  anchorX,
  anchorY,
  width,
  height,
) {
  if (!Number.isFinite(factor) || !(factor > 0)) {
    throw new ValidationError('Camera zoom factor must be positive.');
  }
  const before = screenToWorld(camera, anchorX, anchorY, width, height);
  camera.scale = Math.min(20_000, Math.max(8, camera.scale * factor));
  const after = screenToWorld(camera, anchorX, anchorY, width, height);
  camera.centerX += before.x - after.x;
  camera.centerY += before.y - after.y;
}

/**
 * @param {Camera} camera
 * @param {ArrayLike<{x: number, y: number}>} points
 * @param {number} width
 * @param {number} height
 * @param {number} [padding]
 */
export function fitCamera(camera, points, width, height, padding = 48) {
  if (points.length === 0 || width <= padding * 2 || height <= padding * 2) {
    camera.centerX = 0;
    camera.centerY = 0;
    camera.scale = 180;
    return camera;
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    minX = Math.min(minX, points[index].x);
    maxX = Math.max(maxX, points[index].x);
    minY = Math.min(minY, points[index].y);
    maxY = Math.max(maxY, points[index].y);
  }
  const spanX = Math.max(maxX - minX, 0.25);
  const spanY = Math.max(maxY - minY, 0.25);
  camera.centerX = (minX + maxX) * 0.5;
  camera.centerY = (minY + maxY) * 0.5;
  camera.scale = Math.max(
    8,
    Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY),
  );
  return camera;
}
