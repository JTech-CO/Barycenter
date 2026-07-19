import {
  Activity,
  CircleDot,
  Download,
  Eye,
  FileJson,
  Focus,
  Gauge,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Ruler,
  Save,
  Share2,
  SkipForward,
  Sparkles,
  Square,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScenarioComposer } from '../ai/ScenarioComposer.jsx';
import { GraphicsArea } from '../components/GraphicsArea.jsx';
import { MiniPlot } from '../components/MiniPlot.jsx';
import { NumberField } from '../components/NumberField.jsx';
import { stateToElements } from '../core/kepler.js';
import {
  downloadTextFile,
  startCanvasWebmRecording,
} from '../export/files.js';
import { RuntimeProvider } from '../runtime/RuntimeContext.jsx';
import { observeRuntimePerformance } from '../runtime/performance-monitor.js';
import { useRuntime, useRuntimeSnapshot } from '../runtime/hooks.js';
import { SimulationRuntime } from '../runtime/simulation-runtime.js';
import {
  createPresetScenarios,
  getPresetScenario,
} from '../scenarios/presets.js';
import { encodeScenarioHash } from '../scenarios/schema.js';
import { useBaryStore } from '../state/store.js';
import { resolveInitialScenario } from './initial-scenario.js';
import styles from './Workbench.module.css';

/** @typedef {import('../core/state.js').Body} Body */
/** @typedef {ReturnType<SimulationRuntime['getSnapshot']>} RuntimeSnapshot */

/** @param {number} value @param {number} [digits] */
function scientific(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  return value.toExponential(digits);
}

/** @param {number} radians */
function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

/** @param {number} degrees */
function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * @param {{
 *   icon: import('react').ReactNode,
 *   label: string,
 *   onClick: () => void,
 *   active?: boolean,
 *   disabled?: boolean,
 *   title?: string,
 * }} props
 */
