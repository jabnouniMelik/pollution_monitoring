# RBAC Change Log

This file tracks all changes made to the RBAC system.

---

## [2.0.0] - 2026-05-06

### Major Session — Full Feature Implementation

This session covered a large scope of changes across RBAC, operator management, zone-based dashboards, report generation, and data seeding.

---

### [2.0.1] — verifyToken enrichment (CRITICAL FIX)

**Change:** `verifyToken` middleware now fetches `industryId`, `sitesManaging`, and `zonesAssigned` from DB on every request.

**Problem:** `req.user` only contained `{ userId, email, role, zone }` from the JWT payload. Any service that checked `requester.industryId` or `requester.sitesManaging` received `undefined`, causing empty results or wrong access decisions.

**Files Modified:**
- `backend/middleware/verifyToken.js` — converted to `async`, added DB lookup after token validation

---

### [2.0.2] — SITE_SUPERVISOR zone dashboard

**Change:** SITE_SUPERVISOR can now see and switch between all zones of their managed sites.

**Files Modified:**
- `backend/services/AuthService.js` — `login()` and `getProfile()` now fetch zones from the supervisor's sites and inject them as `zonesAssigned`
- `frontend/src/components/common/ZoneSwitcher/ZoneSwitcher.tsx` — extended to support `SITE_SUPERVISOR` and `HEAD_SUPERVISOR` (was OPERATOR-only)
- `frontend/src/components/common/UserInfo/UserInfo.tsx` — shows site name + zone count for SITE_SUPERVISOR

---

### [2.0.3] — Operator Management page (SITE_SUPERVISOR)

**Change:** SITE_SUPERVISOR can create, delete, and manage zone assignments for operators in their site.

**Backend:**
- `backend/services/UserManagementService.js`:
  - `createUser()` — SITE_SUPERVISOR can create OPERATOR (role forced, industryId inherited)
  - `getUsers()` — SITE_SUPERVISOR sees operators whose zones intersect with their site zones
  - `getUserById()` — SITE_SUPERVISOR can access operators in their industry/site
  - `deleteUser()` — SITE_SUPERVISOR can delete operators in their site; removes from all zones
  - `assignZones()` — validates zones belong to supervisor's sites; syncs `Zone.operatorsAssigned`
  - Added `_getSupervisorZoneIds()` and `_operatorBelongsToSupervisorSite()` helpers
- `backend/repositories/UserRepository.js` — `findAll()` now accepts and applies a filter (was ignoring it)
- `backend/routes/userManagementRoutes.js` — `POST /` and `DELETE /:id` now allow SITE_SUPERVISOR

**Frontend:**
- `frontend/src/lib/constants/roles.ts` — added `MANAGE_OPERATORS` permission to SITE_SUPERVISOR
- `frontend/src/components/layout/Sidebar/Sidebar.tsx` — added "Mes Opérateurs" nav item
- `frontend/src/routes/routes.tsx` — added `/operators` route
- `frontend/src/pages/Operators/Operators.tsx` — new page with create/assign-zones/delete modals
- `frontend/src/features/users/hooks/useUsers.ts` — added `useAssignZones` hook

**Zone assignment modal fix:**
- `frontend/src/pages/Operators/Operators.tsx` — `AssignZonesModal` now uses `useEffect` to reset `selected` state when operator changes; normalizes zone IDs to strings for comparison

---

### [2.0.4] — Alert system fixes

**Change:** Fixed alert routes auth, filtering, stats, escalation, and acknowledge.

**Files Modified:**
- `backend/routes/alertRoutes.js` — added `router.use(verifyToken)` (was completely unprotected — CRIT-001 resolved)
- `backend/controllers/alertController.js`:
  - `getAllAlerts` — fixed `polluantId` → `PolluantId` (capital P) filter; added `status` → `isAcknowledged`/`resolvedAt` mapping; added `zoneId` filter via SensorNode lookup
  - `getAlertStats` — rewrote response to map backend shape `{ bySeverity, totalUnacknowledged }` to frontend shape `{ total, critical, warning, info, open, resolved }`; handles mixed severity casing
  - `acknowledgeAlert` — catches "déjà acquittée" → returns 409 (not 500); uses `req.user.userId`
  - `resolveAlert` — catches "déjà résolue" → returns 409
  - `escalateAlert` — passes all fields through
