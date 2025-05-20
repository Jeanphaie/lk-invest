import express, { Request, Response, Router } from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import * as Handlebars from 'handlebars';
import { ProjectService } from '../services/project.service';
import { PdfMappingService } from '../services/pdfMappingService';
import { PdfConfigSchema, PdfConfig, PdfData } from '../../../shared/types/pdf';
const QuickChart = require('quickchart-js');

const router: Router = express.Router();
const projectService = new ProjectService();


// Fonctions utilitaires pour le formatage
const formatCurrency = (value: number | null | undefined, unit: string = '€', decimals: number = 0): string => {
  if (value === null || value === undefined) return '0 ' + unit;
  try {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `${numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${unit}`;
  } catch {
    return '0 ' + unit;
  }
};

const formatKCurrency = (value: number | null | undefined, decimals: number = 0): string => {
  if (value === null || value === undefined) return '0 k€';
  try {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return formatCurrency(numValue / 1000, 'k€', decimals);
  } catch {
    return '0 k€';
  }
};

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0%';
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + '%';
};

const formatNumber = (value: number | null | undefined, decimals: number = 0): string => {
  if (value === null || value === undefined) return '0';
  try {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  } catch {
    return '0';
  }
};

// Enregistrer les helpers Handlebars
Handlebars.registerHelper('formatCurrency', formatCurrency);
Handlebars.registerHelper('formatKCurrency', formatKCurrency);
Handlebars.registerHelper('formatPercentage', formatPercentage);
Handlebars.registerHelper('formatNumber', formatNumber);
Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

// Fonction pour convertir une image en base64
const imageToBase64 = (filePath: string): string => {
  try {
    const image = fs.readFileSync(filePath);
    return `data:image/${path.extname(filePath).slice(1)};base64,${image.toString('base64')}`;
  } catch (error) {
    console.error('Erreur lors de la conversion de l\'image:', error);
    return '';
  }
};

// Types pour les données DVF
interface DvfTransaction {
  date_mutation?: string;
  voie?: string;
  code_postal?: string;
  valeur_fonciere?: number;
  nombre_pieces_principales?: number;
  surface_reelle_bati?: number;
  prix_m2?: number;
  is_outlier?: boolean;
}

interface TrendSeries {
  year?: number | string;
  selection_avg?: number;
  selection_count?: number;
  arrondissement_avg?: number;
  arrondissement_count?: number;
  premium_avg?: number;
  premium_count?: number;
}

interface DistributionSeries {
  bin?: string;
  prixM2?: number;
  count?: number;
  nombreTransactions?: number;
}

function buildDvfTableHtml(transactions: DvfTransaction[] = []): string {
  if (!Array.isArray(transactions)) return '';
  const formatKCurrency = (value: number | undefined, decimals = 0) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return (Math.round(value / 1000 * Math.pow(10, decimals)) / Math.pow(10, decimals))
      .toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  const sorted = [...transactions].sort((a, b) => (b.date_mutation || '').localeCompare(a.date_mutation || ''));
  return sorted.slice(0, 30).map((prop) => `
    <tr class="${prop.is_outlier ? 'outlier-row' : ''}">
      <td class="col-date">${prop.date_mutation || 'N/A'}</td>
      <td class="col-adresse">${prop.voie || 'Inconnu'}</td>
      <td class="col-cp">${prop.code_postal || 'N/A'}</td>
      <td class="col-valeur">${formatKCurrency(prop.valeur_fonciere, 0)}</td>
      <td class="col-pieces">${prop.nombre_pieces_principales ?? 'N/A'}</td>
      <td class="col-surface">${prop.surface_reelle_bati ? Math.round(prop.surface_reelle_bati) : 'N/A'}</td>
      <td class="col-prixm2">${formatKCurrency(prop.prix_m2, 2)}</td>
    </tr>
  `).join('\n');
}

function buildTrendTableHtml(trendSeries: TrendSeries[] = []): string {
  if (!Array.isArray(trendSeries)) return '';
  const formatKCurrency = (value: number | undefined, decimals = 2) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return (Math.round(value / 1000 * Math.pow(10, decimals)) / Math.pow(10, decimals))
      .toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  return trendSeries.map(trend => `
    <tr>
      <td>${trend.year || ''}</td>
      <td>${formatKCurrency(trend.selection_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.selection_count || 0})</span></td>
      <td>${formatKCurrency(trend.arrondissement_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.arrondissement_count || 0})</span></td>
      <td>${formatKCurrency(trend.premium_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.premium_count || 0})</span></td>
    </tr>
  `).join('\n');
}

function buildTrendChartUrl(trendSeries: TrendSeries[] = []): string {
  if (!Array.isArray(trendSeries) || !trendSeries.length) return '';
  const chart = new QuickChart();
  chart.setConfig({
    type: 'line',
    data: {
      labels: trendSeries.map(t => t.year),
      datasets: [
        {
          label: 'Sélection',
          data: trendSeries.map(t => t.selection_avg ? t.selection_avg / 1000 : null),
          borderColor: '#1a237e',
          backgroundColor: '#1a237e22',
          yAxisID: 'y1',
          fill: false,
          pointRadius: 4,
          borderWidth: 3,
          tension: 0.4,
        },
        {
          label: 'Arrondissement',
          data: trendSeries.map(t => t.arrondissement_avg ? t.arrondissement_avg / 1000 : null),
          borderColor: '#388e3c',
          backgroundColor: '#388e3c22',
          yAxisID: 'y1',
          fill: false,
          pointRadius: 4,
          borderWidth: 3,
          tension: 0.4,
        },
        {
          label: 'Premium (top 10%)',
          data: trendSeries.map(t => t.premium_avg ? t.premium_avg / 1000 : null),
          borderColor: '#d32f2f',
          backgroundColor: '#d32f2f22',
          yAxisID: 'y2',
          fill: false,
          pointRadius: 4,
          borderWidth: 3,
          tension: 0.4,
        }
      ]
    },
    options: {
      plugins: {
        legend: { display: true, position: 'bottom' },
        title: { display: false }
      },
      scales: {
        y1: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'k€/m²' },
          min: 9,
          max: 18
        },
        y2: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Premium (k€/m²)' },
          min: 9,
          max: 18,
          grid: { drawOnChartArea: false }
        },
        x: { title: { display: true, text: 'Année' } }
      }
    }
  });
  chart.setWidth(600).setHeight(320).setBackgroundColor('transparent');
  return chart.getUrl();
}

