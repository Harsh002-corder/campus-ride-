# CampusRide

CampusRide is a campus transportation web app built with React + Vite + TypeScript.

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Run locally

```sh
npm install
npm run dev
```

## Run full stack (frontend + backend)

```sh
npm run dev:all
```

This command auto-frees ports 4000 and 8080, then starts backend and frontend together.

## Environment setup

Create a frontend env file from template:

```sh
copy .env.example .env
```

Then set values in `.env` (especially `VITE_GOOGLE_MAPS_API_KEY`).

For mobile/LAN testing, set:

- `VITE_API_URL=http://<YOUR_PC_LAN_IP>:4000`
- Optional: `VITE_SOCKET_BASE_URL=http://<YOUR_PC_LAN_IP>:4000`

Backend origin policy (in `backend/.env`):

- `CLIENT_ORIGIN`/`ALLOWED_ORIGINS`: comma-separated explicit allowed web origins.
- `ALLOWED_ORIGIN_PATTERNS`: optional wildcard host patterns (example: `*.example.com`).
- `ALLOW_LAN_ORIGINS=false` by default for stricter CORS/socket checks.
- Set `ALLOW_LAN_ORIGINS=true` only for local LAN/device testing in non-production.

## Build

```sh
npm run build
```

## PWA deployment on Vercel

CampusRide now ships as an installable Progressive Web App.

Features included:

- Web app manifest at `/manifest.webmanifest`
- Auto-updating service worker with offline shell support
- Offline fallback page at `/offline.html`
- Install prompt UI for Chrome on Android and desktop
- Safari basic support through manifest and Apple mobile web app meta tags

Deployment checklist:

1. Set `VITE_API_URL` to your production backend origin, for example `https://api.your-domain.com`.
2. Run `npm install` so `vite-plugin-pwa` is available locally and in CI.
3. Run `npm run build` and verify the generated `dist/` includes `manifest.webmanifest`, `offline.html`, and the service worker bundle.
4. Deploy the frontend build to Vercel as a static Vite app.
5. Keep backend live tracking on your cloud backend; the service worker intentionally skips caching live ride tracking and socket traffic.

Install behavior by platform:

- Android Chrome: install prompt appears from the in-app Install App button.
- Desktop Chrome: install prompt appears when Chrome allows installation.
- Safari: users can use Share > Add to Home Screen; Safari does not fire `beforeinstallprompt`.

Future push notifications:

- The service worker includes `push` and `notificationclick` handlers so backend notification events like driver accepted ride, driver arrived, and ride completed can be wired in later without reworking the PWA foundation.
