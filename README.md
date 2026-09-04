# Genesis

AI-powered HighLevel app builder. Vue 3 + shadcn-vue frontend, Firebase (Auth, Firestore,
Cloud Functions, Hosting) backend. This README currently covers local setup only; the full
architecture decisions / what-I'd-improve / deployment writeup lands once the app is feature
complete.

**Status**: Firebase Auth (sign up/in) and HighLevel OAuth connect are live.

## Live deployment

- Hosting: https://genesis-hl-app.web.app
- Hello-world function: https://us-central1-genesis-hl-app.cloudfunctions.net/hello
- HighLevel OAuth callback: https://us-central1-genesis-hl-app.cloudfunctions.net/hlOAuthCallback

## Prerequisites

- Node.js 20+ (`node -v`)
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

**`.env.example` at the repo root is a reference listing every var the app uses** — it's not
a file you fill in directly; nothing reads a root `.env`. Vars are split by consumer:

- `frontend/.env` — the `VITE_*` vars (Vite only reads env files from `frontend/`)
- `functions/.env` — HighLevel client ID/secret/redirect URI, frontend URL, LLM key.
  Firebase Functions v2 loads this file both for local runs and on `deploy` (moves to
  Secret Manager in Phase 5's hardening pass).

Ask to be added as a collaborator to get real values, or provide your own (a HighLevel
marketplace app + `.env.example`'s var list) if running against your own Firebase project.

## Running locally

**We don't run Firebase locally** — no emulators. The frontend dev server runs on your
machine but talks to the real, deployed Firebase project (Auth, Firestore) and the real,
deployed Cloud Functions. This keeps local testing consistent with what's actually
deployed — important for things like the HighLevel OAuth callback, which is a public URL
HighLevel itself redirects to and can't reach `localhost`.

```bash
cd frontend && npm run dev
```

- Frontend: http://localhost:5173 (or next free port — Vite will tell you)

Backend (Cloud Functions) changes have no local dev loop: edit, `cd functions && npm run
build`, then `npx firebase deploy --only functions` to test against the frontend.

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
