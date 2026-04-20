# EmissionsIQ — Frontend Roadmap

> Liste vivante de tout ce qui reste à faire côté frontend.  
> **Cocher une case dès qu'une tâche est terminée** (`- [ ]` → `- [x]`).  
> Date de dernière mise à jour : _2026-04-17_

---

## 🔴 Critique — bloquant pour la prod

- [ ] **#1 — Synchro temps réel des caches React Query**
  - `WebSocketProvider` doit dispatcher `queryClient.setQueryData(...)` quand un message arrive.
  - Topics à mapper :
    - `kpi:site:*` / `kpi:global` → `queryKeys.kpi.summary(...)`
    - `alerts:all` → `queryKeys.alerts.list(...)` (push optimiste + invalidation `stats`)
  - Ajouter un util `applyWSMessage(queryClient, message)`.
- [ ] **#2 — Vérifier le contrat API backend** (mapping un-à-un)
  - Lister tous les endpoints réels de `backend/routes/*.js`.
  - Patcher `src/lib/api/endpoints.ts` + DTOs frontend en conséquence.
  - Marquer ici les endpoints qui n'existent pas → à créer côté backend ou à retirer côté frontend.
- [ ] **#3 — Bootstrap `/api/auth/me` bruyant**
  - Ne bootstrapper que si un access token est en mémoire **ou** si un cookie de refresh existe.
  - Sinon → `markInitialized()` direct sans appel HTTP.
- [ ] **#4 — Backend `/api/auth/refresh` 500**
  - Vérifier `cookie-parser` monté avant les routes (`backend/server.js`).
  - Vérifier `JWT_REFRESH_SECRET` dans `backend/.env`.
  - Logger le stack trace côté backend et corriger.

---

## 🟠 Important — fonctionnalités attendues mais incomplètes

- [ ] **#5 — Overview MTD = données aléatoires**
  - Remplacer `Math.random()` par `useKPIHistory({ pollutant: 'NOX', period: 'mtd' })`.
  - Calculer le cumul à partir des points renvoyés.
- [ ] **#6 — Page AI Predictions = 100 % factice**
  - Brancher sur les routes backend `/api/ai/*` (ou créer un mock MSW si pas dispo).
  - Composants à brancher : stats modèle, prédictions, forecast chart.
- [ ] **#7 — Reports — génération & export**
  - Confirmer/implémenter `POST /api/reports/generate` côté backend.
  - Téléchargement PDF/CSV : utiliser `jspdf` + `papaparse` côté client si l'export se fait en local.
- [ ] **#8 — Alert detail modal**
  - Au clic sur un `<AlertItem>`, ouvrir `<Modal>` avec :
    - Détail complet (pollutant, capteur, valeurs)
    - Timeline (created → acknowledged → escalated → resolved)
    - Champ commentaire
- [ ] **#9 — Pagination UI alertes**
  - Composant `<Pagination>` réutilisable + branchement sur `useAlerts({ page, pageSize })`.
- [ ] **#10 — Filtres alertes persistés dans l'URL**
  - Migrer `useState` → `useSearchParams`.
  - Synchroniser au montage + à chaque change.
- [ ] **#11 — Sidebar mobile (hamburger + drawer)**
  - Ajouter bouton `Menu` dans `Topbar` visible `< md`.
  - Sidebar en mode `fixed inset-y-0 left-0 -translate-x-full data-[open]:translate-x-0` sur mobile.
  - Backdrop semi-opaque + fermeture au clic.
- [ ] **#12 — Topbar Search & Notifications**
  - **Search** : palette `cmdk` (`Ctrl+K`) — sites, alertes, rapports, navigation.
  - **Notifications** : dropdown branché sur `useAlerts({ pageSize: 5, status: 'open' })`.
- [ ] **#13 — Profil utilisateur / menu**
  - Dropdown sur l'avatar : Mon profil, Sites assignés, Changer mot de passe, Se déconnecter.

---

## 🟡 CRUD manquants (pages d'admin)

- [ ] **#14 — Gestion utilisateurs `/users`**
  - Liste paginée + filtres par rôle/site
  - Création (modal) avec `role`, `assignedSites`, `assignedZones`
  - Édition + suppression + activation/désactivation
  - Backend : `userManagementRoutes` déjà disponible
- [ ] **#15 — Gestion sites `/sites` & zones `/zones`**
  - CRUD complet
  - Assignation supervisor / operator
  - Vue arborescente Industrie → Sites → Zones
- [ ] **#16 — Gestion seuils par polluant** (dans `/config`)
  - Table éditable des seuils (`thresholdConfig`)
  - Min / Max / Limit / Unité par polluant
  - Validation Zod + soumission

---

## 🟢 Qualité — UX & accessibilité

- [ ] **#17 — Empty/error states uniformes**
  - Wrapper `<QueryState query={...} empty={...} error={...} children={...}>` réutilisable.
  - Bouton « Réessayer » câblé sur `query.refetch()`.
- [ ] **#18 — Skeletons par bloc cohérents**
  - History, Compliance, Reports — actuellement vide pendant le chargement.
- [ ] **#19 — Dark mode**
  - Activer `darkMode: 'class'` dans `tailwind.config.js`.
  - Toggle dans le `Topbar` (persisté en `localStorage`).
  - Adapter les variables CSS dans `:root.dark { ... }`.
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
- [x] UI kit (`Button`, `Card`, `Badge`, `Input`, `Select`, `Table`, `Skeleton`, `Toast`, `Modal`)
- [x] Layout (`Sidebar` sticky, `Topbar`, `MainLayout`, `PageHeader`)
- [x] Charts (`MiniTrendChart`, `HistoryChart`, `IPEGauge`, `MTDTrendChart`, `ChartWrapper`)
- [x] KPI calculations (TD, EMJ, IPE, RCO2 + statuses)
- [x] Pages : Login (full), Overview (full), Alerts, History, Compliance, AIPredictions, Reports, Config, 404, 401
- [x] Routing avec lazy-loading + `ProtectedRoute`
- [x] Tests sample : `kpiCalculations`, `checkPermission`, `Button`, `KPICard`
- [x] Playwright config + sample login E2E
- [x] Docker multi-stage + `nginx.conf` + `docker-compose.yml`
- [x] CI GitHub Actions (lint + test + build + e2e)
- [x] README complet (architecture, RBAC matrix, API contract, troubleshooting)
- [x] `normalizeUser` → tolérant aux variantes de payload backend
- [x] Sidebar sticky en scroll

---

## Comment utiliser ce fichier

1. Avant de commencer une tâche → la déplacer dans **🟢 En cours** (section à créer si besoin).
2. À la fin → cocher la case et l'archiver dans **✅ Déjà terminé**.
3. Si une tâche fait apparaître des sous-tâches → les ajouter en sous-listes sous la tâche parente.
4. Mettre à jour la **date de dernière mise à jour** en haut.
