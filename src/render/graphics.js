import {
  createCr3bpNormalization,
  jacobiConstant,
  physicalRotatingToCanonical,
  sampleZeroVelocityGrid,
  solveLagrangePoints,
} from '../core/cr3bp.js';
import {
  createPrimaryPairFrame,
  inertialToRotating,
} from '../core/frames.js';
import { worldToScreen } from './camera.js';

/** @param {number} value */
function niceStep(value) {
  const power = 10 ** Math.floor(Math.log10(Math.max(value, Number.EPSILON)));
  const normalized = value / power;
  if (normalized <= 1) return power;
  if (normalized <= 2) return 2 * power;
  if (normalized <= 5) return 5 * power;
  return 10 * power;
}

/** @param {ReturnType<import('../runtime/simulation-runtime.js').SimulationRuntime['getSnapshot']>} snapshot */
export function projectSnapshot(snapshot) {
  const bodies = snapshot.bodies.map((body) => ({
    ...body,
    position: Array.from(body.position),
    velocity: Array.from(body.velocity),
  }));
  let origin = [0, 0, 0];
  let rotatingFrame = null;
  if (snapshot.frame.type === 'barycentric') {
    let totalMass = 0;
    origin = [0, 0, 0];
    for (const body of bodies) {
      if (body.kind !== 'massive') continue;
      totalMass += body.mass;
      for (let axis = 0; axis < 3; axis += 1) {
        origin[axis] += body.mass * body.position[axis];
      }
    }
    if (totalMass > 0) origin = origin.map((component) => component / totalMass);
  } else if (snapshot.frame.type === 'rotating') {
    const primary = bodies.find((body) => body.id === snapshot.frame.refA);
    const secondary = bodies.find((body) => body.id === snapshot.frame.refB);
    if (primary && secondary) {
      rotatingFrame = createPrimaryPairFrame(
        primary.position,
        primary.velocity,
        primary.mass,
        secondary.position,
        secondary.velocity,
        secondary.mass,
        snapshot.time,
      );
    }
  }

  /** @param {ArrayLike<number>} position @param {ArrayLike<number>} [velocity] */
  const transformPosition = (position, velocity = [0, 0, 0]) => {
    if (rotatingFrame) {
      return Array.from(
        inertialToRotating(
          position,
          velocity,
          snapshot.time,
          rotatingFrame,
        ).position,
      );
    }
    return [
      position[0] - origin[0],
      position[1] - origin[1],
      position[2] - origin[2],
    ];
  };
  /** @param {ArrayLike<number>} position @param {ArrayLike<number>} velocity */
  const transformVelocity = (position, velocity) => {
    if (rotatingFrame) {
      return Array.from(
        inertialToRotating(
          position,
          velocity,
          snapshot.time,
          rotatingFrame,
        ).velocity,
      );
    }
    return Array.from(velocity);
  };
  const projectedBodies = bodies.map((body) => ({
    ...body,
    projectedPosition: transformPosition(body.position, body.velocity),
    projectedVelocity: transformVelocity(body.position, body.velocity),
  }));
  const projectedTrails = snapshot.trails.map((trail) => {
    const points = new Float64Array(trail.points.length);
    for (let index = 0; index < trail.points.length; index += 3) {
      const transformed = transformPosition([
        trail.points[index],
        trail.points[index + 1],
        trail.points[index + 2],
      ]);
      points[index] = transformed[0];
      points[index + 1] = transformed[1];
      points[index + 2] = transformed[2];
    }
    return { id: trail.id, points };
  });
  return { bodies: projectedBodies, trails: projectedTrails, rotatingFrame };
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} width
 * @param {number} height
 * @param {import('./camera.js').Camera} camera
 * @param {{canvas: string, grid: string, axis: string, text: string, accent: string, selected: string, series: string[], contour: string}} colors
 */
