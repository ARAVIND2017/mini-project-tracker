// Installs freshly generated Supabase types into src/lib/database.types.ts and re-applies
// the two local edits. Usage: node scripts/install-db-types.mjs <generated-types-file>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , source] = process.argv;
if (!source) {
  console.error('Usage: node scripts/install-db-types.mjs <generated-types-file>');
  process.exit(1);
}
let types = readFileSync(source, 'utf8');
try {
  const parsed = JSON.parse(types);
  if (typeof parsed?.types === 'string') types = parsed.types;
} catch {
  // Plain TypeScript, not JSON.
}

// app_set_project_domain accepts null (unassigns the domain); the generator cannot express it.
const fixed = types.replace(
  /(app_set_project_domain: \{\s*Args: \{ p_domain_id: string)(;)/,
  '$1 | null$2',
);
if (fixed === types) throw new Error('app_set_project_domain signature not found');

const header = `// Generated from the live Supabase schema (project utkekzbkdtcbmupbxmpp) — do not edit by hand.
// Regenerate after each migration (Supabase MCP \`generate_typescript_types\` or
// \`supabase gen types typescript --project-id utkekzbkdtcbmupbxmpp\`), then run
// \`node scripts/install-db-types.mjs <file>\`, which re-applies the local edits below.
`;
const helpers = `
// Local helpers (kept when regenerating).
type PublicSchema = Database['public'];
export type Views<T extends keyof PublicSchema['Views']> = PublicSchema['Views'][T]['Row'];
export type RpcArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args'];
`;
writeFileSync('src/lib/database.types.ts', header + fixed.trimEnd() + '\n' + helpers);
console.log('✓ src/lib/database.types.ts updated');
