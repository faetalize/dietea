# Meal Prep Planner Documentation

- Architecture and file layout: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- Module-by-module reference: [MODULE_GUIDE.md](MODULE_GUIDE.md)
- How the current architecture came about: [REFACTORING.md](REFACTORING.md)

## App overview

A single-page vanilla JavaScript webapp for meal prep planning, backed by Supabase.
No build step and no framework — `index.html` loads `main.js` as an ES module and
everything else is imported from `js/`. The only dependency, `supabase-js`, is vendored
into `js/vendor/` rather than loaded from a CDN, so the deployed site is entirely
self-contained.

The app has five tabs plus a settings panel:

| Tab | What it does |
| --- | --- |
| Shopping | Ingredient totals aggregated from the current schedule, with checkable rows |
| Schedule | The planned week as a list or a calendar, plus the schedule editor and weekly calorie/macro overview |
| Menu | Meal cards; create, edit, delete, import, and drill into a meal's recipe |
| Ingredients | The ingredient database; create, edit, delete, import |
| Supplements | Daily supplement adherence and water tracking |
| Settings (gear) | Profile, start day, account, and destructive data actions |

## Exposing the schema

All tables live in a dedicated `dietea` Postgres schema rather than `public`. PostgREST
only serves schemas that are explicitly exposed, and a custom schema is never exposed by
default. Until it is, every request fails with `PGRST106` and the app surfaces
*"The dietea schema is not exposed by the API…"*.

On this project it is **already done**, applied as PostgREST in-database configuration:

```sql
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, dietea';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
```

**Both notifies are required.** `reload config` alone makes reads start working while
writes keep failing with a bare `404` and an empty body — adding a schema changes which
tables PostgREST has introspected, and that cache only rebuilds on `reload schema`. That
failure is very hard to read, because an empty body means the error carries no code or
message at all.

To undo it: `alter role authenticator reset pgrst.db_schemas;` plus the same two notifies.

### Caveat: the dashboard no longer reflects reality

In-database config takes precedence over the platform's own setting, so **Project
Settings → API → Exposed schemas will still show only `public` and `graphql_public`**, and
editing it there may appear to do nothing.

If you would rather have one source of truth, set `dietea` in the dashboard and then
`reset` the role setting above. Doing it through the dashboard is the more conventional
route; it was done in SQL here only because the dashboard was not reachable at the time.

## Getting started

1. Start a local server — the app cannot run from `file://`:

   ```bash
   npm run dev
   ```

2. Open <http://localhost:3000>.
3. Create an account, or sign in.
4. Complete onboarding (age, sex, weight, height, activity level, goal weight, goal
   timeframe). That produces your maintenance and target calories.

On first sign-in the account is seeded from the bundled `ingredients.json` and
`menu.json` so you start with a working ingredient database and menu rather than an empty
app. After that those two files are inert — they are starter data, not the database.

## Where data lives

Everything is in Postgres, in the `dietea` schema, one row set per user and isolated by
row level security:

| Table | Holds | Shape |
| --- | --- | --- |
| `dietea.profiles` | Body/goal profile, start day, onboarding flag, shopping checkmarks | One row per user |
| `dietea.ingredients` | The ingredient database | One row per ingredient |
| `dietea.meals` | Recipes; nested entries and instructions are JSONB | One row per meal |
| `dietea.schedules` | The 7-day plan | One row per user |
| `dietea.supplement_days` | Supplement and water tracking | One row per user per day |

Nothing is kept in `localStorage` any more except the Supabase session itself, stored
under the `dietea-auth` key by `supabase-js`.

`supplement_days` is keyed by date rather than overwritten daily, so the tracker keeps
history instead of discarding yesterday. The app reads the most recent row and starts a
fresh day when that row is not today's, carrying the bottle-size preference forward.

## Auth

Email and password via Supabase Auth. The session persists and auto-refreshes, so signing
in once per device is enough.

If the project requires email confirmation, sign-up returns no session — the app detects
this and tells the user to check their inbox rather than pretending they are signed in.

Row level security is what actually protects the data: every policy is
`auth.uid() = user_id`, so the publishable key in `js/config.js` is safe to commit and a
signed-out client can read nothing.

## Data integrity

Three things worth knowing, all inherited from the original design:

- **Dangling `mealId`s.** The schedule references meals by id with no foreign key, so
  deleting a meal leaves the slot rendering "Unassigned meal" rather than erroring.
- **Silent calorie under-reporting.** `hydrateMeal` substitutes a zero-macro placeholder
  when a meal's `itemId` no longer resolves. The meal still looks right but weighs
  nothing. This is deliberate — it is why meal rows keep a denormalized `itemName` and
  `itemUnit`.
- **Orphaned checkmarks.** Shopping state is keyed `<category-slug>-<item-id>`, so
  renaming a category or ingredient id abandons its checkmarks.

## Deploying to Cloudflare Pages

The frontend is static. Point Pages at the repository root with **no build command** and
the output directory set to `/`. There are no environment variables to configure: the
Supabase URL and publishable key are committed in `js/config.js` and are safe to expose.

Add your Pages domain to **Supabase → Authentication → URL Configuration** so auth
redirects resolve correctly.

Exclude `node_modules/`, `scripts/`, and `supabase/` from the deployment if your host
supports it — they are development-only. Nothing in them is served.

## Development

```bash
npm run dev
```

Serves the repo root on port 3000 with live reload.

The `--ignorePattern` regex is double-quoted deliberately. Single quotes break the script
on Windows: `npm` runs scripts through `cmd.exe`, which does not treat `'` as a quote, so
the `|` characters in the regex are parsed as pipes and the server fails to start
outright. Double quotes are stripped by both `cmd.exe` and POSIX shells, and the `$`
sequences in the pattern are not valid parameter expansions, so it survives intact on
both.

### Regenerating the vendored Supabase bundle

```bash
npm install
npm run vendor:supabase
```

That bundles `scripts/supabase-entry.js` with esbuild into `js/vendor/supabase.js`, which
is committed. `node_modules/` is only needed to regenerate it — the app itself never
needs an install.

### Migrations

SQL lives in `supabase/migrations/`, named to match the versions recorded in the remote
`supabase_migrations.schema_migrations` table so local and remote history line up.
