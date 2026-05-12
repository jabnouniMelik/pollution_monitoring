# Frontend — Documentation
### The dashboard website that users interact with

---

## What is the Frontend?

The frontend is the **website** that supervisors, operators, and auditors open in their browser to monitor the factory's emissions. It is a Single Page Application (SPA) — meaning it loads once and then updates dynamically without full page reloads, like a desktop application running inside the browser.

Think of it as the **instrument panel of an airplane cockpit** — it displays all the important readings, highlights problems in red, and gives operators the controls they need to respond.

The frontend runs on **port 3000** during development and communicates with the backend server to fetch data and receive real-time updates.

---

## What Can Users Do on the Dashboard?

### Everyone (all roles)
- Log in securely with username and password
- View the main dashboard with live KPI scores and pollutant readings
- See real-time alerts when thresholds are exceeded
- View historical charts of pollution levels over time

### Operators (in addition to above)
- Acknowledge alerts (mark them as "I've seen this and I'm handling it")
- View data only for their assigned zones

### Site Supervisors (in addition to above)
- View data for all zones in their sites
- Generate compliance reports (PDF or CSV)
- Manage operators assigned to their sites

### Head Supervisors (in addition to above)
- View data across all sites in their industry
- Manage site supervisors

### Super Admin (full access)
- Manage all users (create, edit, delete, assign roles)
- Configure legal threshold values
- Configure KPI calculation parameters (air flow rate, pollutant weights)
- View all data across all sites and industries

---

## The Pages

### 1. Login Page (`/login`)
The entry point. Users enter their email and password. The system verifies credentials and issues a security token that is used for all subsequent requests. If the token expires (after 15 minutes of inactivity), the system automatically refreshes it silently — the user doesn't need to log in again unless they've been inactive for 7 days.

---

### 2. Overview — Main Dashboard (`/`)
**The most important page.** This is what opens after login.

It shows:

**4 KPI Cards at the top:**
Each card shows one KPI value with a colored status indicator and a trend arrow showing whether it improved or worsened compared to the previous period.
- 🟢 Green = within target
- 🟡 Yellow = approaching the limit
- 🔴 Red = target exceeded

**Pollutant Cards:**
One card per pollutant (NOx, SO2, PM2.5, COV, CO2, Temperature, Humidity). Each shows the latest measured value, the legal limit, and a color-coded status.

**IPE Gauge Chart:**
A circular gauge (like a speedometer) showing the overall Environmental Performance Index score from 0 to 100. The needle points to the current score.

**MTD Trend Chart:**
A bar/line chart showing the Month-to-Date trend for NOx emissions — how emissions have evolved day by day this month.

**History Chart:**
An interactive line chart showing historical readings. Users can:
- Select which pollutant to display
- Toggle individual pollutants on/off
- See threshold lines overlaid on the chart
- Zoom into specific time periods

**Recent Alerts Panel:**
Shows the 5 most recent open alerts with their severity, pollutant, and timestamp.

---

### 3. Alerts Page (`/alerts`)
A full list of all alerts with powerful filtering options:

**Filters available:**
- By status: Open / Acknowledged / Resolved
- By severity: Warning / High / Critical
- By pollutant: NOx, SO2, PM2.5, etc.
- By date range

**Actions on each alert:**
- **Acknowledge** — marks the alert as "seen and being handled" (records who acknowledged it and when)
- **Resolve** — marks the alert as fixed (requires a resolution note explaining what was done)
- **View details** — opens a modal with the full context: which sensor, what value, what threshold, which reading triggered it

---

### 4. History Page (`/history`)
A dedicated page for exploring historical sensor data:
- Select any pollutant
- Select any date range
- Filter by site and zone
- See the legal threshold line on the chart
- Compare multiple pollutants on the same chart

---

### 5. Compliance Page (`/compliance`)
Shows the regulatory compliance status for each pollutant:
- Is the factory currently compliant with Décret 2010-2516?
- Which pollutants are close to their limits?
- Trend analysis showing whether compliance is improving or worsening
- Export compliance data to PDF or CSV

