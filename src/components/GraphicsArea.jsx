import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCamera,
  fitCamera,
  panCamera,
  zoomCamera,
} from '../render/camera.js';
import { drawOrbitScene, projectSnapshot } from '../render/graphics.js';
import { useRuntimeSnapshot } from '../runtime/hooks.js';
import { useBaryStore } from '../state/store.js';
import styles from '../workbench/Workbench.module.css';

/** @typedef {ReturnType<typeof drawOrbitScene>} DrawResult */

/** @param {number} value */
function compactNumber(value) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < 1e-3 || magnitude >= 1e4)) {
    return value.toExponential(3);
  }
  return Number(value.toPrecision(5)).toString();
}

/**
 * @param {{onCanvasReady?: (canvas: HTMLCanvasElement | null) => void}} props
 */
export function GraphicsArea({ onCanvasReady }) {
  const snapshot = useRuntimeSnapshot();
  const selectedId = useBaryStore((state) => state.selectedId);
  const cameraCommand = useBaryStore((state) => state.cameraCommand);
  const measurementMode = useBaryStore((state) => state.measurementMode);
  const measurementFromId = useBaryStore((state) => state.measurementFromId);
  const measurement = useBaryStore((state) => state.measurement);
  const registerMeasurementHit = useBaryStore(
    (state) => state.registerMeasurementHit,
  );
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const cameraRef = useRef(createCamera());
  const drawResultRef = useRef(/** @type {DrawResult | null} */ (null));
  const dragRef = useRef(
    /** @type {{pointerId: number, x: number, y: number, moved: boolean} | null} */ (
      null
    ),
  );
  const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 });
  const [cameraRevision, setCameraRevision] = useState(0);
  const [canvasAvailable, setCanvasAvailable] = useState(true);

  useEffect(() => {
    if (!onCanvasReady) return undefined;
    onCanvasReady(canvasRef.current);
    return () => onCanvasReady(null);
  }, [onCanvasReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 640));
      const height = Math.max(
        1,
        Math.round(rect.height || canvas.clientHeight || 480),
      );
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      setSize((current) =>
        current.width === width &&
        current.height === height &&
        current.dpr === dpr
          ? current
          : { width, height, dpr },
      );
    };
    updateSize();
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const fit = useCallback(() => {
    if (size.width === 0 || size.height === 0) return;
    const projected = projectSnapshot(snapshot);
    fitCamera(
      cameraRef.current,
      projected.bodies.map((body) => ({
        x: body.projectedPosition[0],
        y: body.projectedPosition[1],
      })),
      size.width,
      size.height,
      72,
    );
    setCameraRevision((revision) => revision + 1);
  }, [size.height, size.width, snapshot]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      if (cameraCommand.type === 'fit') {
        fit();
        return;
      }
      const factor = cameraCommand.type === 'zoom-in' ? 1.35 : 1 / 1.35;
      zoomCamera(
        cameraRef.current,
        factor,
        size.width * 0.5,
        size.height * 0.5,
        size.width,
        size.height,
      );
      setCameraRevision((revision) => revision + 1);
    });
    return () => cancelAnimationFrame(frameId);
  }, [cameraCommand, fit, size.height, size.width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    canvas.width = Math.round(size.width * size.dpr);
    canvas.height = Math.round(size.height * size.dpr);
    const context = canvas.getContext('2d');
    if (!context) {
      setCanvasAvailable(false);
      return;
    }
    setCanvasAvailable(true);
    context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    const computed = getComputedStyle(canvas);
    /** @param {string} name @param {string} fallback */
    const token = (name, fallback) =>
      computed.getPropertyValue(name).trim() || fallback;
    drawResultRef.current = drawOrbitScene(
      context,
      snapshot,
      cameraRef.current,
      {
        width: size.width,
        height: size.height,
        selectedId,
        showVelocity: snapshot.config.rendering.showVelocity,
        colors: {
          canvas: token('--canvas', 'Canvas'),
          grid: token('--canvas-grid', 'ButtonFace'),
          axis: token('--canvas-axis', 'GrayText'),
          text: token('--canvas-text', 'CanvasText'),
          accent: token('--accent', 'Highlight'),
          selected: token('--selection', 'Highlight'),
          contour: token('--contour', 'GrayText'),
          series: [
            token('--series-1', 'Highlight'),
            token('--series-2', 'LinkText'),
            token('--series-3', 'ActiveText'),
            token('--series-4', 'MarkText'),
            token('--series-5', 'VisitedText'),
          ],
        },
      },
    );
  }, [cameraRevision, selectedId, size, snapshot]);

  /** @param {import('react').PointerEvent<HTMLCanvasElement>} event */
  const pointerDown = (event) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** @param {import('react').PointerEvent<HTMLCanvasElement>} event */
  const pointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) {
      drag.moved = true;
      panCamera(cameraRef.current, dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      setCameraRevision((revision) => revision + 1);
    }
  };

  /** @param {import('react').PointerEvent<HTMLCanvasElement>} event */
  const pointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const target of drawResultRef.current?.hitTargets ?? []) {
      const distance = Math.hypot(target.x - x, target.y - y);
      if (distance <= target.radius && distance < nearestDistance) {
        nearest = target;
        nearestDistance = distance;
      }
    }
    if (nearest) registerMeasurementHit(nearest.id, snapshot.bodies);
  };

  /** @param {import('react').WheelEvent<HTMLCanvasElement>} event */
  const wheel = (event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomCamera(
      cameraRef.current,
      Math.exp(-event.deltaY * 0.0012),
      event.clientX - rect.left,
      event.clientY - rect.top,
      size.width,
      size.height,
    );
    setCameraRevision((revision) => revision + 1);
  };

  /** @param {import('react').KeyboardEvent<HTMLCanvasElement>} event */
  const keyDown = (event) => {
    const panBy = 28;
    if (event.key === 'ArrowLeft') panCamera(cameraRef.current, -panBy, 0);
    else if (event.key === 'ArrowRight') panCamera(cameraRef.current, panBy, 0);
    else if (event.key === 'ArrowUp') panCamera(cameraRef.current, 0, -panBy);
    else if (event.key === 'ArrowDown') panCamera(cameraRef.current, 0, panBy);
    else if (event.key === '+' || event.key === '=') {
      zoomCamera(
        cameraRef.current,
        1.25,
        size.width * 0.5,
        size.height * 0.5,
        size.width,
        size.height,
      );
    } else if (event.key === '-') {
      zoomCamera(
        cameraRef.current,
        0.8,
        size.width * 0.5,
        size.height * 0.5,
        size.width,
        size.height,
      );
    } else if (event.key.toLowerCase() === 'f') {
      fit();
      event.preventDefault();
      return;
    } else {
      return;
    }
    event.preventDefault();
    setCameraRevision((revision) => revision + 1);
  };

  const frameLabel =
    snapshot.frame.type === 'rotating'
      ? 'Rotating primary-pair frame'
      : snapshot.frame.type === 'barycentric'
        ? 'Barycentric inertial frame'
        : 'Inertial frame';

  return (
    <section className={styles.graphicsArea} aria-label="Orbit graphics area">
      <canvas
        ref={canvasRef}
        className={styles.orbitCanvas}
        data-testid="orbit-canvas"
        tabIndex={0}
        aria-label="Interactive XY orbit view in astronomical units"
        aria-describedby="canvas-help"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onWheel={wheel}
        onDoubleClick={fit}
        onKeyDown={keyDown}
      >
        Interactive orbit graphics require Canvas 2D.
      </canvas>
      {!canvasAvailable ? (
        <div className={styles.canvasFallback} role="status">
          Canvas 2D is unavailable. The deterministic CPU simulation and
          diagnostics remain active; use the property and figure panels.
        </div>
      ) : null}
      <div className={styles.canvasHud}>
        <span>{frameLabel}</span>
        <span>XY projection · AU</span>
      </div>
      <p id="canvas-help" className={styles.visuallyHidden}>
        Drag to pan, use the mouse wheel or plus and minus keys to zoom, arrow
        keys to pan, and F to fit all bodies.
      </p>
      {measurementMode ? (
        <div className={styles.measureBadge} role="status">
          {measurementFromId == null
            ? 'Measure: select the first body'
            : 'Measure: select the second body'}
        </div>
      ) : null}
      {measurement ? (
        <div className={styles.measureResult} role="status">
          Distance {compactNumber(measurement.distance)} AU
        </div>
      ) : null}
    </section>
  );
}
