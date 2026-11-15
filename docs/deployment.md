# Deployment (Render)

Hosted at https://valuebite.onrender.com (Render free web service, Oregon).

## How data gets to the live site

Pages serve from `data/snapshot.json` when it exists (see `src/modules/db/snapshot.ts`); PGlite is dev-only.

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Do NOT add `npm run seed` / `npm run snapshot` to the build command: `seed.ts` rebuilds the DB from static test fixtures, which would overwrite the real refreshed data in the committed `data/snapshot.json`.

## Refresh flow

1. `npx tsx scripts/refresh.ts 33613` (writes local PGlite from live chain APIs)
2. `npm run snapshot` (exports PGlite to `data/snapshot.json`)
3. Commit + push `data/snapshot.json`
4. Trigger a manual deploy (this service was created via the Render API and has no GitHub webhook):
   `POST https://api.render.com/v1/services/<id>/deploys` with `{"clearCache":"do_not_clear"}`
