/**
 * Safe automation wrapper for type generation.
 *
 * - If SUPABASE_GEN_MODE=local: runs local typegen (requires Docker + `supabase start`)
 * - Else: runs remote typegen ONLY if a Supabase project ref is present
 *   (PROJECT_REF / SUPABASE_PROJECT_REF / SUPABASE_PROJECT_ID)
 *
 * This prevents install/build flows from failing in environments that don't have Supabase configured.
 */
const { spawnSync } = require('node:child_process');

function hasProjectRef() {
  return Boolean(
    process.env.PROJECT_REF ||
      process.env.SUPABASE_PROJECT_REF ||
      process.env.SUPABASE_PROJECT_ID
  );
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  process.exit(res.status ?? 1);
}

const mode = (process.env.SUPABASE_GEN_MODE || '').toLowerCase();

if (mode === 'local') {
  console.log('ℹ️  Running local type generation (SUPABASE_GEN_MODE=local)...');
  run('npm', ['run', 'types:generate:local']);
}

if (!hasProjectRef()) {
  console.log(
    'ℹ️  Skipping type generation (no Supabase project ref env set). ' +
      'Set PROJECT_REF (or SUPABASE_PROJECT_REF / SUPABASE_PROJECT_ID) to enable.'
  );
  process.exit(0);
}

console.log('ℹ️  Running remote type generation...');
run('npm', ['run', 'types:generate']);