function buildDistributionChartUrl(distributionSeries: DistributionSeries[] = []): string {
  if (!Array.isArray(distributionSeries) || !distributionSeries.length) return '';
  const labels = distributionSeries.map(d => d.bin ?? (typeof d.prixM2 === 'number' ? `${d.prixM2}` : ''));
  const data = distributionSeries.map(d => d.count ?? d.nombreTransactions ?? 0);

  const chart = new QuickChart();
  chart.setConfig({
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Nombre de transactions',
          data,
          backgroundColor: '#bfa77a',
        },
      ],
    },
    options: {
      plugins: { title: { display: true, text: 'Nombre de transactions par groupe de prix' } },
      scales: {
        y: { title: { display: true, text: 'Nombre de transactions' } },
        x: { title: { display: true, text: 'Prix/m² (k€)' } }
      }
    }
  });
  chart.setWidth(600).setHeight(300).setBackgroundColor('transparent');
  return chart.getUrl();
}

// Helper pour extraire un nombre d'un champ potentiellement objet
function getNumber(val: any): number {
  if (typeof val === 'object' && val !== null) {
    if ('value' in val) return Number(val.value);
    if ('min' in val) return Number(val.min);
    if ('max' in val) return Number(val.max);
    return 0;
  }
  return Number(val ?? 0);
}


// Fonction utilitaire pour générer un cercle encodé polyline Google Maps
function encodeCirclePolyline(lat: number, lng: number, radiusMeters: number, numPoints: number = 32): string {
  const R = 6378137; // Rayon de la Terre en mètres
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    // Décalage en degrés
    const dLat = (dy / R) * (180 / Math.PI);
    const dLng = (dx / (R * Math.cos((Math.PI * lat) / 180))) * (180 / Math.PI);
    points.push([lat + dLat, lng + dLng]);
  }
  // Polyline encoding Google Maps
  function encode(points: [number, number][]): string {
    let plat = 0, plng = 0, res = '';
    for (const [lat, lng] of points) {
      let late5 = Math.round(lat * 1e5);
      let lnge5 = Math.round(lng * 1e5);
      let dlat = late5 - plat;
      let dlng = lnge5 - plng;
      plat = late5;
      plng = lnge5;
      for (const v of [dlat, dlng]) {
        let sv = v < 0 ? ~(v << 1) : v << 1;
        while (sv >= 0x20) {
          res += String.fromCharCode((0x20 | (sv & 0x1f)) + 63);
          sv >>= 5;
        }
        res += String.fromCharCode(sv + 63);
      }
    }
    return res;
  }
  return encode(points);
}

// Helper pour générer une URL HTTP à partir d'un chemin
const makeHttpUrl = (url: string | undefined) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `http://localhost:3001${url}`;
};

