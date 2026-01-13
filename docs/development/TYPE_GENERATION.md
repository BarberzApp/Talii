# Supabase Type Generation

This repo uses **Supabase schema-generated TypeScript types** as the longer-term source of truth.

The generated output lives at:

- `packages/shared/src/types/database.ts`

## Generate types (recommended: remote)

You can generate types against your hosted Supabase project **without running Docker**.

Set the following environment variables (either exported in your shell *or* placed in repo root `.env` — the generator loads `.env` automatically):

- `SUPABASE_ACCESS_TOKEN`: Personal access token from the Supabase dashboard
- `SUPABASE_PROJECT_REF` (or `PROJECT_REF` / `SUPABASE_PROJECT_ID`): the project ref (e.g. `abcd1234efgh5678`)

Then run:

```bash
npm run types:generate
```

Notes:
- The Supabase CLI will use `SUPABASE_ACCESS_TOKEN` automatically (no interactive `supabase login` needed).
- We generate for `--schema public`.

## Generate types (local)

If you're running Supabase locally:

```bash
supabase start
SUPABASE_GEN_MODE=local npm run types:generate
```

## How to use the generated types

`packages/shared/src/types/index.ts` re-exports:

- `Database`
- `Json`

So you can import from the shared package:

```ts
import type { Database } from "@barber-app/shared";
```

## When to regenerate

Regenerate types whenever:

- You add or modify migrations under `supabase/migrations/`
- You change DB constraints, column names, or table shapes

If your app code compiles but runtime DB calls fail with column/constraint errors, regenerate first to detect drift early.

