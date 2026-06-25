/**
 * MIGRATION : SensorNode.zone (String) → SensorNode.zoneId (ObjectId)
 *
 * Ce script migre les documents SensorNode existants :
 *   - Lit le champ `zone` (ex: "Zone-A", "Zone-Fours")
 *   - Cherche la Zone correspondante par code ou nom dans le même site/industrie
 *   - Écrit `zoneId` et `siteId` sur le document
 *   - Supprime l'ancien champ `zone`
 *
 * Usage :
 *   node backend/migrations/migrate-sensornode-zone.js
 *
 * Pré-requis :
 *   - Les documents Zone doivent exister avec les bons codes/noms
 *   - La variable d'environnement MONGO_URI doit être définie (ou .env chargé)
 *
 * Sécurité :
 *   - Le script est idempotent : relancer ne cause pas de doublons
 *   - Les nœuds déjà migrés (zoneId présent) sont ignorés
 *   - Les nœuds sans correspondance de zone sont listés en fin de rapport
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI non défini dans .env");
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log("✓ Connecté à MongoDB");

  const SensorNode = mongoose.model(
    "SensorNode",
    new mongoose.Schema({}, { strict: false }),
    "sensornodes",
  );
  const Zone = mongoose.model(
    "Zone",
    new mongoose.Schema({}, { strict: false }),
    "zones",
  );

  // Récupérer tous les nœuds qui ont encore l'ancien champ `zone` (string)
  const nodes = await SensorNode.find({
    zone: { $exists: true, $type: "string" },
    zoneId: { $exists: false },
  }).lean();

  console.log(`\n📋 ${nodes.length} nœud(s) à migrer`);

  if (nodes.length === 0) {
    console.log("✓ Aucune migration nécessaire.");
    await mongoose.disconnect();
    return;
  }

  const unmatched = [];
  let migrated = 0;

  for (const node of nodes) {
    const zoneString = node.zone; // ex: "Zone-A", "Zone-Fours"

    // Chercher la zone par code (exact) ou nom (case-insensitive)
    // dans la même industrie si possible
    const zoneQuery = {
      $or: [
        { code: zoneString },
        { nom: { $regex: new RegExp(`^${zoneString}$`, "i") } },
      ],
    };
    if (node.IndustrieId) {
      zoneQuery.industrieId = node.IndustrieId;
    }

    const zone = await Zone.findOne(zoneQuery).lean();

    if (!zone) {
      unmatched.push({ nodeId: node._id, nom: node.nom, zone: zoneString });
      console.warn(`  ⚠️  Nœud "${node.nom}" (${node._id}): zone "${zoneString}" introuvable`);
      continue;
    }

    // Mettre à jour le nœud
    await SensorNode.updateOne(
      { _id: node._id },
      {
        $set: {
          zoneId: zone._id,
          siteId: zone.siteId,
        },
        $unset: { zone: "" },
      },
    );

    console.log(`  ✓ "${node.nom}" → zone "${zone.nom}" (${zone._id}), site ${zone.siteId}`);
    migrated++;
  }

  console.log(`\n✅ Migration terminée : ${migrated}/${nodes.length} nœuds migrés`);

  if (unmatched.length > 0) {
    console.log(`\n⚠️  ${unmatched.length} nœud(s) sans correspondance de zone :`);
    for (const u of unmatched) {
      console.log(`   - ${u.nom} (${u.nodeId}) : zone="${u.zone}"`);
    }
    console.log(
      "\n  → Créez les zones manquantes puis relancez ce script, ou mettez à jour manuellement.",
    );
  }

  await mongoose.disconnect();
  console.log("\n✓ Déconnecté de MongoDB");
}

migrate().catch((err) => {
  console.error("❌ Erreur migration:", err);
  process.exit(1);
});
