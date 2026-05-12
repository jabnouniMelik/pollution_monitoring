/**
 * SERVICE : PDF GENERATOR
 * Génère des rapports PDF avec graphiques et données de compliance
 * Utilise Puppeteer pour convertir HTML en PDF
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class PdfGeneratorService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads/reports');
    this.chartRenderer = new ChartJSNodeCanvas({ width: 800, height: 400 });
  }

  /**
   * Initialise le dossier uploads si nécessaire
   */
  async ensureUploadsDir() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Génère un graphique IPE en base64
   */
  async generateIPEChart(ipeScore, polluantScores) {
    const configuration = {
      type: 'bar',
      data: {
        labels: Object.keys(polluantScores),
        datasets: [{
          label: 'Score par polluant (%)',
          data: Object.values(polluantScores),
          backgroundColor: [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
          ],
        }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
          },
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `Score IPE Global : ${ipeScore}/100`,
            font: { size: 16 },
          },
        },
      },
    };

    const imageBuffer = await this.chartRenderer.renderToBuffer(configuration);
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
  }

  /**
   * Génère un graphique de tendance temporelle
   */
  async generateTrendChart(trendData) {
    if (!trendData || trendData.length === 0) {
      return null;
    }

    const configuration = {
      type: 'line',
      data: {
        labels: trendData.map(d => new Date(d.date).toLocaleDateString('fr-FR')),
        datasets: [{
          label: 'IPE quotidien',
          data: trendData.map(d => d.value),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
        }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
          },
        },
        plugins: {
          title: {
            display: true,
            text: 'Évolution IPE sur la période',
            font: { size: 14 },
          },
        },
      },
    };

    const imageBuffer = await this.chartRenderer.renderToBuffer(configuration);
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
  }

  /**
   * Génère le template HTML du rapport
   */
  generateHtmlTemplate(reportData) {
    const {
      title,
      periodStart,
      periodEnd,
      overallScore,
      polluantScores,
      breachCount,
      complianceData,
      ipeChartBase64,
      trendChartBase64,
      generatedAt,
    } = reportData;

    const formatDate = (date) => new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const polluantRows = Object.entries(polluantScores || {})
      .map(([name, score]) => {
        const status = score >= 80 ? '✓ Conforme' : score >= 60 ? '⚠ Attention' : '✗ Non conforme';
        const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${name}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${score}%</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: ${color}; font-weight: 600;">${status}</td>
          </tr>
        `;
      })
      .join('');

    const complianceRows = (complianceData || [])
      .map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.parameter}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.value}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.limit}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.status}</td>
        </tr>
      `)
      .join('');

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title || 'Rapport Environnemental'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      padding: 40px;
    }
    .header {
      border-bottom: 4px solid #3b82f6;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1e40af;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header .meta {
      color: #6b7280;
      font-size: 14px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #1e40af;
      font-size: 20px;
      margin-bottom: 15px;
      border-left: 4px solid #3b82f6;
      padding-left: 12px;
    }
    .kpi-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
    }
    .kpi-box .score {
      font-size: 64px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .kpi-box .label {
      font-size: 18px;
      opacity: 0.9;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 5px;
    }
    .stat-card .label {
      color: #6b7280;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    thead {
      background: #f3f4f6;
    }
    th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }
    .chart-container {
      margin: 20px 0;
      text-align: center;
    }
    .chart-container img {
      max-width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 ${title || 'Rapport Environnemental EmissionsIQ'}</h1>
    <div class="meta">
      <strong>Période :</strong> ${formatDate(periodStart)} → ${formatDate(periodEnd)}<br>
      <strong>Généré le :</strong> ${formatDate(generatedAt)}
    </div>
  </div>

  <div class="kpi-box">
    <div class="score">${overallScore}/100</div>
    <div class="label">Indice de Performance Environnementale (IPE)</div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="value">${breachCount}</div>
      <div class="label">Dépassements</div>
    </div>
    <div class="stat-card">
      <div class="value">${Object.keys(polluantScores || {}).length}</div>
      <div class="label">Polluants surveillés</div>
    </div>
    <div class="stat-card">
      <div class="value">${overallScore >= 80 ? 'Conforme' : 'Non conforme'}</div>
      <div class="label">Statut global</div>
    </div>
  </div>

  ${ipeChartBase64 ? `
  <div class="section">
    <h2>Scores par polluant</h2>
    <div class="chart-container">
      <img src="${ipeChartBase64}" alt="Graphique IPE" />
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2>Détail des scores</h2>
    <table>
      <thead>
        <tr>
          <th>Polluant</th>
          <th style="text-align: center;">Score (%)</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        ${polluantRows}
      </tbody>
    </table>
  </div>

  ${trendChartBase64 ? `
  <div class="section">
    <h2>Évolution temporelle</h2>
    <div class="chart-container">
      <img src="${trendChartBase64}" alt="Graphique de tendance" />
    </div>
  </div>
  ` : ''}

  ${complianceData && complianceData.length > 0 ? `
  <div class="section">
    <h2>Données de compliance</h2>
    <table>
      <thead>
        <tr>
          <th>Paramètre</th>
          <th style="text-align: center;">Valeur mesurée</th>
          <th style="text-align: center;">Limite réglementaire</th>
          <th style="text-align: center;">Statut</th>
        </tr>
      </thead>
      <tbody>
        ${complianceRows}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>Rapport généré automatiquement par EmissionsIQ — Système de surveillance environnementale</p>
    <p>Conforme aux normes NT 106.04 (Tunisie) et directives ANPE</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Génère un PDF à partir des données du rapport
   */
  async generatePdf(reportData) {
    await this.ensureUploadsDir();

    const reportId = reportData.id || reportData._id;
    const filename = `report_${reportId}_${Date.now()}.pdf`;
    const filepath = path.join(this.uploadsDir, filename);

    // Générer les graphiques
    const ipeChartBase64 = await this.generateIPEChart(
      reportData.overallScore,
      reportData.polluantScores
    );

    const trendChartBase64 = reportData.trendData
      ? await this.generateTrendChart(reportData.trendData)
      : null;

    // Générer HTML
    const html = this.generateHtmlTemplate({
      ...reportData,
      ipeChartBase64,
      trendChartBase64,
    });

    // Convertir en PDF avec Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: filepath,
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });

      return {
        filename,
        filepath,
        url: `/uploads/reports/${filename}`,
      };
    } finally {
      await browser.close();
    }
  }
}

module.exports = new PdfGeneratorService();
