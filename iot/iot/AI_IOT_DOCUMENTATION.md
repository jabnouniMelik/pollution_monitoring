# Documentation IoT pour generation de rapport IA

## Objectif

Ce document sert de base de connaissance pour un autre modele IA charge de rediger un rapport de projet sur la station IoT de surveillance de pollution.

Source de verite : le firmware ESP32 dans `src/main.cpp`, `src/sensors.cpp` et les fichiers d'interface `include/config.h`, `include/pins.h`, `include/sensors.h`.

Regle d'utilisation pour le modele de redaction :
- n'inventer ni capteur, ni bus, ni topic, ni champ JSON absent du code;
- distinguer ce qui est observe dans le firmware et ce qui reste une hypothese d'integration;
- citer les limitations techniques quand elles existent;
- conserver le vocabulaire du projet quand il est explicite dans le code.

## Vue d'ensemble du systeme

Le projet IoT est une station ESP32 qui mesure plusieurs indicateurs de qualite de l'air et du contexte environnemental, puis publie les donnees via MQTT vers le backend Node.js.

Chaine fonctionnelle principale :

ESP32 -> capteurs -> acquisition locale -> JSON -> MQTT -> backend Node.js -> stockage MongoDB -> alertes / IA

Le firmware est concu pour fonctionner de maniere non bloquante : chaque famille de capteurs est relue selon un intervalle propre, et les resultats sont envoyes sur le broker MQTT sous forme de messages JSON.

## Objectifs techniques du firmware

- Initialiser les interfaces capteurs au demarrage.
- Se connecter au WiFi en mode station.
- Se connecter au broker MQTT Mosquitto.
- Publier les mesures sur des topics du type `emissions/<zone>/<sensorType>`.
- Fournir des niveaux indicatifs `normal`, `warning`, `high`, `critical` calcules localement pour le debug et l'affichage.
- Garder la compatibilite de format avec le simulateur de donnees du projet.

## Architecture logicielle

### Fichiers principaux

- `src/main.cpp` : orchestration generale, WiFi, MQTT, temporisation, construction JSON.
- `src/sensors.cpp` : acquisition bas niveau des capteurs, conversion des valeurs et validation.
- `include/config.h` : configuration logique du noud, WiFi, MQTT, intervalles et seuils.
- `include/pins.h` : affectation GPIO et details de cablage.
- `include/sensors.h` : structures de retour et prototypes.

### Separation des responsabilites

- `sensors.cpp` lit les capteurs et renvoie des structures typees avec un indicateur `valid`.
- `main.cpp` transforme ces lectures en messages MQTT et gere le cycle d'envoi.
- Le backend reste responsable de la validation metier finale, du stockage et des alertes officielles.

## Materiel embarque

### Carte de calcul

- ESP32 DevKit V1 (module WROOM-32) — WiFi 802.11 b/g/n integre, dual-core 240 MHz, 520 KB SRAM.

### Capteurs retenus

- MH-Z19B : CO2 en ppm, liaison UART, technologie NDIR.
- SDS011 : PM2.5 et PM10 en ug/m3, liaison UART, diffusion laser.
- ME4-SO2 : SO2 electrochimique, sortie courant uA via TIA vers ADC GPIO33.
- ME4-NO2 : NO2 electrochimique, sortie courant uA via TIA vers ADC GPIO34.
- SGP30 : COV / TVOC en ppb, liaison I2C (adresse 0x58).
- DHT22 : temperature et humidite relative, protocole 1-wire GPIO4.

Note : les capteurs ME4 (SO2, NO2) necessitent un amplificateur de transimpedance
(op-amp LMV358 ou MCP6002, Rf = 100 kOhm) pour convertir leur sortie courant
en tension lisible par l'ADC ESP32.

### Alimentation et contraintes hardware

- Alimentation principale : bloc secteur 5 V / 3 A (USB / Jack DC).
- Protection : fusible 1 A + diode 1N4007 (anti-inversion de polarite).
- Conversion interne : regulateur buck LM2596 pour produire le 3,3 V.
- Distribution : MH-Z19B et SDS011 sur bus 5 V ; ME4, SGP30, DHT22 et ESP32 (VIN) sur bus 5 V ou 3,3 V selon le composant.
- Les signaux UART des capteurs 5 V (MH-Z19B, SDS011) passent par un convertisseur de niveau bidirectionnel.
- Les entrees ADC de l'ESP32 restent limitees a 3,3 V maximum.

