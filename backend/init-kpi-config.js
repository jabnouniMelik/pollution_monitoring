/**
 * SCRIPT D'INITIALISATION : CONFIGURATION KPI
 * Crée la configuration par défaut du site pour les calculs KPI
 * Usage: node init-kpi-config.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const SiteConfig = require("./models/SiteConfig");
const Polluant = require("./models/Polluant");

async function initKPIConfig() {
  try {
    console.log("🚀 Initialisation configuration KPI...\n");

    // Connexion MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✓ Connecté à MongoDB");

    // Vérifier si config existe déjà
    const existingConfig = await SiteConfig.findOne({ isActive: true });
    if (existingConfig) {
      console.log("⚠️  Configuration active déjà existante");
      console.log(`   Site: ${existingConfig.siteName}`);
      console.log(`   Q_air: ${existingConfig.airflow} Nm³/s`);
      console.log("\n❓ Voulez-vous la remplacer? (Ctrl+C pour annuler)\n");
      
      // Attendre 3 secondes avant de continuer
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      existingConfig.isActive = false;
      await existingConfig.save();
      console.log("✓ Ancienne configuration désactivée");
    }

    // Créer nouvelle configuration
    const config = new SiteConfig({
      siteName: "Station-Sfax-01",
      airflow: 2.0, // Nm³/s - Débit volumique d'air
      thermalPower: null,
      polluantWeights: {
        NOx: 0.30,
        SO2: 0.25,
        PM25: 0.25, // PM2.5 → PM25
        COV: 0.15,
        CO2: 0.05,
      },
      targets: {
        tauxDepassement: 2.0, // ≤ 2% / mois
        ipe: 95, // ≥ 95 / mois
        reductionCO2: -5.0, // ≤ -5% / trimestre
      },
      location: {
        type: "Point",
        coordinates: [10.7602, 35.8256], // Sfax, Tunisie
      },
      isActive: true,
    });

    await config.save();
    console.log("\n✓ Configuration créée:");
    console.log(`   Site: ${config.siteName}`);
    console.log(`   Q_air: ${config.airflow} Nm³/s`);
    console.log(`   Location: ${config.location.coordinates.join(", ")}`);

    // Mettre à jour les poids dans les polluants
    console.log("\n📊 Mise à jour des poids des polluants...");
    
    const polluants = await Polluant.find();
    const weights = {
      NOx: config.polluantWeights.NOx,
      SO2: config.polluantWeights.SO2,
      "PM2.5": config.polluantWeights.PM25, // PM25 → PM2.5
      COV: config.polluantWeights.COV,
      CO2: config.polluantWeights.CO2,
    };

    for (const polluant of polluants) {
      const weight = weights[polluant.name] || 0.1;
      polluant.weight = weight;
      await polluant.save();
      console.log(`   ${polluant.name}: ${weight}`);
    }

    console.log("\n✓ Poids des polluants mis à jour");

    // Afficher résumé
    console.log("\n" + "=".repeat(60));
    console.log("CONFIGURATION KPI INITIALISÉE");
    console.log("=".repeat(60));
    console.log("\n📋 Paramètres techniques:");
    console.log(`   • Débit d'air (Q_air): ${config.airflow} Nm³/s`);
    console.log(`   • Puissance thermique: ${config.thermalPower || "Non définie"}`);

    console.log("\n📊 Poids réglementaires (IPE):");
    console.log(`   • NOx: ${(config.polluantWeights.NOx * 100).toFixed(0)}%`);
    console.log(`   • SO2: ${(config.polluantWeights.SO2 * 100).toFixed(0)}%`);
    console.log(`   • PM2.5: ${(config.polluantWeights.PM25 * 100).toFixed(0)}%`);
    console.log(`   • COV: ${(config.polluantWeights.COV * 100).toFixed(0)}%`);
    console.log(`   • CO2: ${(config.polluantWeights.CO2 * 100).toFixed(0)}%`);

    console.log("\n🎯 Objectifs KPI:");
    console.log(`   • Taux de Dépassement (TD): ≤ ${config.targets.tauxDepassement}% / mois`);
    console.log(`   • IPE: ≥ ${config.targets.ipe} / mois`);
    console.log(`   • Réduction CO2 (RCO2): ≤ ${config.targets.reductionCO2}% / trimestre`);

    console.log("\n📍 Localisation:");
    console.log(`   • Coordonnées: ${config.location.coordinates.join(", ")}`);

    console.log("\n✅ Configuration prête pour calculs KPI");
    console.log("\n💡 Prochaines étapes:");
    console.log("   1. Démarrer le serveur: npm start");
    console.log("   2. Les schedulers calculeront automatiquement les KPIs");
    console.log("   3. Ou déclencher manuellement: POST /api/kpi/aggregate");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erreur initialisation:", error.message);
    process.exit(1);
  }
}

// Exécution
initKPIConfig();
