/**
 * REPOSITORY : REPORT
 * Gère toutes les opérations DB pour les rapports
 */

const Report = require("../models/Report");

class ReportRepository {
  /**
   * Récupère tous les rapports avec filtres
   * @param {Object} filter - Filtre MongoDB
   * @returns {Promise<Array>} Array de rapports
   */
  async findAll(filter = {}) {
    return await Report.find(filter).sort({ generatedAt: -1 });
  }

  /**
   * Récupère un rapport par ID
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document rapport ou null
   */
  async findById(id) {
    return await Report.findById(id).populate("generatedBy", "username email");
  }

  /**
   * Crée un nouveau rapport
   * @param {Object} data - Données rapport
   * @returns {Promise<Object>} Document créé
   */
  async create(data) {
    return await Report.create(data);
  }

  /**
   * Met à jour un rapport
   * @param {String} id - ID MongoDB
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} Document mis à jour
   */
  async update(id, data) {
    return await Report.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Met à jour le statut d'un rapport
   * @param {String} id - ID MongoDB
   * @param {String} status - Nouveau statut (DRAFT, SUBMITTED, APPROVED)
   * @param {String} notes - Notes optionnelles
   * @returns {Promise<Object>} Document mis à jour
   */
  async updateStatus(id, status, notes = "") {
    const updateData = { status };
    if (notes) updateData.notes = notes;
    if (status === "SUBMITTED") updateData.submittedAt = new Date();
    if (status === "APPROVED") updateData.approvedAt = new Date();

    return await Report.findByIdAndUpdate(id, updateData, { new: true });
  }

  /**
   * Compte les rapports par statut
   * @param {String} status - Statut à compter
   * @returns {Promise<Number>} Nombre de rapports
   */
  async countByStatus(status) {
    return await Report.countDocuments({ status });
  }

  /**
   * Récupère le rapport le plus récent
   * @returns {Promise<Object>} Document rapport ou null
   */
  async findLatest() {
    return await Report.findOne().sort({ generatedAt: -1 });
  }

  /**
   * Supprime un rapport
   * @param {String} id - ID MongoDB
   * @returns {Promise<Object>} Document supprimé
   */
  async delete(id) {
    return await Report.findByIdAndDelete(id);
  }
}

module.exports = new ReportRepository();
