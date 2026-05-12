/**
 * SERVICE : CSV GENERATOR
 * Génère des rapports CSV avec données KPI et compliance
 * 
 * Format: UTF-8 with BOM + semicolon separator
 * → Excel (FR) opens correctly without encoding issues
 */

const fs = require('fs').promises;
const path = require('path');

class CsvGeneratorService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads/reports');
    // Semicolon separator for French Excel (which uses ; as default CSV delimiter)
    this.SEP = ';';
  }

  async ensureUploadsDir() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Escape a CSV cell value:
   * - Wrap in quotes if it contains the separator, quotes, or newlines
   * - Double any internal quotes
   */
  escapeCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(this.SEP) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Build a CSV row from an array of values
   */
  row(...cells) {
    return cells.map(c => this.escapeCell(c)).join(this.SEP);
  }

  /**
   * Format a date as DD/MM/YYYY
   */
  formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  async generateCsv(reportData) {
    await this.ensureUploadsDir();

    const reportId = reportData.id || reportData._id;
    const filename = `report_${reportId}_${Date.now()}.csv`;
    const filepath = path.join(this.uploadsDir, filename);

    const lines = [];

    // Header row
    lines.push(this.row('SECTION', 'PARAMETRE', 'VALEUR', 'UNITE', 'STATUT'));

    // ── Section 1: Informations générales ──────────────────────
    lines.push(this.row('INFORMATIONS GENERALES', 'Titre',
      reportData.title || 'Rapport Environnemental', '', ''));
    lines.push(this.row('INFORMATIONS GENERALES', 'Periode debut',
      this.formatDate(reportData.periodStart), '', ''));
    lines.push(this.row('INFORMATIONS GENERALES', 'Periode fin',
      this.formatDate(reportData.periodEnd), '', ''));
    lines.push(this.row('INFORMATIONS GENERALES', 'Date de generation',
      this.formatDate(reportData.generatedAt), '', ''));
    lines.push('');

    // ── Section 2: Performance environnementale ─────────────────
    const ipeStatus = (reportData.overallScore ?? 0) >= 80 ? 'Conforme' : 'Non conforme';
    lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'Score IPE Global',
      reportData.overallScore ?? 0, '/100', ipeStatus));
    lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'Nombre de depassements',
      reportData.breachCount ?? 0, '',
      (reportData.breachCount ?? 0) === 0 ? 'Aucun' : 'Alertes detectees'));
    lines.push('');

    // ── Section 3: Scores par polluant ──────────────────────────
    const scores = reportData.polluantScores || {};
    const scoreEntries = scores instanceof Map
      ? Array.from(scores.entries())
      : Object.entries(scores);

    if (scoreEntries.length > 0) {
      lines.push(this.row('SCORES PAR POLLUANT', 'Polluant', 'Score (%)', '', 'Statut'));
      for (const [name, score] of scoreEntries) {
        const s = Number(score);
        const status = s >= 80 ? 'Conforme' : s >= 60 ? 'Attention' : 'Non conforme';
        lines.push(this.row('SCORES PAR POLLUANT', name, s, '%', status));
      }
      lines.push('');
    }

    // ── Section 4: Données de compliance ───────────────────────
    const compliance = reportData.complianceData || [];
    if (compliance.length > 0) {
      lines.push(this.row('DONNEES DE COMPLIANCE', 'Parametre',
        'Valeur mesuree', 'Limite reglementaire', 'Statut'));
      for (const item of compliance) {
        lines.push(this.row('DONNEES DE COMPLIANCE',
          item.parameter, item.value, item.limit, item.status));
      }
    }

    // Write file: UTF-8 BOM (\uFEFF) + content
    // The BOM tells Excel this is UTF-8, preventing encoding corruption
    const content = '\uFEFF' + lines.join('\r\n');
    await fs.writeFile(filepath, content, 'utf8');

    return {
      filename,
      filepath,
      url: `/uploads/reports/${filename}`,
    };
  }
}

module.exports = new CsvGeneratorService();
