import { csvFileName, toCsv, type CsvColumn } from '@/domain/csv';
import { downloadText } from '@/lib/download';

/** "Export CSV" for a table (FUN-17). Exports exactly the rows passed in. */
export function ExportCsvButton<T>({
  rows,
  columns,
  name,
  label = 'Export CSV',
}: {
  rows: readonly T[];
  columns: readonly CsvColumn<T>[];
  name: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={rows.length === 0}
      onClick={() => downloadText(csvFileName(name), toCsv(rows, columns))}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
    >
      {label}
    </button>
  );
}