---

### 6. AI Predictions Page (`/ai`)
Displays the output of the Python AI module:
- **Trend predictions**: Where will NOx/SO2/etc. levels be in the next 1 hour and 24 hours?
- **Anomaly detections**: Which recent readings were flagged as unusual by the AI?
- Confidence intervals shown as shaded areas on the prediction chart

> Note: This page requires the AI module (Python service) to be running.

---

### 7. Reports Page (`/reports`)
Generate and download official compliance reports:
- Select the reporting period (start date, end date)
- Choose format: PDF (formatted document) or CSV (spreadsheet)
- View a list of all previously generated reports
- Download any past report

---

### 8. Config Page (`/config`) — Super Admin only
Configure the KPI calculation parameters:
- **Air flow rate (Q_air)**: The volume of air flowing through the factory per second (in Nm³/s). Used in the EMJ formula.
- **Pollutant weights**: How much each pollutant contributes to the IPE score (must add up to 1.0)
- **KPI targets**: The threshold values for each KPI (e.g., TD target = 2%)

---

### 9. Users Page (`/users`) — Super Admin only
Manage all system users:
- Create new users (set username, email, password, role)
- Edit existing users (change role, assign sites/zones)
- Deactivate users (they can no longer log in)
- Assign sites to Head Supervisors
- Assign zones to Operators

---

### 10. Sites Page (`/sites`)
View and manage industrial sites:
- List of all sites with their status (active/inactive)
- Number of zones per site
- Assigned supervisor
- Geographic location

---

### 11. Zones Page (`/zones/:siteId`)
View and manage zones within a specific site:
- List of zones with their sensor node count
- Assigned operators
- Zone status

---

### 12. Unauthorized Page (`/unauthorized`)
Shown when a user tries to access a page they don't have permission for. Displays a clear message explaining the access restriction.

---

## How the Dashboard Updates in Real Time

The dashboard maintains a **live WebSocket connection** to the backend server. This is like keeping a phone line open — the server can send new information to the browser at any moment without the browser having to ask.

