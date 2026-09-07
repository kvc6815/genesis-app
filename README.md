# Genesis

An AI-powered HighLevel app builder: sign in, connect a HighLevel account via OAuth, describe
an app in chat, and watch Claude stream back real HTML/CSS/JS that calls **real** HighLevel
Contacts/Conversations/Calendars endpoints — rendered live in an in-browser preview, with
restorable version snapshots along the way.

Built as a take-home assignment for a HighLevel Senior Engineer role.

## Live URLs

- **Frontend (Hosting)**: https://genesis-hl-app.web.app
- **Cloud Functions base URL**: https://us-central1-genesis-hl-app.cloudfunctions.net
- **HighLevel OAuth redirect endpoint**: https://us-central1-genesis-hl-app.cloudfunctions.net/hlOAuthCallback
  (this is the exact URL registered in the HighLevel marketplace app — see below)

## Demo video

**Loom Video Link**: https://www.loom.com/share/1b319ad0f601499890482b00d08f935e

## Repository layout

```
/frontend        Vue 3 app (script setup, TypeScript, shadcn-vue, Vite)
/functions       Firebase Cloud Functions (TypeScript), one function per file, grouped by domain
firebase.json    Hosting rewrites + emulator config
.firebaserc      Firebase project alias (genesis-hl-app)
firestore.rules  Security rules, every collection scoped to request.auth.uid
.env.example     Every environment variable the app uses, split by where it's read
```

## HighLevel setup

To connect this app to your own HighLevel account (or to re-point it at a different
marketplace app):

