/**
 * REPOSITORY : REPORT
 * Gère toutes les opérations DB pour les rapports
 */

const Report = require("../models/Report");

const USER_POPULATE = [
  { path: "generatedBy", select: "username email role" },
  { path: "approvedBy", select: "username email" },
  { path: "rejectedBy", select: "username email" },
];

class ReportRepository {
  async findAll(filter = {}) {
    return await Report.find(filter)
      .sort({ generatedAt: -1 })
      .populate(USER_POPULATE);
  }

  async findById(id) {
    return await Report.findById(id).populate(USER_POPULATE);
  }

  async create(data) {
    return await Report.create(data);
  }

  async update(id, data) {
    return await Report.findByIdAndUpdate(id, data, {
      returnDocument: "after",
      runValidators: true,
    }).populate(USER_POPULATE);
  }

  async updateStatus(id, status, notes = "") {
    const updateData = { status };
    if (notes) updateData.notes = notes;
    if (status === "SUBMITTED") updateData.submittedAt = new Date();
    if (status === "APPROVED") updateData.approvedAt = new Date();

    return await Report.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
      runValidators: true,
    }).populate(USER_POPULATE);
  }

  async updateWorkflowStatus(id, payload) {
    const {
      status,
      actorId = null,
      notes = "",
      rejectionReason = "",
    } = payload;

    const updateData = { status };
    if (notes) updateData.notes = notes;

    if (status === "SUBMITTED") {
      updateData.submittedAt = new Date();
    }

    if (status === "APPROVED") {
      updateData.approvedAt = new Date();
      updateData.approvedBy = actorId;
      updateData.rejectedAt = null;
      updateData.rejectedBy = null;
      updateData.rejectionReason = "";
    }

    if (status === "REJECTED") {
      updateData.rejectedAt = new Date();
      updateData.rejectedBy = actorId;
      updateData.rejectionReason = rejectionReason || notes || "";
    }

    return await Report.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
      runValidators: true,
    }).populate(USER_POPULATE);
  }

  async countByStatus(status) {
    return await Report.countDocuments({ status });
  }

  async findLatest() {
    return await Report.findOne().sort({ generatedAt: -1 });
  }

  async delete(id) {
    return await Report.findByIdAndDelete(id);
  }
}

module.exports = new ReportRepository();