// Route pour générer le PDF à partir des données POST (config custom)
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { projectId, pdfConfig } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId requis' });
    }

    // Validation de la config PDF si présente
    let validatedConfig: PdfConfig | undefined = undefined;
    if (pdfConfig) {
      const result = PdfConfigSchema.safeParse(pdfConfig);
      if (!result.success) {
        return res.status(400).json({
          error: 'Config PDF invalide',
          details: result.error.errors.map(err => ({ path: err.path.join('.'), message: err.message }))
        });
      }
      validatedConfig = result.data;
    }

    // Récupérer le projet
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Log uniquement les données DVF pour debug
    console.log('[PDF][DEBUG] project.dvfDistributions (après récupération):', JSON.stringify(project.dvfDistributions, null, 2));
    console.log('[PDF][DEBUG] project.dvfSeries (après récupération):', JSON.stringify(project.dvfSeries, null, 2));
    console.log('[PDF][DEBUG] project.dvfTransactions (après récupération):', JSON.stringify(project.dvfTransactions, null, 2));

    // Utiliser le nouveau PdfMappingService pour extraire les données
    const pdfData = PdfMappingService.mapProjectToPdfData(project, validatedConfig || {});

    // 1. Préparation des données
    const project_title = project.projectTitle || 'Sans titre';
    const includeSections = (pdfConfig && pdfConfig.sections) || {};
    const dynamicFields = req.body.dynamicFields || {};

    // 2. Préparation des assets
    const logo_path = '/data/lki/uploads/LOGO-LK-noir_2025.png';
    const cover_image_path = '/data/lki/uploads/cover_LKI.png';
    const css_path = path.join(__dirname, '..', 'static', 'pdf_assets', 'styles_new.css');

    // Conversion des images logo/cover en base64 pour garantir leur affichage
    const logo_base64 = imageToBase64(logo_path);
    const cover_image_base64 = imageToBase64(cover_image_path);

    // 3. Lecture des templates et du CSS
    const templatesDir = path.join(__dirname, '..', 'templates');

    const cssContent = await fs.promises.readFile(css_path, 'utf-8');



    let htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
            ${cssContent}
        </style>
      </head>
      <body>
    `;

    // 4. Génération des sections

    if (includeSections.cover) {
      console.log('[PDF] --> Entrée dans la section COVER');
      const coverTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'cover_page.html'),
        'utf-8'
      );
      const compiledCover = Handlebars.compile(coverTemplate);
      const coverData = {
        ...pdfData,
        logo_path: logo_base64,
        cover_image_path: cover_image_base64,
        ...(pdfData.pdf_config?.dynamic_fields || {})
      };

      htmlContent += compiledCover(coverData);
      htmlContent += '<div class="page-break"></div>';
    }

    if (includeSections.summary) {
      console.log('[PDF] --> Entrée dans la section SUMMARY');
      const tocTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'toc_page.html'),
        'utf-8'
      );
      const compiledToc = Handlebars.compile(tocTemplate);
      const tocData = {
        ...pdfData,
        rayon: pdfData.inputsDvf?.rayon,
        prix_m2_prix_vente_pondere_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_pondere_m2,
        resultats_marge_nette: pdfData.resultsBusinessPlan?.resultats?.marge_nette,
        resultats_rentabilite: pdfData.resultsBusinessPlan?.resultats?.rentabilite,
      };

      htmlContent += compiledToc(tocData);
      htmlContent += '<div class="page-break"></div>';
    }

    if (includeSections.property) {
      console.log('[PDF] --> Entrée dans la section PROPERTY');
      const propertyTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'property_description.html'),
        'utf-8'
      );
      const compiledProperty = Handlebars.compile(propertyTemplate);
      const propertyData = {
        ...pdfData,
        ...(pdfData.pdf_config?.dynamic_fields || {}),
        prix_achat: pdfData.inputsBusinessPlan?.prix_achat,
        prix_m2_prix_achat_pondere_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_pondere_m2,
        prix_m2_prix_achat_carrez_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_carrez_m2,
        dvf_sel_final_avg: pdfData.resultsDvfMetadata?.sel_final_avg,
        prix_m2_prix_revient_pondere_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_revient_pondere_m2,
        prix_m2_prix_revient_carrez_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_revient_carrez_m2,
        prix_m2_prix_vente_pondere_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_pondere_m2,
        prix_m2_prix_vente_carrez_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_carrez_m2,
        superficie_totale: pdfData.resultsDescriptionBien?.surface_totale,
      };

      htmlContent += compiledProperty(propertyData);
      htmlContent += '<div class="page-break"></div>';
    }

    if (includeSections.valuation_lk) {
      console.log('[PDF] --> Entrée dans la section VALUATION_LK');
      console.log('[PDF] DEBUG RAYON - Avant compilation template LK Invest, rayon:', pdfData.inputsDvf?.rayon);

      const valuationLkTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'valuation_lk_invest.html'),
        'utf-8'
      );
      const compiledValuationLk = Handlebars.compile(valuationLkTemplate);

      // Génération dynamique des tables DVF à partir des liaisons one-to-many
      const dvfTransactions: any[] = (project.dvfTransactions || []) as any[];
      const trendSeries: any[] = (project.dvfSeries || []) as any[];
      // Log la structure brute avant mapping
      console.log('[PDF][DEBUG] project.dvfDistributions (avant mapping):', JSON.stringify(project.dvfDistributions, null, 2));
      // Log chaque objet avant transformation
      (project.dvfDistributions || []).forEach((d, i) => {
        console.log(`[PDF][DEBUG] dvfDistributions[${i}] avant mapping:`, JSON.stringify(d));
      });
      // Mapping explicite sur d.data
      const distributionSeries = (project.dvfDistributions || [])
        .map((d, i) => {
          const entry: any = d;
          const obj = entry && entry.data ? entry.data : entry;
          if (!obj || (!obj.bin && !obj.prixM2)) {
            console.warn(`[PDF][DEBUG] dvfDistributions[${i}] ignorée car data invalide:`, JSON.stringify(entry));
            return null;
          }
          let prixM2 = obj.prixM2;
          if (obj.bin && typeof obj.bin === 'string') {
            const [minStr, maxStr] = obj.bin.split('-');
            const min = parseFloat(minStr.replace('k', '000'));
            const max = parseFloat(maxStr.replace('k', '000'));
            prixM2 = (min + max) / 2;
            console.log(`[PDF][DEBUG] Bin transformé: ${obj.bin} => prixM2=${prixM2}`);
          }
          const res = {
            ...obj,
            prixM2,
            nombreTransactions: obj.count ?? obj.nombreTransactions ?? 0
          };
          console.log(`[PDF][DEBUG] dvfDistributions[${i}] (après transformation):`, JSON.stringify(res));
          return res;
        })
        .filter(Boolean); // On enlève les nulls
      // Log la structure finale
      console.log('[PDF][DEBUG] distributionSeries (après mapping):', JSON.stringify(distributionSeries, null, 2));

      const valuationLkData = {
        ...pdfData,
        outlier_lower_bound_percent: pdfData.inputsDvf?.outlierLowerBoundPercent,
        outlier_upper_bound_coeff: pdfData.inputsDvf?.outlierUpperBoundCoeff,
        dvf_sel_final_avg: pdfData.resultsDvfMetadata?.sel_final_avg,
        dvf_premium_final_avg: pdfData.resultsDvfMetadata?.premium_final_avg,
        total_arrondissement_transactions: pdfData.resultsDvfMetadata?.arrondissement_total_count,
        selection_cleaned_transactions: pdfData.resultsDvfMetadata?.selection_total_count,
        total_premium_transactions: pdfData.resultsDvfMetadata?.premium_total_count,
        lat: pdfData.latitude,
        lng: pdfData.longitude,
        description_quartier: pdfData.inputsGeneral?.description_quartier,
        dvf_table_html: buildDvfTableHtml(dvfTransactions),
        trend_table_html: buildTrendTableHtml(trendSeries),
        trend_chart_url: buildTrendChartUrl(trendSeries),
        distribution_chart_url: buildDistributionChartUrl(distributionSeries),
      };

      htmlContent += compiledValuationLk(valuationLkData);
      htmlContent += '<div class="page-break"></div>';
    }

    if (includeSections.financial) {
      console.log('[PDF] --> Entrée dans la section FINANCIAL');
      const financialTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'financial_data.html'),
        'utf-8'
      );
      const compiledFinancial = Handlebars.compile(financialTemplate);

      // Calcul des pourcentages de financement utilisés pour le template PDF
      const total_montants_utilises = pdfData.resultsBusinessPlan?.financement?.montants_utilises?.total_montants_utilises || 1;
      const pct_credit_foncier_utilise = pdfData.resultsBusinessPlan?.financement?.montants_utilises?.credit_foncier_output_amount
        ? pdfData.resultsBusinessPlan.financement.montants_utilises.credit_foncier_output_amount / total_montants_utilises * 100
        : 0;
      const pct_fonds_propres_utilise = pdfData.resultsBusinessPlan?.financement?.montants_utilises?.fonds_propres_output_amount
        ? pdfData.resultsBusinessPlan.financement.montants_utilises.fonds_propres_output_amount / total_montants_utilises * 100
        : 0;

      const financialData = {
        ...pdfData,
        // Surfaces et pondération
        surface_carrez_apres_travaux: pdfData.inputsBusinessPlan?.surface_carrez_apres_travaux,
        surface_terrasse_apres_travaux: pdfData.inputsBusinessPlan?.surface_terrasse_apres_travaux,
        coef_ponderation: pdfData.inputsGeneral?.ponderation_terrasse,
        surface_ponderee_apres_travaux: pdfData.inputsBusinessPlan?.surface_ponderee_apres_travaux,

        // Acquisition
        prix_achat: pdfData.inputsBusinessPlan?.prix_achat,
        frais_notaire_percent: pdfData.inputsBusinessPlan?.frais_notaire_percent,
        frais_agence_achat_percent: pdfData.inputsBusinessPlan?.frais_agence_achat_percent,
        frais_agence_vente_percent: pdfData.inputsBusinessPlan?.frais_agence_vente_percent,

        // Financement
        financement_credit_foncier_amount: pdfData.inputsBusinessPlan?.financement_credit_foncier_amount,
        financement_fonds_propres_amount: pdfData.inputsBusinessPlan?.financement_fonds_propres_amount,
        financement_credit_accompagnement_amount: pdfData.inputsBusinessPlan?.financement_credit_accompagnement_amount,
        financement_taux_credit_percent: pdfData.inputsBusinessPlan?.financement_taux_credit_percent,
        financement_commission_percent: pdfData.inputsBusinessPlan?.financement_commission_percent,
        frais_dossier_amount: pdfData.inputsBusinessPlan?.frais_dossier_amount,

        // Travaux
        cout_travaux_m2: pdfData.inputsBusinessPlan?.cout_travaux_m2,
        cout_terrasse_input_amount: pdfData.inputsBusinessPlan?.cout_terrasse_input_amount,
        cout_mobilier_input_amount: pdfData.inputsBusinessPlan?.cout_mobilier_input_amount,
        cout_maitrise_oeuvre_percent: pdfData.inputsBusinessPlan?.cout_maitrise_oeuvre_percent,
        cout_alea_percent: pdfData.inputsBusinessPlan?.cout_alea_percent,
        cout_demolition_input_amount: pdfData.inputsBusinessPlan?.cout_demolition_input_amount,
        cout_honoraires_tech_input_amount: pdfData.inputsBusinessPlan?.cout_honoraires_tech_input_amount,
        cout_prorata_foncier_input_amount: pdfData.inputsBusinessPlan?.cout_prorata_foncier_input_amount,
        cout_diagnostics_input_amount: pdfData.inputsBusinessPlan?.cout_diagnostics_input_amount,

        // Résultats et coûts (nouvelle structure, tout l'objet resultsBusinessPlan à plat)
        ...(pdfData.resultsBusinessPlan || {}),

        // Pourcentages calculés (calculés ici)
        pct_credit_foncier_utilise,
        pct_fonds_propres_utilise,
      };

      htmlContent += compiledFinancial(financialData);
      htmlContent += '<div class="page-break"></div>';
    }

    htmlContent += '</body></html>';

    // DEBUG: Sauvegarder le HTML généré dans un fichier temporaire
    const tempHtmlPath = `/data/lki/pdf_debug_${projectId}.html`;
    try {
      fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
      console.log(`[PDF DEBUG] HTML sauvegardé dans ${tempHtmlPath}`);
    } catch (err) {
      console.error('[PDF DEBUG] Erreur lors de la sauvegarde du HTML:', err);
    }

    // 5. Génération du PDF avec Puppeteer
    console.log('[PDF] Début de la génération du PDF avec Puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Configurer Puppeteer pour accéder aux fichiers locaux
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.resourceType() === 'image') {
        const url = request.url();
        if (url.startsWith('/data/lki/')) {
          const filePath = url;
          try {
            const imageBuffer = fs.readFileSync(filePath);
            request.respond({
              status: 200,
              contentType: 'image/png',
              body: imageBuffer
            });
          } catch (error) {
            console.error(`Erreur lors de la lecture de l'image ${filePath}:`, error);
            request.abort();
          }
        } else {
          request.continue();
        }
      } else {
        request.continue();
      }
    });

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });
    await browser.close();
    console.log('[PDF] PDF généré avec succès');

    // 6. Envoi du PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Business_Plan_${project_title.replace(/\s+/g, '_')}.pdf`);
    res.end(pdf);

  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du PDF',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// Route pour générer le PDF moderne
