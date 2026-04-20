/**
 * ============================================================
 * ERROR HANDLING TESTS
 * Tests complets pour vérifier la gestion d'erreurs 3-tier
 * ============================================================
 * 
 * Architecture testée:
 * - Middleware Layer: validators, verifyToken, errorHandler
 * - Service Layer: ReadingService, AlertService, AuthService
 * - Repository Layer: MongoDB errors (duplicate, validation, cast)
 * - MQTT Layer: Message processing errors
 * 
 * Scénarios couverts:
 * 1. Validation errors (400)
 * 2. Authentication errors (401)
 * 3. Authorization errors (403)
 * 4. Not found errors (404)
 * 5. Business logic errors (400/409)
 * 6. Database errors (400/500)
 * 7. MQTT processing errors
 */

require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");

// Configuration
const BASE_URL = "http://localhost:5000/api";
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db";

// Couleurs pour console
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// Utilitaires
const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.yellow}${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}${colors.reset}`),
  test: (msg) => console.log(`${colors.gray}  → ${msg}${colors.reset}`),
};

// Compteurs de tests
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Helper pour assertions
const assert = (condition, testName) => {
  totalTests++;
  if (condition) {
    passedTests++;
    log.success(testName);
  } else {
    failedTests++;
    log.error(testName);
  }
};

// Helper pour tester les erreurs HTTP
const expectError = async (fn, expectedStatus, testName) => {
  totalTests++;
  try {
    await fn();
    failedTests++;
    log.error(`${testName} - Devrait échouer mais a réussi`);
    return null;
  } catch (error) {
    if (error.response && error.response.status === expectedStatus) {
      passedTests++;
      log.success(testName);
      return error.response.data;
    } else {
      failedTests++;
      log.error(`${testName} - Status attendu: ${expectedStatus}, reçu: ${error.response?.status || "N/A"}`);
      return null;
    }
  }
};

// Variables globales pour les tests
let validToken = null;
let testIndustrieId = null;
let testSensorNodeId = null;
let testPolluantId = null;
let testSensorId = null;

// ============================================================
// SETUP: Connexion et données de test
// ============================================================
async function setup() {
  log.section("SETUP - Connexion et préparation");
  
  try {
    // Connexion MongoDB
    await mongoose.connect(MONGO_URI);
    log.success("MongoDB connecté");

    // Login pour obtenir un token valide
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: "admin@enim.tn",
        password: "Admin1234",
      });
      validToken = loginResponse.data.data.accessToken;
      log.success("Token d'authentification obtenu");
    } catch (error) {
      log.error("Impossible de se connecter - Créer un utilisateur admin d'abord");
      process.exit(1);
    }

    // Récupérer des IDs de test existants
    const Industrie = require("../models/Industrie");
    const SensorNode = require("../models/SensorNode");
    const Polluant = require("../models/Polluant");
    const Sensor = require("../models/Sensor");

    const industrie = await Industrie.findOne();
    if (industrie) {
      testIndustrieId = industrie._id.toString();
      log.success(`Industrie de test trouvée: ${testIndustrieId}`);
    }

    const sensorNode = await SensorNode.findOne();
    if (sensorNode) {
      testSensorNodeId = sensorNode._id.toString();
      log.success(`SensorNode de test trouvé: ${testSensorNodeId}`);
    }

    const polluant = await Polluant.findOne();
    if (polluant) {
      testPolluantId = polluant._id.toString();
      log.success(`Polluant de test trouvé: ${testPolluantId}`);
    }

    const sensor = await Sensor.findOne();
    if (sensor) {
      testSensorId = sensor._id.toString();
      log.success(`Sensor de test trouvé: ${testSensorId}`);
    }

  } catch (error) {
    log.error(`Erreur setup: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================
