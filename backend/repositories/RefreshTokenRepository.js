/**
 * REPOSITORY : REFRESH TOKEN
 * Gère toutes les opérations DB pour les refresh tokens
 */

const RefreshToken = require("../models/RefreshToken");

class RefreshTokenRepository {
  /**
   * Crée un nouveau refresh token
   * @param {Object} data - Données token
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await RefreshToken.create(data);
  }

  /**
   * Récupère un refresh token par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document token ou null
   */
  async findById(id) {
    return await RefreshToken.findById(id);
  }

  /**
   * Récupère les tokens d'un utilisateur
   * @param {String} userId - ID de l'utilisateur
   * @returns {Promise<Array>} Array de tokens
   */
  async findByUserId(userId) {
    return await RefreshToken.find({ userId });
  }

  /**
   * Récupère un token par valeur
   * @param {String} token - Valeur du token
   * @returns {Promise<Object>} Document token ou null
   */
  async findByToken(token) {
    return await RefreshToken.findOne({ token });
  }

  /**
   * Supprime un token
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await RefreshToken.findByIdAndDelete(id);
  }

  /**
   * Supprime tous les tokens d'un utilisateur
   * @param {String} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Résultat suppression
   */
  async deleteByUserId(userId) {
    return await RefreshToken.deleteMany({ userId });
  }

  /**
   * Supprime les tokens expirés
   * @returns {Promise<Object>} Résultat suppression
   */
  async deleteExpired() {
    return await RefreshToken.deleteMany({
      expiresAt: { $lt: new Date() },
    });
  }
}

module.exports = new RefreshTokenRepository();
