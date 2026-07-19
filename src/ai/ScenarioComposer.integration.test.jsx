// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { useBaryStore } from '../state/store.js';

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

describe('natural-language review and apply flow', () => {
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
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the current world unchanged until a validated draft is applied', async () => {
    const user = userEvent.setup();
    render(<App />);
    const originalTitle = '원형 이체계';
    expect(screen.getAllByText(originalTitle).length).toBeGreaterThan(0);

    const home = screen.getByRole('toolbar', { name: 'home commands' });
    await user.click(
      within(home).getByRole('button', { name: 'Natural language' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Natural-language scenario',
    });
    await user.type(
      within(dialog).getByLabelText('Describe the gravitational system'),
      '태양 두 개와 그 주위를 도는 행성',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate draft' }),
    );

    expect(
      await within(dialog).findByRole('region', {
        name: 'Scenario draft review',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(originalTitle).length).toBeGreaterThan(0);
    expect(screen.getByText('step 0')).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Apply validated draft' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      screen.getAllByText('쌍성 주위를 도는 행성').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('3 bodies')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Simulation' }));
    const simulation = screen.getByRole('toolbar', {
      name: 'simulation commands',
    });
    await user.click(
      within(simulation).getByRole('button', { name: 'Step' }),
    );
    expect(screen.getByText('step 1')).toBeInTheDocument();
  });

  it('reports an unsupported request without disabling manual simulation', async () => {
    const user = userEvent.setup();
    render(<App />);
    const home = screen.getByRole('toolbar', { name: 'home commands' });
    await user.click(
      within(home).getByRole('button', { name: 'Natural language' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Natural-language scenario',
    });
    await user.type(
      within(dialog).getByLabelText('Describe the gravitational system'),
      'an unrecognized speculative arrangement',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Generate draft' }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Draft was not applied',
    );
    expect(screen.getAllByText('원형 이체계').length).toBeGreaterThan(0);

    await user.click(
      within(dialog).getByRole('button', {
        name: 'Close natural-language scenario',
      }),
    );
    await user.click(screen.getByRole('tab', { name: 'Simulation' }));
    const simulation = screen.getByRole('toolbar', {
      name: 'simulation commands',
    });
    await user.click(
      within(simulation).getByRole('button', { name: 'Run' }),
    );
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });
});