router.post('/generate-modern', async (req: Request, res: Response) => {
  try {
    const { projectId, pdfConfig } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId requis' });
    }

    // Validation de la config PDF si présente
    let validatedConfig: PdfConfig | undefined = undefined;
    if (pdfConfig) {
      const result = PdfConfigSchema.safeParse(pdfConfig);
      if (!result.success) {
        return res.status(400).json({
          error: 'Config PDF invalide',
          details: result.error.errors.map(err => ({ path: err.path.join('.'), message: err.message }))
        });
      }
      validatedConfig = result.data;
    }

    // Récupérer le projet
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Utiliser le PdfMappingService pour extraire les données
    const pdfData = PdfMappingService.mapProjectToPdfData(project, validatedConfig || {});

    // 1. Préparation des données
    const project_title = project.projectTitle || 'Sans titre';
    const includeSections = (pdfConfig && pdfConfig.sections) || {};
    const dynamicFields = req.body.dynamicFields || {};

    // 2. Préparation des assets
    const logo_path = '/data/lki/uploads/LOGO-LK-noir_2025.png';
    const cover_image_path = '/data/lki/uploads/cover_LKI.png';
    const css_path = path.join(__dirname, '..', 'static', 'pdf_assets', 'styles_modern.css');

    // Conversion des images logo/cover en base64
    const logo_base64 = imageToBase64(logo_path);
    const cover_image_base64 = imageToBase64(cover_image_path);

    // 3. Lecture des templates et du CSS
    const templatesDir = path.join(__dirname, '..', 'templates');
    const cssContent = await fs.promises.readFile(css_path, 'utf-8');

    let htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
            ${cssContent}
        </style>
      </head>
      <body>
    `;

    // ===== SECTION COVER =====
    if (includeSections.cover) {
      console.log('[PDF] --> Entrée dans la section COVER (modern)');
      const coverTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'cover_page_modern.html'),
        'utf-8'
      );
      const compiledCover = Handlebars.compile(coverTemplate);
      const coverData = {
        ...pdfData,
        logo_path: logo_base64,
        cover_image_path: cover_image_base64,
        ...(pdfData.pdf_config?.dynamic_fields || {})
      };
      htmlContent += compiledCover(coverData);
      
    }

    // ===== SOMMAIRE =====
    // Génère la liste des sections activées pour le sommaire
    const tocSections = [];
    if (includeSections.property) tocSections.push({ key: 'property', label: 'Description du bien' });
    if ((pdfData.selectedBeforePhotosForPdf || []).length > 0) tocSections.push({ key: 'before', label: 'Photos avant travaux' });
    if ((project.photos?.selectedPlansPhotosForPdf || []).length > 0) tocSections.push({ key: 'plans', label: 'Plans' });
    if ((project.photos?.selected3dPhotosForPdf || []).length > 0) tocSections.push({ key: '3d', label: 'Photos 3D' });
    if (includeSections.valuation_lk) tocSections.push({ key: 'dvf', label: 'Analyse DVF' });
    if (includeSections.financial) tocSections.push({ key: 'financial', label: 'Données financières' });
    if (includeSections.valuation_lk) tocSections.push({ key: 'transactions', label: 'Transactions DVF' });

    const tocTemplate = await fs.promises.readFile(
      path.join(templatesDir, 'toc_modern.html'),
      'utf-8'
    );
    const compiledToc = Handlebars.compile(tocTemplate);
    htmlContent += compiledToc({ sections: tocSections });

    // Prépare le template d'intro
    const sectionIntroTemplate = await fs.promises.readFile(
      path.join(templatesDir, 'section_intro.html'),
      'utf-8'
    );
    const compiledSectionIntro = Handlebars.compile(sectionIntroTemplate);

    // ===== SECTION PROPERTY =====
    if (includeSections.property) {
      htmlContent += compiledSectionIntro({
        title: 'Description du bien',
        description: 'Caractéristiques principales du bien',
        description_2: 'Analyse des plans et projet de rénovation 3D',
        summary: 'Après rénovation on pourra appliquer un coefficient de pondération de <strong>' + pdfData.resultsDescriptionBien?.coef_ponderation + '</strong> par rapport au prix moyen du mètre carré des appartements avoisinants.'
      });
      console.log('[PDF] --> Entrée dans la section PROPERTY (modern)');
      const propertyTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'property_description_modern.html'),
        'utf-8'
      );
      const compiledProperty = Handlebars.compile(propertyTemplate);
      // Préparation des impacts et couleur coef
      const impacts = pdfData.resultsDescriptionBien?.impacts || [];
      const impacts_col1 = impacts.slice(0, 3);
      const impact_col2 = impacts[3];
      const impacts_col3 = impacts.slice(4, 7);
      const coef = pdfData.resultsDescriptionBien?.coef_ponderation ?? 1;
      let coef_class = 'coef-blue';
      if (coef >= 1.2) coef_class = 'coef-red';
      else if (coef >= 1.1) coef_class = 'coef-orange';
      const propertyData = {
        ...pdfData,
        adresse: pdfData.adresse,
        prix_achat: pdfData.inputsBusinessPlan?.prix_achat,
        prix_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_pondere_m2,
        coefficient: pdfData.inputsGeneral?.ponderation_terrasse,
        images: pdfData.selectedBeforePhotosForPdf,
        description: pdfData.pdf_config?.dynamic_fields?.description_general,
        impacts_col1,
        impact_col2,
        impacts_col3,
        coef_class,
        ...(pdfData.pdf_config?.dynamic_fields || {})
      };
      htmlContent += compiledProperty(propertyData);
      htmlContent += '<div class="page-break"></div>';
    }

    // ===== SECTION PHOTOS BEFORE =====
    if ((pdfData.selectedBeforePhotosForPdf || []).length > 0) {

      const imagesRaw = pdfData.selectedBeforePhotosForPdf || [];
      const n = imagesRaw.length;
      const imagesStyled = imagesRaw.map((url, i) => {
        let left, top, width, height, rotate, z = 2, shadow = '0 6px 32px rgba(0,0,0,0.18)';
        if (i === 0) {
          left = '50%'; top = '50%'; width = '70vw'; height = '52vh'; rotate = '-2deg'; z = 10;
          shadow = '0 12px 40px rgba(0,0,0,0.22)';
        } else {
          const nSat = n - 1;
          const angle = (360 / nSat) * (i - 1) - 90 + (nSat > 1 ? 360 / (2 * nSat) : 0);
          const rad = (angle * Math.PI) / 180;
          const r = n < 7 ? 40 : 44;
          left = `${50 + Math.cos(rad) * r}%`;
          top = `${50 + Math.sin(rad) * r}%`;
          width = n < 7 ? '48vw' : '38vw';
          height = n < 7 ? '36vh' : '28vh';
          rotate = `${-10 + (i * 13) % 21}deg`;
          z = 2 + i;
        }
        const style = `left:${left};top:${top};width:${width};height:${height};transform:translate(-50%,-50%) rotate(${rotate});z-index:${z};box-shadow:${shadow};`;
        return { url, style };
      });
      if (imagesStyled.length > 0) {
        console.log('[PDF] --> Entrée dans la section PHOTOS (modern)');
        const photosTemplate = await fs.promises.readFile(
          path.join(templatesDir, 'photos_before_modern.html'),
          'utf-8'
        );
        const compiledPhotos = Handlebars.compile(photosTemplate);
        htmlContent += compiledPhotos({ images: imagesStyled });
        htmlContent += '<div class="page-break"></div>';
      }
    }

    // ===== SECTION PLANS =====
    if ((project.photos?.selectedPlansPhotosForPdf || []).length > 0) {

      const plansPhotos = project.photos?.plans || [];
      const plansImagesRaw = (project.photos?.selectedPlansPhotosForPdf || [])
        .map(id => {
          const photo = plansPhotos.find(p => p.id === id);
          return photo ? makeHttpUrl(photo.url) : undefined;
        })
        .filter(url => url !== undefined);
      const plansN = plansImagesRaw.length;
      const plansImagesStyled = plansImagesRaw.map((url, i) => {
        let left, top, width, height, rotate, z = 2, shadow = '0 6px 32px rgba(0,0,0,0.18)';
        if (i === 0) {
          left = '50%'; top = '50%'; width = '70vw'; height = '52vh'; rotate = '-2deg'; z = 10;
          shadow = '0 12px 40px rgba(0,0,0,0.22)';
        } else {
          const nSat = plansN - 1;
          const angle = (360 / nSat) * (i - 1) - 90 + (nSat > 1 ? 360 / (2 * nSat) : 0);
          const rad = (angle * Math.PI) / 180;
          const r = plansN < 7 ? 40 : 44;
          left = `${50 + Math.cos(rad) * r}%`;
          top = `${50 + Math.sin(rad) * r}%`;
          width = plansN < 7 ? '48vw' : '38vw';
          height = plansN < 7 ? '36vh' : '28vh';
          rotate = `${-10 + (i * 13) % 21}deg`;
          z = 2 + i;
        }
        const style = `left:${left};top:${top};width:${width};height:${height};transform:translate(-50%,-50%) rotate(${rotate});z-index:${z};box-shadow:${shadow};`;
        return { url, style };
      });
      if (plansImagesStyled.length > 0) {
        console.log('[PDF] --> Entrée dans la section PLANS');
        const plansTemplate = await fs.promises.readFile(
          path.join(templatesDir, 'photos_plans_modern.html'),
          'utf-8'
        );
        const compiledPlans = Handlebars.compile(plansTemplate);
        htmlContent += compiledPlans({
          images: plansImagesStyled,
          plan_renovation: pdfData.inputsRenovationBien?.plan_renovation || ''
        });
        htmlContent += '<div class="page-break"></div>';
      }
    }

    // ===== SECTION PHOTOS 3D =====
    if ((project.photos?.selected3dPhotosForPdf || []).length > 0) {

      const photos3d = project.photos?.['3d'] || [];
      const images3dRaw = (project.photos?.selected3dPhotosForPdf || [])
        .map(id => {
          const photo = photos3d.find(p => p.id === id);
          return photo ? makeHttpUrl(photo.url) : undefined;
        })
        .filter(url => url !== undefined);
      const images3dN = images3dRaw.length;
      const images3dStyled = images3dRaw.map((url, i) => {
        let left, top, width, height, rotate, z = 2, shadow = '0 6px 32px rgba(0,0,0,0.18)';
        if (i === 0) {
          left = '50%'; top = '50%'; width = '70vw'; height = '52vh'; rotate = '-2deg'; z = 10;
          shadow = '0 12px 40px rgba(0,0,0,0.22)';
        } else {
          const nSat = images3dN - 1;
          const angle = (360 / nSat) * (i - 1) - 90 + (nSat > 1 ? 360 / (2 * nSat) : 0);
          const rad = (angle * Math.PI) / 180;
          const r = images3dN < 7 ? 40 : 44;
          left = `${50 + Math.cos(rad) * r}%`;
          top = `${50 + Math.sin(rad) * r}%`;
          width = images3dN < 7 ? '48vw' : '38vw';
          height = images3dN < 7 ? '36vh' : '28vh';
          rotate = `${-10 + (i * 13) % 21}deg`;
          z = 2 + i;
        }
        const style = `left:${left};top:${top};width:${width};height:${height};transform:translate(-50%,-50%) rotate(${rotate});z-index:${z};box-shadow:${shadow};`;
        return { url, style };
      });
      if (images3dStyled.length > 0) {
        console.log('[PDF] --> Entrée dans la section PHOTOS 3D');
        const photos3dTemplate = await fs.promises.readFile(
          path.join(templatesDir, 'photos_3d_modern.html'),
          'utf-8'
        );
        const compiledPhotos3d = Handlebars.compile(photos3dTemplate);
        htmlContent += compiledPhotos3d({
          images: images3dStyled,
          explication_3d: pdfData.inputsRenovationBien?.explication_3d || ''
        });
        htmlContent += '<div class="page-break"></div>';
      }
    }

    // ===== SECTION ANALYSE DVF (KPI, graphique, tableau) =====
    if (includeSections.valuation_lk) {
      htmlContent += compiledSectionIntro({
        title: 'Analyse DVF',
        description: 'Basée sur les transactions immobilières autour du bien (voir annexe), nous calculons un prix moyen par mètre carré pour le bien (prix moyen de la sélection selection).',
        description_2: 'Nous calculons également un prix moyen par mètre carré pour l\'arrondissement (prix moyen de la sélection arrondissement) et pour les biens premium ce qui nous donne une indication du potentiel de rénovation du bien.',
        summary: 'Le prix moyen du mètre carré des appartements dans un rayon de ' + Math.round(Number(pdfData.inputsDvf?.rayon) * 1000) + ' mètres autour du bien est de <strong>' + formatKCurrency(pdfData.resultsDvfMetadata?.sel_final_avg,1) + '</strong>/m².'
      });
      console.log('[PDF] --> Entrée dans la section VALUATION_LK (modern)');
      // Préparation des données DVF
      const dvfTransactions = (project.dvfTransactions || []) as DvfTransaction[];
      const dvfTransactionsSorted = [...dvfTransactions].sort((a, b) => (b.date_mutation || '').localeCompare(a.date_mutation || ''));
      const trendSeries = (project.dvfSeries || []) as TrendSeries[];
      const trendSeriesSanitized = trendSeries.map(t => ({
        year: String(t.year ?? ''),
        selection_avg: Number(t.selection_avg ?? 0),
        selection_count: Number(t.selection_count ?? 0),
        arrondissement_avg: Number(t.arrondissement_avg ?? 0),
        arrondissement_count: Number(t.arrondissement_count ?? 0),
        premium_avg: Number(t.premium_avg ?? 0),
        premium_count: Number(t.premium_count ?? 0),
      }));

      // Génération du graphique d'évolution
      let trend_chart_url = '';
      if (trendSeriesSanitized.length > 0) {
        const y1Vals = trendSeriesSanitized.flatMap(t => [t.selection_avg, t.arrondissement_avg].map(v => v ? v / 1000 : null)).filter(v => v !== null);
        const y2Vals = trendSeriesSanitized.map(t => t.premium_avg ? t.premium_avg / 1000 : null).filter(v => v !== null);
        const y1Min = Math.floor(Math.min(...y1Vals) - 0.5);
        const y1Max = Math.ceil(Math.max(...y1Vals) + 0.5);
        const y2Min = Math.floor(Math.min(...y2Vals) - 0.5);
        const y2Max = Math.ceil(Math.max(...y2Vals) + 0.5);
        try {
          trend_chart_url = new QuickChart()
            .setConfig({
              type: 'line',
              data: {
                labels: trendSeriesSanitized.map(t => t.year),
                datasets: [
                  {
                    label: 'Sélection',
                    data: trendSeriesSanitized.map(t => t.selection_avg ? t.selection_avg / 1000 : null),
                    borderColor: '#1a237e',
                    backgroundColor: '#1a237e22',
                    yAxisID: 'y1',
                    fill: false,
                    pointRadius: 4,
                    borderWidth: 3,
                    lineTension: 0.4,
                  },
                  {
                    label: 'Arrondissement',
                    data: trendSeriesSanitized.map(t => t.arrondissement_avg ? t.arrondissement_avg / 1000 : null),
                    borderColor: '#388e3c',
                    backgroundColor: '#388e3c22',
                    yAxisID: 'y1',
                    fill: false,
                    pointRadius: 4,
                    borderWidth: 3,
                    lineTension: 0.4,
                  },
                  {
                    label: 'Premium (top 10%)',
                    data: trendSeriesSanitized.map(t => t.premium_avg ? t.premium_avg / 1000 : null),
                    borderColor: '#d32f2f',
                    backgroundColor: '#d32f2f22',
                    yAxisID: 'y2',
                    fill: false,
                    pointRadius: 4,
                    borderWidth: 3,
                    lineTension: 0.4,
                  }
                ]
              },
              options: {
                legend: { display: true, position: 'bottom' },
                title: { display: false },
                scales: {
                  yAxes: [
                    {
                      id: 'y1',
                      type: 'linear',
                      position: 'left',
                      scaleLabel: { display: true, labelString: 'k€/m²' },
                      ticks: { min: y1Min, max: y1Max }
                    },
                    {
                      id: 'y2',
                      type: 'linear',
                      position: 'right',
                      scaleLabel: { display: true, labelString: 'Premium (k€/m²)' },
                      ticks: { min: y2Min, max: y2Max },
                      gridLines: { drawOnChartArea: false }
                    }
                  ],
                  xAxes: [
                    { scaleLabel: { display: true, labelString: 'Année' } }
                  ]
                }
              }
            })
            .setWidth(600)
            .setHeight(220)
            .setBackgroundColor('transparent')
            .getUrl();
        } catch (err) {
          console.error('[PDF] Erreur génération graphique DVF:', err);
        }
      }

      // Préparation des métadonnées DVF
      const meta = pdfData.resultsDvfMetadata || {};
      const metaAny = meta as any;
      const safeMeta = {
        selection_total_count: getNumber(metaAny.selection_total_count),
        arrondissement_total_count: getNumber(metaAny.arrondissement_total_count),
        premium_total_count: getNumber(metaAny.premium_total_count),
        sel_final_avg: getNumber(metaAny.sel_final_avg),
        arr_final_avg: getNumber(metaAny.arr_final_avg),
        premium_final_avg: getNumber(metaAny.premium_final_avg),
        outlier_lower_bound: formatCurrency(getNumber(metaAny.outlier_lower_bound), '€', 0),
        outlier_upper_bound: formatCurrency(getNumber(metaAny.outlier_upper_bound), '€', 0),
        arrondissement_avg_for_outliers: getNumber(metaAny.arrondissement_avg_for_outliers)
      };

      // Génération de la page KPI/graphique/tableau
      const dvfTemplatePage2 = await fs.promises.readFile(
        path.join(templatesDir, 'dvf_valuation_modern_page2.html'),
        'utf-8'
      );
      const compiledDvfPage2 = Handlebars.compile(dvfTemplatePage2);
      htmlContent += compiledDvfPage2({
        resultsDvfMetadata: safeMeta,
        dvf_series: trendSeriesSanitized,
        trend_chart_url,
      });
      htmlContent += '<div class="page-break"></div>';
    }

    // ===== SECTION FINANCIAL =====
    if (includeSections.financial) {
      htmlContent += compiledSectionIntro({
        title: 'Données financières',
        description: 'Reprise de toutes les hypothèses du business plan, Synthèse des coûts, financement, marges et indicateurs financiers du projet.',
        description_2: 'Nous prenons une hypothèse de prix de vente du mètre carré conservateur par rapport au prix moyen du mètre carré des appartements avoisinants et du coefficient de pondération du bien.',
        summary: 'Selon les hypothèses de financement et de cout des travaux, le prix de revient sera de <strong>' + formatKCurrency(pdfData.resultsBusinessPlan?.couts_total, 0) + '</strong> et la marge nette sera de <strong>' + formatKCurrency(pdfData.resultsBusinessPlan?.resultats?.marge_nette, 0) + '</strong> (' + formatPercentage(pdfData.resultsBusinessPlan?.resultats?.rentabilite) + ').'
      });
      console.log('[PDF] --> Entrée dans la section FINANCIAL (modern)');
      const financialTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'financial_data_modern.html'),
        'utf-8'
      );
      const compiledFinancial = Handlebars.compile(financialTemplate);

      // Génération du graphique financier
      let vente_chart_url = '';
      try {
        const chart = new QuickChart();
        const prix_achat = pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_pondere_m2 || 0;
        const prix_revient = pdfData.resultsBusinessPlan?.prix_m2?.prix_revient_pondere_m2 || 0;
        const prix_vente = pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_pondere_m2 || 0;
        const prix_achat_carrez = pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_carrez_m2 || 0;
        const prix_revient_carrez = pdfData.resultsBusinessPlan?.prix_m2?.prix_revient_carrez_m2 || 0;
        const prix_vente_carrez = pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_carrez_m2 || 0;
        const prix_m2_benchmark = pdfData.resultsDvfMetadata?.sel_final_avg || null;

        const allVals = [prix_achat, prix_revient, prix_vente, prix_achat_carrez, prix_revient_carrez, prix_vente_carrez].filter(v => typeof v === 'number' && v > 0);
        const minVal = Math.min(...allVals);
        const yMin = Math.max(0, Math.floor(minVal - 500));

        const chartConfig = {
          type: 'bar',
          data: {
            labels: ['Achat (pondéré)', 'Revient (pondéré)', 'Vente (pondéré)', 'Achat (carrez)', 'Revient (carrez)', 'Vente (carrez)'],
            datasets: [
              {
                label: 'Prix/m²',
                data: [prix_achat, prix_revient, prix_vente, prix_achat_carrez, prix_revient_carrez, prix_vente_carrez],
                backgroundColor: ['#bfa77a', '#c97c2b', '#0a6c9d', '#bfa77a55', '#c97c2b55', '#0a6c9d55'],
              },
              ...(prix_m2_benchmark ? [{
                type: 'line',
                label: 'Benchmark',
                data: [prix_m2_benchmark, prix_m2_benchmark, prix_m2_benchmark, prix_m2_benchmark, prix_m2_benchmark, prix_m2_benchmark],
                borderColor: '#e53e3e',
                borderDash: [8, 4],
                fill: false,
                pointRadius: 0,
                order: 2
              }] : [])
            ]
          },
          options: {
            plugins: { legend: { display: true } },
            scales: {
              yAxes: [{
                display: true,
                scaleLabel: { display: true, labelString: 'Prix (€/m²)' },
                ticks: { min: yMin }
              }],
              y: { title: { display: true, text: 'Prix (€/m²)' }, min: yMin },
              x: { title: { display: true, text: 'Type' } }
            }
          }
        };

        chart.setConfig(chartConfig);
        chart.setWidth(700).setHeight(320).setBackgroundColor('transparent');
        vente_chart_url = chart.getUrl();
      } catch (err) {
        console.error('[PDF] Erreur génération graphique vente:', err);
      }

      const financialData = {
        ...pdfData,
        vente_chart_url,
        prix_m2_vente_pondere: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_pondere_m2,
        prix_m2_vente_carrez: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_carrez_m2,
        ...(pdfData.pdf_config?.dynamic_fields || {})
      };
      htmlContent += compiledFinancial(financialData);
    }

    // ===== SECTION TRANSACTIONS DVF (pagination) =====
    if (includeSections.valuation_lk) {
      htmlContent += compiledSectionIntro({
        title: 'Annexe : Transactions DVF',
        description: 'Liste détaillée des transactions immobilières utilisées pour l\'analyse comparative.'
      });
      // Préparation des données DVF
      const dvfTransactions = (project.dvfTransactions || []) as DvfTransaction[];
      const dvfTransactionsSorted = [...dvfTransactions].sort((a, b) => (b.date_mutation || '').localeCompare(a.date_mutation || ''));
      const pageSize = 20;
      const numPages = Math.ceil(dvfTransactionsSorted.length / pageSize) || 1;

      // Lecture du template
      const dvfTemplatePage1 = await fs.promises.readFile(
        path.join(templatesDir, 'dvf_valuation_modern.html'),
        'utf-8'
      );
      const compiledDvfPage1 = Handlebars.compile(dvfTemplatePage1);

      // Préparation du cercle pour la carte
      let circlePolyline = '';
      let rayon_m = 0;
      if (pdfData.latitude && pdfData.longitude && pdfData.inputsDvf?.rayon) {
        rayon_m = Math.round(Number(pdfData.inputsDvf.rayon) * 1000);
        circlePolyline = encodeCirclePolyline(pdfData.latitude, pdfData.longitude, rayon_m);
      }

      // Génération des pages de transactions
      for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
        const pageTransactions = dvfTransactionsSorted.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);
        htmlContent += compiledDvfPage1({
          ...pdfData,
          dvf_transactions: pageTransactions,
          lat: pdfData.latitude,
          lng: pdfData.longitude,
          description_quartier: pdfData.inputsGeneral?.description_quartier || '',
          page: 1,
          circle_polyline: circlePolyline,
          rayon_m
        });
        htmlContent += '<div class="page-break"></div>';
      }
    }

    htmlContent += '</body></html>';

    // DEBUG: Sauvegarder le HTML généré
    const tempHtmlPath = `/data/lki/pdf_modern_debug_${projectId}.html`;
    try {
      fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
      console.log(`[PDF DEBUG] HTML moderne sauvegardé dans ${tempHtmlPath}`);
    } catch (err) {
      console.error('[PDF DEBUG] Erreur lors de la sauvegarde du HTML:', err);
    }

    // 5. Génération du PDF avec Puppeteer
    console.log('[PDF] Début de la génération du PDF moderne avec Puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Configurer Puppeteer pour accéder aux fichiers locaux
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.resourceType() === 'image') {
        const url = request.url();
        if (url.startsWith('/data/lki/')) {
          const filePath = url;
          try {
            const imageBuffer = fs.readFileSync(filePath);
            request.respond({
              status: 200,
              contentType: 'image/png',
              body: imageBuffer
            });
          } catch (error) {
            console.error(`Erreur lors de la lecture de l'image ${filePath}:`, error);
            request.abort();
          }
        } else {
          request.continue();
        }
      } else {
        request.continue();
      }
    });

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });
    await browser.close();
    console.log('[PDF] PDF moderne généré avec succès');

    // 6. Envoi du PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Business_Plan_Modern_${project_title.replace(/\s+/g, '_')}.pdf`);
    res.end(pdf);

  } catch (error) {
    console.error('Erreur lors de la génération du PDF moderne:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du PDF moderne',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

export default router;