function drawGrid(context, width, height, camera, colors) {
  context.fillStyle = colors.canvas;
  context.fillRect(0, 0, width, height);
  const step = niceStep(80 / camera.scale);
  const halfWorldWidth = width / (2 * camera.scale);
  const halfWorldHeight = height / (2 * camera.scale);
  const minX = camera.centerX - halfWorldWidth;
  const maxX = camera.centerX + halfWorldWidth;
  const minY = camera.centerY - halfWorldHeight;
  const maxY = camera.centerY + halfWorldHeight;
  context.lineWidth = 1;
  context.font = '10px ui-monospace, monospace';
  context.fillStyle = colors.text;
  context.textBaseline = 'top';
  for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
    const screen = worldToScreen(camera, x, 0, width, height);
    context.strokeStyle = Math.abs(x) < step * 1e-6 ? colors.axis : colors.grid;
    context.beginPath();
    context.moveTo(Math.round(screen.x) + 0.5, 0);
    context.lineTo(Math.round(screen.x) + 0.5, height);
    context.stroke();
    if (screen.x >= 4 && screen.x <= width - 36) {
      context.fillText(`${Number(x.toPrecision(4))}`, screen.x + 3, 4);
    }
  }
  for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
    const screen = worldToScreen(camera, 0, y, width, height);
    context.strokeStyle = Math.abs(y) < step * 1e-6 ? colors.axis : colors.grid;
    context.beginPath();
    context.moveTo(0, Math.round(screen.y) + 0.5);
    context.lineTo(width, Math.round(screen.y) + 0.5);
    context.stroke();
    if (screen.y >= 16 && screen.y <= height - 14) {
      context.fillText(`${Number(y.toPrecision(4))}`, 4, screen.y + 2);
    }
  }
  context.fillText('AU', width - 24, height - 18);
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {ReturnType<typeof projectSnapshot>} projected
 * @param {ReturnType<import('../runtime/simulation-runtime.js').SimulationRuntime['getSnapshot']>} snapshot
 * @param {number} width
 * @param {number} height
 * @param {import('./camera.js').Camera} camera
 * @param {{contour: string, text: string}} colors
 */
