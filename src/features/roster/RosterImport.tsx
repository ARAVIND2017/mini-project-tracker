import { useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import { ROSTER_TEMPLATE, rosterRowsFromCsv, type RosterRow } from '@/domain/csv';
import { importRoster, type ImportReport } from '@/lib/api';

const ACTION_LABEL = { create: 'New', update: 'Change', unchanged: 'No change' } as const;

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([ROSTER_TEMPLATE], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'roster-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV → preview (nothing written) → confirm (all-or-nothing import). */
export function RosterImport({
  semesterId,
  onImported,
}: {
  semesterId: string;
  onImported: () => Promise<void>;
}) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    setError(null);
    setDone(null);
    setReport(null);
    setRows(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = rosterRowsFromCsv(await file.text());
      setRows(parsed.rows);
      setIgnored(parsed.ignoredColumns);
      setBusy(true);
      setReport(await importRoster(semesterId, parsed.rows, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importRoster(semesterId, rows, false);
      setDone(
        `Imported: ${result.counts.create} new, ${result.counts.update} changed, ${result.counts.unchanged} unchanged. ` +
          `${result.filled_after} of ${result.capacity} places are now filled.`,
      );
      setReport(null);
      setRows(null);
      setFileName('');
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import failed. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Import roster from CSV"
      actions={
        <Button variant="secondary" onClick={downloadTemplate}>
          Download template
        </Button>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Columns: <code>slot_no</code> (required), <code>institution_id</code>,{' '}
        <code>full_name</code>, <code>email</code>, <code>drive_folder_url</code>,{' '}
        <code>domain</code>. Values are stored exactly as written; a row with only a slot number
        stays an empty slot. You will see a preview before anything is saved.
      </p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-700">
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        Choose CSV file
      </label>
      {fileName && (
        <span className="ml-2 text-sm text-slate-600 dark:text-slate-300">{fileName}</span>
      )}
      {busy && (
        <p className="mt-3 text-sm" role="status">
          Checking…
        </p>
      )}
      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {done && (
        <div className="mt-3">
          <Alert tone="success">{done}</Alert>
        </div>
      )}
      {ignored.length > 0 && report && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Ignored columns: {ignored.join(', ')}
        </p>
      )}

      {report && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            <strong>Preview:</strong> {report.counts.create} new, {report.counts.update} changed,{' '}
            {report.counts.unchanged} unchanged · {report.filled_after} of {report.capacity} places
            would be filled.
          </p>
          {report.filled_after > report.capacity && (
            <Alert tone="error">
              This would exceed the semester capacity of {report.capacity}. Remove rows or raise the
              capacity in the semester settings.
            </Alert>
          )}
          {report.errors.length > 0 && (
            <div>
              <Alert tone="error">
                {report.errors.length} row(s) need fixing. Correct the file and choose it again.
              </Alert>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800 dark:text-red-200">
                {report.errors.map((e) => (
                  <li key={`${e.row}-${e.message}`}>
                    Row {e.row}
                    {e.slot_no ? ` (slot ${e.slot_no})` : ''}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.rows.length > 0 && (
            <div className="-mx-4 max-h-80 overflow-auto">
              <table className="data-table">
                <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-1 font-medium">Slot</th>
                    <th className="px-4 py-1 font-medium">Name</th>
                    <th className="px-4 py-1 font-medium">Student ID</th>
                    <th className="px-4 py-1 font-medium">Email</th>
                    <th className="px-4 py-1 font-medium">Domain</th>
                    <th className="px-4 py-1 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.rows.map((r) => (
                    <tr key={r.slot_no}>
                      <td className="px-4 py-1">{r.slot_no}</td>
                      <td className="px-4 py-1">
                        {r.full_name ?? (
                          <em className="text-slate-500 dark:text-slate-400">empty slot</em>
                        )}
                      </td>
                      <td className="px-4 py-1">{r.institution_id ?? '—'}</td>
                      <td className="px-4 py-1">{r.email ?? '—'}</td>
                      <td className="px-4 py-1">{r.domain_name ?? '—'}</td>
                      <td className="px-4 py-1">{ACTION_LABEL[r.action]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2">
            <Button busy={busy} disabled={!report.ok} onClick={confirm}>
              Import {report.counts.create + report.counts.update} row(s)
            </Button>
            <Button variant="secondary" onClick={() => onFile(undefined)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
