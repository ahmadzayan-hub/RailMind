import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '@/App';

afterEach(cleanup);

describe('RailMind journey', () => {
  it('opens on the asset that most needs the engineer', () => {
    render(<App />);
    // EMU-R24-017 is the worst asset in the sample network.
    expect(screen.getByRole('heading', { name: /EMU set R24-017/ })).toBeInTheDocument();
  });

  it('names every asset state in words, not colour alone', () => {
    render(<App />);
    const node = screen.getByLabelText(/Track section A12: Critical, health 48 of 100/i);
    expect(node).toBeInTheDocument();
  });

  it('shows the drivers behind a recommendation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText(/Track section A12/i));
    expect(screen.getByText('Condition degradation')).toBeInTheDocument();
    expect(screen.getByText(/Health index 48\/100/)).toBeInTheDocument();
  });

  it('refuses to propose a work order on a high-risk asset without a named engineer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText(/EMU set R24-017/i));
    expect(screen.getByText(/Engineer review required/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Accept and propose work order/i }));
    expect(screen.getByText(/anonymous review is not a review/i)).toBeInTheDocument();
    expect(screen.queryByText(/ready for Maximo/i)).not.toBeInTheDocument();
  });

  it('produces a proposal once an engineer is named, and never submits it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText(/EMU set R24-017/i));
    await user.type(screen.getByLabelText(/Reviewing engineer/i), 'A. Zaian');
    await user.click(screen.getByRole('button', { name: /Accept and propose work order/i }));
    const proposal = screen.getByText(/ready for Maximo/i).closest('div')!;
    expect(within(proposal).getByText(/Not submitted/i)).toBeInTheDocument();
  });

  it('records a rejection without producing anything', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText(/EMU set R24-017/i));
    await user.type(screen.getByLabelText(/Reviewing engineer/i), 'A. Zaian');
    await user.click(screen.getByRole('button', { name: /^Reject$/i }));
    expect(screen.getByText(/Recorded as rejected/i)).toBeInTheDocument();
    expect(screen.queryByText(/ready for Maximo/i)).not.toBeInTheDocument();
  });

  it('clears a review when the engineer moves to another asset', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText(/EMU set R24-017/i));
    await user.type(screen.getByLabelText(/Reviewing engineer/i), 'A. Zaian');
    await user.click(screen.getByRole('button', { name: /Accept and propose work order/i }));
    expect(screen.getByText(/ready for Maximo/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Track section A12/i));
    expect(screen.queryByText(/ready for Maximo/i)).not.toBeInTheDocument();
  });

  it('lets a low-risk asset be proposed without a review gate', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText(/Substation 11/i));
    expect(screen.queryByText(/Engineer review required/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Propose Maximo work order/i }));
    expect(screen.getByText(/ready for Maximo/i)).toBeInTheDocument();
  });

  it('says the data is sample data and states the control boundary', () => {
    render(<App />);
    expect(screen.getByText(/Sample network/i)).toBeInTheDocument();
    expect(screen.getByText(/no safety-critical rail control action/i)).toBeInTheDocument();
  });

  it('lists assets worst first and filters without re-scoring', async () => {
    const user = userEvent.setup();
    render(<App />);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: /EMU set R24-017/ })).toBeInTheDocument();
    const all = rows.length;
    await user.click(screen.getByRole('button', { name: /^Healthy \d+/ }));
    const healthy = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(healthy.length).toBeLessThan(all);
    expect(within(screen.getByRole('table')).queryByRole('button', { name: /EMU set R24-017/ })).not.toBeInTheDocument();
  });

  it('opens an asset from the priority list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: /Track section A12/ }));
    expect(screen.getByRole('heading', { name: /Track section A12/ })).toBeInTheDocument();
  });
});