function drawCr3bpOverlay(
  context,
  projected,
  snapshot,
  width,
  height,
  camera,
  colors,
) {
  if (snapshot.frame.type !== 'rotating') return;
  const primary = projected.bodies.find((body) => body.id === snapshot.frame.refA);
  const secondary = projected.bodies.find((body) => body.id === snapshot.frame.refB);
  if (!primary || !secondary || !projected.rotatingFrame) return;
  const canonicalDirection = primary.mass >= secondary.mass ? 1 : -1;

  const separation = Math.hypot(
    secondary.projectedPosition[0] - primary.projectedPosition[0],
    secondary.projectedPosition[1] - primary.projectedPosition[1],
    secondary.projectedPosition[2] - primary.projectedPosition[2],
  );
  if (!(separation > 0)) return;
  const normalization = createCr3bpNormalization({
    primaryMass: Math.max(primary.mass, secondary.mass),
    secondaryMass: Math.min(primary.mass, secondary.mass),
    separation,
    gravitationalConstant: snapshot.config.G,
  });
  const points = solveLagrangePoints(normalization.mu);
  context.save();
  context.strokeStyle = colors.contour;
  context.fillStyle = colors.text;
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  for (const point of Object.values(points)) {
    const screen = worldToScreen(
      camera,
      point.position[0] * separation * canonicalDirection,
      point.position[1] * separation * canonicalDirection,
      width,
      height,
    );
    context.beginPath();
    context.moveTo(screen.x - 5, screen.y);
    context.lineTo(screen.x + 5, screen.y);
    context.moveTo(screen.x, screen.y - 5);
    context.lineTo(screen.x, screen.y + 5);
    context.stroke();
    context.fillText(point.label, screen.x + 7, screen.y - 7);
  }
  context.setLineDash([]);

  if (snapshot.config.rendering.showContours) {
    const tracer = projected.bodies.find((body) => body.kind === 'tracer');
    if (tracer) {
      const canonical = physicalRotatingToCanonical(
        canonicalDirection === 1
          ? tracer.projectedPosition
          : [
              -tracer.projectedPosition[0],
              -tracer.projectedPosition[1],
              tracer.projectedPosition[2],
            ],
        canonicalDirection === 1
          ? tracer.projectedVelocity
          : [
              -tracer.projectedVelocity[0],
              -tracer.projectedVelocity[1],
              tracer.projectedVelocity[2],
            ],
        normalization,
      );
      const jacobi = jacobiConstant(
        normalization.mu,
        canonical.position,
        canonical.velocity,
      );
      const grid = sampleZeroVelocityGrid(normalization.mu, jacobi, {
        xMin: -1.5,
        xMax: 1.5,
        yMin: -1.2,
        yMax: 1.2,
        width: 48,
        height: 38,
      });
      context.globalAlpha = 0.45;
      for (let row = 0; row < grid.height - 1; row += 1) {
        for (let column = 0; column < grid.width - 1; column += 1) {
          const indices = [
            row * grid.width + column,
            row * grid.width + column + 1,
            (row + 1) * grid.width + column,
            (row + 1) * grid.width + column + 1,
          ];
          const values = indices.map((index) => grid.values[index]);
          if (Math.min(...values) > 0 || Math.max(...values) < 0) continue;
          const x = grid.bounds.xMin +
            ((grid.bounds.xMax - grid.bounds.xMin) * (column + 0.5)) /
              (grid.width - 1);
          const y = grid.bounds.yMin +
            ((grid.bounds.yMax - grid.bounds.yMin) * (row + 0.5)) /
              (grid.height - 1);
          const screen = worldToScreen(
            camera,
            x * separation * canonicalDirection,
            y * separation * canonicalDirection,
            width,
            height,
          );
          context.fillRect(screen.x, screen.y, 1.5, 1.5);
        }
      }
      context.globalAlpha = 1;
    }
  }
  context.restore();
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {ReturnType<import('../runtime/simulation-runtime.js').SimulationRuntime['getSnapshot']>} snapshot
 * @param {import('./camera.js').Camera} camera
 * @param {{width: number, height: number, selectedId: number | null, showVelocity: boolean, colors: {canvas: string, grid: string, axis: string, text: string, accent: string, selected: string, series: string[], contour: string}}} options
 */
export function drawOrbitScene(context, snapshot, camera, options) {
  const { width, height, colors } = options;
  const projected = projectSnapshot(snapshot);
  drawGrid(context, width, height, camera, colors);
  drawCr3bpOverlay(context, projected, snapshot, width, height, camera, colors);
  const bodyById = new Map(projected.bodies.map((body) => [body.id, body]));
  for (let trailIndex = 0; trailIndex < projected.trails.length; trailIndex += 1) {
    const trail = projected.trails[trailIndex];
    if (trail.points.length < 6) continue;
    context.strokeStyle = colors.series[trailIndex % colors.series.length];
    context.lineWidth = 1.25;
    for (let index = 3; index < trail.points.length; index += 3) {
      const previous = worldToScreen(
        camera,
        trail.points[index - 3],
        trail.points[index - 2],
        width,
        height,
      );
      const current = worldToScreen(
        camera,
        trail.points[index],
        trail.points[index + 1],
        width,
        height,
      );
      context.globalAlpha = 0.16 + 0.72 * (index / trail.points.length);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(current.x, current.y);
      context.stroke();
    }
  }
  context.globalAlpha = 1;
  const hitTargets = [];
  for (let index = 0; index < projected.bodies.length; index += 1) {
    const body = projected.bodies[index];
    const screen = worldToScreen(
      camera,
      body.projectedPosition[0],
      body.projectedPosition[1],
      width,
      height,
    );
    const radius =
      body.kind === 'tracer'
        ? 4
        : Math.min(11, Math.max(5, 6 + Math.log10(Math.max(body.mass, 1e-9))));
    context.fillStyle = colors.series[index % colors.series.length];
    context.beginPath();
    context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    context.fill();
    if (body.id === options.selectedId) {
      context.strokeStyle = colors.selected;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(screen.x, screen.y, radius + 4, 0, Math.PI * 2);
      context.stroke();
    }
    if (options.showVelocity) {
      const velocityScale = 0.04;
      context.strokeStyle = colors.accent;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(screen.x, screen.y);
      context.lineTo(
        screen.x + body.projectedVelocity[0] * camera.scale * velocityScale,
        screen.y - body.projectedVelocity[1] * camera.scale * velocityScale,
      );
      context.stroke();
    }
    hitTargets.push({ id: body.id, x: screen.x, y: screen.y, radius: radius + 7 });
  }
  return {
    projected,
    hitTargets,
    points: projected.bodies.map((body) => ({
      x: body.projectedPosition[0],
      y: body.projectedPosition[1],
    })),
    bodyById,
  };
}