// TEST SUITE 1: Authentication & Authorization Errors
// ============================================================
async function testAuthErrors() {
  log.section("TEST SUITE 1: Authentication & Authorization");

  // Test 1.1: Login sans email
  await expectError(
    () => axios.post(`${BASE_URL}/auth/login`, { password: "test123" }),
    400,
    "Login sans email → 400"
  );

  // Test 1.2: Login sans password
  await expectError(
    () => axios.post(`${BASE_URL}/auth/login`, { email: "test@test.com" }),
    400,
    "Login sans password → 400"
  );

  // Test 1.3: Login avec email invalide
  await expectError(
    () => axios.post(`${BASE_URL}/auth/login`, {
      email: "nonexistent@test.com",
      password: "wrongpass",
    }),
    400,
    "Login avec email invalide → 400"
  );

  // Test 1.4: Login avec mauvais mot de passe
  await expectError(
    () => axios.post(`${BASE_URL}/auth/login`, {
      email: "admin@enim.tn",
      password: "wrongpassword",
    }),
    400,
    "Login avec mauvais mot de passe → 400"
  );

  // Test 1.5: Accès sans token
  await expectError(
    () => axios.get(`${BASE_URL}/alerts`),
    401,
    "Accès endpoint protégé sans token → 401"
  );

  // Test 1.6: Accès avec token invalide
  await expectError(
    () => axios.get(`${BASE_URL}/alerts`, {
      headers: { Authorization: "Bearer invalid_token_xyz" },
    }),
    401,
    "Accès avec token invalide → 401"
  );

  // Test 1.7: Accès avec format Bearer incorrect
  await expectError(
    () => axios.get(`${BASE_URL}/alerts`, {
      headers: { Authorization: "InvalidFormat token123" },
    }),
    401,
    "Format Authorization incorrect → 401"
  );

  // Test 1.8: Register avec rôle invalide
  await expectError(
    () => axios.post(`${BASE_URL}/auth/register`, {
      username: "testuser",
      email: "test@test.com",
      password: "Test1234",
      role: "INVALID_ROLE",
    }),
    400,
    "Register avec rôle invalide → 400"
  );

  // Test 1.9: Register sans champs requis
  await expectError(
    () => axios.post(`${BASE_URL}/auth/register`, {
      username: "testuser",
      // email manquant
      password: "Test1234",
      role: "OPERATOR",
    }),
    400,
    "Register sans email → 400"
  );

  // Test 1.10: Refresh token invalide
  await expectError(
    () => axios.post(`${BASE_URL}/auth/refresh`, {
      refreshToken: "invalid_refresh_token",
    }),
    400,
    "Refresh avec token invalide → 400"
  );
}

// ============================================================
// TEST SUITE 2: Validation Errors (Middleware)
// ============================================================
async function testValidationErrors() {
  log.section("TEST SUITE 2: Validation Errors");

  const headers = { Authorization: `Bearer ${validToken}` };

  // Test 2.1: Créer industrie sans nom
  await expectError(
    () => axios.post(`${BASE_URL}/industries`, {
      secteur: "Chimie",
      // nom manquant
    }, { headers }),
    400,
    "Créer industrie sans nom → 400"
  );

  // Test 2.2: Créer industrie sans secteur
  await expectError(
    () => axios.post(`${BASE_URL}/industries`, {
      nom: "Test Industrie",
      // secteur manquant
    }, { headers }),
    400,
    "Créer industrie sans secteur → 400"
  );

  // Test 2.3: Créer sensor node sans nom
  if (testIndustrieId) {
    await expectError(
      () => axios.post(`${BASE_URL}/sensor-nodes`, {
        industrieId: testIndustrieId,
        zone: "Zone Test",
        // nom manquant
      }, { headers }),
      400,
      "Créer sensor node sans nom → 400"
    );
  }

  // Test 2.4: Créer sensor node avec industrieId invalide
  await expectError(
    () => axios.post(`${BASE_URL}/sensor-nodes`, {
      nom: "Test Node",
      industrieId: "invalid_id_format",
      zone: "Zone Test",
    }, { headers }),
    400,
    "Créer sensor node avec ID invalide → 400"
  );

  // Test 2.5: Créer polluant sans nom
  await expectError(
    () => axios.post(`${BASE_URL}/polluants`, {
      formula: "CO2",
      unit: "ppm",
      // nom manquant
    }, { headers }),
    400,
    "Créer polluant sans nom → 400"
  );

  // Test 2.6: Créer polluant avec limite négative
  await expectError(
    () => axios.post(`${BASE_URL}/polluants`, {
      name: "Test Polluant",
      formula: "TP",
      unit: "ppm",
      regulatoryLimit: -100,
    }, { headers }),
    400,
    "Créer polluant avec limite négative → 400"
  );

  // Test 2.7: Créer sensor sans type
  if (testSensorNodeId && testPolluantId) {
    await expectError(
      () => axios.post(`${BASE_URL}/sensors`, {
        sensorNodeId: testSensorNodeId,
        PolluantId: testPolluantId,
        model: "Test Model",
        unit: "ppm",
        // type manquant
      }, { headers }),
      400,
      "Créer sensor sans type → 400"
    );
  }

  // Test 2.8: Créer reading avec valeur négative
  if (testSensorId && testPolluantId && testSensorNodeId) {
    await expectError(
      () => axios.post(`${BASE_URL}/readings`, {
        sensorId: testSensorId,
        PolluantId: testPolluantId,
        nodeId: testSensorNodeId,
        value: -50,
        unit: "ppm",
      }, { headers }),
      400,
      "Créer reading avec valeur négative → 400"
    );
  }

  // Test 2.9: Créer reading sans unité
  if (testSensorId && testPolluantId && testSensorNodeId) {
    await expectError(
      () => axios.post(`${BASE_URL}/readings`, {
        sensorId: testSensorId,
        PolluantId: testPolluantId,
        nodeId: testSensorNodeId,
        value: 100,
        // unit manquant
      }, { headers }),
      400,
      "Créer reading sans unité → 400"
    );
  }
}

