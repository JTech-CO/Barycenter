import { create } from 'zustand';

/** @typedef {ReturnType<import('../runtime/simulation-runtime.js').SimulationRuntime['getSnapshot']>} RuntimeSnapshot */

/**
 * @typedef {object} RuntimeSummary
 * @property {number} revision
 * @property {string | null} scenarioId
 * @property {string} title
 * @property {'idle' | 'running' | 'paused' | 'error'} status
 * @property {number} time
 * @property {number} step
 * @property {number} fps
 * @property {number} bodyCount
 * @property {RuntimeSnapshot['config'] | null} config
 * @property {RuntimeSnapshot['diagnostics'] | null} diagnostics
 * @property {RuntimeSnapshot['lastError']} lastError
 *
 * @typedef {object} Measurement
 * @property {number} fromId
 * @property {number} toId
 * @property {number} distance
 *
 * @typedef {object} ConsoleLog
 * @property {'info' | 'warning' | 'error'} level
 * @property {string} message
 *
 * @typedef {object} BaryStore
 * @property {RuntimeSummary} summary
 * @property {number | null} selectedId
 * @property {'home' | 'simulation' | 'analysis' | 'view'} activeRibbonTab
 * @property {'cartesian' | 'kepler'} coordinateMode
 * @property {'energy' | 'angular' | 'separation'} activeFigure
 * @property {boolean} measurementMode
 * @property {number | null} measurementFromId
 * @property {Measurement | null} measurement
 * @property {{type: 'fit' | 'zoom-in' | 'zoom-out', sequence: number}} cameraCommand
 * @property {ConsoleLog[]} consoleLogs
 * @property {string | null} notice
 * @property {boolean} recording
 * @property {(snapshot: RuntimeSnapshot) => void} syncRuntime
 * @property {(selectedId: number | null) => void} selectBody
 * @property {(tab: BaryStore['activeRibbonTab']) => void} setActiveRibbonTab
 * @property {(mode: BaryStore['coordinateMode']) => void} setCoordinateMode
 * @property {(figure: BaryStore['activeFigure']) => void} setActiveFigure
 * @property {() => void} toggleMeasurementMode
 * @property {(id: number, bodies: import('../core/state.js').Body[]) => void} registerMeasurementHit
 * @property {(type: BaryStore['cameraCommand']['type']) => void} requestCamera
 * @property {(level: ConsoleLog['level'], message: string) => void} addConsoleLog
 * @property {(notice: string | null) => void} setNotice
 * @property {(recording: boolean) => void} setRecording
 * @property {() => void} resetUi
 */

/** @type {RuntimeSummary} */
const initialSummary = {
  revision: 0,
  scenarioId: null,
  title: 'Barycenter',
  status: 'idle',
  time: 0,
  step: 0,
  fps: 0,
  bodyCount: 0,
  config: null,
  diagnostics: null,
  lastError: null,
};

/** @type {import('zustand').StateCreator<BaryStore>} */
const createBaryStore = (set) => ({
  summary: initialSummary,
  selectedId: null,
  activeRibbonTab: 'home',
  coordinateMode: 'cartesian',
  activeFigure: 'energy',
  measurementMode: false,
  measurementFromId: null,
  measurement: null,
  cameraCommand: { type: 'fit', sequence: 0 },
  consoleLogs: [
    { level: 'info', message: '수치 코어와 Analysis Alpha 기준선을 불러왔습니다.' },
  ],
  notice: null,
  recording: false,
  syncRuntime: (snapshot) =>
    set((state) => ({
      summary: {
        revision: snapshot.revision,
        scenarioId: snapshot.scenarioId,
        title: snapshot.title,
        status: snapshot.status,
        time: snapshot.time,
        step: snapshot.step,
        fps: snapshot.fps,
        bodyCount: snapshot.bodies.length,
        config: snapshot.config,
        diagnostics: snapshot.diagnostics,
        lastError: snapshot.lastError,
      },
      selectedId:
        state.selectedId != null &&
        snapshot.bodies.some((body) => body.id === state.selectedId)
          ? state.selectedId
          : (snapshot.bodies[0]?.id ?? null),
    })),
  selectBody: (selectedId) =>
    set({ selectedId, measurement: null }),
  setActiveRibbonTab: (activeRibbonTab) => set({ activeRibbonTab }),
  setCoordinateMode: (coordinateMode) => set({ coordinateMode }),
  setActiveFigure: (activeFigure) => set({ activeFigure }),
  toggleMeasurementMode: () =>
    set((state) => ({
      measurementMode: !state.measurementMode,
      measurementFromId: null,
      measurement: null,
    })),
  registerMeasurementHit: (id, bodies) =>
    set((state) => {
      if (!state.measurementMode) return { selectedId: id };
      if (state.measurementFromId == null) {
        return { measurementFromId: id, selectedId: id, measurement: null };
      }
      const from = bodies.find((body) => body.id === state.measurementFromId);
      const to = bodies.find((body) => body.id === id);
      if (!from || !to || from.id === to.id) {
        return { measurementFromId: id, selectedId: id, measurement: null };
      }
      return {
        selectedId: id,
        measurementFromId: null,
        measurement: {
          fromId: from.id,
          toId: to.id,
          distance: Math.hypot(
            to.position[0] - from.position[0],
            to.position[1] - from.position[1],
            to.position[2] - from.position[2],
          ),
        },
      };
    }),
  requestCamera: (type) =>
    set((state) => ({
      cameraCommand: { type, sequence: state.cameraCommand.sequence + 1 },
    })),
  addConsoleLog: (level, message) =>
    set((state) => ({
      consoleLogs: [...state.consoleLogs, { level, message }].slice(-50),
    })),
  setNotice: (notice) => set({ notice }),
  setRecording: (recording) => set({ recording }),
  resetUi: () =>
    set({
      summary: initialSummary,
      selectedId: null,
      activeRibbonTab: 'home',
      coordinateMode: 'cartesian',
      activeFigure: 'energy',
      measurementMode: false,
      measurementFromId: null,
      measurement: null,
      cameraCommand: { type: 'fit', sequence: 0 },
      consoleLogs: [
        { level: 'info', message: 'Barycenter 세션을 초기화했습니다.' },
      ],
      notice: null,
      recording: false,
    }),
});

export const useBaryStore = create(createBaryStore);