When you open the dashboard:
1. The browser connects to `ws://localhost:5000/ws`
2. It identifies itself (sends the user's ID and role)
3. It subscribes to KPI update topics
4. Every 5 seconds, the server sends updated KPI data
5. When a new alert is created, the server immediately pushes it to the browser
6. The dashboard updates automatically — no page refresh needed

---

## How Data is Fetched and Cached

The frontend uses **TanStack Query** to manage all data fetching. Think of it as a smart caching layer:

- When you open the Alerts page, it fetches the alert list from the server
- The result is **cached for 30 seconds** — if you navigate away and come back within 30 seconds, it shows the cached data instantly (no loading spinner)
- After 30 seconds, the data is considered "stale" and will be refreshed on the next access
- If a request fails due to a server error, it automatically retries up to 3 times
- If a request fails with a "permission denied" error (4xx), it does NOT retry

---

## Global Filters (Site / Zone / Period)

At the top of most pages, there is a filter bar that lets users select:
- **Site**: Which industrial site to view data for
- **Zone**: Which zone within that site
- **Period**: Day / Week / Month

These selections are **shared across all pages** — if you select "Site Sfax" on the Overview page, the Alerts page and History page will also show data for "Site Sfax". This is managed by a global state store (Zustand).

---

## Navigation and Access Control

The sidebar navigation menu shows only the pages the current user has permission to access. For example:
- An Operator will not see the "Users" or "Config" menu items
- An Auditor will not see the "Config" menu item
- A Super Admin sees everything

If a user manually types a URL they don't have access to (e.g., `/config`), they are automatically redirected to the "Unauthorized" page.

---

## The Charts

The dashboard uses **Chart.js** for all data visualization. Charts are interactive:
- **Hover** over any data point to see the exact value and timestamp
- **Click** on legend items to show/hide individual pollutants
- Charts automatically resize to fit the screen (responsive)

| Chart Type | Where it's used | What it shows |
|-----------|----------------|---------------|
| Line chart | History page, Overview | Pollution levels over time |
| Gauge chart | Overview (IPE) | Current IPE score |
| Bar chart | Overview (MTD Trend) | Daily emissions this month |
| Sparkline | KPI cards | Mini trend for each KPI |

---

## Forms and Validation

All forms (login, create user, generate report, etc.) use **React Hook Form** with **Zod** validation. This means:
- Errors are shown immediately as you type (before submitting)
- The form cannot be submitted with invalid data
- Error messages are clear and specific (e.g., "Password must be at least 6 characters")

---

## Folder Structure (Simplified)

```
frontend/src/
│
├── pages/              ← One folder per page (Login, Overview, Alerts, etc.)
│
├── components/         ← Reusable building blocks used across multiple pages
│   ├── charts/         ← All chart components (HistoryChart, IPEGauge, etc.)
│   ├── alerts/         ← Alert list, alert item, alert filters
│   ├── kpi/            ← KPI cards, pollutant cards
│   ├── layout/         ← The app shell (sidebar, header, main layout)
│   └── ui/             ← Generic UI elements (buttons, cards, modals, etc.)
│
├── features/           ← Feature modules (each feature has its own API calls + hooks)
│   ├── auth/           ← Login logic, token management
│   ├── kpi/            ← KPI data fetching and calculations
│   ├── alerts/         ← Alert data fetching and actions
│   ├── readings/       ← Sensor reading data fetching
│   ├── reports/        ← Report generation
│   ├── websocket/      ← Real-time connection management
│   └── ...
│
├── store/              ← Global state (site/zone/period selection, UI state)
│
├── lib/
│   ├── api/            ← HTTP client configuration, all API endpoint URLs
│   ├── constants/      ← Fixed values (role names, pollutant codes, KPI targets)
│   └── utils/          ← Helper functions (date formatting, number formatting, colors)
│
├── routes/             ← URL routing configuration
└── App.tsx             ← Root component — sets up all providers
```

---

## Technology Stack

| Technology | What it is | Why it's used |
|-----------|-----------|---------------|
| **React 18** | UI framework | Builds the interactive interface from reusable components |
| **TypeScript** | Typed JavaScript | Catches bugs at development time, not at runtime |
| **Vite** | Build tool | Extremely fast development server and production bundler |
| **React Router** | URL routing | Handles navigation between pages without full page reloads |
| **TanStack Query** | Data fetching library | Manages server data with caching, loading states, and auto-refresh |
| **Zustand** | State management | Stores global UI state (selected site, zone, period) |
| **Chart.js** | Charting library | Renders all the interactive charts |
| **Tailwind CSS** | CSS framework | Utility classes for styling — no custom CSS files needed |
| **React Hook Form** | Form library | Manages form state and validation efficiently |
| **Zod** | Validation library | Defines and enforces data schemas for forms |
| **Axios** | HTTP client | Makes API requests to the backend |
| **Lucide React** | Icon library | Provides all the icons used in the UI |

---

## Development Commands

```bash
cd frontend
npm install          # Install dependencies (first time only)
npm run dev          # Start development server on port 3000
npm run build        # Build for production
npm run typecheck    # Check for TypeScript errors
npm run lint         # Check for code style issues
npm run test         # Run unit tests
npm run test:e2e     # Run end-to-end browser tests (Playwright)
```

---

## Production Build

For production, the frontend is compiled into static files (HTML, CSS, JavaScript) and served by **Nginx** (a high-performance web server). The build process:

1. TypeScript is compiled and type-checked
2. All JavaScript is bundled and minified (made as small as possible)
3. The output goes into the `dist/` folder
4. Nginx serves these files on port 80

This means the production frontend has **no Node.js dependency** — it's just static files served by Nginx.