## Affectation des broches

### I2C

- SDA : GPIO 21
- SCL : GPIO 22
- Utilisation : SGP30 (adresse 0x58) + afficheur OLED SSD1306 (optionnel)
- Resistances de tirage : 2 x 4,7 kOhm entre SDA/SCL et 3,3 V

### DHT22

- GPIO 4, pull-up 10 kOhm

### UART MH-Z19B (Serial2)

- RX ESP32 : GPIO 16
- TX ESP32 : GPIO 17
- Vitesse : 9600 bauds, 8N1

### UART SDS011 (Serial1)

- RX ESP32 : GPIO 18
- TX ESP32 : GPIO 19
- Vitesse : 9600 bauds
- Mode d'acquisition : query mode (commande -> reponse 10 octets)

### ADC ME4 (via TIA)

- ME4-SO2 Vout TIA : GPIO 33 (ADC1 CH5)
- ME4-NO2 Vout TIA : GPIO 34 (ADC1 CH6, input-only)
- ADC1 exclusivement (ADC2 incompatible WiFi actif)

## Configuration logique

### Identification du noud

- `NODE_NAME` : `Station-Sfax-01`
- `NODE_ZONE` : `Zone-A`

Ces valeurs servent a construire les topics MQTT et a identifier la station dans le backend.

### WiFi et MQTT

- SSID et mot de passe WiFi definis dans `secrets.h` si le fichier existe.
- Broker MQTT par defaut : `192.168.1.100`
- Port MQTT : `1883`
- Client ID : `pollution-esp32-01`
- Buffer MQTT : 512 octets (setBufferSize)

### Calibration ME4

- `ME4_RF_KOHM` : 100 kOhm (resistance de feedback TIA)
- `ME4_SO2_SENSITIVITY` : 0.8 uA/ppm (datasheet Winsen, valeur typique)
- `ME4_NO2_SENSITIVITY` : 1.2 uA/ppm (datasheet Winsen, valeur typique)
- `ME4_SO2_PPM_TO_MG_NM3` : 2.86 (facteur molaire SO2, conditions normales)
- `ME4_NO2_PPM_TO_MG_NM3` : 2.05 (facteur molaire NO2, conditions normales)

## Frequences de publication

Les intervalles sont en millisecondes et la boucle principale les verifie avec `millis()`.

- CO2 (MH-Z19B) : 10000 ms
- PM2.5 / PM10 (SDS011) : 15000 ms
- SO2 + NO2 (ME4) + COV (SGP30) : 30000 ms
- Temperature / humidite (DHT22) : 10000 ms

Ces rythmes sont coherents avec le simulateur du projet et adaptes aux caracteristiques physiques de chaque capteur.

## Format des messages MQTT

### Topic

Le topic suit la structure :

`emissions/<NODE_ZONE>/<sensorType>`

Exemples :
- `emissions/Zone-A/CO2`
- `emissions/Zone-A/SO2`
- `emissions/Zone-A/NOX`
- `emissions/Zone-A/PM25`
- `emissions/Zone-A/PM10`
- `emissions/Zone-A/COV`
- `emissions/Zone-A/TEMPERATURE`
- `emissions/Zone-A/HUMIDITY`

### Structure JSON

Chaque message publie contient les champs suivants :

- `sensorType` : type de mesure publiee.
- `model` : reference materielle du capteur.
- `zone` : zone logique de la station.
- `nodeName` : nom du noud.
- `value` : valeur traitee principale (en mg/Nm3 pour SO2/NO2/COV, ppm pour CO2, ug/m3 pour PM).
- `rawValue` : valeur brute (tension TIA en V pour ME4, ppb pour SGP30, identique sinon).
- `unit` : unite physique.
- `level` : `normal`, `warning`, `high` ou `critical`.
- `timestamp` : horodatage ISO 8601 UTC (NTP).
- `isValid` : booleen de validite de la lecture.
- `rssi` : puissance du signal WiFi en dBm.
- `battery` : `null` (station sur secteur).

