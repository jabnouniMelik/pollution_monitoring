/**
 * @file secrets.example.h
 * @brief Modèle de configuration réseau — à copier vers include/secrets.h
 *
 * Installation :
 *   1. Copier ce fichier :  include/secrets.h
 *   2. Remplir SSID, mot de passe WiFi et IP du broker MQTT
 *   3. Ne jamais committer secrets.h (déjà dans .gitignore)
 *
 * Hardware réseau :
 *   - L'ESP32 et le PC/serveur MQTT doivent être sur le même réseau local.
 *   - Mosquitto en dev : souvent mqtt://<IP_du_PC>:1883
 *   - En production : broker dédié, éventuellement TLS (non géré dans ce firmware).
 */

#pragma once

#define WIFI_SSID "votre_reseau"
#define WIFI_PASSWORD "votre_mot_de_passe"
#define MQTT_BROKER "192.168.1.100"  // IP de la machine qui exécute Mosquitto
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "pollution-esp32-01"
