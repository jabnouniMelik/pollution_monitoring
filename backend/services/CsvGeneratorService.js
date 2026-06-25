/**
 * SERVICE : CSV GENERATOR
 * Génère des rapports CSV avec données KPI et compliance
 * 
 * Format: UTF-8 with BOM + semicolon separator
 * → Excel (FR) opens correctly without encoding issues
 */

const fs = require('fs').promises;
const path = require('path');
const XLSX = require('xlsx');

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

  formatDateTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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
    const ipeTarget = reportData.kpiTargets?.ipe ?? 95;
    const tdTarget = reportData.kpiTargets?.td ?? 2;
    const rco2Target = reportData.kpiTargets?.rco2 ?? -5;
    const ipeStatus = (reportData.overallScore ?? 0) >= ipeTarget ? 'Conforme' : 'Non conforme';
    lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'Score IPE Global',
      reportData.overallScore ?? 0, '/100', ipeStatus));
    lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'Taux de depassement (TD)',
      reportData.td ?? 0, '%', (reportData.td ?? 0) <= tdTarget ? 'Conforme' : 'Non conforme'));
    lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'Lectures en depassement',
      reportData.breachCount ?? 0, '', (reportData.breachCount ?? 0) === 0 ? 'Aucun' : 'Detecte'));
    if (reportData.rco2) {
      lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'RCO2 variation mensuelle',
        reportData.rco2.reductionPct ?? 0, '%',
        (reportData.rco2.reductionPct ?? 0) <= rco2Target ? 'Conforme' : 'Non conforme'));
      lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'Atteinte objectif CO2',
        reportData.rco2.goalAttainmentPct ?? 0, '%', ''));
      lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'CO2 moyen mois actuel',
        reportData.rco2.currentAvg ?? 0, 'ppm', ''));
      lines.push(this.row('PERFORMANCE ENVIRONNEMENTALE', 'CO2 moyen mois precedent',
        reportData.rco2.previousAvg ?? 0, 'ppm', ''));
    }
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
        const status = s >= (reportData.kpiTargets?.ipe ?? 95) ? 'Conforme' : s >= (reportData.kpiTargets?.ipe ?? 95) * 0.9 ? 'Attention' : 'Non conforme';
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

    // ── Section 5: Historique concentrations (dataset) ──────────
    const history = reportData.concentrationHistory || [];
    if (history.length > 0) {
      lines.push('');
      lines.push(this.row(
        'HISTORIQUE CONCENTRATIONS',
        'Horodatage',
        'Polluant',
        'Valeur',
        'Unite',
        'Limite reglementaire',
        'Statut',
        'Noeud',
        'Capteur',
      ));
      for (const item of history) {
        lines.push(this.row(
          'HISTORIQUE CONCENTRATIONS',
          this.formatDateTime(item.timestamp),
          item.pollutant,
          Number(item.value).toFixed(3),
          item.unit,
          item.regulatoryLimit ?? '',
          item.status,
          item.node || '',
          item.sensor || '',
        ));
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

  async generateXlsx(reportData) {
    await this.ensureUploadsDir();

    const reportId = reportData.id || reportData._id;
    const filename = `report_${reportId}_${Date.now()}.xlsx`;
    const filepath = path.join(this.uploadsDir, filename);

    const summaryRows = [
      ['Section', 'Paramètre', 'Valeur', 'Unité', 'Statut'],
      ['INFORMATIONS GENERALES', 'Titre', reportData.title || 'Rapport Environnemental', '', ''],
      ['INFORMATIONS GENERALES', 'Période début', this.formatDate(reportData.periodStart), '', ''],
      ['INFORMATIONS GENERALES', 'Période fin', this.formatDate(reportData.periodEnd), '', ''],
      ['INFORMATIONS GENERALES', 'Date de génération', this.formatDate(reportData.generatedAt), '', ''],
      [],
    ];

    const ipeStatus = (reportData.overallScore ?? 0) >= 80 ? 'Conforme' : 'Non conforme';
    summaryRows.push(
      ['PERFORMANCE ENVIRONNEMENTALE', 'Score IPE Global', reportData.overallScore ?? 0, '/100', ipeStatus],
      [
        'PERFORMANCE ENVIRONNEMENTALE',
        'Nombre de dépassements',
        reportData.breachCount ?? 0,
        '',
        (reportData.breachCount ?? 0) === 0 ? 'Aucun' : 'Alertes détectées',
      ],
      [],
    );

    const scores = reportData.polluantScores || {};
    const scoreEntries = scores instanceof Map ? Array.from(scores.entries()) : Object.entries(scores);
    if (scoreEntries.length > 0) {
      summaryRows.push(['SCORES PAR POLLUANT', 'Polluant', 'Score (%)', '', 'Statut']);
      for (const [name, score] of scoreEntries) {
        const s = Number(score);
        const status = s >= (reportData.kpiTargets?.ipe ?? 95) ? 'Conforme' : s >= (reportData.kpiTargets?.ipe ?? 95) * 0.9 ? 'Attention' : 'Non conforme';
        summaryRows.push(['SCORES PAR POLLUANT', name, s, '%', status]);
      }
      summaryRows.push([]);
    }

    const compliance = reportData.complianceData || [];
    if (compliance.length > 0) {
      summaryRows.push(['DONNEES DE COMPLIANCE', 'Paramètre', 'Valeur mesurée', 'Limite réglementaire', 'Statut']);
      for (const item of compliance) {
        summaryRows.push([
          'DONNEES DE COMPLIANCE',
          item.parameter,
          item.value,
          item.limit,
          item.status,
        ]);
      }
    }

    const historyRows = [
      ['Horodatage', 'Polluant', 'Valeur', 'Unité', 'Limite réglementaire', 'Statut', 'Nœud', 'Capteur'],
    ];
    for (const item of reportData.concentrationHistory || []) {
      historyRows.push([
        this.formatDateTime(item.timestamp),
        item.pollutant,
        Number(item.value),
        item.unit,
        item.regulatoryLimit ?? '',
        item.status,
        item.node || '',
        item.sensor || '',
      ]);
    }

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    const historySheet = XLSX.utils.aoa_to_sheet(historyRows);

    summarySheet['!cols'] = [
      { wch: 36 },
      { wch: 30 },
      { wch: 24 },
      { wch: 20 },
      { wch: 18 },
    ];
    historySheet['!cols'] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 16 },
      { wch: 20 },
      { wch: 24 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');
    XLSX.utils.book_append_sheet(workbook, historySheet, 'Historique concentrations');
    XLSX.writeFile(workbook, filepath);

    return {
      filename,
      filepath,
      url: `/uploads/reports/${filename}`,
    };
  }
}

module.exports = new CsvGeneratorService();
