# EmissionsIQ — Frontend Roadmap

> Liste vivante de tout ce qui reste à faire côté frontend.  
> **Cocher une case dès qu'une tâche est terminée** (`- [ ]` → `- [x]`).  
> Date de dernière mise à jour : _2026-04-23_ (#15 CRUD Sites/Zones ✅)

---

## 🔴 Critique — bloquant pour la prod

- [x] **#1 — Synchro temps réel des caches React Query**
  - `applyWSMessage(queryClient, message)` dans `src/features/websocket/applyWSMessage.ts`.
  - Appel depuis `WebSocketProvider` à chaque message WS.
  - `kpi_update` → invalidation `['kpi','summary']` + `['readings','latest']` ; `alert` → `['alerts']`.
- [x] **#2 — Vérifier le contrat API backend** (mapping un-à-un)
  - `docs/API_CONTRACT.md` + `src/lib/api/endpoints.ts` (industries, polluants, sensors, sensor-nodes, site-config, thresholds complets).
  - Corrections : `readings.latest`, `thresholds` sans `bySite`, `reports.export` → fichier via `url`, `kpi.history` → mapping `AggregateData`, clé React Query `readings.list`.
- [x] **#3 — Bootstrap `/api/auth/me` bruyant**
  - Si ni profil persisté ni access token : tentative `tryRefreshSession()` (POST `/api/auth/refresh` avec cookie HttpOnly) avant d'abandonner ; sinon `markInitialized()` sans `/me`.
  - Export `tryRefreshSession` dans `src/lib/api/axios.ts`.
- [x] **#4 — Backend `/api/auth/refresh` 500**
  - `AuthService.refresh` : validation cryptographique `verifyRefreshToken(...)` + codes 401 explicites.
  - `authController.refresh` : garde-fou cookie absent + log diagnostique (`hasCookie`, message).
  - `config/jwt.js` : erreurs claires si `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` manquent (au lieu d'un 500 opaque).

---

## 🟠 Important — fonctionnalités attendues mais incomplètes

- [x] **#5 — Overview MTD = données aléatoires**
  - `Overview` utilise `useKPIHistory('NOX', { period: 'day' })` + filtrage mois courant pour le MTD.
  - Cumul MTD calculé à partir des points réels (plus de `Math.random()`).
- [ ] **#6 — Page AI Predictions = 100 % factice**
  - Brancher sur les routes backend `/api/ai/*` (ou créer un mock MSW si pas dispo).
  - Composants à brancher : stats modèle, prédictions, forecast chart.
- [x] **#7 — Reports — génération & export**
  - Backend : génération PDF avec Puppeteer (HTML → PDF)
  - Backend : génération CSV avec csv-writer
  - Contenu : en-tête, score IPE, graphiques (ChartJS), tableau polluants, tendances, compliance
  - Stockage : `backend/uploads/reports/`
  - Frontend : téléchargement via URL `/uploads/reports/{filename}`
  - Tests : script `test-report-generation.js` + E2E Playwright
  - Documentation : `REPORTS_GENERATION_GUIDE.md`
- [x] **#8 — Alert detail modal**
  - Modal complet avec détail alerte (pollutant, capteur, valeurs, dépassement)
  - Timeline visuelle (created → acknowledged → resolved)
  - Champ commentaire (resolutionNote)
  - Actions : Acquitter, Escalader, Résoudre
  - Intégration dans page Alerts (clic sur AlertItem)
  - Tests E2E Playwright (`alert-detail.spec.ts`)
- [x] **#9 — Pagination UI alertes**
  - Backend : pagination serveur avec `page`, `pageSize`, `total`, `totalPages`
  - Repository : méthode `findAllPaginated` avec skip/limit
  - Frontend : composant `<Pagination>` réutilisable
  - Intégration page Alerts : navigation + sélecteur taille page (10, 20, 50, 100)
  - Tests : script `test-alert-pagination.js`
- [x] **#10 — Filtres alertes persistés dans l'URL**
  - `Alerts.tsx` migre de `useState` vers `useSearchParams`.
  - Synchronisation bidirectionnelle URL ⇄ filtres (severity, status, pollutant, search, page, pageSize).
- [x] **#11 — Sidebar mobile (hamburger + drawer)**
  - Bouton hamburger dans Topbar (visible < md)
  - Sidebar en mode fixed avec slide depuis la gauche
  - Backdrop semi-opaque avec fermeture au clic
  - Fermeture automatique au clic sur un lien de navigation
  - Store UI : états `mobileMenuOpen`, `toggleMobileMenu`, `closeMobileMenu`
  - Animation fluide (300ms transition)
- [x] **#12 — Topbar Notifications**
  - **Notifications** : dropdown branché sur `useAlerts({ pageSize: 5, status: 'open' })`.
  - Badge avec compteur d'alertes non lues
  - Bouton "Marquer comme lu" pour chaque alerte
  - Lien vers la page alertes
  - Fermeture au clic extérieur
- [x] **#13 — Profil utilisateur / menu**
  - Dropdown sur l'avatar : Mon profil, Sites assignés, Changer mot de passe, Se déconnecter.
  - ProfileModal : affichage username, email, role, sites/zones assignés (lecture seule)
  - ChangePasswordModal : formulaire avec validation (min 8 caractères, correspondance)
  - Endpoint backend : POST /api/auth/change-password

---

## 🟡 CRUD manquants (pages d'admin)

- [x] **#14 — Gestion utilisateurs `/users`**
  - Liste paginée (10 users/page) + filtres par rôle/recherche
  - Création (modal) avec `role`, `industryId`
  - Édition + suppression + changement de rôle
  - Backend : `userManagementRoutes` disponible
  - Frontend : `/features/users/` hooks + API + pages complets
- [x] **#15 — Gestion sites `/sites` & zones `/zones`** ✅ Option 1 (MVP Streamline)
  - **Sites** : page listée (10 sites/page), filtres par industrieId/recherche, modales CRUD
  - **Zones** : page dédiée `/zones/:siteId`, accès via lien « Zones » dans table sites, modales CRUD
  - Assignation supervisor (sites) / operateurs (zones) — structure prête, UI minimale
  - Route protection : `VIEW_ALL_SITES` (SUPER_ADMIN + HEAD_SUPERVISOR)
  - Backend : `siteManagementRoutes` + `zoneManagementRoutes` branchés, pagination via query params
  - Frontend : `/features/sites/` et `/features/zones/` API + hooks + pages complets + build validation ✅
- [x] **#16 — Gestion seuils par polluant** (dans `/config`)
  - Section `ThresholdConfigSection` : min / max / warning / critical / unité / référence, validation Zod, API `all-pollutants` + reset.

---

## 🟢 Qualité — UX & accessibilité

- [x] **#17 — Empty/error states uniformes**
  - Composant `<QueryState>` réutilisable pour gérer loading/error/empty
  - Bouton « Réessayer » câblé sur `query.refetch()`
  - Composants `EmptyState` et `ErrorState` exportés pour usage standalone
  - Intégré dans pages History, Compliance, Reports
  - Skeletons personnalisables par page
- [x] **#18 — Skeletons par bloc cohérents**
  - Composants skeleton spécialisés : `KPICardSkeleton`, `ChartSkeleton`, `TableSkeleton`, `AlertListSkeleton`, `StatsGridSkeleton`
  - Skeletons complets par page : `OverviewSkeleton`, `HistorySkeleton`, `ComplianceSkeleton`, `ReportsSkeleton`
  - Intégrés dans QueryState pour History, Compliance, Reports
  - Hauteurs et colonnes configurables
- [ ] **#19 — Dark mode** (ANNULÉ)
  - Fonctionnalité retirée sur demande
- [ ] **#20 — i18n**
  - Installer `i18next` + `react-i18next`.
  - Extraire toutes les chaînes FR vers `src/i18n/fr.json`.
  - Préparer `en.json` (peut être vide au début).
- [ ] **#21 — A11y — focus trap modal**
  - Intégrer `focus-trap-react` ou implémenter manuellement dans `<Modal>`.
- [ ] **#22 — A11y — toasts par sévérité**
  - `error` & `warning` → `aria-live="assertive"`.
  - `info` & `success` → `aria-live="polite"`.

---

## 🧪 Tests & qualité de code

- [ ] **#23 — Couverture tests à augmenter** (cible 70 %+)
  - Tests à ajouter : `PermissionGate`, `ProtectedRoute`, `LoginForm` (avec MSW), `useAuth` bootstrap, `WebSocket` reconnect, `kpiCalculations` cas limites.
- [ ] **#24 — MSW (Mock Service Worker)**
  - Configurer pour les tests + mode dev offline.
  - Handlers de base pour tous les endpoints.
- [ ] **#25 — E2E Playwright étendu**
  - Login + redirection
  - Acquittement d'alerte
  - Génération de rapport
  - RBAC negative test (operator ne voit pas `/config`)
  - Reconnexion WebSocket
- [ ] **#26 — Storybook (optionnel, non bloquant)**
  - Documenter `ui/`, `kpi/`, `alerts/`, `charts/`.

---

## 🚀 DevOps

- [ ] **#27 — `.env.local` exemple complet**
  - Ajouter `VITE_ENABLE_DEVTOOLS`, commentaires CI.
- [ ] **#28 — Healthcheck applicatif**
  - Endpoint `/healthz` qui ping `/api/health`.
  - Dockerfile `HEALTHCHECK` adapté.
- [ ] **#29 — Sentry (error tracking en prod)**
  - Intégrer `@sentry/react` + `@sentry/vite-plugin`.
  - Source maps uploadées en CI.
- [ ] **#30 — Bundle analysis**
  - `rollup-plugin-visualizer` dans `vite.config.ts` derrière un flag `ANALYZE=1`.
  - Script `npm run analyze`.

---

## ✅ Déjà terminé (référence)

- [x] Scaffolding Vite + React 18 + TS strict
- [x] Tailwind avec palette complète (navy / accent / pollutants)
- [x] Zustand stores (`uiStore`, `selectionStore`, `authStore`)
- [x] React Query (`queryClient`, `queryKeys`, hooks)
- [x] Axios + intercepteurs (refresh-on-401, JWT en mémoire)
- [x] RBAC (`Role`, `Permission`, `hasPermission`, `PermissionGate`, `ProtectedRoute`)
- [x] WebSocket client (auto-reconnect, heartbeat, re-auth, re-subscribe)
- [x] **WebSocket → invalidation React Query** (`applyWSMessage`, 2026-04)
- [x] **Auth bootstrap** : refresh silencieux avant `/me` si cookie de session (`tryRefreshSession`, 2026-04)
- [x] **Contrat API** : `docs/API_CONTRACT.md`, endpoints alignés backend, DTO KPI history + readings latest (2026-04)
- [x] UI kit (`Button`, `Card`, `Badge`, `Input`, `Select`, `Table`, `Skeleton`, `Toast`, `Modal`)
- [x] Layout (`Sidebar` sticky, `Topbar`, `MainLayout`, `PageHeader`)
- [x] Charts (`MiniTrendChart`, `HistoryChart`, `EnvironmentChart`, `IPEGauge`, `MTDTrendChart`, `ChartWrapper`)
- [x] KPI calculations (TD, EMJ, IPE, RCO2 + statuses)
- [x] Pages : Login (full), Overview (full), Alerts, History, Compliance, AIPredictions, Reports, Config (SUPER_ADMIN), 404, 401
- [x] Routing avec lazy-loading + `ProtectedRoute`
- [x] Tests sample : `kpiCalculations`, `checkPermission`, `Button`, `KPICard`
- [x] Playwright config + sample login E2E
- [x] Docker multi-stage + `nginx.conf` + `docker-compose.yml`
- [x] CI GitHub Actions (lint + test + build + e2e)
- [x] README complet (architecture, RBAC matrix, API contract, troubleshooting)
- [x] `normalizeUser` → tolérant aux variantes de payload backend
- [x] Sidebar sticky en scroll
- [x] **Configuration** : seuils globaux par polluant (`ThresholdConfigSection` + backend `all-pollutants`)

---

## Comment utiliser ce fichier

1. Avant de commencer une tâche → la déplacer dans **🟢 En cours** (section à créer si besoin).
2. À la fin → cocher la case et l'archiver dans **✅ Déjà terminé**.
3. Si une tâche fait apparaître des sous-tâches → les ajouter en sous-listes sous la tâche parente.
4. Mettre à jour la **date de dernière mise à jour** en haut.
