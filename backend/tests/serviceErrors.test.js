/**
 * ============================================================
 * SERVICE LAYER ERROR HANDLING TESTS
 * Tests unitaires pour la logique métier des Services
 * ============================================================
 * 
 * Ces tests vérifient que les Services gèrent correctement:
 * - Validation des données d'entrée
 * - Erreurs métier (business logic)
 * - Propagation des erreurs Repository
 * - Messages d'erreur clairs et cohérents
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Services à tester
const ReadingService = require("../services/ReadingService");
const AlertService = require("../services/AlertService");
const AuthService = require("../services/AuthService");
const SensorService = require("../services/SensorService");

// Configuration
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pollution_db";

// Couleurs
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

let testsPassed = 0;
let testsFailed = 0;

const log = {
  success: (msg) => {
    testsPassed++;
    console.log(`${colors.green}✅ ${msg}${colors.reset}`);
  },
  error: (msg) => {
    testsFailed++;
    console.log(`${colors.red}❌ ${msg}${colors.reset}`);
  },
  section: (msg) => console.log(`\n${colors.yellow}${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}${colors.reset}`),
};

// Helper pour tester les erreurs
async function expectError(fn, expectedMessage, testName) {
  try {
    await fn();
    log.error(`${testName} - Devrait échouer mais a réussi`);
    return false;
  } catch (error) {
    if (error.message.includes(expectedMessage)) {
      log.success(testName);
      return true;
    } else {
      log.error(`${testName} - Message attendu: "${expectedMessage}", reçu: "${error.message}"`);
      return false;
    }
  }
}

// ============================================================
// TEST SUITE 1: ReadingService Error Handling
// ============================================================
async function testReadingServiceErrors() {
  log.section("TEST SUITE 1: ReadingService Error Handling");

  // Test 1.1: Capteur inexistant
  await expectError(
    () => ReadingService.ingestReading({
      sensorId: "507f1f77bcf86cd799439011",
      polluantId: "507f1f77bcf86cd799439012",
      nodeId: "507f1f77bcf86cd799439013",
      value: 100,
      unit: "ppm",
    }),
    "Capteur non trouvé",
    "ingestReading() rejette capteur inexistant"
  );

  // Test 1.2: Polluant inexistant
  const Sensor = require("../models/Sensor");
  const sensor = await Sensor.findOne();
  
  if (sensor) {
    await expectError(
      () => ReadingService.ingestReading({
        sensorId: sensor._id.toString(),
        polluantId: "507f1f77bcf86cd799439012", // Fake ID
        nodeId: sensor.sensorNodeId.toString(),
        value: 100,
        unit: "ppm",
      }),
      "Polluant non trouvé",
      "ingestReading() rejette polluant inexistant"
    );
  }

  // Test 1.3: Capteur inactif
  const inactiveSensor = await Sensor.findOne({ isActive: false });
  if (inactiveSensor) {
    await expectError(
      () => ReadingService.ingestReading({
        sensorId: inactiveSensor._id.toString(),
        polluantId: inactiveSensor.PolluantId.toString(),
        nodeId: inactiveSensor.sensorNodeId.toString(),
        value: 100,
        unit: "ppm",
      }),
      "Le capteur est inactif",
      "ingestReading() rejette capteur inactif"
    );
  } else {
    console.log("  ⚠️  Pas de capteur inactif pour tester");
  }

  // Test 1.4: Reading inexistante
  await expectError(
    () => ReadingService.getReadingById("507f1f77bcf86cd799439011"),
    "Mesure non trouvée",
    "getReadingById() rejette ID inexistant"
  );

  // Test 1.5: Ré-évaluation reading inexistante
  await expectError(
    () => ReadingService.reEvaluateReading("507f1f77bcf86cd799439011"),
    "Mesure non trouvée",
    "reEvaluateReading() rejette ID inexistant"
  );
}

// ============================================================
// TEST SUITE 2: AlertService Error Handling
// ============================================================
async function testAlertServiceErrors() {
  log.section("TEST SUITE 2: AlertService Error Handling");

  const Alert = require("../models/Alert");

  // Test 2.1: Alerte inexistante
  await expectError(
    () => AlertService.getAlertById("507f1f77bcf86cd799439011"),
    "Alerte non trouvée",
    "getAlertById() rejette ID inexistant"
  );

  // Test 2.2: Acknowledge alerte inexistante
  await expectError(
    () => AlertService.acknowledgeAlert("507f1f77bcf86cd799439011", "user123"),
    "Alerte non trouvée",
    "acknowledgeAlert() rejette ID inexistant"
  );

  // Test 2.3: Escalade alerte inexistante
  await expectError(
    () => AlertService.escalateAlert("507f1f77bcf86cd799439011", "HIGH", "Test"),
    "Alerte non trouvée",
    "escalateAlert() rejette ID inexistant"
  );

  // Test 2.4: Escalade avec sévérité invalide
  // Note: Le service vérifie d'abord si l'alerte existe, puis la sévérité
  // Donc on doit tester avec une alerte existante
  const existingAlert = await Alert.findOne();
  
  if (existingAlert) {
    await expectError(
      () => AlertService.escalateAlert(existingAlert._id.toString(), "INVALID", "Test"),
      "Sévérité invalide",
      "escalateAlert() rejette sévérité invalide"
    );
  } else {
    console.log("  ⚠️  Pas d'alerte pour tester escalade avec sévérité invalide");
  }

  // Test 2.5: Acquitter alerte déjà acquittée
  const acknowledgedAlert = await Alert.findOne({ isAcknowledged: true });
  
  if (acknowledgedAlert) {
    await expectError(
      () => AlertService.acknowledgeAlert(acknowledgedAlert._id.toString(), "user123"),
      "Alerte déjà acquittée",
      "acknowledgeAlert() rejette alerte déjà acquittée"
    );
  } else {
    console.log("  ⚠️  Pas d'alerte acquittée pour tester");
  }
}

// ============================================================
// TEST SUITE 3: AuthService Error Handling
// ============================================================
async function testAuthServiceErrors() {
  log.section("TEST SUITE 3: AuthService Error Handling");

  // Test 3.1: Login sans email
  await expectError(
    () => AuthService.login("", "password123"),
    "Email et mot de passe requis",
    "login() rejette email vide"
  );

  // Test 3.2: Login sans password
  await expectError(
    () => AuthService.login("test@test.com", ""),
    "Email et mot de passe requis",
    "login() rejette password vide"
  );

  // Test 3.3: Login avec email inexistant
  await expectError(
    () => AuthService.login("nonexistent@test.com", "password123"),
    "Email ou mot de passe incorrect",
    "login() rejette email inexistant"
  );

  // Test 3.4: Login avec mauvais mot de passe
  await expectError(
    () => AuthService.login("admin@enim.tn", "wrongpassword"),
    "Email ou mot de passe incorrect",
    "login() rejette mauvais mot de passe"
  );

  // Test 3.5: Register sans champs requis
  await expectError(
    () => AuthService.register({
      username: "test",
      // email manquant
      password: "Test1234",
      role: "OPERATOR",
    }),
    "username, email, password et role sont requis",
    "register() rejette champs manquants"
  );

  // Test 3.6: Register avec rôle invalide
  await expectError(
    () => AuthService.register({
      username: "test",
      email: "test@test.com",
      password: "Test1234",
      role: "INVALID_ROLE",
    }),
    "Rôle invalide",
    "register() rejette rôle invalide"
  );

  // Test 3.7: Register avec email dupliqué
  const User = require("../models/User");
  const existingUser = await User.findOne();
  
  if (existingUser) {
    await expectError(
      () => AuthService.register({
        username: `newuser${Date.now()}`,
        email: existingUser.email, // Email dupliqué
        password: "Test1234",
        role: "OPERATOR",
      }),
      "Email déjà utilisé",
      "register() rejette email dupliqué"
    );
  }

  // Test 3.8: Register avec username dupliqué
  if (existingUser) {
    await expectError(
      () => AuthService.register({
        username: existingUser.username, // Username dupliqué
        email: `new${Date.now()}@test.com`,
        password: "Test1234",
        role: "OPERATOR",
      }),
      "Username déjà utilisé",
      "register() rejette username dupliqué"
    );
  }

  // Test 3.9: Refresh sans token
  await expectError(
    () => AuthService.refresh(""),
    "Refresh token requis",
    "refresh() rejette token vide"
  );

  // Test 3.10: Refresh avec token invalide
  await expectError(
    () => AuthService.refresh("invalid_token_xyz"),
    "Refresh token invalide",
    "refresh() rejette token invalide"
  );

  // Test 3.11: Logout sans token
  await expectError(
    () => AuthService.logout(""),
    "Refresh token requis",
    "logout() rejette token vide"
  );

  // Test 3.12: getProfile utilisateur inexistant
  await expectError(
    () => AuthService.getProfile("507f1f77bcf86cd799439011"),
    "Utilisateur non trouvé",
    "getProfile() rejette ID inexistant"
  );
}

// ============================================================
// TEST SUITE 4: SensorService Error Handling
// ============================================================
async function testSensorServiceErrors() {
  log.section("TEST SUITE 4: SensorService Error Handling");

  // Test 4.1: Sensor inexistant
  await expectError(
    () => SensorService.getSensorById("507f1f77bcf86cd799439011"),
    "Capteur non trouvé",
    "getSensorById() rejette ID inexistant"
  );

  // Test 4.2: Update sensor inexistant
  await expectError(
    () => SensorService.updateSensor("507f1f77bcf86cd799439011", { model: "New Model" }),
    "Capteur non trouvé",
    "updateSensor() rejette ID inexistant"
  );

  // Test 4.3: Delete sensor inexistant
  await expectError(
    () => SensorService.deleteSensor("507f1f77bcf86cd799439011"),
    "Capteur non trouvé",
    "deleteSensor() rejette ID inexistant"
  );

  // Test 4.4: Calibrate sensor inexistant
  await expectError(
    () => SensorService.calibrateSensor("507f1f77bcf86cd799439011", 1.0, 0.0),
    "Capteur non trouvé",
    "calibrateSensor() rejette ID inexistant"
  );
}

// ============================================================
// TEST SUITE 5: Alert Engine Logic
// ============================================================
async function testAlertEngineLogic() {
  log.section("TEST SUITE 5: Alert Engine Logic");

  const Polluant = require("../models/Polluant");
  const Sensor = require("../models/Sensor");

  // Test 5.1: Pas d'alerte si pas de seuil réglementaire
  const polluantNoLimit = await Polluant.findOne({ regulatoryLimit: { $exists: false } });
  if (polluantNoLimit) {
    const sensor = await Sensor.findOne({ PolluantId: polluantNoLimit._id });
    if (sensor) {
      try {
        const result = await ReadingService.ingestReading({
          sensorId: sensor._id.toString(),
          polluantId: polluantNoLimit._id.toString(),
          nodeId: sensor.sensorNodeId.toString(),
          value: 1000, // Valeur élevée
          unit: polluantNoLimit.unit,
        });
        
        if (result.alert === null) {
          log.success("Pas d'alerte créée pour polluant sans seuil réglementaire");
        } else {
          log.error("Alerte créée alors que pas de seuil réglementaire");
        }
      } catch (error) {
        log.error(`Erreur test 5.1: ${error.message}`);
      }
    }
  }

  // Test 5.2: Alerte Warning créée si dépassement warningThreshold
  const polluantWithLimits = await Polluant.findOne({
    regulatoryLimit: { $exists: true },
    warningThreshold: { $exists: true },
  });
  
  if (polluantWithLimits) {
    const sensor = await Sensor.findOne({ PolluantId: polluantWithLimits._id, isActive: true });
    if (sensor) {
      try {
        // Valeur entre warningThreshold et regulatoryLimit
        const testValue = polluantWithLimits.warningThreshold + 10;
        
        const result = await ReadingService.ingestReading({
          sensorId: sensor._id.toString(),
          polluantId: polluantWithLimits._id.toString(),
          nodeId: sensor.sensorNodeId.toString(),
          value: testValue,
          unit: polluantWithLimits.unit,
        });
        
        if (result.alert && result.alert.severity === "Warning") {
          log.success("Alerte Warning créée correctement");
        } else {
          log.error(`Alerte Warning attendue, reçu: ${result.alert?.severity || "null"}`);
        }
      } catch (error) {
        log.error(`Erreur test 5.2: ${error.message}`);
      }
    }
  }

  // Test 5.3: Alerte High créée si dépassement regulatoryLimit
  if (polluantWithLimits) {
    const sensor = await Sensor.findOne({ PolluantId: polluantWithLimits._id, isActive: true });
    if (sensor) {
      try {
        // Valeur entre regulatoryLimit et regulatoryLimit * 1.5
        const testValue = polluantWithLimits.regulatoryLimit * 1.2;
        
        const result = await ReadingService.ingestReading({
          sensorId: sensor._id.toString(),
          polluantId: polluantWithLimits._id.toString(),
          nodeId: sensor.sensorNodeId.toString(),
          value: testValue,
          unit: polluantWithLimits.unit,
        });
        
        if (result.alert && result.alert.severity === "High") {
          log.success("Alerte High créée correctement");
        } else {
          log.error(`Alerte High attendue, reçu: ${result.alert?.severity || "null"}`);
        }
      } catch (error) {
        log.error(`Erreur test 5.3: ${error.message}`);
      }
    }
  }

  // Test 5.4: Alerte Critical créée si dépassement > 150%
  if (polluantWithLimits) {
    const sensor = await Sensor.findOne({ PolluantId: polluantWithLimits._id, isActive: true });
    if (sensor) {
      try {
        // Valeur > regulatoryLimit * 1.5
        const testValue = polluantWithLimits.regulatoryLimit * 1.6;
        
        const result = await ReadingService.ingestReading({
          sensorId: sensor._id.toString(),
          polluantId: polluantWithLimits._id.toString(),
          nodeId: sensor.sensorNodeId.toString(),
          value: testValue,
          unit: polluantWithLimits.unit,
        });
        
        if (result.alert && result.alert.severity === "Critical") {
          log.success("Alerte Critical créée correctement");
        } else {
          log.error(`Alerte Critical attendue, reçu: ${result.alert?.severity || "null"}`);
        }
      } catch (error) {
        log.error(`Erreur test 5.4: ${error.message}`);
      }
    }
  }

  // Test 5.5: Pas d'alerte si valeur normale
  if (polluantWithLimits) {
    const sensor = await Sensor.findOne({ PolluantId: polluantWithLimits._id, isActive: true });
    if (sensor) {
      try {
        // Valeur en dessous de warningThreshold
        const testValue = polluantWithLimits.warningThreshold * 0.5;
        
        const result = await ReadingService.ingestReading({
          sensorId: sensor._id.toString(),
          polluantId: polluantWithLimits._id.toString(),
          nodeId: sensor.sensorNodeId.toString(),
          value: testValue,
          unit: polluantWithLimits.unit,
        });
        
        if (result.alert === null) {
          log.success("Pas d'alerte pour valeur normale");
        } else {
          log.error(`Pas d'alerte attendue, reçu: ${result.alert.severity}`);
        }
      } catch (error) {
        log.error(`Erreur test 5.5: ${error.message}`);
      }
    }
  }
}

// ============================================================
// MAIN
// ============================================================
async function runTests() {
  console.log(`
${colors.cyan}╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        SERVICE LAYER ERROR HANDLING TESTS                  ║
║        Tests unitaires de la logique métier                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
  `);

  try {
    // Connexion MongoDB
    await mongoose.connect(MONGO_URI);
    console.log(`${colors.green}✅ MongoDB connecté${colors.reset}\n`);

    // Exécuter les tests
    await testReadingServiceErrors();
    await testAlertServiceErrors();
    await testAuthServiceErrors();
    await testSensorServiceErrors();
    await testAlertEngineLogic();

    // Résumé
    log.section("RÉSUMÉ");
    const total = testsPassed + testsFailed;
    console.log(`
  Total tests    : ${total}
  ${colors.green}✅ Réussis     : ${testsPassed}${colors.reset}
  ${colors.red}❌ Échoués     : ${testsFailed}${colors.reset}
  ${colors.cyan}📊 Taux succès : ${total > 0 ? ((testsPassed / total) * 100).toFixed(1) : 0}%${colors.reset}
    `);

    if (testsFailed === 0) {
      console.log(`${colors.green}🎉 TOUS LES TESTS PASSÉS !${colors.reset}\n`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Erreur fatale: ${error.message}${colors.reset}`);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log(`${colors.cyan}ℹ️  Connexion MongoDB fermée${colors.reset}`);
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

// Exécuter
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
