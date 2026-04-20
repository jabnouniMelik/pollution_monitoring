//middleware de validation ds données entrants
//verifie les données entrants avant qu'elles arrivent aux controllers
//retourne 400 bad request si les données sont invalides
const mongoose = require("mongoose");
const {
  pollutant_types,
  sensor_node_status,
  alert_severity,
  alert_types,
} = require("../utils/constants");

//fonction utilitaire
//verifie si un id mongodb est valide
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

//validation industrie
const validateIndustrie = (req, res, next) => {
  const { nom, secteur } = req.body;
  if (!nom || nom.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Le nom de l'industrie est requis",
    });
  }
  if (!secteur || secteur.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Le secteur de l'industrie est requis",
    });
  }
  next(); //donnes valides ==> passer au controller
};
// validation sensorNode
const validateSensorNode = (req, res, next) => {
  const { nom, industrieId, zone } = req.body;
  if (!nom || nom.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Le nom du noeud est requis",
    });
  }
  if (!industrieId || !isValidObjectId(industrieId)) {
    return res.status(400).json({
      success: false,
      message: "L'ID de l'industrie est requis et invalide",
    });
  }
  if (!zone || zone.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "La zone du noeud est requise",
    });
  }
  next(); //donnes valides ==> passer au controller
};
//validation des capteurs
const validateSensor = (req, res, next) => {
  const { sensorNodeId, PolluantId, type, model, unit } = req.body;
  if (!sensorNodeId || !isValidObjectId(sensorNodeId)) {
    return res.status(400).json({
      success: false,
      message: "L'ID du noeud est requis et invalide",
    });
  }
  if (!PolluantId || !isValidObjectId(PolluantId)) {
    return res.status(400).json({
      success: false,
      message: "L'ID du polluant est requis et invalide",
    });
  }
  if (!type || !Object.values(pollutant_types).includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Le type du capteur est requis",
    });
  }
  if (!model || model.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Le modèle du capteur est requis",
    });
  }
  if (!unit || unit.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "L'unité du capteur est requise",
    });
  }
  next();
};
//validation des polluants
const validatePolluant = (req, res, next) => {
  const { name, formula, unit, regulatoryLimit, warningThreshold } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Le nom du polluant est requis",
    });
  }
  if (!formula || formula.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "La formule du polluant est requise",
    });
  }
  if (!unit || unit.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "L'unité du polluant est requise",
    });
  }
  // regulatoryLimit et warningThreshold sont optionnels
  if (
    regulatoryLimit !== undefined &&
    regulatoryLimit !== null &&
    (isNaN(regulatoryLimit) || regulatoryLimit <= 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "La limite réglementaire doit être un nombre positif",
    });
  }
  if (
    warningThreshold !== undefined &&
    warningThreshold !== null &&
    (isNaN(warningThreshold) || warningThreshold <= 0)
  ) {
    return res.status(400).json({
      success: false,
      message: "Le seuil d'alerte doit être un nombre positif",
    });
  }
  next();
};
//validation readings(données de capteurs en temps réel)
const validateReading = (req, res, next) => {
  const { sensorId, PolluantId, nodeId, value, unit } = req.body;
  if (!sensorId || !isValidObjectId(sensorId)) {
    return res.status(400).json({
      success: false,
      message: "L'ID du capteur est requis et invalide",
    });
  }
  if (!PolluantId || !isValidObjectId(PolluantId)) {
    return res.status(400).json({
      success: false,
      message: "L'ID du polluant est requis et invalide",
    });
  }
  if (!nodeId || !isValidObjectId(nodeId)) {
    return res.status(400).json({
      success: false,
      message: "L'ID du noeud est requis et invalide",
    });
  }
  if (value === undefined || isNaN(value) || value < 0) {
    return res.status(400).json({
      success: false,
      message: "La valeur du capteur est requise",
    });
  }
  if (!unit || unit.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "L'unité du capteur est requise",
    });
  }
  next();
};
module.exports = {
  validateIndustrie,
  validateSensorNode,
  validateSensor,
  validatePolluant,
  validateReading,
};
