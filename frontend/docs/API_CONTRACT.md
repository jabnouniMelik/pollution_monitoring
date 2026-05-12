# Contrat API — backend ↔ frontend

> Aligné sur `backend/routes/*.js` et `backend/server.js` (avril 2026).  
> Chemins canoniques : `src/lib/api/endpoints.ts`.

## Résumé des écarts corrigés côté frontend

| Sujet | Avant | Après |
|--------|--------|--------|
| Dernières mesures | `GET /api/readings` avec `limit` | `GET /api/readings/latest` + `nodeId` (alias `sensorId`) |
| Seuils par site | `GET /api/thresholds/site/:id` | N’existe pas — `GET /api/thresholds` (config active) |
| Export rapport | `GET /api/reports/:id/export` | N’existe pas — `reportApi.export` utilise `fileUrl` du rapport |
| Historique KPI | `unwrap` comme `KPIHistory` | Réponse réelle `{ data: AggregateData[] }` → mapping `avgValue` / `periodStart` |
| Zones opérateur | `/zones/:id/operator` | Backend : `POST/DELETE .../operators` — voir `endpoints.zones` |

## Montages Express (`server.js`)

| Préfixe | Fichier routes |
|---------|----------------|
| `/api/auth` | `authRoutes.js` |
| `/api/users` | `userManagementRoutes.js` |
| `/api/sites` | `siteManagementRoutes.js` |
| `/api/zones` | `zoneManagementRoutes.js` |
| `/api/industries` | `industrieRoutes.js` |
| `/api/sensor-nodes` | `sensorNodeRoutes.js` |
| `/api/polluants` | `polluantRoutes.js` |
| `/api/sensors` | `sensorRoutes.js` |
| `/api/readings` | `readingRoutes.js` |
| `/api/alerts` | `alertRoutes.js` |
| `/api/reports` | `reportRoutes.js` |
| `/api/kpi` | `kpiRoutes.js` |
| `/api/thresholds` | `thresholdConfigManagementRoutes.js` |
| `/api/site-config` | `siteConfigManagementRoutes.js` |
| `/api/ws/stats` | inline dans `server.js` |

## Endpoints non exposés (ou à ajouter côté backend)

- `GET /api/reports/:id/export` — **non implémenté** ; téléchargement via URL stockée ou génération client.
- `GET /api/thresholds/site/:siteId` — **non implémenté** ; une seule config active via `GET /api/thresholds`.

## Notes backend connues

- **KPI `POST /aggregate` et PUT `/config/*`** : `checkRole(["admin"])` dans `kpiRoutes.js` — les rôles réels sont `SUPER_ADMIN`, etc. À harmoniser côté serveur si les PUT retournent 403.
- **`GET /api/users/role/:role`** : en Express, l’ordre des routes peut faire matcher `/:id` avant `/role/:role` selon l’ordre d’enregistrement — à vérifier côté backend.

## React Query

- Historique lectures : clé `queryKeys.readings.list` (anciennement `history`) — `GET /api/readings`.
