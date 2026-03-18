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