- `backend/services/AlertService.js` — added `countResolved()` call in `getAlertStats`
- `backend/repositories/AlertRepository.js` — `findAllPaginated()` handles `_pollutantName` filter with Polluant lookup; `countCriticalUnacknowledged()` fixed casing
- `backend/services/AlertService.js` — `escalateAlert()` normalizes severity to DB enum casing (`"High"`, `"Critical"`)
- `frontend/src/features/alerts/api/alertApi.ts` — `normalizeSeverity()`: `"high"` → `'critical'`
- `frontend/src/features/alerts/hooks/useAlerts.ts` — 409 on acknowledge/resolve silently refreshes list; `useAlertStats` staleTime → 0
- `frontend/src/components/alerts/AlertActions/AlertActions.tsx` — hides resolved alerts; hides Acquitter if already acknowledged; hides Escalader if already critical
- `frontend/src/pages/Alerts/Alerts.tsx` — removed Export CSV, Refresh button, search bar; removed client-side search filter
- `frontend/src/components/alerts/AlertFilters/AlertFilters.tsx` — removed search bar
- DB migration: normalized all `"HIGH"` severity values to `"High"`

---

### [2.0.5] — History page fix

**Change:** History page was always empty due to `polluantId` vs `PolluantId` field name mismatch.

**Files Modified:**
- `backend/controllers/readingController.js`:
  - `getAllReadings` — fixed `filter.polluantId` → `filter.PolluantId`; added `zoneId` filter via SensorNode zone code lookup; default limit 100 → 500
  - `getLatestReadings` — added `zoneId` filtering
- `frontend/src/features/readings/api/readingApi.ts` — `resolvePolluantId()` now maps by `code` field too; added `PM ↔ PM25` alias; exported `resetPolluantCache()`
- `frontend/src/features/readings/hooks/useReadings.ts` — `staleTime` → 0

---

### [2.0.6] — Data seeding (Cimenterie de Gabès)

**Change:** Seeded a complete demo industrie with 30 days of realistic readings.

**Script:** `backend/seed-demo-industrie.js` (kept for re-use)

**Created:**
- Industrie: Cimenterie de Gabès (secteur: Ciment)
- Site: Site Principal Gabès
- Zones: Zone Fours de Calcination (Zone-Four), Zone Broyage & Expédition (Zone-Broyage)
- SensorNodes: Node-Gabes-Four, Node-Gabes-Broyage
- Sensors: CO2, NOX, SO2, PM25, COV × 2 nodes = 10 sensors
- Readings: 30 days × 5-min interval × 10 sensors = ~86,400 readings
- Users:
  - `responsable.industrie@cimenterie-gabes.tn` / `Head123!` (HEAD_SUPERVISOR)
  - `responsable.site@cimenterie-gabes.tn` / `Site123!` (SITE_SUPERVISOR)
  - `operateur.four@cimenterie-gabes.tn` / `Oper123!` (OPERATOR — Zone-Four)
  - `operateur.broyage@cimenterie-gabes.tn` / `Oper123!` (OPERATOR — Zone-Broyage)
  - `operator@example.com` / `operator123` (OPERATOR — both zones, for switching test)

---

### [2.0.7] — Report generation by zone

**Change:** Reports can now be generated per zone; fixed 400 error, empty files, and CSV encoding.

**Files Modified:**
- `backend/models/Report.js` — added `zoneId` and `siteId` fields with indexes
- `backend/controllers/reportController.js` — `generateReport` now passes all fields (`title`, `format`, `zoneId`, `siteId`, `includeCompliance`); uses `req.user.userId` for `generatedBy`
- `backend/services/ReportService.js`:
  - `generateReport()` — resolves `zoneId` → SensorNodes → `nodeIdFilter`; auto-generates zone name in title; converts Mongoose Map to plain object before passing to generators; sets end-of-day for date-only inputs
  - `calculateIPE()` — accepts `nodeIdFilter`; skips polluants with no regulatory limit (TEMPERATURE, HUMIDITY)
  - `getComplianceData()` — accepts `nodeIdFilter`; skips polluants with no regulatory limit
- `backend/repositories/ReadingRepository.js` — `aggregateByPolluantPeriod()` accepts optional `nodeIdFilter`
- `backend/services/CsvGeneratorService.js` — complete rewrite: UTF-8 BOM + semicolon separator (French Excel); no more `csv-writer` dependency; handles Map and plain object for `polluantScores`
- `frontend/src/features/reports/api/reportApi.ts` — `normalizeReport()` prepends backend base URL to relative `fileUrl`
- `frontend/src/pages/Reports/Reports.tsx` — added zone picker dropdown; client-side validation before submit; form reset after generation

