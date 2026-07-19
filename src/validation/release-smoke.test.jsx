// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { useBaryStore } from '../state/store.js';

describe('Core v1 CPU fallback smoke', () => {
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
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
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

  it('keeps default load, stepping, diagnostics, and CSV usable without Canvas', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn().mockReturnValue('blob:csv');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<App />);

    expect(
      await screen.findByText(/Canvas 2D is unavailable/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('원형 이체계').length).toBeGreaterThan(0);
    expect(screen.getByText('Energy ΔE/E₀')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Simulation' }));
    let toolbar = screen.getByRole('toolbar', {
      name: 'simulation commands',
    });
    await user.click(within(toolbar).getByRole('button', { name: 'Step' }));
    expect(screen.getByText('step 1')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Home' }));
    toolbar = screen.getByRole('toolbar', { name: 'home commands' });
    await user.click(within(toolbar).getByRole('button', { name: 'CSV' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
  });

  it('reports unsupported WebM without stopping the CPU simulation', async () => {
    const user = userEvent.setup();
    render(<App />);
    const toolbar = screen.getByRole('toolbar', { name: 'home commands' });
    await user.click(
      within(toolbar).getByRole('button', { name: 'Record WebM' }),
    );
    expect(
      (await screen.findAllByText(/WebM 캡처를 지원하지 않습니다/)).length,
    ).toBeGreaterThan(0);
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