### Exemple de message CO2

```json
{
  "sensorType": "CO2",
  "model": "MH-Z19B",
  "zone": "Zone-A",
  "nodeName": "Station-Sfax-01",
  "value": 650,
  "rawValue": 650,
  "unit": "ppm",
  "level": "warning",
  "timestamp": "2026-06-03T12:00:00Z",
  "isValid": true,
  "rssi": -58,
  "battery": null
}
```

### Exemple de message SO2

```json
{
  "sensorType": "SO2",
  "model": "ME4-SO2",
  "zone": "Zone-A",
  "nodeName": "Station-Sfax-01",
  "value": 12.01,
  "rawValue": 0.336,
  "unit": "mg/Nm³",
  "level": "normal",
  "timestamp": "2026-06-03T12:00:30Z",
  "isValid": true,
  "rssi": -58,
  "battery": null
}
```

`value` = tension TIA convertie en ppm puis en mg/Nm3 (x2.86).
`rawValue` = tension TIA en volts (diagnostic circuit ME4).

## Mappage des capteurs et des mesures

### CO2

- Capteur : MH-Z19B (NDIR)
- Unite : ppm
- Fonction de lecture : `readCo2()`
- Publication : `CO2`
- Plage : 0-5000 ppm

### Particules fines

- Capteur : SDS011 (diffusion laser)
- Unite : ug/m3
- Fonction de lecture : `readParticulates()`
- Publication : `PM25` et `PM10`
- Un seul cycle de lecture produit deux messages MQTT
- Plage : 0-999.9 ug/m3

### SO2

- Capteur : ME4-SO2 (electrochimique)
- Unite publication : mg/Nm3 (apres conversion firmware)
- Fonction de lecture : `readSo2()`
- Publication : `SO2`
- Plage nominale : 0-20 ppm (max detectable 200 ppm)
- Conversion : ppm x 2.86 = mg/Nm3

### NO2

- Capteur : ME4-NO2 (electrochimique)
- Unite publication : mg/Nm3 (apres conversion firmware)
- Fonction de lecture : `readNo2()`
- Publication : `NOX`
- Plage nominale : 0-20 ppm (max detectable 150 ppm)
- Conversion : ppm x 2.05 = mg/Nm3
- Limitation : plage inferieure a la VLE reglementaire (500 mg/Nm3 = 244 ppm).
  Ce capteur est adapte a la surveillance perimetrique ambiante.

### COV

- Capteur : SGP30 (I2C, MOX)
- Unite publication : mg/Nm3 (approximation)
- Fonction de lecture : `readCov()`
- Publication : `COV`
- Sortie native : TVOC en ppb
- Conversion approximative : ppb x 0.0045 = mg/Nm3

### Environnement local

- Capteur : DHT22
- Unite temperature : degC
- Unite humidite : %RH
- Fonction de lecture : `readEnvironment()`
- Publication : `TEMPERATURE` et `HUMIDITY`

## Logique de calcul locale

### Calcul des niveaux

Le firmware calcule un niveau indicatif a partir de seuils fixes (ThresholdBand) alignes sur
le Décret 2018-928, Annexe 1 (valeurs generales — toutes sources fixes industrielles) :

- SO2  : warning 240 / high 300 / critical 360 mg/Nm3  (VLE = 300)
- NOX  : warning 400 / high 500 / critical 600 mg/Nm3  (VLE = 500)
- COV  : warning 88  / high 110 / critical 132 mg/Nm3  (VLE = 110)
- CO2  : warning 640 / high 800 / critical 960 ppm     (seuil interne)
- PM25 : seuils OMS air ambiant (sensor perimetrique)

Ordre de severite : `normal` -> `warning` -> `high` -> `critical`.

Ces seuils sont utilises pour le champ `level` dans le JSON. Le backend conserve
la responsabilite de l'evaluation metier et des alertes officielles.

### Conversion ME4 tension → ppm

Les capteurs ME4 utilisent :
- lecture ADC moyennee sur 16 echantillons espacés de 5 ms;
- calcul courant : I_uA = Vout / (Rf_kOhm x 1000) x 1e6;
- concentration : ppm = I_uA / sensitivity;
- conversion unitaire : mg/Nm3 = ppm x facteur_molaire.