---

## [1.2.1] - 2026-05-06

### Updated - Zone Filter Integration

**Change:** Integrated zone switcher with existing selectionStore for automatic data filtering

**Files Modified:**
1. `frontend/src/components/common/ZoneSwitcher/ZoneSwitcher.tsx`
2. `frontend/src/pages/Alerts/Alerts.tsx`

---

## [1.2.0] - 2026-05-06

### Added - OPERATOR Zone Switcher & Industry Display

**Files Modified:**
1. `backend/services/AuthService.js`
2. `frontend/src/features/auth/types/auth.types.ts`
3. `frontend/src/features/auth/store/zoneStore.ts` (NEW)
4. `frontend/src/features/auth/hooks/useSelectedZone.ts` (NEW)
5. `frontend/src/components/common/ZoneSwitcher/ZoneSwitcher.tsx` (NEW)
6. `frontend/src/components/common/UserInfo/UserInfo.tsx` (NEW)
7. `frontend/src/components/layout/Sidebar/Sidebar.tsx`

---

## [1.1.0] - 2026-05-06

### Added - OPERATOR AI Access

**Files Modified:**
1. `frontend/src/lib/constants/roles.ts` — added `VIEW_AI` to OPERATOR

---

## [1.0.0] - 2026-05-06

### Initial RBAC Analysis

**Deliverables:** RBAC_ANALYSIS.md, RBAC_QUICK_REFERENCE.md, RBAC_ISSUES_TRACKER.md, RBAC_SUMMARY.md, RBAC_ARCHITECTURE.md, RBAC_README.md

### Updated - Zone Filter Integration

**Change:** Integrated zone switcher with existing selectionStore for automatic data filtering

**Rationale:**
- All pages need to filter data by selected zone
- Existing `selectionStore` already used for site/zone filtering
- Seamless integration with existing architecture

**Impact:**
- **Frontend:** Zone switcher now syncs with `selectionStore.zoneId`
- **Frontend:** All pages automatically filter by selected zone
- **Frontend:** Alerts page explicitly updated to use zoneId
- **Backend:** No changes needed (already supports zone filtering)

**Files Modified:**

**Frontend:**
1. `frontend/src/components/common/ZoneSwitcher/ZoneSwitcher.tsx`
   - Added `useSelectionStore` integration
   - Syncs `selectedZone` with `selectionStore.zoneId`
   - Auto-updates filter when zone changes

2. `frontend/src/pages/Alerts/Alerts.tsx`
   - Added `useSelectionStore` import
   - Added `zoneId` to alert filters
   - Alerts now filtered by selected zone

**Pages Already Integrated:**
- ✅ Overview - Already uses `useSelectionStore`
- ✅ History - Already uses `useSelectionStore`
- ✅ Compliance - Already uses `useSelectionStore`
- ⏳ AI Predictions - Uses mock data (will auto-filter when API connected)

**Features:**
- ✅ Zone selection synced across all pages
- ✅ Switching zones updates all dashboards
- ✅ Real-time data filtering
- ✅ No page reload needed
- ✅ Smooth transitions

**Testing Required:**
- [x] Switch zones - verify all pages update
- [x] Reload page - verify zone selection persists
- [x] Check Overview - verify KPIs filtered
- [x] Check Alerts - verify alerts filtered
- [x] Check History - verify readings filtered
- [x] Check Compliance - verify limits filtered

**Documentation:**
- Created `RBAC_ZONE_INTEGRATION_SUMMARY.md` - Complete integration guide

---

## [1.2.0] - 2026-05-06

### Added - OPERATOR Zone Switcher & Industry Display

**Change:** OPERATOR can now see their industry name and switch between assigned zones

**Rationale:** 
- Operators need to know which industry/company they work for
- Operators assigned to multiple zones need to switch between zone dashboards
- Better UX and context awareness for operators

**Impact:**
- **Backend:** `/api/auth/me` and `/api/auth/login` now populate `zonesAssigned`, `industryId`, and `sitesManaging`
- **Frontend:** New zone switcher component in sidebar
- **Frontend:** User info component shows industry and zone information
- **Frontend:** Zone selection persists across page reloads

**Files Modified:**

**Backend:**
1. `backend/services/AuthService.js`
   - Updated `getProfile()` to populate zones and industry
   - Updated `login()` to populate zones and industry

