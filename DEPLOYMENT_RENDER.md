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
