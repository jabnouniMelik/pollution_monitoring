# Checklist — Intégration IA (Backend ↔ Frontend)

> Revue du 25/05/2026 — corrections appliquées le 25/05/2026.

| ID | Priorité | Problème | Impact | Statut |
|----|----------|----------|--------|--------|
| **IA-01** | **P0** | `iaController` renvoie `{ success, health, forecast }` au lieu de `{ success, data: {...} }` | `unwrap()` frontend → `undefined`, pages IA cassées | ✅ **Terminé** — `backend/controllers/iaController.js` |
| **IA-02** | **P0** | `getSkillSummary()` lit `report.global_skill` au lieu de `report.global.skill` | Skill global toujours `undefined` dans l'UI | ✅ **Terminé** — `backend/services/AIService.js` |
| **IA-03** | **P1** | Unité PM frontend `µg/m³` vs simulateur/LSTM `mg/m³` | Graphiques et seuils incohérents | ✅ **Terminé** — `frontend/src/lib/constants/pollutants.ts` |
| **IA-04** | **P1** | Pas d'affichage d'erreur si `/api/ia/*` échoue | Cartes vides sans message explicite | ✅ **Terminé** — `AIPredictions.tsx` (bannières erreur) |
| **IA-05** | **P2** | Endpoints `runForecast` / `runDetect` non branchés | Impossible de lancer l'IA manuellement | ✅ **Terminé** — `iaApi.ts`, `useRunIAForZone`, bouton « Lancer IA » (par zone) |
| **IA-06** | **P2** | Routes IA sans contrôle permission backend | Tout utilisateur authentifié pouvait appeler `/api/ia/*` | ✅ **Terminé** — `view_ai` / `run_ia` dans `checkRole.js` + `iaRoutes.js` |
| **IA-07** | **P3** | Sidebar masque « Prédictions IA » pour SUPER_ADMIN | Comportement **voulu** : SUPER_ADMIN n'a pas `VIEW_AI` | ✅ **Documenté** — commentaire `Sidebar.tsx` |
| **IA-08** | **P3** | Prévisions IA = **site** ; historique peut filtrer par **zone** | Confusion utilisateur possible | ✅ **Terminé** — note UI `AIPredictions` + `ForecastBanner` |
| **IA-09** | **Info** | `IA_CREATE_FORECAST_ALERTS=false` par défaut | Alertes type Forecast non créées en Mongo | ℹ️ Documenté — `backend/env.ia.example` |
| **IA-10** | **Info** | LSTM ne déduplique pas par `(siteId, anchorPeriodStart)` | Croissance collection `lstmforecasts` | ℹ️ Backlog (non bloquant) |

---

## Fichiers modifiés

| Fichier | Correction |
|---------|------------|
| `backend/controllers/iaController.js` | Enveloppe `{ success, data }` sur tous les endpoints |
| `backend/services/AIService.js` | `getSkillSummary()` → `report.global.skill` |
| `backend/middleware/checkRole.js` | Permissions `view_ai`, `run_ia` |
| `backend/routes/iaRoutes.js` | `checkPermission('view_ai' \| 'run_ia')` |
| `frontend/src/lib/constants/pollutants.ts` | PM unité `mg/m³` |
| `frontend/src/lib/constants/roles.ts` | Permission `RUN_IA` |
| `frontend/src/features/ia/api/iaApi.ts` | `runForecast`, `runDetection` |
| `frontend/src/features/ia/hooks/useIA.ts` | `useRunIAForZone` mutation |
| `frontend/src/pages/AIPredictions/AIPredictions.tsx` | Erreurs, run IA, skill global, note site/zone |
| `frontend/src/pages/History/History.tsx` | `siteLevelOnly` sur bannière |
| `frontend/src/features/ia/components/ForecastBanner.tsx` | Note niveau site |

---

## Critères de validation post-correction

- [x] `GET /api/ia/health` → `{ success: true, data: { health, skill } }`
- [x] `GET /api/ia/forecasts/:siteId/latest` → `{ success: true, data: { forecast } }`
- [x] Skill global exposé via `data.skill.global_skill`
- [x] Bouton « Lancer IA » (permission `RUN_IA`) pour HEAD_SUPERVISOR / SUPER_ADMIN
- [x] OPERATOR : lecture via `view_ai` ; run refusé (403 `run_ia`)
- [x] Note « prévisions au niveau site » si zone sélectionnée
- [x] Sync agrégats HOURLY avant run IA (`syncHourlyAggregatesForSite`)
- [x] GET forecast/latest → 200 avec `forecast: null` (plus de 404 console)
- [ ] Test manuel E2E avec backend + simulateur + microservice Python (à valider en local)

---

## Permissions RBAC (alignement backend ↔ frontend)

| Action | Backend | Frontend |
|--------|---------|----------|
| Lire health / forecast / anomalies | `view_ai` | `VIEW_AI` |
| Lancer IF + LSTM manuellement | `run_ia` | `RUN_IA` |
| Ré-entraîner modèles | — (script / notebook) | `RETRAIN_MODEL` (bouton placeholder) |

**Rôles `view_ai` :** HEAD_SUPERVISOR, SITE_SUPERVISOR, AUDITOR, OPERATOR  
**Rôles `run_ia` :** SUPER_ADMIN, HEAD_SUPERVISOR

---

*Dernière mise à jour : 25/05/2026*
