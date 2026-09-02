# Genesis

AI-powered HighLevel app builder. Vue 3 + shadcn-vue frontend, Firebase (Auth, Firestore,
Cloud Functions, Hosting) backend. This README currently covers local setup only; the full
architecture decisions / what-I'd-improve / deployment writeup lands once the app is feature
complete.

**Status**: Phase 0 (scaffolding) deployed. No app functionality yet.

## Live deployment

- Hosting: https://genesis-hl-app.web.app
- Hello-world function: https://us-central1-genesis-hl-app.cloudfunctions.net/hello

## Prerequisites

- Node.js 20+ (`node -v`)
- A JRE/JDK (Java 11+) on PATH — required by the Firestore emulator. On macOS:
  `brew install openjdk` then follow the symlink instructions it prints, or
  `brew install --cask temurin`. Verify with `java -version`.
- A Firebase account with access to the `genesis-hl-app` project (ask to be added as a
  collaborator), or your own Firebase project for local-only work

## First-time setup

```bash
# from repo root
npm install              # firebase-tools (dev dependency, used via npx)
cd frontend && npm install && cd ..
cd functions && npm install && cd ..

npx firebase login
npx firebase use genesis-hl-app   # or your own project id
```

## Environment variables

Nothing yet — right now the app is just a blank scaffolded page and a hello-world function,
neither of which reads any env vars. **`.env.example` at the repo root lists everything the
finished app will need**, but it's a reference, not a file you fill in directly — nothing
reads a root `.env`. Once each feature lands (Phase 1+), split the vars it needs into:

- `frontend/.env` — the `VITE_*` vars (Vite only reads env files from `frontend/`)
- `functions/.env` — everything else (`firebase-functions` auto-loads this for the emulator;
  deployed secrets move to Secret Manager in Phase 5)

## Running locally

Two things need to run side by side, in separate terminals:

```bash
# Terminal 1 — Firebase emulators (Auth, Firestore, Functions)
npx firebase emulators:start
```

```bash
# Terminal 2 — frontend dev server
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Emulator UI (Auth/Firestore/Functions inspector): http://localhost:4000 (default port;
  individual emulator ports are pinned in `firebase.json`)

## Building & deploying

```bash
cd frontend && npm run build && cd ..
npx firebase deploy                        # everything
npx firebase deploy --only hosting         # frontend only
npx firebase deploy --only functions       # backend only
```

Note: if a combined `hosting,functions` deploy errors out on the Cloud Run
artifact-registry cleanup-policy step, the hosting files can be uploaded but not released.
Re-run `npx firebase deploy --only hosting` afterward to confirm it finalized.
