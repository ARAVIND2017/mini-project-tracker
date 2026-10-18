/**
 * Minimal RFC 4180 CSV reader (quotes, escaped quotes, commas and newlines inside
 * quotes, CRLF/LF, UTF-8 BOM). Values are returned exactly as written.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error('The file has an unclosed quote');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop completely empty lines (e.g. a trailing newline).
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export interface RosterRow {
  slot_no: string;
  institution_id?: string;
  full_name?: string;
  email?: string;
  drive_folder_url?: string;
  domain_name?: string;
}

const HEADER_ALIASES: Record<keyof RosterRow, string[]> = {
  slot_no: ['slot_no', 'slot', 'slot number', 'sl no', 'sl. no', 'sl.no', 's.no', 'sno', 'no'],
  institution_id: [
    'institution_id',
    'student id',
    'student_id',
    'usn',
    'roll no',
    'roll number',
    'register number',
    'id',
  ],
  full_name: ['full_name', 'name', 'student name', 'full name'],
  email: ['email', 'email id', 'e-mail', 'email address'],
  drive_folder_url: [
    'drive_folder_url',
    'drive',
    'drive link',
    'drive folder',
    'google drive',
    'drive url',
  ],
  domain_name: ['domain_name', 'domain', 'project domain'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ParsedRoster {
  rows: RosterRow[];
  /** Columns found, by roster field. */
  columns: Partial<Record<keyof RosterRow, string>>;
  ignoredColumns: string[];
}

/** Maps a roster CSV to rows for app_import_roster. Throws with a clear message on header problems. */
export function rosterRowsFromCsv(text: string): ParsedRoster {
  const table = parseCsv(text);
  if (table.length === 0) throw new Error('The file is empty');
  const [header = [], ...body] = table;
  const index: Partial<Record<keyof RosterRow, number>> = {};
  const columns: ParsedRoster['columns'] = {};
  const ignoredColumns: string[] = [];

  header.forEach((raw, i) => {
    const name = normalizeHeader(raw);
    const field = (Object.keys(HEADER_ALIASES) as (keyof RosterRow)[]).find((f) =>
      HEADER_ALIASES[f].includes(name),
    );
    if (!field) {
      if (raw.trim()) ignoredColumns.push(raw.trim());
      return;
    }
    if (index[field] !== undefined)
      throw new Error(`Two columns map to "${field}": check the headers`);
    index[field] = i;
    columns[field] = raw.trim();
  });

  if (index.slot_no === undefined) {
    throw new Error('The file needs a "slot_no" column (slot number 1, 2, 3 …)');
  }
  if (body.length === 0) throw new Error('The file has a header but no rows');

  const rows = body.map((cells) => {
    const row: RosterRow = { slot_no: cells[index.slot_no as number] ?? '' };
    for (const field of Object.keys(index) as (keyof RosterRow)[]) {
      if (field === 'slot_no') continue;
      const value = cells[index[field] as number];
      if (value !== undefined) row[field] = value;
    }
    return row;
  });
  return { rows, columns, ignoredColumns };
}

export const ROSTER_TEMPLATE =
  'slot_no,institution_id,full_name,email,drive_folder_url,domain\n' + '1,,,,,\n' + '2,,,,,\n';