### SGP30

- Le SGP30 fournit du TVOC en ppb.
- Le firmware applique une conversion approximative vers mg/Nm3 (x0.0045).
- Cette conversion ne doit pas etre presentee comme une mesure reglementaire certifiee.

## Validation et robustesse

### Validite des lectures

Chaque structure de retour contient un flag `valid`.

Une lecture peut etre marquee invalide si :
- tension TIA < 0.05 V (ME4 deconnecte ou court-circuit) ;
- tension TIA > 3.20 V (saturation TIA) ;
- retour CO2 = 0 (erreur UART ou capteur non pret) ;
- la trame SDS011 est incorrecte (result.isOk() = false) ;
- le DHT22 renvoie NaN ;
- l'initialisation SGP30 echoue (sgp30.begin() = false).

### Reconnexion reseau

Le firmware tente de reconnecter :
- le WiFi si la connexion tombe ;
- le broker MQTT si la session est perdue (delai 3 s entre tentatives).

### Tolerance d'execution

La boucle principale reste non bloquante et laisse du temps au watchdog et au stack WiFi via un court delai final (delay(50)).

## Integration backend

Le backend Node.js attend des messages MQTT compatibles avec le simulateur et avec le service d'ingestion.

Points importants pour le rapport :
- le format JSON permet la resolution du capteur par `sensorType` et `model` ;
- les topics sont structures pour isoler les zones ;
- l'architecture prend en charge l'ingestion, la persistence MongoDB et les alertes ;
- la couche IA s'appuie sur les readings deja normalises par le backend.

## Limites techniques a mentionner dans le rapport

- Le ME4-NO2 couvre 0-41 mg/Nm3 alors que la VLE est 500 mg/Nm3 — adapte a la surveillance perimetrique ambiante uniquement.
- Le SGP30 plafonne a ~60 mg/Nm3 equiv. (VLE = 110 mg/Nm3) — mesure indicative, non certifiable sans calibration labo.
- Le SDS011 mesure en ug/m3 (max ~999) alors que la VLE industrielle est 40 mg/m3 = 40 000 ug/m3 — adapte a la surveillance perimetrique.
- Le MQTT est non-TLS en environnement de developpement.
- Le timestamp depend d'une synchronisation NTP reussie.
- Une calibration terrain avec gaz etalon est recommandee pour les ME4 apres installation.

## Points forts du systeme

- Architecture modulaire avec separation claire acquisition / transport / traitement.
- Capteurs ME4 electrochimiques calibres d'usine (vs MQ a oxyde metallique).
- Acquisition multi-capteurs heterogene (UART, I2C, ADC via TIA, 1-wire).
- Publication normalisee par MQTT avec conversion d'unites dans le firmware.
- Compatibilite avec le backend temps reel et les modeles IA.
- Seuils indicatifs alignes sur le Décret 2018-928, Annexe 1.

## Structure de rapport suggeree pour un autre modele IA

Le rapport final peut suivre cette logique :

1. Contexte du projet et problemes de pollution surveilles.
2. Architecture globale IoT -> MQTT -> backend -> IA.
3. Description materielle de la station ESP32.
4. Details des capteurs et justifications de choix.
5. Protocole de communication et schema des donnees.
6. Strategie de calcul local, seuils et niveaux d'alerte.
7. Contraintes d'alimentation, cablage et fiabilite.
8. Limites, calibrations et perspectives d'amelioration.
9. Integration avec la chaine logicielle du projet.

## Resume court pour generation automatique

Station ESP32 de surveillance de pollution avec capteurs MH-Z19B (CO2, NDIR), ME4-SO2 (SO2 electrochimique, TIA), ME4-NO2 (NO2 electrochimique, TIA), SGP30 (COV/TVOC, I2C), SDS011 (PM2.5/PM10, laser) et DHT22 (temperature/humidite). Le firmware publie des messages JSON via MQTT QoS1 sur des topics `emissions/<zone>/<sensorType>`. Les valeurs SO2 et NO2 sont converties de ppm en mg/Nm3 avant publication pour coherence avec les seuils reglementaires (Décret 2018-928, Annexe 1). Le backend Node.js consomme ces messages pour stockage MongoDB, alertes et traitement IA.
