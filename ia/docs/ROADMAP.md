# Feuille de route IA — EmissionsIQ

> Synthèse opérationnelle. Détail complet : [`DOCUMENTATION_IA_COMPLETE.md`](../DOCUMENTATION_IA_COMPLETE.md) § 9.4.

## État actuel (v1.2)

- IA **zone-level** (IF + LSTM 4 h)
- Intégration backend / frontend / scheduler H:05
- Modèles entraînés sur dataset industriel tunisien (+6,65 % skill LSTM)
- Démo fonctionnelle avec simulateur MQTT

## Phases

| Phase | Horizon | Objectif |
|-------|---------|----------|
| **A** | 1–2 sem | Démo stable (sim 48 h, E2E, rapport PFE) |
| **B** | 2–4 sem | Qualité IA (seuil IF, données 30 j, réentraînement hybride) |
| **C** | 1–2 mois | UX opérateur, alertes, tests auto |
| **D** | post-PFE | LSTM 24 h, modèles dédiés, drift |
| **E** | prod | Docker, CI, capteurs réels |

## Actions immédiates

1. Simulateur **48 h** sur zones équipées  
2. Test E2E (Mongo + backend + FastAPI + frontend)  
3. `python scripts/evaluate_models.py` après chaque changement modèle  
4. Rédiger chapitre IA du rapport (§ 7.5 + § 9.4)

## Scripts de suivi

```bash
cd ia && python scripts/evaluate_models.py
cd backend && node scripts/analyze-ia-vs-simulator.js
```
