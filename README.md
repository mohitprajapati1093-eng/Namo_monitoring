# Namo Monitoring

**Health facility operations and medicine supply-chain monitoring** — a local functional prototype for PHCs/CHCs and district teams.

> **Prototype boundary:** all bundled records are synthetic. Forecasts are illustrative and are not a validated AI model. Do not enter real patient-identifying or confidential health data. The JSON-backed demo authentication and single-process server are not production-ready.

## Contents

- [Purpose and architecture](#purpose-and-architecture)
- [Run locally](#run-locally)
- [Demo accounts](#demo-accounts)
- [Roles and permissions](#roles-and-permissions)
- [Application workflow](#application-workflow)
- [API reference](#api-reference)
- [Persistence and data model](#persistence-and-data-model)
- [Branding and background watermark](#branding-and-background-watermark)
- [Checks and troubleshooting](#checks-and-troubleshooting)
- [Known limitations and roadmap](#known-limitations-and-roadmap)
- [Repository hygiene and third-party notices](#repository-hygiene-and-third-party-notices)

## Purpose and architecture

Namo Monitoring consolidates health-centre operations and supply-chain visibility into one role-aware interface. The current implementation uses:

- **Frontend:** plain HTML (`frontend/index.html`), CSS (`frontend/styles.css`), and JavaScript (`frontend/app.js`, `frontend/config.js`), bundled with Vite. No React or JSX is used by the active frontend.
- **Backend:** Node.js ES modules and Express REST API (`backend/server.mjs`).
- **Persistence:** `backend/data/db.json`, initialized/updated by the backend.
- **Development server:** Express hosts the API and integrates Vite in development so the app can run on one local port.
- **Production-like local run:** build the frontend, then run Express to serve the built assets and API.

The application is a prototype and uses a single JSON file. It is appropriate for local demos and workflow testing only. It is not designed for multiple server instances or concurrent production traffic.

## Run locally

### Requirements

- Node.js 18 or newer (Node 20+ recommended).
- npm.

### Install and start

From the repository root:

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The integrated development server serves the frontend and API from the same origin.

Useful commands:

```bash
npm run check   # Syntax checks for backend and test modules
npm test        # Smoke, seed-integrity, and API tests
npm run build   # Build frontend assets into frontend/dist
npm start       # Serve built frontend and API; build first
```

The port defaults to `3000`; set `PORT` to override it. `npm run dev:web` starts Vite separately and proxies `/api` to `http://localhost:3000`. The GitHub Pages frontend is static and cannot host Express itself. Once the backend is deployed, set `window.NAMO_API_BASE` in `frontend/config.js` to its HTTPS origin and allow the Pages origin in the backend CORS policy. Until then, the live frontend will show API offline when it cannot reach a backend.

## Demo accounts

The backend seeds these local prototype accounts if they do not already exist. Each demo password is `Demo@12345`.

| Role | Email | Default scope |
|---|---|---|
| District Administrator | `district.admin@demo.local` | Assigned district |
| Facility Manager | `facility.manager@demo.local` | `PHC-014` |
| Pharmacist / Storekeeper | `pharmacist@demo.local` | `PHC-014` |
| Clinical / Operations Staff | `operations.staff@demo.local` | `PHC-014` |

These are public demo credentials and must never be reused for real accounts. New registrations are pending until a district administrator approves them. The local password hashing/session implementation is for demonstration and needs a production identity system before deployment.

## Roles and permissions

### District Administrator

- District-level overview, facility comparisons, alerts, and authorized reports.
- Review user access requests within the assigned district.
- Review transfer requests and district-level interventions.
- Review operational reports and monitor facility risks.

### Facility Manager / Medical Officer in Charge

- Facility-scoped operations and reporting.
- Review reports and requests within authorized scope.
- Create and manage interventions for assigned facilities.
- Review transfers and monitor local stock, beds, footfall, attendance, and diagnostics.

### Pharmacist / Storekeeper

- Medicine inventory and transaction workflows within assigned facilities.
- Stock requests, inventory alerts, and authorized transfer dispatch/receipt steps.
- Stock balances and transactions are expected to remain traceable through ledger entries.

### Clinical / Operations Staff

- Submit permitted facility operations reports.
- Report operational issues and follow workflow updates.
- Cannot perform administrative review or privileged inventory actions unless explicitly authorized.

**Authorization note:** the backend performs role and facility/district checks for protected endpoints. The role menus are a usability layer, not the security boundary. The authorization matrix still needs exhaustive endpoint-by-endpoint regression testing before any external pilot.

## Application workflow

### 1. Sign-in and access approval

1. A user signs in using an approved demo account or submits an access request.
2. New accounts remain pending.
3. A district administrator can approve/reject requests in their district.
4. An approved user receives a session and sees the workspace for their role.
5. Logout invalidates the session in the local JSON store.

### 2. Medicine inventory

1. Open **Medicine inventory** and select an authorized medicine record.
2. Record an allowed receipt, issue, wastage, expiry, or adjustment action.
3. The backend validates the quantity and role, updates the medicine balance, and stores a transaction/audit record.
4. Refresh the view and confirm the change persists in `backend/data/db.json`.

Batch-level traceability and complete production-grade stock accounting require further validation. Never use this prototype as the authoritative record for real medicine dispensing.

### 3. Stock request

1. An authorized user creates a request for a medicine, quantity, and reason.
2. A facility manager or district administrator reviews it within their scope.
3. The request can be approved or rejected with a recorded status.
4. Approval is a decision only: it does **not** mean stock was dispatched or received. Fulfilment and receipt are separate workflow steps.

### 4. Inter-facility transfer

The intended lifecycle is:

`Request → Review → Approve/Reject → Dispatch → Confirm receipt → Reconcile discrepancy → Complete`

- Requests identify a source facility, destination, medicine, quantity, urgency, and note.
- Review checks source availability and reserve rules.
- Dispatch decrements the source inventory and records a transaction.
- Receipt records the actual received quantity and updates the destination inventory.
- Partial/mismatched receipts retain discrepancy details.

A transfer is not complete merely because it was approved. The complete request-to-receipt lifecycle should be tested against the current JSON data and all role scopes before relying on it.

### 5. Facility operations reporting

Authorized facility managers and clinical/operations staff can submit dated reports for:

- Patient footfall.
- Beds: total, occupied, and unavailable.
- Staff attendance: present versus expected.
- Diagnostic tests/services: available versus total, plus unavailable notes.

Server validation rejects negative/non-integer counts, occupied plus unavailable beds greater than total capacity, and available diagnostics greater than total. Reports have a review status; authorized reviewers can accept or return them for correction. Returned reports may be corrected and resubmitted where the current UI/API exposes that workflow. Summary fields on the facility record reflect the latest submitted figures, so use the report history for date-specific context.

### 6. Cross-role issue workflow

1. An authorized user reports an operational issue for an assigned facility.
2. Relevant facility/district users see the record in **Workflow inbox**.
3. Authorized roles add comments, assign/start work, and update the status.
4. The reporter can refresh the shared queue to see the latest status and handoff comments.
5. Issue reporting is distinct from formal interventions; not every issue is automatically converted into an intervention.

### 7. Interventions

1. A district administrator or facility manager creates an intervention for a valid facility.
2. The intervention receives a severity, accountable owner, deadline, and initial history entry.
3. Authorized users add progress notes and evidence.
4. Resolution requires closure evidence or a verification note.
5. History and audit events record important updates; resolved items may be reopened through permitted status updates.

### 8. Notifications

The notification centre surfaces relevant workflow changes, such as review decisions, transfer updates, stock requests, and report status changes. Notifications have read state and timestamps. Notifications are persisted/derived by the local prototype; this is not a push-notification or guaranteed real-time delivery system.

### 9. Inventory intelligence

The intelligence service calculates stock-risk labels, safety-stock/reorder indicators, and illustrative demand projections. The forecast endpoint explicitly identifies its method as an illustrative statistical baseline and includes synthetic example history. Forecasts must not be represented as trained or validated AI predictions.

## API reference

All protected endpoints require a valid session bearer token, except public health/demo-auth endpoints. API errors return JSON, including unknown `/api` routes, to avoid returning the SPA HTML to JSON clients.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Server health and prototype status |
| `GET` | `/api/auth/demo-accounts` | Demo account list for the login UI |
| `POST` | `/api/auth/register` | Request account access |
| `POST` | `/api/auth/login` | Create a session for an approved account |
| `GET` | `/api/auth/me` | Current session user |
| `POST` | `/api/auth/logout` | Invalidate current session |
| `GET` | `/api/auth/users` | District-scoped user list for administrator |
| `POST` | `/api/auth/users/:id/decision` | Approve/reject an access request |
| `GET` | `/api/bootstrap` | Role-scoped initial data for the application |
| `GET` | `/api/dashboard` | Scoped dashboard summary |
| `GET` | `/api/facilities` | Authorized facilities |
| `GET` | `/api/medicines` | Authorized/searchable medicine records |
| `POST` | `/api/medicines` | Add a medicine record where permitted |
| `POST` | `/api/stock-transactions` | Record a stock movement |
| `GET` | `/api/stock-transactions` | Read authorized stock ledger entries |
| `GET` | `/api/alerts` | Stock and facility alerts in scope |
| `GET` | `/api/forecast/:id` | Illustrative forecast for an authorized medicine |
| `GET` | `/api/stock-requests` | List scoped stock requests |
| `POST` | `/api/stock-requests` | Create a stock request |
| `POST` | `/api/stock-requests/:id/decision` | Review a stock request |
| `GET` | `/api/transfers` | List authorized transfers |
| `POST` | `/api/transfers` | Create a transfer request |
| `POST` | `/api/transfers/:id/review` | Approve/reject/request further review |
| `POST` | `/api/transfers/:id/dispatch` | Dispatch approved stock from source |
| `POST` | `/api/transfers/:id/receive` | Confirm actual receipt and record discrepancies |
| `GET` | `/api/operations-reports` | List authorized operational reports |
| `POST` | `/api/operations-reports` | Submit footfall/beds/attendance/diagnostics report |
| `POST` | `/api/operations-reports/:id/resubmit` | Correct/resubmit a returned report |
| `POST` | `/api/operations-reports/:id/review` | Accept or return an operational report |
| `GET` | `/api/notifications` | List relevant notifications |
| `POST` | `/api/notifications/:id/read` | Mark a notification as read |
| `GET` | `/api/interventions` | List authorized interventions |
| `POST` | `/api/interventions` | Create an intervention |
| `POST` | `/api/interventions/:id/updates` | Add progress/evidence/status update |
| `PATCH` | `/api/interventions/:id` | Update permitted intervention fields/status |

For exact request and response payloads, inspect the route handlers in `backend/server.mjs` and the calling functions in `frontend/src/App.jsx`. API contracts should be updated together with UI changes.

## Persistence and data model

The JSON store is `backend/data/db.json`. It contains seeded facilities, medicine records, stock transactions, transfers, interventions, accounts/sessions, audit events, and prototype workflow records such as stock requests, operations reports, and notification-read state. Optional collections are initialized when the server starts.

**Before applying patches or changing schemas:** stop the server and make a copy of `backend/data/db.json`. Do not delete this file to fix a UI issue. JSON writes are serialized in-process, but this is not a substitute for a transactional database under concurrent or multi-instance operation.

## Branding and background watermark

- The product is branded **Namo Monitoring** in the login/registration screen, sidebar, page title, and favicon.
- `frontend/public/namo-monitoring-mark.svg` preserves the supplied detailed logo artwork as embedded image content; it is image-faithful but not a path-traced, editable vector drawing.
- `frontend/public/namo-monitoring-logo.png` is the supplied artwork crop/reference.
- The fixed watermark uses `body::before` and the `--namo-workspace-left` CSS variable to center the mark in the visible workspace rather than underneath the fixed desktop sidebar. It uses 250px on wide desktop, 230px in the intermediate desktop breakpoint, and 0px when the sidebar becomes a mobile overlay. The authentication screen has no sidebar and therefore centers the watermark in the full viewport.
- The watermark has `pointer-events: none`, sits behind app content, and remains fixed while content scrolls.

If the sidebar width changes, update the corresponding CSS breakpoint and watermark offset together. If the app adds a collapsible sidebar, expose its current width through a CSS variable/class rather than hardcoding another offset.

## Checks and troubleshooting

Run all of the following from the repository root:

```bash
npm run check
npm test
npm run build
```

Then run `npm run dev` and test each role in the browser. The integrated API is available at `http://localhost:3000/api/health`.

### `Unexpected token '<'` when parsing JSON

This usually means the frontend requested an API endpoint but received an HTML page. Start the integrated app with `npm run dev`, check that the URL is on the expected port, and confirm the endpoint begins with `/api/`. Unknown API paths should return a JSON 404.

### Old logo/favicon remains visible

Hard-refresh with `Ctrl+Shift+R`. Favicons may be cached separately by the browser.

### Watermark seems off-centre

Check the sidebar width at the current viewport breakpoint. Wide desktop uses 250px, medium desktop uses 230px, and tablet/mobile uses 0px because the sidebar is an overlay. Authentication uses the full viewport. Check that no later CSS rule overrides `body::before`.

### Port is already in use

Stop the other development server or run with a different `PORT`, ensuring frontend API requests use that same integrated server.

## Known limitations and roadmap

- JSON persistence is single-process/local and not safe for production multi-user concurrency.
- Demo accounts and synthetic seed data are not real identity or facility data.
- Production SSO/identity, secure session management, database migrations, backups, deployment monitoring, and stronger operational security remain future work.
- Forecasts use synthetic example history and are not trained/validated AI.
- Cross-role visibility, state transitions, transfer reconciliation, and authorization require comprehensive regression testing across all roles.
- Real-time push notifications, external health-system integrations, and production reporting/export workflows are not guaranteed by this prototype.
- Full multilingual UI is not yet implemented; the language control is currently a preview/placeholder.
- This app is not a medical record system and is not approved for real clinical or supply-chain operations.

Suggested next steps: run the complete test/build suite; exercise all cross-role workflows; fix any failing state transitions/permissions; then plan a production database and authentication architecture only after the prototype is stable.

## Repository hygiene and third-party notices

Generated output (`frontend/dist/`), installed dependencies (`node_modules/`), local secrets (`.env*`), and Git internals are not source deliverables. Recreate dependencies with `npm install` and the build output with `npm run build`. See `THIRD_PARTY_NOTICES.md` for reused source attribution and license notes.
