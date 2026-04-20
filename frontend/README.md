# EmissionsIQ — Frontend

Production-grade environmental compliance dashboard for industrial facilities in Tunisia. Monitors real-time pollution data, enforces regulatory compliance (**Décret n° 2010-2516**), and serves supervisors, auditors, and regulators.

- **Stack**: React 18 · TypeScript 5 · Vite 5 · Tailwind CSS 3 · Zustand · TanStack Query · Chart.js · React Router v6 · React Hook Form + Zod
- **Testing**: Vitest + Testing Library + Playwright
- **Accessibility**: WCAG 2.1 AA targets (landmarks, ARIA, focus visibility)

## Prerequisites

- Node.js **20+**
- npm **10+** (or pnpm / yarn)
- A running backend (see `../backend`) exposing the API on `http://localhost:5000`

## Quick start

```bash
cd frontend
cp .env.example .env.local    # adjust VITE_API_URL if needed
npm install
npm run dev                    # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR, API & WS proxy |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` / `test:coverage` | Vitest (unit + component) |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run format` | Prettier (Tailwind class sorting) |

## Architecture

```text
src/
├── @types/           Global .d.ts for API, Chart.js, WebSocket
├── assets/           Static assets (fonts, images)
├── components/       Reusable components (atomic design)
│   ├── ui/           Button, Card, Badge, Input, Select, Table, Skeleton, Toast, Modal
│   ├── charts/       MiniTrendChart, HistoryChart, IPEGauge, MTDTrendChart, ChartWrapper
│   ├── kpi/          KPICard, PollutantCard, ComplianceTable
│   ├── alerts/       AlertItem, AlertList, AlertFilters, AlertActions
│   ├── layout/       Sidebar, Topbar, MainLayout, PageHeader
│   └── common/       ProtectedRoute, ErrorBoundary, LoadingSpinner, EmptyState,
│                     PermissionGate, LiveIndicator
├── features/         Domain-driven modules (api/hooks/store/types)
│   ├── auth/         Login, RBAC session, token storage
│   ├── kpi/          Summary, calculations (TD/EMJ/IPE/RCO2), config
│   ├── alerts/       List, stats, acknowledge/escalate/resolve
│   ├── sites/  zones/  readings/  config/  reports/
│   └── websocket/    Provider, client (reconnect + heartbeat), subscription hook
├── lib/
│   ├── api/          Axios instance with refresh-on-401, queryClient, endpoint map
│   ├── constants/    Roles, pollutants, KPI targets, Tunisia décret limits
│   ├── rbac/         Permission checks, hierarchy, resource access
│   ├── utils/        cn, formatters, colorUtils, chartHelpers
│   └── validation/   Zod schemas
├── pages/            Route-level components (lazy-loaded)
├── routes/           Route config + guards
├── store/            Zustand global stores (UI, selection)
└── styles/           Tailwind entry + CSS variables
```

## RBAC model

Five roles map to explicit permissions (`src/lib/constants/roles.ts`). Route protection is enforced by `<ProtectedRoute requires={[...]} />` and component-level gates by `<PermissionGate permission=… />`. The matrix mirrors the backend (see `../backend/BACKEND_RBAC_IMPLEMENTATION.md`):

| Role | VIEW_KPI | ACK alert | GENERATE_REPORT | UPDATE_CONFIG | RETRAIN_MODEL |
| --- | --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `HEAD_SUPERVISOR` | ✅ | ✅ | ✅ | — | ✅ |
| `SITE_SUPERVISOR` | ✅ (own) | ✅ (own) | ✅ (own) | — | — |
| `AUDITOR` | ✅ (read) | — | ✅ | — | — |
| `OPERATOR` | ✅ (own) | ✅ (own) | — | — | — |

Resource-level access (site/zone scoping) is enforced by the backend and mirrored client-side via `canAccessResource()`.

## API contract

Base URL: `VITE_API_URL` (defaults to `http://localhost:5000`). Shape:

```ts
// Success
{ success: true, message?: string, data: T }

// Error
{ success: false, message: string, code?: string }
```

Axios is configured with:
- `withCredentials: true` for the HttpOnly refresh cookie
- Silent refresh-on-401 via `/api/auth/refresh`
- Global unauthorized listener that clears session

Endpoint map lives in `src/lib/api/endpoints.ts` — one source of truth per backend route.

## WebSocket

`src/features/websocket/websocketClient.ts` implements:
- Auto-reconnect with exponential backoff (1s → 30s cap)
- 30s heartbeat (`ping`/`pong`)
- Topic subscriptions (`kpi:site:*`, `alerts:all`, …)
- Re-authentication + re-subscription on reconnect

`<WebSocketProvider>` wires the client to the authenticated user and exposes `useWebSocket()` + `useWebSocketSubscription(topics, onMessage)`.

## KPI calculations (Décret 2010-2516)

Implemented in `src/features/kpi/utils/kpiCalculations.ts`:

| KPI | Formula | Target |
| --- | --- | --- |
| **TD** — Taux de Dépassement | `(count(value > limit) / count(value)) × 100` | ≤ 2 % |
| **EMJ** — Émission Massique Journalière | `airflow × concentration × duration / 10⁶` | contextual |
| **IPE** — Indice de Performance | `100 − Σ(normalized × weight)` | ≥ 95 / 100 |
| **RCO2** — Réduction CO₂ | `(baseline − current) / baseline × −100` | ≤ −5 % |

Regulatory VLE defaults are mirrored in `src/lib/constants/tunisiaDecret.ts`. Backend `ThresholdConfig` is authoritative.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000` | Backend base URL |
| `VITE_WS_URL` | derived | Explicit WebSocket URL |
| `VITE_ENABLE_DEVTOOLS` | `false` | Show React Query devtools |

## Accessibility

- Landmark roles (`<main>`, `<aside>`, `<header>`), `aria-live` regions for toasts & live indicator
- Skip-to-content link in `App.tsx`
- Visible focus ring (`--focus-ring`)
- `role="group"` + `aria-label` on KPI cards; `role="progressbar"` on pollutant gauges
- All form fields have labels, `aria-invalid`, `aria-describedby` error copy
- Decorative icons are `aria-hidden="true"`

## Docker

```bash
docker build -t emissionsiq/frontend:latest .
docker run -p 3000:80 emissionsiq/frontend:latest
# or:
docker compose up --build
```

`docker/nginx.conf` proxies `/api` and `/ws` to the `backend` service.

## Troubleshooting

- **401 loop on login** — check that backend sets the `refreshToken` HttpOnly cookie and `CORS` has `credentials: true` for the Vite origin.
- **WebSocket stays `reconnecting`** — confirm `VITE_WS_URL` matches the backend (`/ws`) and the backend WebSocket server is initialized (see backend `server.js`).
- **Charts look squashed** — Chart.js requires a parent with explicit height; `<ChartWrapper height={…}>` handles this. Do not place charts inside `flex` items without `min-h-0`.
- **`tsc --noEmit` fails on `process`** — `@types/node` is declared; if you see the error in the IDE, restart the TS server after `npm install`.

## License

Proprietary — internal use for environmental compliance. Contact the maintainers before redistribution.