1. Create an app at [marketplace.gohighlevel.com](https://marketplace.gohighlevel.com), under
   your developer account.
2. Set the app's **Redirect URI** to exactly:
   `https://us-central1-genesis-hl-app.cloudfunctions.net/hlOAuthCallback`
   (or your own deployed function's URL, if running against your own Firebase project).
3. Set the app's **distribution/target user type to Sub-Account** (not Agency) — this is what
   makes HighLevel show the `chooselocation` consent screen so a specific sub-account can be
   selected during install. Request read scopes for **Contacts**, **Conversations**,
   **Calendars**, and **Locations** (the last one is needed for a company-vs-location token
   auto-upgrade the backend runs after every connect — see "What I'd improve" below for the
   caveat on this).
4. Copy the marketplace app's **Client ID**, **Client Secret**, and the full **install/authorize
   URL** shown on its dashboard into `functions/.env` (`HL_CLIENT_ID`, `HL_CLIENT_SECRET`,
   `HL_REDIRECT_URI`) and `frontend/.env` (`VITE_HL_INSTALL_URL`) — see `.env.example`. The
   install URL is copied verbatim; HighLevel's dashboard bakes `client_id`/`redirect_uri`/
   `scope` into it directly, so nothing needs to be assembled by hand.
5. Create a sandbox sub-account under the same developer account (HighLevel provides one for
   marketplace app testing) and add a few real contacts/conversations/calendar events to it —
   the generated apps call live data, so an empty sandbox will render correctly but show
   nothing interesting.
6. Install the app onto that sandbox sub-account by clicking "Connect HighLevel" in Genesis's
   dashboard once signed in — this drives the real OAuth flow end to end.

## Local setup

### Prerequisites

- Node.js 20+
- A Firebase project on the **Blaze** (pay-as-you-go) plan — required for Cloud Functions v2
  and outbound network calls (to the HighLevel and Anthropic APIs)
- A HighLevel marketplace app + sandbox sub-account (see above)
- An Anthropic API key

### Install

```bash
npm install                      # root — firebase-tools, used via npx
cd frontend && npm install && cd ..
cd functions && npm install && cd ..

npx firebase login
npx firebase use <your-project-id>   # or genesis-hl-app if you have access
```

### Environment variables

`.env.example` at the repo root lists every variable the app uses as a single reference —
nothing reads a root `.env` file directly. Copy the relevant variables into two real files:

- `frontend/.env` — the `VITE_*` variables (Vite only reads env files from `frontend/`)
- `functions/.env` — HighLevel client ID/secret/redirect URI, the frontend URL for OAuth
  redirects, and the Anthropic API key (Firebase Functions v2 loads this file automatically,
  both for local runs and on `deploy`)

### Running the frontend

```bash
cd frontend && npm run dev
```

Opens on `http://localhost:5173` (or the next free port).

### About `firebase emulators:start`

`firebase.json` does define an `emulators` block (Auth, Firestore, Functions, Hosting UI), and
`firebase emulators:start` will boot them. In practice, this project's own local development
never used them — the frontend dev server talks to the **real, deployed** Firebase project
(Auth, Firestore, and Cloud Functions) instead. The reason isn't preference, it's a hard
constraint from HighLevel: the OAuth redirect (`hlOAuthCallback`) and the live-preview file
server (`previewFile`, serving generated apps' HTML/CSS/JS at `/preview/**`) both have to be
reachable at a real public HTTPS URL — HighLevel's OAuth consent screen redirects to whatever
URL is registered in the marketplace app, and it can't reach `localhost`. Developing against
emulators would mean testing a codepath that diverges from what's actually deployed, for
exactly the parts of the app most likely to break in deployment-specific ways. So: Cloud
Functions changes are tested by deploying (`cd functions && npm run build && npx firebase
deploy --only functions`) and exercising them against the real frontend, rather than an
edit/run-locally loop. The emulator config is left in place for anyone who wants an isolated
sandbox for pure Firestore-rules or Auth-flow testing, but the OAuth and preview paths haven't
been verified against it.

## Building & deploying

```bash
cd frontend && npm run build && cd ..
npx firebase deploy                        # everything
npx firebase deploy --only hosting         # frontend only
npx firebase deploy --only functions       # backend only
```

If a combined `hosting,functions` deploy errors out on the Cloud Run artifact-registry
cleanup-policy step, the hosting files can end up uploaded but not released — re-run
`npx firebase deploy --only hosting` to confirm it finalized.

## Architecture decisions

1. **HighLevel API calls are proxied through Cloud Functions, never made browser-direct.**
   Generated code runs in the live-preview iframe — code an LLM wrote, unvetted. Handing it a
   live HighLevel access token for direct calls would be real exposure (XSS in generated code,
   or the code doing something unintended, could exfiltrate it). Instead, generated `fetch()`
   calls hit this app's own `/api/hl/*` routes with a Firebase ID token; the backend resolves
   the real HL token server-side and the browser never sees it.
2. **A custom text protocol for streamed file output, not Claude's native tool-use API.**
   `generateStream` teaches Claude a hand-rolled marker format
   (`<<<GENESIS_FILE path="...">>>` / `<<<GENESIS_END_FILE>>>`) parsed incrementally by a small
   state machine. Tool-use is the more idiomatic fit for "write a file at this path with this
   content," but the marker approach was already built and proven correct across edge cases
   (markers split across stream chunks, multiple files, char-by-char streaming, malformed
   input) — reworking it mid-build wasn't obviously a win. The real cost showed up later: since
   the parser can't patch a file, Claude always re-emits a file's *entire* contents on any
   change, which contributed to a real `max_tokens` truncation bug on a large file.
3. **Three separate files (`index.html`/`style.css`/`app.js`), not one self-contained
   `index.html`.** The preview started as a single srcdoc'd HTML file; splitting it cut the
   blast radius of point 2's truncation risk (a styling tweak now re-emits only `style.css`,
   not an entire page) and produces more idiomatically structured generated code.
4. **The live preview's auth token travels in the URL path, not a query string.**
   `/preview/{projectId}/{idToken}/index.html` — `index.html`'s sibling loads
   (`<link href="style.css">`, `<script src="app.js">`) are plain relative URLs the browser
   resolves against the current path. A path segment survives that resolution automatically;
   a query string on the top-level URL would not propagate to those requests, leaving them
   unauthenticated.
5. **Generated project files live as one Firestore document per file** in a
   `projects/{id}/files` subcollection, not a single map field on the project doc or Cloud
   Storage. This matches the streaming shape (files complete independently as `file_end`
   events arrive, without rewriting siblings), avoids Firestore's 1 MiB single-document
   ceiling as generated apps grow, and makes snapshotting a bounded batched copy over N small
   docs.
6. **Two different auth mechanisms across the backend, deliberately.** `generateStream` reads
   the Firebase ID token from a query param and verifies it manually, because `EventSource`
   (the only thing that can consume a GET-based SSE stream from the browser) can't send custom
   headers. Snapshot restore/create, by contrast, are plain button clicks with no such
   constraint, so they're `onCall` functions that get `request.auth.uid` verified for free by
   the SDK — no reason to hand-roll auth where it isn't required.
7. **Snapshots are full copies per version, not diffs.** Each restore point is a separate
   `projects/{id}/snapshots/{id}/files` subcollection mirroring the live files at that moment,
   numbered `v1`, `v2`, … with an `activeSnapshotId` pointer denormalized onto the project doc
   for a cheap "is this the current one" check. Simpler restore logic (overwrite live files
   with the snapshot's) at the cost of storage that scales with snapshot count — acceptable
   for a project of this size.
8. **Snapshotting an editor edit is a manual "Save Snapshot" button, not automatic or
   debounced.** Every completed generation snapshots automatically, but a debounced
   auto-snapshot on manual edits was considered and rejected — it would create one version per
   pause-in-typing, making the version history noise rather than signal. A manual step keeps
   it to points the user actually decided were worth keeping.
9. **Local development runs against the real deployed Firebase project, never emulators.**
   HighLevel's OAuth redirect and the live-preview file server both need a real public HTTPS
   URL; testing against `localhost` would mean the most deployment-sensitive parts of the app
   are the least tested locally.
10. **The Anthropic SDK's stream-`end` event is not trusted as success on its own** — the SDK
    treats hitting `max_tokens` as a normal stream completion, not an error. `generateStream`
    checks the response's `stop_reason` explicitly and, on truncation, drops the specific file
    that was mid-write (rather than persisting a corrupted overwrite of a previously-working
    file) and surfaces a real error to the user.

## What I'd improve

1. **HighLevel's Company-vs-Location OAuth token type is worked around, not resolved.** Token
   exchange consistently returns a Company-level token even when a specific sub-account is
   selected at consent, and HighLevel's own docs don't document what actually decides this. The
   app auto-upgrades to a location-scoped token when a company has exactly one location; a
   company with multiple locations has no picker UI and is left stuck on a non-functional
   Company-level token.
2. **The custom marker-based file protocol should move to Claude's native tool-use API.**
   Beyond being more idiomatic, it would let large files be edited incrementally instead of
   always re-emitted whole — removing the root cause of the `max_tokens` truncation risk
   described above, rather than just detecting and rejecting it after the fact.
3. **Secrets currently live in `functions/.env` (gitignored, loaded by Firebase Functions v2 at
   deploy time), not Firebase Secret Manager.** Functional and never committed, but Secret
   Manager would add access auditing and per-secret rotation without code changes.
4. **Interrupted-stream handling (client disconnects mid-generation) is implemented but not
   conclusively exercised live.** The code path persists partial files on abort and is
   type-correct against the SDK's event types, but the one real test raced with normal
   completion rather than an actual mid-stream disconnect.
5. **No generation cancellation, diff view, or rate limiting.** All three were scoped as
   optional bonus work and not attempted: a running generation can't be cancelled mid-stream
   from the UI, there's no diff view between a generation's before/after, and none of the
   Cloud Function endpoints have rate limiting beyond Cloud Run's own defaults.

## Deployment notes

- **Firebase project**: `genesis-hl-app`, on the Blaze plan (required for Cloud Functions v2
  and any outbound network calls). Firestore is provisioned in Native mode.
- **No CI/CD** — every deploy in this project was run manually from a local machine via
  `npx firebase deploy` (or its `--only hosting` / `--only functions` variants). There's no
  GitHub Actions workflow gating deploys on tests or review.
- **One-time manual console steps** (not captured by `firebase deploy`):
  - Enable the Email/Password sign-in provider under Firebase Auth.
  - Register the deployed `hlOAuthCallback` URL as the HighLevel marketplace app's Redirect
    URI (see "HighLevel setup" above).
  - The `projects` list query's composite index (`ownerId` + `deleted` + `updatedAt`) is
    defined in `firestore.indexes.json` and deployed via `firebase deploy --only
    firestore:indexes` (or the console link Firestore prints on first query failure) — it's a
    deploy-time artifact, not something the app creates itself at runtime.
- **A combined `hosting,functions` deploy can fail partway** on the Cloud Run artifact-registry
  cleanup-policy step, leaving hosting files uploaded but not released. Deploying is otherwise
  idempotent — re-running `--only hosting` resolves it.
- **Runtime**: Cloud Functions run on Node.js 20, which Firebase has scheduled for
  decommissioning; the functions will need a runtime bump ahead of that deadline.
