// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NumberField } from './NumberField.jsx';

describe('scientific NumberField', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('commits finite direct input and restores an out-of-range draft', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const view = render(
      <NumberField
        label="Mass"
        value={1}
        min={0}
        max={5}
        onCommit={onCommit}
      />,
    );
    const input = screen.getByLabelText('Mass');
    await user.clear(input);
    await user.type(input, '2.5');
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(2.5);

    view.rerender(
      <NumberField
        label="Mass"
        value={2.5}
        min={0}
        max={5}
        onCommit={onCommit}
      />,
    );
    await user.clear(input);
    await user.type(input, '9');
    await user.tab();
    expect(input).toHaveValue('2.5');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('scrubs an unbounded coordinate with a finite scale', () => {
    const onCommit = vi.fn();
    render(<NumberField label="X" value={1} onCommit={onCommit} />);
    const handle = screen.getByRole('button', { name: 'Drag to adjust X' });

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
      pointerId: 7,
    });
    fireEvent.pointerMove(handle, { clientX: 110, pointerId: 7 });
    fireEvent.pointerUp(handle, { clientX: 110, pointerId: 7 });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0]).toBeCloseTo(1.025, 12);
  });
});
