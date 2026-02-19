# Deploy backend to Render (step-by-step)

## 1) Create Render service from GitHub

1. Open Render Dashboard.
2. Click `New +` -> `Blueprint`.
3. Select repo: `Draeziel/TeleDnD`.
4. Render detects `render.yaml` and creates:
   - Web service: `telednd-backend`
   - Postgres: `telednd-db`
5. Click `Apply`.

## 2) Wait for first deploy

Render runs:
- `npm ci && npm run build`
- `npx prisma migrate deploy && node dist/server.js`

When status is `Live`, open backend URL:

- `https://<your-render-service>.onrender.com/api/characters/classes`

Expected: HTTP 200 (array response).

Also verify probes:

- `GET /livez` -> `status=alive`
- `GET /healthz` -> `status=ok`
- `GET /readyz` -> `status=ready`
- `GET /metricsz` -> contains `metrics.totals`

## 3) Seed initial game data (one-time)

Open Render -> service -> `Shell` and run:

```bash
npm run seed
```

Then re-check:

- `GET /api/characters/classes`

Expected: seeded classes (e.g., Barbarian, Bard).

## 4) Connect Cloudflare Pages frontend to this backend

In Cloudflare Pages project:

1. `Settings` -> `Environment variables`
2. Add:
   - `VITE_API_URL = https://<your-render-service>.onrender.com/api`
3. Trigger `Redeploy`.

## 5) Verify end-to-end

- Open `https://telednd.pages.dev`
- Try create draft / character flow.
- If this works in browser, repeat in Telegram WebApp.

## Notes

- Keep backend URL HTTPS only.
- If Render free tier sleeps, first request may take longer.

## Auto-deploy and manual trigger

Render Web Service auto-deploy is **event-based** (new commit/push), not cron-based.

- There is usually no schedule setting for this mode.
- Deploy starts when you push to the tracked branch (for example, `main`).

To trigger deploy manually from this repo, run:

```powershell
./trigger-deploy.ps1
```

What it does:
- updates `deploy-trigger.txt` timestamp,
- creates a git commit,
- pushes to `origin/main` (or another branch via `-Branch`).

Useful options:

```powershell
# Commit locally, do not push
./trigger-deploy.ps1 -NoPush

# Push to another branch
./trigger-deploy.ps1 -Branch develop
```

## Post-deploy SLO smoke baseline

Run smoke with optional SLO thresholds (in percentages):

```powershell
./run-smoke.ps1 -BaseUrl https://<your-render-service>.onrender.com -MaxErrorRatePct 5 -MaxSlowRatePct 20
```

Interpretation:
- `Error rate SLO` checks `metrics.totals.errors / metrics.totals.requests`.
- `Slow rate SLO` checks `metrics.totals.slow / metrics.totals.requests`.
- These checks are enabled only when thresholds are provided (>= 0).
