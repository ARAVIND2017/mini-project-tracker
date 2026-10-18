import { parseCsv, rosterRowsFromCsv } from './csv';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and newlines inside quotes', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n1,"line\nbreak",3')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', 'line\nbreak', '3'],
    ]);
  });

  it('handles CRLF, a BOM, trailing newlines and empty cells', () => {
    expect(parseCsv('\uFEFFx,y\r\n1,\r\n\r\n')).toEqual([
      ['x', 'y'],
      ['1', ''],
    ]);
  });

  it('rejects an unclosed quote', () => {
    expect(() => parseCsv('a,"b')).toThrow('unclosed quote');
  });
});

describe('rosterRowsFromCsv', () => {
  it('maps common header names and keeps values exactly as written', () => {
    const csv =
      'Sl No,USN,Student Name,Email ID,Drive Link,Domain,Remarks\n' +
      '1,1XX26CS001, Test Student ,test@example.test,https://drive.google.com/x,AI,ok\n' +
      '2,,,,,,\n';
    const parsed = rosterRowsFromCsv(csv);
    expect(parsed.rows).toEqual([
      {
        slot_no: '1',
        institution_id: '1XX26CS001',
        full_name: ' Test Student ',
        email: 'test@example.test',
        drive_folder_url: 'https://drive.google.com/x',
        domain_name: 'AI',
      },
      {
        slot_no: '2',
        institution_id: '',
        full_name: '',
        email: '',
        drive_folder_url: '',
        domain_name: '',
      },
    ]);
    expect(parsed.ignoredColumns).toEqual(['Remarks']);
  });

  it('requires a slot number column', () => {
    expect(() => rosterRowsFromCsv('name,email\nA,a@example.test')).toThrow('slot_no');
  });

  it('rejects duplicate column mappings and empty files', () => {
    expect(() => rosterRowsFromCsv('slot_no,name,student name\n1,A,B')).toThrow('Two columns');
    expect(() => rosterRowsFromCsv('')).toThrow('empty');
    expect(() => rosterRowsFromCsv('slot_no,name\n')).toThrow('no rows');
  });
});
