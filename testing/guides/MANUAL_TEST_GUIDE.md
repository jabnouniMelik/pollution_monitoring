# Guide manuel pour lancer les tests

Ce fichier explique comment lancer les tests du projet toi-même, depuis le terminal ou le navigateur.

## 1. Pré-requis

Avant de commencer, assure-toi que ces services sont disponibles :

- MongoDB sur `localhost:27017`
- Mosquitto / MQTT sur `localhost:1883`
- Node.js installé
- Dépendances installées dans `backend/`, `frontend/` et `iot/`

Si ce n’est pas déjà fait :

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\backend
npm install

cd ..\frontend
npm install

cd ..\iot
npm install
```

## 2. Initialiser les données

Pour avoir un environnement de test complet, lance d’abord les scripts de seed :

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\backend
npm run init
```

Ce script prépare les utilisateurs, les polluants, les seuils et les données nécessaires aux tests.

## 3. Lancer les services

Ouvre 3 terminaux séparés.

### Terminal 1 — Backend

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\backend
npm start
```

Le backend doit répondre sur `http://localhost:5000`.

### Terminal 2 — Frontend

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\frontend
npm run dev
```

Le frontend doit répondre sur `http://localhost:3000`.

### Terminal 3 — Simulateur IoT

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\iot
npm start
```

Pour générer plus vite des alertes, utilise plutôt :

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\testing\scripts
node 02-multi-simulator.js critical
```

Tu peux aussi tester les autres modes : `normal`, `warning`, `random`.

## 4. Lancer les tests automatiques

### Backend

Depuis `backend/` :

```powershell
npm test
npm run test:services
npm run test:errors
npm run test:complete
npm run test:all
```

### IoT

Depuis `iot/` :

```powershell
npm test
npm run test:frequency
```

### Frontend

Depuis `frontend/` :

```powershell
npm run test
npm run typecheck
npm run lint
npm run test:e2e
```

## 5. Tester manuellement dans le navigateur

1. Ouvre `http://localhost:3000`
2. Connecte-toi avec : `admin@example.com` / `admin123`
3. Vérifie :
   - les courbes de l’overview
   - les KPI
   - les alertes
   - la page conformité

Si tu veux forcer des alertes, lance le simulateur en mode `critical` puis recharge la page.

## 6. Vérifications rapides

Si quelque chose ne marche pas, commence par ces contrôles :

```powershell
netstat -ano | Select-String ":27017|:1883|:5000|:3000"
```

Tu dois voir :

- `27017` pour MongoDB
- `1883` pour MQTT
- `5000` pour le backend
- `3000` pour le frontend

## 7. Ordre recommandé

Quand tu veux tout tester proprement, fais cet ordre :

1. `npm run init` dans `backend/`
2. `npm start` dans `backend/`
3. `npm run dev` dans `frontend/`
4. `npm start` dans `iot/`
5. `npm run test:all` dans `backend/`
6. Vérification visuelle dans le navigateur

## 8. Si tu veux juste un test rapide

```powershell
cd c:\Users\melik\Desktop\pollution_monitoring\backend
npm run check
```

Puis ouvre le frontend et vérifie que les KPI et les lectures se chargent.