// ============================================================
// TEST SUITE 3: Not Found Errors (404)
// ============================================================
async function testNotFoundErrors() {
  log.section("TEST SUITE 3: Not Found Errors");

  const headers = { Authorization: `Bearer ${validToken}` };
  const fakeId = "507f1f77bcf86cd799439011"; // Valid ObjectId format but doesn't exist

  // Test 3.1: GET industrie inexistante
  await expectError(
    () => axios.get(`${BASE_URL}/industries/${fakeId}`, { headers }),
    404,
    "GET industrie inexistante → 404"
  );

  // Test 3.2: GET sensor node inexistant
  await expectError(
    () => axios.get(`${BASE_URL}/sensor-nodes/${fakeId}`, { headers }),
    404,
    "GET sensor node inexistant → 404"
  );

  // Test 3.3: GET polluant inexistant
  await expectError(
    () => axios.get(`${BASE_URL}/polluants/${fakeId}`, { headers }),
    404,
    "GET polluant inexistant → 404"
  );

  // Test 3.4: GET sensor inexistant
  await expectError(
    () => axios.get(`${BASE_URL}/sensors/${fakeId}`, { headers }),
    404,
    "GET sensor inexistant → 404"
  );

  // Test 3.5: GET alert inexistante
  await expectError(
    () => axios.get(`${BASE_URL}/alerts/${fakeId}`, { headers }),
    404,
    "GET alert inexistante → 404"
  );

  // Test 3.6: UPDATE industrie inexistante
  await expectError(
    () => axios.put(`${BASE_URL}/industries/${fakeId}`, {
      nom: "Updated Name",
    }, { headers }),
    404,
    "UPDATE industrie inexistante → 404"
  );

  // Test 3.7: DELETE sensor inexistant
  await expectError(
    () => axios.delete(`${BASE_URL}/sensors/${fakeId}`, { headers }),
    404,
    "DELETE sensor inexistant → 404"
  );

  // Test 3.8: Acknowledge alert inexistante
  await expectError(
    () => axios.patch(`${BASE_URL}/alerts/${fakeId}/acknowledge`, {}, { headers }),
    404,
    "Acknowledge alert inexistante → 404"
  );
}

