# Delivery Plan

## V1 functional test build (this ZIP)
- Dashboard, inventory, facility operations, AI insights, redistribution and interventions.
- Express REST API and JSON-file persistence.
- Stock receipt/issue with quantity validation and transaction history.
- Transfer review with donor reserve check.
- Intervention status persistence.
- Safety-stock and reorder-point calculation service.
- Source attribution and upstream licenses for copied reference files.

## Phase 1 — Refinement
Review screens, responsive behavior, empty/error states and demo flows.

## Phase 2 — Production persistence and security
PostgreSQL, migrations, authentication, facility-scoped RBAC, audit events and concurrency-safe stock ledger.

## Phase 3 — Operations workflows
Facility reporting, batch-level receipt/issue, expiry-aware stock, requests, dispatch and verified receipt.

## Phase 4 — Intelligence
Authorized demand history, data quality, time-aware baseline evaluation, uncertainty, reserve-aware transfers and explainable recommendations.

## Phase 5 — Pilot readiness
Security, data, performance, backup, deployment and user-acceptance tests.
