import { DEFAULT_STAGE_WEIGHTS, ENUMS, STAGES } from './constants';

// Raw text of every migration, in file order (ADR-007: enums are defined once in SQL
// and mirrored here; this test fails if the two drift apart).
const migrations = import.meta.glob('/supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function sqlEnums(): Record<string, string[]> {
  const sql = Object.keys(migrations)
    .sort()
    .map((file) => migrations[file])
    .join('\n');
  const found: Record<string, string[]> = {};
  const createType = /create\s+type\s+public\.(\w+)\s+as\s+enum\s*\(([^)]*)\)/gi;
  for (const [, name = '', body = ''] of sql.matchAll(createType)) {
    found[name] = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
  }
  const addValue =
    /alter\s+type\s+public\.(\w+)\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']+)'/gi;
  for (const [, name = '', value = ''] of sql.matchAll(addValue)) {
    found[name]?.push(value);
  }
  return found;
}

describe('domain constants', () => {
  it('match the Postgres enum types in the migrations exactly', () => {
    const expected = Object.fromEntries(
      Object.entries(ENUMS).map(([name, values]) => [name, [...values]]),
    );
    expect(sqlEnums()).toEqual(expected);
  });

  it('define the nine stages in order, with dependencies on earlier stages only', () => {
    expect(STAGES.map((s) => s.key)).toEqual(ENUMS.stage_key);
    STAGES.forEach((stage, index) => {
      expect(stage.no).toBe(index + 1);
      for (const dep of stage.dependsOn) {
        expect(ENUMS.stage_key.indexOf(dep)).toBeLessThan(index);
      }
    });
  });

  it('use default stage weights that total 100', () => {
    const total = Object.values(DEFAULT_STAGE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });
});
