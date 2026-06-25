# Diagrammes flux metier (compatibles draw.io)

Ce dossier contient des diagrammes Mermaid centres sur le flux qui vous interesse :
- donnees capteurs jusqu'a affichage
- comparaison aux normes
- predictions IA
- calcul et affichage KPI

Fichiers :
- `01-end-to-end-dataflow.mmd`
- `02-sequence-capteur-affichage-normes.mmd`
- `03-sequence-prediction-ia.mmd`
- `04-sequence-kpi.mmd`
- `05-activity-pipeline-global.mmd`

Import dans draw.io :
1. Ouvrir draw.io
2. Inserer > Avance > Mermaid
3. Coller le contenu d'un fichier `.mmd`
4. Valider puis ajuster la mise en page

Notes de modele :
- Les limites de reference proviennent de `Polluant.regulatoryLimit` et `Polluant.warningThreshold`.
- Les KPIs sont calcules via `KPIService` a partir des readings valides.
- Les predictions IA sont produites par `AIService` (LSTM + anomaly detection) et exposees via `/api/ia/*`.