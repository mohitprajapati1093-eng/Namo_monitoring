# Repository research and integration decisions

Research date: 18 October 2026. These repositories informed the workflow and architecture, but this project does not bundle their Python, Java, or unlicensed source files. The implementation is consolidated into one JavaScript/JSX codebase.

## Relevant workflows adopted

- **PHC Commons** — medicine/batch awareness, validation, low-stock visibility and role-gated write patterns. Source was not copied because a root license was not found at the checked path.
- **Drug Inventory & Supply Chain Tracking** — explicit received/issued stock transactions, batch/expiry metadata and transfer workflow. Source was not copied because a root license was not found at the checked path.
- **DemandForecast** — safety-stock, reorder-point and inventory-simulation concepts. Independently implemented in JavaScript in `backend/src/services/inventory-intelligence.mjs`; this is not an ML forecast.
- **WardWatch** — bed capacity and bed-state transition concepts. The app models facility bed totals/occupancy in JavaScript and includes no Java runtime or source.
- **Medical Inventory Forecasting & Decision Support** — forecast evaluation and explainability workflow; no application source or model artifact copied.

## Consolidated architecture

- One root `package.json` and one npm install.
- React + Vite frontend in `frontend/`.
- Express API and business logic in `backend/`.
- JSON-file demo persistence in `backend/data/db.json`.
- JavaScript-only stock risk, safety stock, reorder point and transfer feasibility calculations.

All seed data is synthetic. Forecasts are illustrative statistical baselines, facility operations are sample snapshots, and approving a transfer does not dispatch physical stock.