**Frontend:**
2. `frontend/src/features/auth/types/auth.types.ts`
   - Added `Zone`, `Industry`, `Site` interfaces
   - Updated `User` interface with populated fields

3. `frontend/src/features/auth/store/zoneStore.ts` (NEW)
   - Created zone selection store with persistence

4. `frontend/src/features/auth/hooks/useSelectedZone.ts` (NEW)
   - Created hooks for accessing selected zone

5. `frontend/src/components/common/ZoneSwitcher/ZoneSwitcher.tsx` (NEW)
   - Created zone switcher dropdown component

6. `frontend/src/components/common/UserInfo/UserInfo.tsx` (NEW)
   - Created user info display component

7. `frontend/src/components/layout/Sidebar/Sidebar.tsx`
   - Added UserInfo and ZoneSwitcher to sidebar

**Features:**
- ✅ Display industry name and sector
- ✅ Display assigned zones
- ✅ Switch between zones (dropdown for multiple zones)
- ✅ Auto-select first zone on login
- ✅ Persist zone selection across sessions
- ✅ Show zone count for multi-zone operators
- ✅ Graceful handling of no assigned zones

**Testing Required:**
- [ ] Login as OPERATOR with 1 zone - verify zone displayed
- [ ] Login as OPERATOR with multiple zones - verify dropdown works
- [ ] Switch zones - verify selection persists on page reload
- [ ] Login as OPERATOR with no zones - verify graceful message
- [ ] Login as other roles - verify zone switcher not shown
- [ ] Verify industry name displayed correctly
- [ ] Test on mobile - verify responsive layout

**Rollback Plan:**
1. Revert backend populate changes in AuthService
2. Remove new frontend components
3. Revert Sidebar changes

---

## [1.1.0] - 2026-05-06

### Added - OPERATOR AI Access

**Change:** OPERATOR role can now access AI prediction page

**Rationale:** Operators need to see AI predictions for their assigned zones to better anticipate pollution events and take proactive measures.

**Impact:**
- **Frontend:** OPERATOR now has `VIEW_AI` permission
- **Backend:** No changes needed (AI endpoints already support zone filtering)
- **Security:** Operators can only view AI predictions for their assigned zones (existing zone filtering applies)

**Files Modified:**
1. `frontend/src/lib/constants/roles.ts`
   - Added `VIEW_AI` to OPERATOR permissions array

2. `RBAC_ANALYSIS.md`
   - Updated Permission Mapping table to show OPERATOR has AI View access

3. `RBAC_QUICK_REFERENCE.md`
   - Updated OPERATOR capabilities section
   - Updated AI permissions table
   - Updated data scope section

4. `RBAC_SUMMARY.md`
   - Updated OPERATOR key powers
   - Updated permission matrix

5. `RBAC_ARCHITECTURE.md`
   - Updated OPERATOR scope diagram to include AI Predictions

**Testing Required:**
- [ ] Login as OPERATOR
- [ ] Verify AI page is accessible in navigation
- [ ] Verify AI predictions shown are filtered to assigned zones only
- [ ] Verify OPERATOR cannot retrain models
- [ ] Test with multiple operators with different zone assignments

**Rollback Plan:**
If issues arise, remove `VIEW_AI` from OPERATOR permissions in `frontend/src/lib/constants/roles.ts`

---

## [1.0.0] - 2026-05-06

### Initial RBAC Analysis

**Change:** Complete RBAC system analysis and documentation

**Deliverables:**
- RBAC_ANALYSIS.md - Complete 50-page technical analysis
- RBAC_QUICK_REFERENCE.md - Quick lookup guide
- RBAC_ISSUES_TRACKER.md - 15 tracked issues
- RBAC_SUMMARY.md - Executive summary
- RBAC_ARCHITECTURE.md - Visual diagrams
- RBAC_README.md - Documentation guide

**Findings:**
- 15 issues identified (3 critical, 4 high, 5 medium, 3 low)
- Security score: 6.5/10
- Estimated fix time: 28 days

---

## Template for Future Changes

```markdown
## [Version] - YYYY-MM-DD

### Change Title

**Change:** Brief description

**Rationale:** Why this change is needed

**Impact:**
- Frontend changes
- Backend changes
- Security implications

**Files Modified:**
1. file1.ts - what changed
2. file2.js - what changed

**Testing Required:**
- [ ] Test case 1
- [ ] Test case 2

**Rollback Plan:**
How to undo this change if needed
```