function CommandButton({
  icon,
  label,
  onClick,
  active,
  disabled = false,
  title,
}) {
  return (
    <button
      type="button"
      className={styles.commandButton}
      data-active={active || undefined}
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * @param {{title: string, meta?: string, children: import('react').ReactNode}} props
 */
function Panel({ title, meta, children }) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

/**
 * @param {{
 *   snapshot: RuntimeSnapshot,
 *   selectedId: number | null,
 *   onSelect: (id: number) => void,
 * }} props
 */
function SpecificationTree({ snapshot, selectedId, onSelect }) {
  return (
    <Panel title="Specification tree" meta={snapshot.bodies.length + ' bodies'}>
      <div className={styles.systemNode}>
        <Orbit size={14} aria-hidden="true" />
        <div>
          <strong>{snapshot.title}</strong>
          <span>{snapshot.frame.type} frame</span>
        </div>
      </div>
      <ul className={styles.bodyTree} aria-label="Simulation bodies">
        {snapshot.bodies.map((body, index) => (
          <li key={body.id}>
            <button
              type="button"
              data-selected={body.id === selectedId || undefined}
              aria-current={body.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(body.id)}
            >
              <span
                className={styles.bodySwatch}
                data-series={(index % 5) + 1}
                aria-hidden="true"
              />
              <span>
                <strong>{body.name}</strong>
                <small>
                  {body.kind}
                  {body.fixed ? ' · fixed' : ''}
                </small>
              </span>
              <code>{body.kind === 'massive' ? scientific(body.mass, 2) : 'm=0'}</code>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * @param {SimulationRuntime} runtime
 * @param {Body} body
 * @param {'position' | 'velocity'} field
 * @param {number} axis
 * @param {number} value
 */
function updateVector(runtime, body, field, axis, value) {
  const vector = Array.from(field === 'position' ? body.position : body.velocity);
  vector[axis] = value;
  runtime.updateBody(
    body.id,
    field === 'position' ? { position: vector } : { velocity: vector },
  );
}

/**
 * @param {{
 *   snapshot: RuntimeSnapshot,
 *   selectedId: number | null,
 *   perform: (label: string, action: () => void) => void,
 * }} props
 */
function PropertyManager({ snapshot, selectedId, perform }) {
  const runtime = useRuntime();
  const coordinateMode = useBaryStore((state) => state.coordinateMode);
  const setCoordinateMode = useBaryStore((state) => state.setCoordinateMode);
  const body =
    snapshot.bodies.find((candidate) => candidate.id === selectedId) ?? null;
  const primaryCandidates = snapshot.bodies.filter(
    (candidate) => candidate.kind === 'massive' && candidate.id !== body?.id,
  );
  const [preferredPrimaryId, setPreferredPrimaryId] = useState(
    /** @type {number | null} */ (null),
  );
  const primary =
    primaryCandidates.find((candidate) => candidate.id === preferredPrimaryId) ??
    primaryCandidates[0] ??
    null;

  const elements = (() => {
    if (!body || !primary) return null;
    try {
      const position = new Float64Array([
        body.position[0] - primary.position[0],
        body.position[1] - primary.position[1],
        body.position[2] - primary.position[2],
      ]);
      const velocity = new Float64Array([
        body.velocity[0] - primary.velocity[0],
        body.velocity[1] - primary.velocity[1],
        body.velocity[2] - primary.velocity[2],
      ]);
      return stateToElements(
        position,
        velocity,
        snapshot.config.G * (primary.mass + body.mass),
        primary.id,
      );
    } catch {
      return null;
    }
  })();

  if (!body) {
    return (
      <Panel title="Property manager">
        <p className={styles.emptyMessage}>Select a body to inspect its state.</p>
      </Panel>
    );
  }

  /** @param {Partial<import('../core/kepler.js').KeplerElements>} patch */
  const updateElements = (patch) => {
    if (!elements || !primary) return;
    perform('Updated Kepler elements for ' + body.name, () => {
      runtime.updateBodyFromKepler(body.id, primary.id, {
        ...elements,
        ...patch,
        anomaly: patch.anomaly ?? elements.anomaly,
      });
    });
  };

  const axisNames = ['X', 'Y', 'Z'];
  return (
    <Panel title="Property manager" meta={'ID ' + body.id}>
      <div className={styles.segmented} aria-label="Coordinate representation">
        <button
          type="button"
          data-active={coordinateMode === 'cartesian' || undefined}
          onClick={() => setCoordinateMode('cartesian')}
        >
          Cartesian
        </button>
        <button
          type="button"
          data-active={coordinateMode === 'kepler' || undefined}
          onClick={() => setCoordinateMode('kepler')}
        >
          Kepler
        </button>
      </div>

      <div className={styles.propertyGrid}>
        <label className={styles.textField}>
          <span>Name</span>
          <input
            key={body.id + ':' + body.name}
            defaultValue={body.name}
            maxLength={80}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== body.name) {
                perform('Renamed body to ' + name, () =>
                  runtime.updateBody(body.id, { name }),
                );
              } else {
                event.target.value = body.name;
              }
            }}
          />
        </label>
        <label className={styles.selectField}>
          <span>Kind</span>
          <select
            value={body.kind}
            onChange={(event) => {
              const kind = event.target.value;
              perform('Changed body kind for ' + body.name, () => {
                if (kind === 'tracer') {
                  runtime.updateBody(body.id, { kind: 'tracer', mass: 0 });
                } else {
                  runtime.updateBody(body.id, {
                    kind: 'massive',
                    mass: Math.max(body.mass, 1e-9),
                  });
                }
              });
            }}
          >
            <option value="massive">Massive</option>
            <option value="tracer">Tracer</option>
          </select>
        </label>
        <NumberField
          label="Mass"
          value={body.mass}
          unit="M☉"
          min={body.kind === 'massive' ? 1e-12 : 0}
          max={1e12}
          disabled={body.kind === 'tracer'}
          onCommit={(mass) =>
            perform('Updated mass for ' + body.name, () =>
              runtime.updateBody(body.id, { mass }),
            )
          }
        />
        <NumberField
          label="Radius"
          value={body.radius ?? 1}
          unit="display"
          min={1e-6}
          max={1e6}
          onCommit={(radius) =>
            perform('Updated display radius for ' + body.name, () =>
              runtime.updateBody(body.id, { radius }),
            )
          }
        />
        <label className={styles.checkField}>
          <input
            type="checkbox"
            checked={body.fixed === true}
            onChange={(event) =>
              perform('Updated fixed constraint for ' + body.name, () =>
                runtime.updateBody(body.id, { fixed: event.target.checked }),
              )
            }
          />
          <span>Fixed position constraint</span>
        </label>
      </div>

      {coordinateMode === 'cartesian' ? (
        <div className={styles.coordinateEditor}>
          <h3>Position · AU</h3>
          {axisNames.map((axis, index) => (
            <NumberField
              key={'p' + axis}
              label={axis}
              value={body.position[index]}
              unit="AU"
              onCommit={(value) =>
                perform('Updated Cartesian position for ' + body.name, () =>
                  updateVector(runtime, body, 'position', index, value),
                )
              }
            />
          ))}
          <h3>Velocity · AU/yr</h3>
          {axisNames.map((axis, index) => (
            <NumberField
              key={'v' + axis}
              label={'V' + axis.toLowerCase()}
              value={body.velocity[index]}
              unit="AU/yr"
              onCommit={(value) =>
                perform('Updated Cartesian velocity for ' + body.name, () =>
                  updateVector(runtime, body, 'velocity', index, value),
                )
              }
            />
          ))}
        </div>
      ) : (
        <div className={styles.coordinateEditor}>
          <label className={styles.selectField}>
            <span>Primary</span>
            <select
              value={primary?.id ?? ''}
              disabled={!primary}
              onChange={(event) => setPreferredPrimaryId(Number(event.target.value))}
            >
              {primaryCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
          {elements ? (
            <>
              <NumberField
                label="a"
                value={elements.a}
                unit="AU"
                min={1e-12}
                onCommit={(a) => updateElements({ a })}
              />
              <NumberField
                label="e"
                value={elements.e}
                min={0}
                max={0.999999999}
                step={0.001}
                onCommit={(e) => updateElements({ e })}
              />
              <NumberField
                label="i"
                value={toDegrees(elements.i)}
                unit="deg"
                onCommit={(i) => updateElements({ i: toRadians(i) })}
              />
              <NumberField
                label="Ω"
                value={toDegrees(elements.Omega)}
                unit="deg"
                onCommit={(Omega) => updateElements({ Omega: toRadians(Omega) })}
              />
              <NumberField
                label="ω"
                value={toDegrees(elements.omega)}
                unit="deg"
                onCommit={(omega) => updateElements({ omega: toRadians(omega) })}
              />
              <NumberField
                label="ν"
                value={toDegrees(elements.anomaly.value)}
                unit="deg"
                onCommit={(value) =>
                  updateElements({
                    anomaly: { type: 'true', value: toRadians(value) },
                  })
                }
              />
            </>
          ) : (
            <p className={styles.emptyMessage}>
              This state is not a supported elliptic orbit relative to a massive
              primary. Use Cartesian editing.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

/** @param {number} value */
function metricLevel(value) {
  if (!Number.isFinite(value) || value >= 1e-3) return 'danger';
  if (value >= 1e-6) return 'warning';
  return 'ok';
}

/** @param {{snapshot: RuntimeSnapshot}} props */
function ConservationMonitor({ snapshot }) {
  const diagnostics = snapshot.diagnostics;
  const metrics = [
    {
      label: 'Energy ΔE/E₀',
      value: diagnostics.energySignedError,
      display: scientific(diagnostics.energySignedError),
    },
    {
      label: 'Angular ΔL/L₀',
      value: diagnostics.angularMomentumError,
      display: scientific(diagnostics.angularMomentumError),
    },
    {
      label: 'Barycenter drift',
      value: diagnostics.centerOfMassDrift,
      display: scientific(diagnostics.centerOfMassDrift),
    },
  ];
  return (
    <section className={styles.monitor} aria-labelledby="monitor-title">
      <header>
        <div>
          <Gauge size={15} aria-hidden="true" />
          <h2 id="monitor-title">Conservation monitor</h2>
        </div>
        <span data-status={snapshot.status}>{snapshot.status}</span>
      </header>
      <div className={styles.monitorMetrics}>
        {metrics.map((metric) => (
          <div key={metric.label} data-level={metricLevel(Math.abs(metric.value))}>
            <span>{metric.label}</span>
            <strong>{metric.display}</strong>
          </div>
        ))}
      </div>
      {diagnostics.constrained ? (
        <p>
          Constrained bodies apply external forces; global conservation is
          diagnostic only.
        </p>
      ) : null}
    </section>
  );
}

/** @param {{snapshot: RuntimeSnapshot}} props */
function FigureDock({ snapshot }) {
  const activeFigure = useBaryStore((state) => state.activeFigure);
  const setActiveFigure = useBaryStore((state) => state.setActiveFigure);
  const series = snapshot.diagnosticsSeries;
  const last = (/** @type {ArrayLike<number>} */ values) =>
    values.length > 0 ? values[values.length - 1] : 0;
  const figures = [
    {
      id: /** @type {'energy'} */ ('energy'),
      label: 'Signed energy error',
      values: series.energySignedError,
      value: scientific(last(series.energySignedError)),
    },
    {
      id: /** @type {'angular'} */ ('angular'),
      label: 'Angular momentum error',
      values: series.angularMomentumError,
      value: scientific(last(series.angularMomentumError)),
    },
    {
      id: /** @type {'separation'} */ ('separation'),
      label: 'Primary separation',
      values: series.separation,
      value: scientific(last(series.separation)) + ' AU',
    },
  ];
  return (
    <aside className={styles.figureDock} aria-label="Analysis figures">
      <header className={styles.dockHeader}>
        <Activity size={15} aria-hidden="true" />
        <div>
          <h2>Figures</h2>
          <span>{series.time.length} samples</span>
        </div>
      </header>
      <div className={styles.figureList}>
        {figures.map((figure) => (
          <section
            key={figure.id}
            data-active={activeFigure === figure.id || undefined}
          >
            <button type="button" onClick={() => setActiveFigure(figure.id)}>
              {figure.label}
            </button>
            <MiniPlot
              label={figure.label}
              values={figure.values}
              valueLabel={figure.value}
            />
          </section>
        ))}
      </div>
      <div className={styles.analysisNote}>
        <strong>Analysis frame</strong>
        <span>{snapshot.frame.type}</span>
        <p>
          Direct O(N²) forces · {snapshot.config.integrator} · fixed Δt
        </p>
      </div>
    </aside>
  );
}

function ConsolePanel() {
  const logs = useBaryStore((state) => state.consoleLogs);
  return (
    <section className={styles.consolePanel} aria-label="Simulation console">
      <header>
        <span>CONSOLE</span>
        <span>{logs.length} events</span>
      </header>
      <div role="log" aria-live="polite">
        {logs.map((entry, index) => (
          <p key={index} data-level={entry.level}>
            <span>{entry.level.toUpperCase()}</span>
            {entry.message}
          </p>
        ))}
      </div>
    </section>
  );
}

/**
 * @param {{
 *   snapshot: RuntimeSnapshot,
 *   presets: import('../scenarios/schema.js').Scenario[],
 *   onPreset: (id: string) => void,
 *   onSave: () => void,
 *   onShare: () => void,
 *   onCsv: () => void,
 *   onRecord: () => void,
 *   onCompose: () => void,
 *   recording: boolean,
 *   perform: (label: string, action: () => void) => void,
 * }} props
 */
function Ribbon({
  snapshot,
  presets,
  onPreset,
  onSave,
  onShare,
  onCsv,
  onRecord,
  onCompose,
  recording,
  perform,
}) {
  const runtime = useRuntime();
  const activeTab = useBaryStore((state) => state.activeRibbonTab);
  const setActiveTab = useBaryStore((state) => state.setActiveRibbonTab);
  const requestCamera = useBaryStore((state) => state.requestCamera);
  const measurementMode = useBaryStore((state) => state.measurementMode);
  const toggleMeasurement = useBaryStore((state) => state.toggleMeasurementMode);
  const massive = snapshot.bodies.filter((body) => body.kind === 'massive');
  const tabs = [
    { id: /** @type {'home'} */ ('home'), label: 'Home' },
    { id: /** @type {'simulation'} */ ('simulation'), label: 'Simulation' },
    { id: /** @type {'analysis'} */ ('analysis'), label: 'Analysis' },
    { id: /** @type {'view'} */ ('view'), label: 'View' },
  ];

  /** @param {'inertial' | 'barycentric' | 'rotating'} type */
  const changeFrame = (type) => {
    perform('Changed analysis frame to ' + type, () => {
      if (type === 'rotating') {
        if (massive.length < 2) {
          throw new Error('A rotating frame requires two massive reference bodies.');
        }
        runtime.updateFrame({
          type,
          refA: massive[0].id,
          refB: massive[1].id,
        });
      } else {
        runtime.updateFrame({ type, refA: null, refB: null });
      }
    });
  };

  return (
    <section className={styles.ribbon}>
      <div className={styles.ribbonTabs} role="tablist" aria-label="Ribbon tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            data-active={activeTab === tab.id || undefined}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.ribbonCommands} role="toolbar" aria-label={activeTab + ' commands'}>
        {activeTab === 'home' ? (
          <>
            <label className={styles.ribbonSelect}>
              <span>Preset</span>
              <select
                aria-label="Load preset"
                value={snapshot.scenarioId}
                onChange={(event) => onPreset(event.target.value)}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.title}
                  </option>
                ))}
              </select>
            </label>
            <CommandButton
              icon={<Sparkles size={18} />}
              label="Natural language"
              onClick={onCompose}
            />
            <CommandButton icon={<Save size={18} />} label="Scenario" onClick={onSave} />
            <CommandButton icon={<Share2 size={18} />} label="Share URL" onClick={onShare} />
            <CommandButton icon={<Download size={18} />} label="CSV" onClick={onCsv} />
            <CommandButton
              icon={recording ? <Square size={18} /> : <Video size={18} />}
              label={recording ? 'Stop WebM' : 'Record WebM'}
              active={recording}
              onClick={onRecord}
            />
          </>
        ) : null}

        {activeTab === 'simulation' ? (
          <>
            <CommandButton
              icon={snapshot.status === 'running' ? <Pause size={19} /> : <Play size={19} />}
              label={snapshot.status === 'running' ? 'Pause' : 'Run'}
              disabled={snapshot.status === 'error'}
              onClick={() =>
                perform(snapshot.status === 'running' ? 'Paused simulation' : 'Started simulation', () => {
                  if (snapshot.status === 'running') runtime.pause();
                  else runtime.play();
                })
              }
            />
            <CommandButton
              icon={<SkipForward size={19} />}
              label="Step"
              disabled={snapshot.status === 'error'}
              onClick={() => perform('Advanced one fixed step', () => runtime.stepOnce())}
            />
            <CommandButton
              icon={<RotateCcw size={19} />}
              label="Reset"
              onClick={() => perform('Reset to the current edit point', () => runtime.reset())}
            />
            <label className={styles.ribbonSelect}>
              <span>Integrator</span>
              <select
                value={snapshot.config.integrator}
                onChange={(event) => {
                  const integrator = event.target.value;
                  if (
                    integrator === 'leapfrog' ||
                    integrator === 'yoshida4' ||
                    integrator === 'rk4'
                  ) {
                    perform('Changed integrator to ' + integrator, () =>
                      runtime.updateConfig({ integrator }),
                    );
                  }
                }}
              >
                <option value="leapfrog">Leapfrog</option>
                <option value="yoshida4">Yoshida 4</option>
                <option value="rk4">RK4 compare</option>
              </select>
            </label>
            <NumberField
              label="Δt"
              value={snapshot.config.dt}
              unit="yr"
              min={1e-9}
              max={10}
              onCommit={(dt) =>
                perform('Changed fixed timestep', () => runtime.updateConfig({ dt }))
              }
            />
            <NumberField
              label="Speed"
              value={snapshot.config.timeScale}
              unit="sim/real"
              min={1e-6}
              max={100}
              onCommit={(timeScale) =>
                perform('Changed playback time scale', () =>
                  runtime.updateConfig({ timeScale }),
                )
              }
            />
          </>
        ) : null}

        {activeTab === 'analysis' ? (
          <>
            <label className={styles.ribbonSelect}>
              <span>Frame</span>
              <select
                value={snapshot.frame.type}
                onChange={(event) => {
                  const type = event.target.value;
                  if (
                    type === 'inertial' ||
                    type === 'barycentric' ||
                    type === 'rotating'
                  ) {
                    changeFrame(type);
                  }
                }}
              >
                <option value="inertial">Inertial</option>
                <option value="barycentric">Barycentric</option>
                <option value="rotating">Rotating pair</option>
              </select>
            </label>
            <CommandButton
              icon={<CircleDot size={19} />}
              label="Zero-velocity"
              active={snapshot.config.rendering.showContours}
              disabled={snapshot.frame.type !== 'rotating'}
              onClick={() =>
                perform('Toggled zero-velocity contours', () =>
                  runtime.updateConfig({
                    rendering: {
                      showContours: !snapshot.config.rendering.showContours,
                    },
                  }),
                )
              }
            />
            <CommandButton
              icon={<Activity size={19} />}
              label="Energy figure"
              active={useBaryStore.getState().activeFigure === 'energy'}
              onClick={() => useBaryStore.getState().setActiveFigure('energy')}
            />
            <CommandButton
              icon={<Gauge size={19} />}
              label="Momentum"
              active={useBaryStore.getState().activeFigure === 'angular'}
              onClick={() => useBaryStore.getState().setActiveFigure('angular')}
            />
          </>
        ) : null}

        {activeTab === 'view' ? (
          <>
            <CommandButton
              icon={<Focus size={19} />}
              label="Fit all"
              onClick={() => requestCamera('fit')}
            />
            <CommandButton
              icon={<ZoomIn size={19} />}
              label="Zoom in"
              onClick={() => requestCamera('zoom-in')}
            />
            <CommandButton
              icon={<ZoomOut size={19} />}
              label="Zoom out"
              onClick={() => requestCamera('zoom-out')}
            />
            <CommandButton
              icon={<Ruler size={19} />}
              label="Measure"
              active={measurementMode}
              onClick={toggleMeasurement}
            />
            <CommandButton
              icon={<Eye size={19} />}
              label="Velocity"
              active={snapshot.config.rendering.showVelocity}
              onClick={() =>
                perform('Toggled velocity vectors', () =>
                  runtime.updateConfig({
                    rendering: {
                      showVelocity: !snapshot.config.rendering.showVelocity,
                    },
                  }),
                )
              }
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * @param {{initialWarning: string | null}} props
 */
function Workbench({ initialWarning }) {
  const runtime = useRuntime();
  const snapshot = useRuntimeSnapshot();
  const presets = useMemo(() => createPresetScenarios(), []);
  const selectedId = useBaryStore((state) => state.selectedId);
  const selectBody = useBaryStore((state) => state.selectBody);
  const notice = useBaryStore((state) => state.notice);
  const recording = useBaryStore((state) => state.recording);
  const [composerOpen, setComposerOpen] = useState(false);
  const addConsoleLog = useBaryStore((state) => state.addConsoleLog);
  const setNotice = useBaryStore((state) => state.setNotice);
  const setRecording = useBaryStore((state) => state.setRecording);
  const requestCamera = useBaryStore((state) => state.requestCamera);
  const toggleMeasurement = useBaryStore((state) => state.toggleMeasurementMode);
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const stopRecordingRef = useRef(/** @type {(() => void) | null} */ (null));
  const warningReported = useRef(false);
  const lastErrorMessage = useRef(/** @type {string | null} */ (null));

  /** @type {(label: string, action: () => void) => void} */
  const perform = useCallback(
    (label, action) => {
      try {
        action();
        addConsoleLog('info', label);
        setNotice(label);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addConsoleLog('error', message);
        setNotice(message);
      }
    },
    [addConsoleLog, setNotice],
  );

  useEffect(
    () =>
      observeRuntimePerformance((metric) => {
        if (metric.name === 'lcp') {
          addConsoleLog(
            metric.valueMs <= 2_500 ? 'info' : 'warning',
            'LCP candidate ' + metric.valueMs.toFixed(1) + ' ms',
          );
        } else {
          addConsoleLog(
            'warning',
            'Long task ' +
              metric.valueMs.toFixed(1) +
              ' ms at ' +
              metric.startTimeMs.toFixed(1) +
              ' ms',
          );
        }
      }),
    [addConsoleLog],
  );

  useEffect(() => {
    if (!initialWarning || warningReported.current) return;
    warningReported.current = true;
    addConsoleLog('warning', initialWarning);
    setNotice(initialWarning);
  }, [addConsoleLog, initialWarning, setNotice]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice, setNotice]);

  useEffect(() => {
    const message = snapshot.lastError?.message ?? null;
    if (!message || message === lastErrorMessage.current) return;
    lastErrorMessage.current = message;
    addConsoleLog('error', 'Safe stop: ' + message);
    setNotice('Simulation stopped safely: ' + message);
  }, [addConsoleLog, setNotice, snapshot.lastError]);

  useEffect(() => {
    /** @param {KeyboardEvent} event */
    const keyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches('input, select, textarea, button') ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        perform(
          runtime.getSnapshot().status === 'running'
            ? 'Paused simulation'
            : 'Started simulation',
          () => {
            if (runtime.getSnapshot().status === 'running') runtime.pause();
            else runtime.play();
          },
        );
      } else if (event.key === '.') {
        perform('Advanced one fixed step', () => runtime.stepOnce());
      } else if (event.key.toLowerCase() === 'f') {
        requestCamera('fit');
      } else if (event.key.toLowerCase() === 'm') {
        toggleMeasurement();
      }
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [perform, requestCamera, runtime, toggleMeasurement]);

  const acceptCanvas = useCallback(
    /** @param {HTMLCanvasElement | null} canvas */ (canvas) => {
      canvasRef.current = canvas;
    },
    [],
  );

  /** @param {string} id */
  const loadPreset = (id) => {
    perform('Loaded preset ' + id, () => {
      runtime.loadScenario(getPresetScenario(id));
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
      requestCamera('fit');
    });
  };

  const saveScenario = () => {
    perform('Exported scenario JSON', () => {
      downloadTextFile(
        snapshot.scenarioId + '.barycenter.json',
        JSON.stringify(runtime.exportScenario(), null, 2) + '\n',
        'application/json',
      );
    });
  };

  const shareScenario = () => {
    perform('Created validated scenario URL', () => {
      const hash = encodeScenarioHash(runtime.exportScenario());
      const url = new URL(window.location.href);
      url.hash = hash;
      window.history.replaceState(null, '', url);
      const clipboard = navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === 'function') {
        void clipboard.writeText(url.toString()).then(
          () => addConsoleLog('info', 'Copied scenario URL to the clipboard'),
          () => addConsoleLog('warning', 'Scenario URL is in the address bar; clipboard access was denied'),
        );
      }
    });
  };

  const exportCsv = () => {
    perform('Exported diagnostics CSV', () => {
      downloadTextFile(
        snapshot.scenarioId + '-diagnostics.csv',
        runtime.exportDiagnosticsCsv(),
        'text/csv;charset=utf-8',
      );
    });
  };

  /** @param {string} filename @param {Blob} blob */
  const downloadBlob = (filename, blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleRecording = () => {
    if (stopRecordingRef.current) {
      stopRecordingRef.current();
      stopRecordingRef.current = null;
      setRecording(false);
      addConsoleLog('info', 'Stopped WebM recording');
      setNotice('Finalizing WebM recording');
      return;
    }
    perform('Started user-triggered WebM recording', () => {
      if (!canvasRef.current) throw new Error('Orbit canvas is not ready.');
      stopRecordingRef.current = startCanvasWebmRecording(
        canvasRef.current,
        (blob) => {
          downloadBlob(snapshot.scenarioId + '.webm', blob);
          setRecording(false);
          stopRecordingRef.current = null;
          addConsoleLog('info', 'Exported WebM recording');
        },
      );
      setRecording(true);
    });
  };

  /** @param {import('../ai/contracts.js').ScenarioDraft} draft @param {'local-reference' | 'proxy'} source */
  const applyScenarioDraft = (draft, source) => {
    perform(
      'Applied reviewed natural-language draft from ' +
        (source === 'proxy' ? 'configured proxy' : 'offline reference'),
      () => {
        runtime.loadScenario(draft.scenario);
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        );
        requestCamera('fit');
        setComposerOpen(false);
      },
    );
  };

  return (
    <div className={styles.appShell}>
      <header className={styles.titlebar}>
        <div className={styles.product}>
          <span className={styles.productMark} aria-hidden="true">
            <CircleDot size={16} />
          </span>
          <strong>Barycenter</strong>
          <span>Product Beta</span>
        </div>
        <div className={styles.documentTitle}>
          <span>{snapshot.title}</span>
          <small>{snapshot.scenarioId}</small>
        </div>
        <div className={styles.titleActions}>
          <button type="button" onClick={saveScenario}>
            <FileJson size={14} aria-hidden="true" />
            Save
          </button>
          <button type="button" onClick={shareScenario}>
            <Share2 size={14} aria-hidden="true" />
            Share
          </button>
        </div>
      </header>

      <Ribbon
        snapshot={snapshot}
        presets={presets}
        onPreset={loadPreset}
        onSave={saveScenario}
        onShare={shareScenario}
        onCsv={exportCsv}
        onRecord={toggleRecording}
        onCompose={() => setComposerOpen(true)}
        recording={recording}
        perform={perform}
      />

      <div className={styles.workspace}>
        <aside className={styles.inspector} aria-label="Specification and properties">
          <SpecificationTree
            snapshot={snapshot}
            selectedId={selectedId}
            onSelect={selectBody}
          />
          <PropertyManager
            snapshot={snapshot}
            selectedId={selectedId}
            perform={perform}
          />
        </aside>

        <main className={styles.centerWorkspace}>
          <GraphicsArea onCanvasReady={acceptCanvas} />
          <ConservationMonitor snapshot={snapshot} />
        </main>

        <FigureDock snapshot={snapshot} />
      </div>

      <ConsolePanel />

      {composerOpen ? (
        <ScenarioComposer
          onApply={applyScenarioDraft}
          onClose={() => setComposerOpen(false)}
          onEvent={addConsoleLog}
        />
      ) : null}

      <footer className={styles.statusbar}>
        <span>
          <i data-status={snapshot.status} aria-hidden="true" />
          {snapshot.status.toUpperCase()}
        </span>
        <span>t = {snapshot.time.toFixed(6)} yr</span>
        <span>step {snapshot.step.toLocaleString()}</span>
        <span>Δt {scientific(snapshot.config.dt, 2)} yr</span>
        <span>{snapshot.config.integrator}</span>
        <span>{Math.round(snapshot.fps)} FPS</span>
        <span>AU · yr · M☉ · G=4π²</span>
      </footer>

      <nav className={styles.mobileControls} aria-label="Simulation controls">
        <button
          type="button"
          aria-label={snapshot.status === 'running' ? 'Pause' : 'Run'}
          onClick={() =>
            perform(snapshot.status === 'running' ? 'Paused simulation' : 'Started simulation', () => {
              if (snapshot.status === 'running') runtime.pause();
              else runtime.play();
            })
          }
        >
          {snapshot.status === 'running' ? <Pause /> : <Play />}
        </button>
        <button
          type="button"
          aria-label="Step once"
          onClick={() => perform('Advanced one fixed step', () => runtime.stepOnce())}
        >
          <SkipForward />
        </button>
        <button type="button" aria-label="Fit all bodies" onClick={() => requestCamera('fit')}>
          <Focus />
        </button>
        <button type="button" aria-label="Reset" onClick={() => perform('Reset simulation', () => runtime.reset())}>
          <RotateCcw />
        </button>
      </nav>

      <div className={styles.notice} role="status" aria-live="polite">
        {notice}
      </div>
    </div>
  );
}

export default function WorkbenchApp() {
  const [initial] = useState(() =>
    resolveInitialScenario(
      typeof window === 'undefined' ? '' : window.location.hash,
    ),
  );
  const [runtime] = useState(() => new SimulationRuntime(initial.scenario));
  return (
    <RuntimeProvider runtime={runtime}>
      <Workbench initialWarning={initial.warning} />
    </RuntimeProvider>
  );
}
