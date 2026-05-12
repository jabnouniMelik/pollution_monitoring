# Authentication & Access Control
### How login, security, and user permissions work

---

## Authentication Flow

```
1. POST /api/auth/login  { email, password }
2. Backend verifies password (bcrypt)
3. Issues two tokens:
   - ACCESS TOKEN  (15 min) → stored in JS memory
   - REFRESH TOKEN (7 days) → stored in HttpOnly cookie
4. On 401 expired → frontend silently calls POST /api/auth/refresh
5. New access token issued → original request retried
```

**verifyToken middleware** (runs on every protected request):
- Reads `Authorization: Bearer <token>` header
- Verifies JWT signature
- Fetches `industryId`, `sitesManaging`, `zonesAssigned` from DB (not in JWT)
- Attaches full `req.user` object

---

## The 5 Roles

### Role Hierarchy

```
SUPER_ADMIN (5)     — System administrator
HEAD_SUPERVISOR (4) — Industry-wide manager
SITE_SUPERVISOR (3) — Site-level manager
AUDITOR (2)         — Read-only compliance officer
OPERATOR (1)        — Zone-level worker
```

### SUPER_ADMIN
- **Home page:** `/industries` (not the operational dashboard)
- **Can:** Manage users, sites, zones, industries, config, thresholds, approvals
- **Cannot:** View operational dashboards (alerts, KPIs, history, reports, AI)
- **Exception:** Can view KPI summary when inspecting a zone from Sites & Zones page

### HEAD_SUPERVISOR
- **Scope:** Their assigned industry (all sites + zones)
- **Can:** Full operational access, create sites/zones (pending approval), manage team
- **Cannot:** Configure thresholds, access other industries

### SITE_SUPERVISOR
- **Scope:** Their assigned sites only
- **Can:** Operational access for their sites, manage operators, create zones (pending approval)
- **Cannot:** Access other sites, configure thresholds

### AUDITOR
- **Scope:** All data (read-only)
- **Can:** View all dashboards, generate reports
- **Cannot:** Acknowledge/resolve alerts, modify anything

### OPERATOR
- **Scope:** Their assigned zones only
- **Can:** View live data, acknowledge alerts, view AI predictions
- **Cannot:** Access other zones, generate reports, resolve alerts

---

## Permission Matrix

| Permission | SUPER_ADMIN | HEAD_SUPERVISOR | SITE_SUPERVISOR | AUDITOR | OPERATOR |
|-----------|:-----------:|:---------------:|:---------------:|:-------:|:--------:|
| VIEW_ALL_USERS | ✅ | ✅ | ✅ | ✅ | ❌ |
| CREATE/UPDATE/DELETE_USER | ✅ | ❌ | ❌ | ❌ | ❌ |
| VIEW_ALL_SITES | ✅ | ✅ | ❌ | ✅ | ❌ |
| CREATE_SITE | ✅ | ✅ | ❌ | ❌ | ❌ |
| CREATE_ZONE | ✅ | ✅ | ✅ | ❌ | ❌ |
| VIEW_ALERTS | ❌ | ✅ | ✅ | ✅ | ✅ |
| ACKNOWLEDGE_ALERT | ❌ | ✅ | ✅ | ❌ | ✅ |
| RESOLVE_ALERT | ❌ | ✅ | ✅ | ❌ | ❌ |
| VIEW_KPI | ❌ | ✅ | ✅ | ✅ | ✅ |
| GENERATE_REPORT | ❌ | ✅ | ✅ | ✅ | ❌ |
| VIEW_AI | ❌ | ✅ | ✅ | ✅ | ✅ |
| UPDATE_THRESHOLDS | ✅ | ❌ | ❌ | ❌ | ❌ |
| VIEW_CONFIG | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## Alert Acknowledge vs Resolve

These are **independent states**:

| State | Meaning | Who sets it |
|-------|---------|-------------|
| `isAcknowledged = true` | "I've seen this, I'm working on it" | Operator/Supervisor manually |
| `resolvedAt` set | "Problem is fixed" | Supervisor manually OR system auto |

- Acknowledging does NOT resolve
- Resolving does NOT force-acknowledge
- Auto-resolve (value drops below threshold) sets `resolvedAt`, `resolvedBy=null`, leaves `isAcknowledged` untouched

---

## Alert Scope by Role

Alerts are filtered server-side based on `req.user`:

| Role | Alert scope |
|------|------------|
| OPERATOR | Only zones in `req.user.zonesAssigned` (via SensorNode.zone → Sensor → Alert chain) |
| SITE_SUPERVISOR | All zones of `req.user.sitesManaging` |
| HEAD_SUPERVISOR | All zones of `req.user.industryId` |
| AUDITOR | All alerts |
| SUPER_ADMIN | No alerts (admin role) |

---

## Zone Switcher

The sidebar bottom section shows a zone/site switcher based on role:

- **OPERATOR**: dropdown of assigned zones → updates `selectionStore.zoneId`
- **SITE_SUPERVISOR**: dropdown of all zones across assigned sites (grouped by site) → updates `selectionStore.siteId` + `zoneId`
- **HEAD_SUPERVISOR**: site selector + zone selector (zones reload when site changes) → updates both

All pages (Overview, Alerts, History, Compliance) read from `selectionStore` and filter data accordingly.

---

## User Management

SUPER_ADMIN uses a unified "Gestion Utilisateurs" page with:
- Dynamic assignment column per role (industry / sites / zones)
- 3-level cascade for OPERATOR assignment: Industry → Site → Zones
- 2-level cascade for SITE_SUPERVISOR: Industry → Sites (multi-select)
- Industry selector for HEAD_SUPERVISOR

When assigning sites to SITE_SUPERVISOR, `industryId` is automatically derived from the first assigned site.

---

## Default Accounts (after init-fresh.js)

| Role | Email | Password |
|------|-------|----------|
| SUPER_ADMIN | superadmin@emissionsiq.tn | Admin1234! |
| HEAD_SUPERVISOR | responsable.industrie@cimenterie-gabes.tn | Head1234! |
| SITE_SUPERVISOR | responsable.site@cimenterie-gabes.tn | Site1234! |
| OPERATOR | operateur.four@cimenterie-gabes.tn | Oper1234! |
| AUDITOR | auditor@example.com | Audit1234! |

> ⚠️ Change all passwords before production deployment.

---

## Security

| Practice | Implementation |
|----------|---------------|
| Password storage | bcrypt (cost 10) |
| Token forgery prevention | JWT signed with server-only secret |
| XSS protection | Refresh token in HttpOnly cookie |
| CSRF protection | SameSite=Strict cookie |
| Brute-force protection | Rate limiting (10 attempts / 15 min in production) |
| Zone isolation | OPERATOR queries automatically filtered by assigned zones |
| industryId in req.user | Fetched from DB on every request (not in JWT) — always current |
