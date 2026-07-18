// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { createPresetScenarios } from '../scenarios/presets.js';
import { SCENARIO_HASH_PREFIX } from '../scenarios/schema.js';
import { useBaryStore } from '../state/store.js';
import { resolveInitialScenario } from './initial-scenario.js';

/** @returns {CanvasRenderingContext2D} */
function createCanvasContext() {
  return /** @type {CanvasRenderingContext2D} */ (
    /** @type {unknown} */ ({
      arc: vi.fn(),
      beginPath: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      setLineDash: vi.fn(),
      setTransform: vi.fn(),
      stroke: vi.fn(),
    })
  );
}

describe('Product Beta workbench flow', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    useBaryStore.getState().resetUi();
    let frameId = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => {
        frameId += 1;
        return frameId;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('ResizeObserver', undefined);
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      createCanvasContext(),
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      'getBoundingClientRect',
    ).mockReturnValue(
      /** @type {DOMRect} */ ({
        bottom: 500,
        height: 500,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads, runs, steps, edits, resets, shares, and restores a preset', async () => {
    const user = userEvent.setup();
    const presets = createPresetScenarios();
    const figureEight = presets.find((preset) => preset.id.includes('figure'));
    expect(figureEight).toBeDefined();

    const firstRender = render(<App />);
    const presetSelect = await screen.findByLabelText('Load preset');
    await user.selectOptions(presetSelect, figureEight?.id ?? '');
    expect(screen.getAllByText(figureEight?.title ?? '').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Simulation' }));
    let toolbar = screen.getByRole('toolbar', { name: 'simulation commands' });
    await user.click(within(toolbar).getByRole('button', { name: 'Run' }));
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    await user.click(within(toolbar).getByRole('button', { name: 'Pause' }));
    await user.click(within(toolbar).getByRole('button', { name: 'Step' }));
    expect(screen.getByText('step 1')).toBeInTheDocument();

    const bodyTree = screen.getByRole('list', { name: 'Simulation bodies' });
    const bodyButtons = within(bodyTree).getAllByRole('button');
    await user.click(bodyButtons[1]);
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Edited secondary');
    await user.tab();
    expect(screen.getAllByText('Edited secondary').length).toBeGreaterThan(0);

    await user.click(within(toolbar).getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('step 0')).toBeInTheDocument();
    expect(screen.getAllByText('Edited secondary').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Home' }));
    toolbar = screen.getByRole('toolbar', { name: 'home commands' });
    await user.click(within(toolbar).getByRole('button', { name: 'Share URL' }));
    expect(window.location.hash.startsWith(SCENARIO_HASH_PREFIX)).toBe(true);
    const sharedHash = window.location.hash;

    firstRender.unmount();
    useBaryStore.getState().resetUi();
    window.history.replaceState(null, '', '/' + sharedHash);
    render(<App />);

    expect(await screen.findByText('Edited secondary')).toBeInTheDocument();
    expect(screen.getAllByText(figureEight?.title ?? '').length).toBeGreaterThan(0);
    expect(screen.getByText('step 0')).toBeInTheDocument();
  });

  it('rejects a malformed shared payload and returns a safe preset', () => {
    const resolved = resolveInitialScenario(
      SCENARIO_HASH_PREFIX + 'not-a-valid-compressed-payload',
    );
    expect(resolved.warning).toMatch(/rejected/i);
    expect(resolved.scenario.id).toBe(createPresetScenarios()[0].id);
  });
});
