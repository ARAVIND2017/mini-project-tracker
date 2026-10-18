import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ImportReport } from '@/lib/api';

const importRoster = vi.fn();
vi.mock('@/lib/api', () => ({ importRoster: (...args: unknown[]) => importRoster(...args) }));

const { RosterImport } = await import('./RosterImport');

function report(overrides: Partial<ImportReport>): ImportReport {
  return {
    dry_run: true,
    ok: true,
    counts: { create: 2, update: 0, unchanged: 0 },
    errors: [],
    rows: [
      {
        row: 1,
        slot_no: 1,
        action: 'create',
        filled: true,
        full_name: 'Test Student 01',
        institution_id: 'ID1',
        email: null,
        domain_name: null,
      },
      {
        row: 2,
        slot_no: 2,
        action: 'create',
        filled: false,
        full_name: null,
        institution_id: null,
        email: null,
        domain_name: null,
      },
    ],
    filled_after: 1,
    capacity: 30,
    ...overrides,
  };
}

const csv = new File(
  ['slot_no,full_name,institution_id\n1,Test Student 01,ID1\n2,,\n'],
  'roster.csv',
  { type: 'text/csv' },
);

describe('RosterImport', () => {
  beforeEach(() => importRoster.mockReset());

  it('previews first, then imports only after confirmation', async () => {
    const onImported = vi.fn().mockResolvedValue(undefined);
    importRoster
      .mockResolvedValueOnce(report({}))
      .mockResolvedValueOnce(report({ dry_run: false }));
    render(<RosterImport semesterId="sem-1" onImported={onImported} />);

    await userEvent.upload(screen.getByLabelText('Choose CSV file'), csv);
    expect(await screen.findByText(/Preview:/)).toBeInTheDocument();
    expect(importRoster).toHaveBeenCalledWith(
      'sem-1',
      [
        { slot_no: '1', full_name: 'Test Student 01', institution_id: 'ID1' },
        { slot_no: '2', full_name: '', institution_id: '' },
      ],
      true,
    );
    expect(screen.getByText('empty slot')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Import 2 row(s)' }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(importRoster).toHaveBeenLastCalledWith('sem-1', expect.any(Array), false);
    expect(screen.getByText(/Imported: 2 new/)).toBeInTheDocument();
  });

  it('keeps the import button disabled when rows have problems', async () => {
    importRoster.mockResolvedValueOnce(
      report({ ok: false, errors: [{ row: 3, slot_no: 3, message: '"x" is not a valid email' }] }),
    );
    render(<RosterImport semesterId="sem-1" onImported={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Choose CSV file'), csv);
    expect(await screen.findByText(/is not a valid email/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import/ })).toBeDisabled();
  });

  it('explains a missing slot column without calling the server', async () => {
    render(<RosterImport semesterId="sem-1" onImported={vi.fn()} />);
    await userEvent.upload(
      screen.getByLabelText('Choose CSV file'),
      new File(['name\nA\n'], 'bad.csv', { type: 'text/csv' }),
    );
    expect(await screen.findByText(/needs a "slot_no" column/)).toBeInTheDocument();
    expect(importRoster).not.toHaveBeenCalled();
  });
});
