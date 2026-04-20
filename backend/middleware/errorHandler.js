//middlewear globale pour la gestion des erreurs
//intercepte les erreurs de l'application et retourne une reponce JSON uniforme
const { error_messages } = require("../utils/constants");

//gestion des erreurs spécifiques a mongodb
const handleMongooseError = (err) => {
  //erreur de duplication
  if (err.code === 11000) {
    const field = err.keyPattern
      ? Object.keys(err.keyPattern)[0]
      : err.KeyValue
        ? Object.keys(err.KeyValue)[0]
        : "field";
    return {
      status: 400,
      message: `${field} already exists`,
    };
  }

  //erreur de validation mongoose(champs requis manquant,enum invalide...)
  if (err.name == "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return {
      status: 400,
      message: messages.join(", "),
    };
  }
  //ID Mongodb invalide
  if (err.name === "CastError") {
    return {
      status: 400,
      message: `${error_messages.invalid_id}: ${err.value}`,
    };
  }
  return null;
};

//Middleware principale
//express reconnaît une fonction de middleware d'erreur par sa signature (err, req, res, next)
const errorHandler = (err, req, res, next) => {
  //log l'erreur dans la console pour le developper
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  console.error("Stack trace:", err.stack);
  //vérifier si c'est une erreur de mongoose connue
  const mongooseError = handleMongooseError(err);
  if (mongooseError) {
    return res.status(mongooseError.status).json({
      success: false,
      message: mongooseError.message,
    });
  }
  //erreur avec status code personalisé (defini dans les controllers)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  //erreur inconnue-> 500 internal server error
  res.status(500).json({
    success: false,
    message: error_messages.server_error,
    //en developpement on affiche les details de l'erreur
    ...(process.env.NODE_ENV === "development" && { error: err.message }),
  });
};

//fonction utilitaire pour creer une erreur avec statusCode
////exemple d'usage dans un controller:
//throw createError(404, 'capteur non trouvé');
const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};
module.exports = {
  errorHandler,
  createError,
};