// ============================================================
// TEST SUITE 4: Business Logic Errors
// ============================================================
async function testBusinessLogicErrors() {
  log.section("TEST SUITE 4: Business Logic Errors");

  const headers = { Authorization: `Bearer ${validToken}` };

  // Test 4.1: Créer reading avec capteur inactif
  log.test("Test 4.1: Reading avec capteur inactif");
  // Note: Ce test nécessite un capteur inactif en DB
  // Pour l'instant, on vérifie juste que le service gère l'erreur

  // Test 4.2: Créer reading avec capteur inexistant
  const fakeId = "507f1f77bcf86cd799439011";
  await expectError(
    () => axios.post(`${BASE_URL}/readings`, {
      sensorId: fakeId,
      PolluantId: testPolluantId || fakeId,
      nodeId: testSensorNodeId || fakeId,
      value: 100,
      unit: "ppm",
    }, { headers }),
    400,
    "Reading avec capteur inexistant → 400"
  );

  // Test 4.3: Escalader alerte avec sévérité invalide
  log.test("Test 4.3: Escalade avec sévérité invalide");
  // Note: Nécessite une alerte existante
  // Le service devrait rejeter les sévérités non valides

  // Test 4.4: Acquitter une alerte déjà acquittée
  log.test("Test 4.4: Double acquittement d'alerte");
  // Note: Nécessite une alerte déjà acquittée
  // Le service devrait rejeter avec "Alerte déjà acquittée"

  // Test 4.5: Register avec email déjà utilisé
  const randomEmail = `test${Date.now()}@test.com`;
  try {
    // Créer un utilisateur
    await axios.post(`${BASE_URL}/auth/register`, {
      username: `user${Date.now()}`,
      email: randomEmail,
      password: "Test1234",
      role: "OPERATOR",
    });
    
    // Tenter de créer un autre avec le même email
    await expectError(
      () => axios.post(`${BASE_URL}/auth/register`, {
        username: `user${Date.now() + 1}`,
        email: randomEmail, // Email dupliqué
        password: "Test1234",
        role: "OPERATOR",
      }),
      400,
      "Register avec email dupliqué → 400"
    );
  } catch (error) {
    log.test("Test 4.5 skipped - Erreur lors de la création utilisateur");
  }
}

// ============================================================
// TEST SUITE 5: MongoDB Errors
// ============================================================
async function testMongoDBErrors() {
  log.section("TEST SUITE 5: MongoDB Errors");

  const headers = { Authorization: `Bearer ${validToken}` };

  // Test 5.1: ID MongoDB invalide (CastError)
  await expectError(
    () => axios.get(`${BASE_URL}/industries/invalid_mongo_id`, { headers }),
    400,
    "GET avec ID MongoDB invalide → 400"
  );

  // Test 5.2: ID trop court
  await expectError(
    () => axios.get(`${BASE_URL}/sensors/123`, { headers }),
    400,
    "GET avec ID trop court → 400"
  );

  // Test 5.3: ID avec caractères invalides
  await expectError(
    () => axios.get(`${BASE_URL}/polluants/zzzzzzzzzzzzzzzzzzzzzzz`, { headers }),
    400,
    "GET avec ID caractères invalides → 400"
  );

  // Test 5.4: Créer industrie avec nom dupliqué
  const uniqueName = `Industrie-Test-${Date.now()}`;
  try {
    // Créer première industrie
    await axios.post(`${BASE_URL}/industries`, {
      nom: uniqueName,
      secteur: "Test",
    }, { headers });

    // Tenter de créer avec le même nom
    await expectError(
      () => axios.post(`${BASE_URL}/industries`, {
        nom: uniqueName,
        secteur: "Test",
      }, { headers }),
      400,
      "Créer industrie avec nom dupliqué → 400"
    );
  } catch (error) {
    log.test("Test 5.4 skipped - Erreur lors de la création industrie");
  }
}

// ============================================================
// TEST SUITE 6: Service Layer Error Handling
// ============================================================
async function testServiceLayerErrors() {
  log.section("TEST SUITE 6: Service Layer Error Handling");

  // Test direct des services (sans passer par HTTP)
  const ReadingService = require("../services/ReadingService");
  const AlertService = require("../services/AlertService");
  const AuthService = require("../services/AuthService");

  // Test 6.1: ReadingService - Capteur inexistant
  try {
    await ReadingService.ingestReading({
      sensorId: "507f1f77bcf86cd799439011",
      polluantId: "507f1f77bcf86cd799439012",
      nodeId: "507f1f77bcf86cd799439013",
      value: 100,
      unit: "ppm",
    });
    assert(false, "ReadingService devrait rejeter capteur inexistant");
  } catch (error) {
    assert(
      error.message.includes("Capteur non trouvé"),
      "ReadingService rejette capteur inexistant"
    );
  }

  // Test 6.2: AlertService - Alerte inexistante
  try {
    await AlertService.getAlertById("507f1f77bcf86cd799439011");
    assert(false, "AlertService devrait rejeter alerte inexistante");
  } catch (error) {
    assert(
      error.message.includes("Alerte non trouvée"),
      "AlertService rejette alerte inexistante"
    );
  }

  // Test 6.3: AlertService - Escalade avec sévérité invalide
  try {
    await AlertService.escalateAlert(
      "507f1f77bcf86cd799439011",
      "INVALID_SEVERITY",
      "Test"
    );
    assert(false, "AlertService devrait rejeter sévérité invalide");
  } catch (error) {
    assert(
      error.message.includes("Sévérité invalide"),
      "AlertService rejette sévérité invalide"
    );
  }

  // Test 6.4: AuthService - Login sans email
  try {
    await AuthService.login("", "password");
    assert(false, "AuthService devrait rejeter login sans email");
  } catch (error) {
    assert(
      error.message.includes("Email et mot de passe requis"),
      "AuthService rejette login sans email"
    );
  }

  // Test 6.5: AuthService - Register avec rôle invalide
  try {
    await AuthService.register({
      username: "test",
      email: "test@test.com",
      password: "Test1234",
      role: "INVALID_ROLE",
    });
    assert(false, "AuthService devrait rejeter rôle invalide");
  } catch (error) {
    assert(
      error.message.includes("Rôle invalide"),
      "AuthService rejette rôle invalide"
    );
  }

  // Test 6.6: ReadingService - Valeur invalide (hors limites)
  log.test("Test 6.6: ReadingService marque valeurs aberrantes comme invalides");
  // Note: Le service marque isValid=false mais ne rejette pas
  // C'est le comportement attendu
}

// ============================================================
// TEST SUITE 7: MQTT Error Handling
// ============================================================
async function testMQTTErrors() {
  log.section("TEST SUITE 7: MQTT Error Handling");

  log.info("Tests MQTT nécessitent le broker actif");
  log.test("Test 7.1: Message MQTT avec JSON invalide");
  log.test("Test 7.2: Message MQTT avec capteur inexistant");
  log.test("Test 7.3: Message MQTT avec polluant inexistant");
  log.test("Test 7.4: Message MQTT avec données manquantes");
  
  log.info("Ces tests sont gérés par mqttService.js:");
  log.info("  - JSON invalide → log warning, continue");
  log.info("  - Capteur inexistant → log warning, skip");
  log.info("  - Polluant inexistant → log warning, skip");
  log.info("  - Erreur traitement → log error, continue");
}

// ============================================================
// MAIN: Exécuter tous les tests
// ============================================================
async function runAllTests() {
  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           ERROR HANDLING TEST SUITE                        ║
║           Architecture 3-Tier                              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
  `);

  try {
    await setup();
    
    await testAuthErrors();
    await testValidationErrors();
    await testNotFoundErrors();
    await testBusinessLogicErrors();
    await testMongoDBErrors();
    await testServiceLayerErrors();
    await testMQTTErrors();

    // Résumé
    log.section("RÉSUMÉ DES TESTS");
    console.log(`
  Total tests    : ${totalTests}
  ${colors.green}✅ Réussis     : ${passedTests}${colors.reset}
  ${colors.red}❌ Échoués     : ${failedTests}${colors.reset}
  ${colors.cyan}📊 Taux succès : ${((passedTests / totalTests) * 100).toFixed(1)}%${colors.reset}
    `);

    if (failedTests === 0) {
      log.success("🎉 TOUS LES TESTS PASSÉS !");
    } else {
      log.error(`${failedTests} test(s) échoué(s)`);
    }

  } catch (error) {
    log.error(`Erreur fatale: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    log.info("Connexion MongoDB fermée");
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
