import express, { Request, Response, Router } from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import * as Handlebars from 'handlebars';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { ProjectService } from '../services/project.service';
import { PdfMappingService } from '../services/pdfMappingService';
import { PdfConfigSchema, PdfConfig, PdfData } from '../../../shared/types/pdf';
import { PdfMappingClosingService } from '../services/pdfMappingClosing';
import { PlansMigrationService } from '../services/plansMigration.service';
import { PlanPhoto } from '../../../shared/types/photos';
import sharp from 'sharp';
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
Handlebars.registerHelper('divide', (a: number, b: number) => b !== 0 ? a / b : 0);
Handlebars.registerHelper('round', (a: number) => Math.round(a));
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});
Handlebars.registerHelper('lt', function (a: number, b: number) {
  return a < b;
});
Handlebars.registerHelper('gt', function (a: number, b: number) {
  return a > b;
});
Handlebars.registerHelper('subtract', function(a: number, b: number) {
  return (Number(a) || 0) - (Number(b) || 0);
});
    Handlebars.registerHelper('mod', function(a: number, b: number) {
      return (Number(a) || 0) % (Number(b) || 1);
});

// Helper pour la couleur d'écart
Handlebars.registerHelper('ecartColor', function(realise, prevu, type) {
  if (type === 'cout' || type === 'duree') {
    return (Number(realise) <= Number(prevu)) ? 'color: #16a34a; font-weight:700' : 'color: #d32f2f; font-weight:700';
  }
  // type === 'marge' ou 'prix'
  return (Number(realise) >= Number(prevu)) ? 'color: #16a34a; font-weight:700' : 'color: #d32f2f; font-weight:700';
});

// Fonction pour convertir une image en base64 (avec optimisation pour logos/covers)
const imageToBase64 = async (filePath: string, optimize: boolean = true): Promise<string> => {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`[PDF] Image non trouvée: ${filePath}`);
      return '';
    }
    
    const originalBuffer = fs.readFileSync(filePath);
    const originalSizeKB = originalBuffer.length / 1024;
    
    // Optimiser les logos/covers si > 100KB
    if (optimize && originalSizeKB > 100) {
      try {
        const optimizedBuffer = await sharp(originalBuffer)
          .resize(800, null, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80 })
          .toBuffer();
        
        const optimizedSizeKB = optimizedBuffer.length / 1024;
        console.log(`[PDF] Logo/Cover optimisé: ${path.basename(filePath)} - ${originalSizeKB.toFixed(2)}KB -> ${optimizedSizeKB.toFixed(2)}KB`);
        return `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;
      } catch (err) {
        console.error(`[PDF] Erreur optimisation logo/cover ${filePath}:`, err);
        // Fallback sur l'original
      }
    }
    
    return `data:image/${path.extname(filePath).slice(1)};base64,${originalBuffer.toString('base64')}`;
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
          title: { 
            display: true, 
            text: 'k€/m²',
            font: {
              size: 24,
              weight: 'bold'
            }
          },
          min: 9,
          max: 18,
          ticks: {
            font: {
              size: 20,
              weight: 'bold'
            }
          }
        },
        y2: {
          type: 'linear',
          position: 'right',
          title: { 
            display: true, 
            text: 'Premium (k€/m²)',
            font: {
              size: 24,
              weight: 'bold'
            }
          },
          min: 9,
          max: 18,
          grid: { drawOnChartArea: false },
          ticks: {
            font: {
              size: 20,
              weight: 'bold'
            }
          }
        },
        x: { 
          title: { 
            display: true, 
            text: 'Année',
            font: {
              size: 24,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: 20,
              weight: 'bold'
            }
          }
        }
      }
    }
  });
  chart.setWidth(500).setHeight(280).setBackgroundColor('transparent');
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
        y: { 
          title: { 
            display: true, 
            text: 'Nombre de transactions',
            font: {
              size: 24,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: 20,
              weight: 'bold'
            }
          }
        },
        x: { 
          title: { 
            display: true, 
            text: 'Prix/m² (k€)',
            font: {
              size: 24,
              weight: 'bold'
            }
          },
          ticks: {
            font: {
              size: 20,
              weight: 'bold'
            }
          }
        }
      }
    }
  });
  chart.setWidth(500).setHeight(250).setBackgroundColor('transparent');
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
    
    // Utiliser le nouveau PdfMappingService pour extraire les données
    const pdfData = PdfMappingService.mapProjectToPdfData(project, validatedConfig || {});

    // 1. Préparation des données
    const project_title = project.projectTitle || 'Sans titre';
    const dynamicFields = req.body.dynamicFields || {};

    // 2. Préparation des assets
    const logo_path = '/data/lki/uploads/LOGO-LK-noir_2025.png';
    const cover_image_path = '/data/lki/uploads/cover_LKI.png';
    const css_path = path.join(__dirname, '..', 'static', 'pdf_assets', 'styles_new.css');

    // Conversion des images logo/cover en base64 pour garantir leur affichage (avec optimisation)
    const logo_base64 = await imageToBase64(logo_path, true);
    const cover_image_base64 = await imageToBase64(cover_image_path, true);

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

    // 4. Génération des sections (toujours toutes incluses)

    // Page de couverture
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

    // Sommaire
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

    // Description du bien
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

      // Note: Cette section semble être du code legacy, on la garde pour compatibilité
      // mais elle ne devrait pas être utilisée dans le flux moderne
      const propertyTemplateLegacy = await fs.promises.readFile(
        path.join(templatesDir, 'property_description_modern.html'),
        'utf-8'
      );
      const compiledPropertyLegacy = Handlebars.compile(propertyTemplateLegacy);
      htmlContent += compiledPropertyLegacy(propertyData);
      htmlContent += '<div class="page-break"></div>';

    // Valorisation LK

      const valuationLkTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'valuation_lk_invest.html'),
        'utf-8'
      );
      const compiledValuationLk = Handlebars.compile(valuationLkTemplate);

      // Génération dynamique des tables DVF à partir des liaisons one-to-many
      const dvfTransactions: any[] = (project.dvfTransactions || []) as any[];
      const trendSeries: any[] = (project.dvfSeries || []) as any[];
      // Mapping explicite sur d.data
      const distributionSeries = (project.dvfDistributions || [])
        .map((d, i) => {
          const entry: any = d;
          const obj = entry && entry.data ? entry.data : entry;
          if (!obj || (!obj.bin && !obj.prixM2)) {
            return null;
          }
          let prixM2 = obj.prixM2;
          if (obj.bin && typeof obj.bin === 'string') {
            const [minStr, maxStr] = obj.bin.split('-');
            const min = parseFloat(minStr.replace('k', '000'));
            const max = parseFloat(maxStr.replace('k', '000'));
            prixM2 = (min + max) / 2;
          }
          const res = {
            ...obj,
            prixM2,
            nombreTransactions: obj.count ?? obj.nombreTransactions ?? 0
          };
          return res;
        })
        .filter(Boolean); // On enlève les nulls
      // Log la structure finale

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

    // Données financières
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

      // Recalcule de secours: surface pondérée après travaux si absente/NaN/0 (logs détaillés retirés)
      let surfacePondereeApres = pdfData.inputsBusinessPlan?.surface_ponderee_apres_travaux as unknown as number | undefined;
      const hasInvalidOrZero = (typeof surfacePondereeApres !== 'number') || isNaN(surfacePondereeApres) || surfacePondereeApres === 0;
      if (hasInvalidOrZero && pdfData.inputsGeneral) {
        const bpCarrez = Number(pdfData.inputsBusinessPlan?.surface_carrez_apres_travaux || 0);
        const bpTerrasse = Number(pdfData.inputsBusinessPlan?.surface_terrasse_apres_travaux || 0);
      // Utiliser uniquement les données du business plan (pas de fallback renovation)
      const carrez = bpCarrez;
      const terrasse = bpTerrasse;
        const ponderation = Number(pdfData.inputsGeneral.ponderation_terrasse || 0);
        surfacePondereeApres = carrez + (terrasse * ponderation);
        // logs détaillés supprimés
      }

      const financialData = {
        ...pdfData,
        // Surfaces et pondération
        surface_carrez_apres_travaux: pdfData.inputsBusinessPlan?.surface_carrez_apres_travaux,
        surface_terrasse_apres_travaux: pdfData.inputsBusinessPlan?.surface_terrasse_apres_travaux,
        coef_ponderation: pdfData.inputsGeneral?.ponderation_terrasse,
        surface_ponderee_apres_travaux: surfacePondereeApres,

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

    htmlContent += '</body></html>';

    // 5. Génération du PDF avec Puppeteer
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
    const dynamicFields = req.body.dynamicFields || {};

    // 2. Préparation des assets
    const logo_path = '/data/lki/uploads/LOGO-LK-noir_2025.png';
    const cover_image_path = '/data/lki/uploads/cover_LKI.png';
    const css_path = path.join(__dirname, '..', 'static', 'pdf_assets', 'styles_modern.css');

    // Conversion des images logo/cover en base64
    const logo_base64 = await imageToBase64(logo_path, true);
    const cover_image_base64 = await imageToBase64(cover_image_path, true);

    // 3. Lecture des templates et du CSS
    const templatesDir = path.join(__dirname, '..', 'templates');
    const cssContent = await fs.promises.readFile(css_path, 'utf-8');
    
    // Enregistrer le helper Handlebars pour détecter les PDFs
    Handlebars.registerHelper('or', function(a: any, b: any) {
      return a || b;
    });
    Handlebars.registerHelper('lt', function(a: number, b: number) {
      return a < b;
    });
    Handlebars.registerHelper('gt', function(a: number, b: number) {
      return a > b;
    });
    Handlebars.registerHelper('contains', function(str: string, substr: string) {
      return str && str.includes(substr);
    });
    Handlebars.registerHelper('add', function(a: number, b: number) {
      return (Number(a) || 0) + (Number(b) || 0);
    });

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
    // Pas de page-break explicite ici car la couverture a déjà page-break-after: always dans son CSS

    // Note: La page description quartier sera ajoutée après la page description bien

    // ===== SOMMAIRE =====
    // Génère la liste des sections principales pour le sommaire
    const tocSections = [];
    tocSections.push({ key: 'section1', label: 'Description du bien' });
    tocSections.push({ key: 'section2', label: 'Rénovation Détaillée' });
    // Ajouter "Suivi du projet" seulement s'il y a des photos during ou after
    const hasDuring = (project.photos?.during || []).length > 0;
    const hasAfter = (project.photos?.after || []).length > 0;
    if (hasDuring || hasAfter) {
      tocSections.push({ key: 'section3', label: 'Suivi du projet' });
    }
    tocSections.push({ key: 'section4', label: 'Justificatif du prix' });
    tocSections.push({ key: 'section5', label: 'Données financières' });
    tocSections.push({ key: 'section6', label: 'Annexes' });

    // Calcul du numéro de page de départ pour les sections
    // Page 1 = Couverture
    // Page 2 = Sommaire
    // Page 3 = Titre Section 1
    let startPageNumber = 1;
    startPageNumber++; // Couverture
    startPageNumber++; // Le sommaire lui-même
    
    // Ajouter le numéro de page calculé à chaque section
    // Chaque section principale commence par une page de titre
    let currentPage = startPageNumber;
    const tocSectionsWithPages = tocSections.map((section, index) => {
      const pageNumber = currentPage;
      // Chaque section prend au moins 1 page (la page de titre)
      // On estime ensuite le nombre de pages pour le contenu
      let estimatedContentPages = 1;
      if (section.key === 'section1') {
        // Description bien (2 pages) + quartier (1) + photos avant (1-2) + caractéristiques (1)
        estimatedContentPages = 4;
      } else if (section.key === 'section2') {
        // Plans (1-2) + 3D (1)
        estimatedContentPages = 3;
      } else if (section.key === 'section3') {
        // Photos pendant/après (1-2 si existantes)
        estimatedContentPages = (hasDuring || hasAfter) ? 2 : 1;
      } else if (section.key === 'section4') {
        // Analyse DVF (2-3 pages)
        estimatedContentPages = 1;
      } else if (section.key === 'section5') {
        // Financial data (1) + Mondrian (1) + Chart (1)
        estimatedContentPages = 6;
      } else if (section.key === 'section6') {
        // Transactions DVF (plusieurs pages)
        const dvfCount = (project.dvfTransactions || []).length;
        estimatedContentPages = Math.max(1, Math.ceil(dvfCount / 20));
      }
      currentPage += 1 + estimatedContentPages; // +1 pour la page de titre
      return {
        ...section,
        pageNumber: pageNumber
      };
    });

    const tocTemplate = await fs.promises.readFile(
      path.join(templatesDir, 'toc_modern.html'),
      'utf-8'
    );
    const compiledToc = Handlebars.compile(tocTemplate);
    htmlContent += compiledToc({ sections: tocSectionsWithPages });

    // Prépare le template d'intro
    const sectionIntroTemplate = await fs.promises.readFile(
      path.join(templatesDir, 'section_intro.html'),
      'utf-8'
    );
    const compiledSectionIntro = Handlebars.compile(sectionIntroTemplate);

    // ===== SECTION 1: DESCRIPTION DU BIEN =====
    htmlContent += compiledSectionIntro({
      title: 'Description du bien',
      description: 'Présentation détaillée du bien immobilier, de son environnement et de ses caractéristiques principales.',
      description_2: '',
      summary: ''
    });

    // Charger les templates pour les pages property (en dehors des blocs pour accessibilité)
    const propertyPage1Template = await fs.promises.readFile(
      path.join(templatesDir, 'property_description_page1_modern.html'),
      'utf-8'
    );
    const compiledPropertyPage1 = Handlebars.compile(propertyPage1Template);
    
    const propertyPage2Template = await fs.promises.readFile(
      path.join(templatesDir, 'property_description_page2_modern.html'),
      'utf-8'
    );
    const compiledPropertyPage2 = Handlebars.compile(propertyPage2Template);

    // ===== SECTION PROPERTY (DESCRIPTION DU BIEN) =====
    {
      // Récupérer la photo de couverture
      let coverPhotoUrl = null;
      if (project.photos?.coverPhoto) {
        const coverPhotoPath = project.photos.coverPhoto;
        // Chercher la photo dans tous les tableaux de photos
        const allPhotos = [
          ...(project.photos?.before || []),
          ...(project.photos?.plans || []),
          ...(project.photos?.['3d'] || []),
          ...(project.photos?.during || []),
          ...(project.photos?.after || [])
        ];
        // Trouver la photo correspondante par chemin
        const coverPhoto = allPhotos.find(p => {
          const photoUrl = p.url || '';
          return photoUrl === coverPhotoPath || 
                 photoUrl.endsWith(coverPhotoPath) ||
                 coverPhotoPath.endsWith(photoUrl) ||
                 photoUrl.includes(coverPhotoPath) ||
                 coverPhotoPath.includes(photoUrl);
        });
        // Utiliser makeHttpUrl comme pour les autres photos
        if (coverPhoto?.url) {
          coverPhotoUrl = makeHttpUrl(coverPhoto.url);
        } else {
          // Fallback : utiliser directement le chemin avec makeHttpUrl
          coverPhotoUrl = makeHttpUrl(coverPhotoPath);
        }
      }
      // Préparation des impacts et couleur coef
      const impacts = pdfData.resultsDescriptionBien?.impacts || [];
      
      // Traduction des valeurs en français
      const translations: Record<string, Record<string, string>> = {
        'Vue': {
          'Exceptional': 'Exceptionnelle',
          'Good': 'Bonne',
          'Average': 'Moyenne',
          'Poor': 'Faible'
        },
        'Étage': {
          'High (≥ 5th)': 'Élevé (≥ 5ème)',
          'Mid (2nd-4th)': 'Moyen (2ème-4ème)',
          'Low (1st)': 'Bas (1er)',
          'Ground Floor': 'Rez-de-chaussée'
        },
        'Ascenseur': {
          'Yes': 'Oui',
          'No': 'Non'
        },
        'Extérieur': {
          'Large (≥ 50 m²)': 'Grande (≥ 50 m²)',
          'Medium (20-49 m²)': 'Moyenne (20-49 m²)',
          'Small (5-19 m²)': 'Petite (5-19 m²)',
          'None (< 5 m²)': 'Aucune (< 5 m²)'
        },
        'Adresse': {
          'Highly Sought-After': 'Très recherchée',
          'Moderately Sought-After': 'Modérément recherchée',
          'Standard': 'Standard'
        },
        'État': {
          'Renovated by Architect': 'Rénové par architecte',
          'Simply Renovated': 'Simplement rénové',
          'Good Condition': 'Bon état',
          'Needs Refreshing': 'À rafraîchir',
          'Needs Renovation': 'À rénover'
        }
      };
      
      // Traduction des descriptions en français
      const descriptionTranslations: Record<string, string> = {
        'Impact de la qualité de la vue': 'Impact de la qualité de la vue',
        'Impact de la hauteur et de l\'ascenseur': 'Impact de la hauteur et de l\'ascenseur',
        'Impact de l\'ascenseur': 'Impact de l\'ascenseur',
        'Impact de la surface extérieure': 'Impact de la surface extérieure',
        'Impact de la qualité de l\'adresse': 'Impact de la qualité de l\'adresse',
        'Impact de l\'état du bien': 'Impact de l\'état du bien',
        'Impact du nombre de pièces': 'Impact du nombre de pièces'
      };
      
      // Formater les impacts : multiplier par 100, ajouter signe, traduire
      const formatImpact = (impact: any) => {
        const impactPercent = (impact.impact * 100).toFixed(0);
        const sign = impact.impact > 0 ? '+' : '';
        const translatedValue = translations[impact.parameter]?.[impact.value] || impact.value;
        const translatedDescription = descriptionTranslations[impact.description] || impact.description;
        return {
          ...impact,
          value: translatedValue,
          description: translatedDescription,
          impactFormatted: `${sign}${impactPercent}%`,
          impactValue: impact.impact
        };
      };
      
      const formattedImpacts = impacts.map(formatImpact);
      // Séparer le nombre de pièces des autres impacts
      const piecesImpact = formattedImpacts.find(imp => imp.parameter === 'PIÈCES' || imp.description === 'Impact du nombre de pièces');
      const otherImpacts = formattedImpacts.filter(imp => imp.parameter !== 'PIÈCES' && imp.description !== 'Impact du nombre de pièces');
      
      // Réorganiser l'ordre : Adresse, Vue (ligne 1), Ascenseur, Étage (ligne 2), État, Extérieur (ligne 3)
      const order = ['Adresse', 'Vue', 'Ascenseur', 'Étage', 'État', 'Extérieur'];
      const orderedImpacts = order.map(param => otherImpacts.find(imp => imp.parameter === param)).filter(Boolean);
      const remainingImpacts = otherImpacts.filter(imp => !order.includes(imp.parameter));
      const finalOrderedImpacts = [...orderedImpacts, ...remainingImpacts];
      
      const impacts_col1 = [finalOrderedImpacts[0], finalOrderedImpacts[1]].filter(Boolean); // Adresse, Vue
      const impact_col2 = finalOrderedImpacts[2]; // Ascenseur
      const impacts_col3 = [finalOrderedImpacts[3], finalOrderedImpacts[4]].filter(Boolean); // Étage, État
      const impact_col4 = finalOrderedImpacts[5]; // Extérieur
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
        coverPhoto: coverPhotoUrl,
        summary: 'Après rénovation on pourra appliquer un coefficient de pondération de <strong>' + pdfData.resultsDescriptionBien?.coef_ponderation + '</strong> par rapport au prix moyen du mètre carré des appartements avoisinants.',
        impacts_col1,
        impact_col2,
        impacts_col3,
        impact_col4,
        piecesImpact,
        coef_class,
        ...(pdfData.pdf_config?.dynamic_fields || {})
      };
      
      // Générer la page 1 (description adresse)
      htmlContent += compiledPropertyPage1(propertyData);
      // Pas de page-break explicite car les pages ont déjà page-break-after dans leur CSS
    }

    // ===== PAGE CARTE ET DESCRIPTION QUARTIER (APRÈS DESCRIPTION ADRESSE, AVANT PHOTOS) =====
    if (pdfData.latitude && pdfData.longitude && pdfData.inputsGeneral?.description_quartier) {
      const mapQuartierTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'map_quartier_modern.html'),
          'utf-8'
        );
      const compiledMapQuartier = Handlebars.compile(mapQuartierTemplate);
        const mapQuartierData = {
          adresse: pdfData.adresse,
          lat: pdfData.latitude,
          lng: pdfData.longitude,
          description_quartier: pdfData.inputsGeneral.description_quartier
        };
      htmlContent += compiledMapQuartier(mapQuartierData);
    }

    // ===== SECTION PHOTOS BEFORE (APRÈS DESCRIPTION QUARTIER, AVANT CARACTÉRISTIQUES) =====
    if ((pdfData.selectedBeforePhotosForPdf || []).length > 0) {
      const imagesRaw = pdfData.selectedBeforePhotosForPdf || [];
      const photoCount = imagesRaw.length;
      
      // Calculer la grille optimale : nombre de colonnes et lignes
      // Pour tenir sur une page (100vh), on calcule dynamiquement
      
      // Calculer le nombre de colonnes optimal
      let cols = 3;
      if (photoCount <= 4) cols = 2;
      else if (photoCount <= 6) cols = 3;
      else if (photoCount <= 9) cols = 3;
      else if (photoCount <= 12) cols = 4;
      else cols = 4;
      
      const rows = Math.ceil(photoCount / cols);
      
      // Utiliser des unités CSS (vh/vw) pour le calcul
      // On a environ 100vh de hauteur totale, le titre prend ~5vh, padding ~3vh, marge bas ~2vh
      // Donc ~90vh disponibles pour les photos
      const titleHeightVh = 5;
      const paddingVh = 3;
      const marginBottomVh = 2; // Marge en bas
      const gapVh = 1.2; // Gap en vh
      const availableHeightVh = 100 - titleHeightVh - paddingVh - marginBottomVh;
      
      // Calculer la hauteur de chaque photo en vh
      const totalGapsHeightVh = (rows - 1) * gapVh;
      const photoHeightVh = (availableHeightVh - totalGapsHeightVh) / rows;
      
      // Pour la largeur, on utilise vw (100vw - padding - gaps)
      const paddingVw = 3;
      const gapVw = 1.2;
      const totalGapsWidthVw = (cols - 1) * gapVw;
      const availableWidthVw = 100 - paddingVw - totalGapsWidthVw;
      const photoWidthVw = availableWidthVw / cols;
      
      // Convertir en valeurs pour le template
      const finalWidthVw = Math.max(photoWidthVw, 15); // Minimum 15vw
      const finalHeightVh = Math.max(photoHeightVh, 12); // Minimum 12vh
      
      const imagesStyled = imagesRaw.map((url, i) => {
        return { url };
      });
      
      // DEBUG: Logs détaillés
      console.log('=== DEBUG PHOTOS AVANT TRAVAUX ===');
      console.log(`imagesRaw.length: ${imagesRaw.length}`);
      console.log(`imagesStyled.length: ${imagesStyled.length}`);
      console.log(`photoCount: ${photoCount}`);
      console.log(`cols: ${cols}, rows: ${rows}`);
      console.log(`photoWidthVw: ${finalWidthVw}, photoHeightVh: ${finalHeightVh}`);
      console.log(`availableHeightVh: ${availableHeightVh}, totalGapsHeightVh: ${totalGapsHeightVh}`);
      console.log(`Premières URLs:`, imagesRaw.slice(0, 5));
      console.log('==================================');
      
      if (imagesStyled.length > 0) {
        const photosTemplate = await fs.promises.readFile(
          path.join(templatesDir, 'photos_before_modern.html'),
          'utf-8'
        );
        const compiledPhotos = Handlebars.compile(photosTemplate);
        const renderedHtml = compiledPhotos({ 
          images: imagesStyled,
          photoCount,
          cols,
          rows,
          photoWidthVw: finalWidthVw,
          photoHeightVh: finalHeightVh,
          gapVw: gapVw,
          gapVh: gapVh
        });
        
        // DEBUG: Vérifier combien de photos sont dans le HTML rendu
        const photoItemCount = (renderedHtml.match(/<div class="photo-item">/g) || []).length;
        console.log(`[DEBUG] Nombre de <div class="photo-item"> dans le HTML rendu: ${photoItemCount}`);
        
        htmlContent += renderedHtml;
        // Pas besoin de page-break supplémentaire car le template a déjà page-break-after: always
      }
    }

    // ===== PAGE 2 CARACTÉRISTIQUES (APRÈS PHOTOS) =====
    {
      // Récupérer la photo de couverture (même logique que pour la page 1)
      let coverPhotoUrlPage2 = null;
      if (project.photos?.coverPhoto) {
        const coverPhotoPath = project.photos.coverPhoto;
        const allPhotos = [
          ...(project.photos?.before || []),
          ...(project.photos?.plans || []),
          ...(project.photos?.['3d'] || []),
          ...(project.photos?.during || []),
          ...(project.photos?.after || [])
        ];
        const coverPhoto = allPhotos.find(p => {
          const photoUrl = p.url || '';
          return photoUrl === coverPhotoPath || 
                 photoUrl.endsWith(coverPhotoPath) ||
                 coverPhotoPath.endsWith(photoUrl) ||
                 photoUrl.includes(coverPhotoPath) ||
                 coverPhotoPath.includes(photoUrl);
        });
        if (coverPhoto?.url) {
          coverPhotoUrlPage2 = makeHttpUrl(coverPhoto.url);
        } else {
          coverPhotoUrlPage2 = makeHttpUrl(coverPhotoPath);
        }
      }
      
      // Recalculer les impacts pour la page 2 (même logique que page 1)
      const impactsPage2 = pdfData.resultsDescriptionBien?.impacts || [];
      const translations: Record<string, Record<string, string>> = {
        'Vue': {
          'Exceptional': 'Exceptionnelle',
          'Good': 'Bonne',
          'Average': 'Moyenne',
          'Poor': 'Faible'
        },
        'Étage': {
          'High (≥ 5th)': 'Élevé (≥ 5ème)',
          'Mid (2nd-4th)': 'Moyen (2ème-4ème)',
          'Low (1st)': 'Bas (1er)',
          'Ground Floor': 'Rez-de-chaussée'
        },
        'Ascenseur': {
          'Yes': 'Oui',
          'No': 'Non'
        },
        'Extérieur': {
          'Large (≥ 50 m²)': 'Grande (≥ 50 m²)',
          'Medium (20-49 m²)': 'Moyenne (20-49 m²)',
          'Small (5-19 m²)': 'Petite (5-19 m²)',
          'None (< 5 m²)': 'Aucune (< 5 m²)'
        },
        'Adresse': {
          'Highly Sought-After': 'Très recherchée',
          'Moderately Sought-After': 'Modérément recherchée',
          'Standard': 'Standard'
        },
        'État': {
          'Renovated by Architect': 'Rénové par architecte',
          'Simply Renovated': 'Simplement rénové',
          'Good Condition': 'Bon état',
          'Needs Refreshing': 'À rafraîchir',
          'Needs Renovation': 'À rénover'
        }
      };
      const descriptionTranslations: Record<string, string> = {
        'Impact de la qualité de la vue': 'Impact de la qualité de la vue',
        'Impact de la hauteur et de l\'ascenseur': 'Impact de la hauteur et de l\'ascenseur',
        'Impact de l\'ascenseur': 'Impact de l\'ascenseur',
        'Impact de la surface extérieure': 'Impact de la surface extérieure',
        'Impact de la qualité de l\'adresse': 'Impact de la qualité de l\'adresse',
        'Impact de l\'état du bien': 'Impact de l\'état du bien',
        'Impact du nombre de pièces': 'Impact du nombre de pièces'
      };
      const formatImpact = (impact: any) => {
        const impactPercent = (impact.impact * 100).toFixed(0);
        const sign = impact.impact > 0 ? '+' : '';
        const translatedValue = translations[impact.parameter]?.[impact.value] || impact.value;
        const translatedDescription = descriptionTranslations[impact.description] || impact.description;
        return {
          ...impact,
          value: translatedValue,
          description: translatedDescription,
          impactFormatted: `${sign}${impactPercent}%`,
          impactValue: impact.impact
        };
      };
      const formattedImpactsPage2 = impactsPage2.map(formatImpact);
      const piecesImpactPage2 = formattedImpactsPage2.find(imp => imp.parameter === 'PIÈCES' || imp.description === 'Impact du nombre de pièces');
      const otherImpactsPage2 = formattedImpactsPage2.filter(imp => imp.parameter !== 'PIÈCES' && imp.description !== 'Impact du nombre de pièces');
      
      // Réorganiser l'ordre : Adresse, Vue (ligne 1), Ascenseur, Étage (ligne 2), État, Extérieur (ligne 3)
      const orderPage2 = ['Adresse', 'Vue', 'Ascenseur', 'Étage', 'État', 'Extérieur'];
      const orderedImpactsPage2 = orderPage2.map(param => otherImpactsPage2.find(imp => imp.parameter === param)).filter(Boolean);
      const remainingImpactsPage2 = otherImpactsPage2.filter(imp => !orderPage2.includes(imp.parameter));
      const finalOrderedImpactsPage2 = [...orderedImpactsPage2, ...remainingImpactsPage2];
      
      const impacts_col1_page2 = [finalOrderedImpactsPage2[0], finalOrderedImpactsPage2[1]].filter(Boolean); // Adresse, Vue
      const impact_col2_page2 = finalOrderedImpactsPage2[2]; // Ascenseur
      const impacts_col3_page2 = [finalOrderedImpactsPage2[3], finalOrderedImpactsPage2[4]].filter(Boolean); // Étage, État
      const impact_col4_page2 = finalOrderedImpactsPage2[5]; // Extérieur
      const coefPage2 = pdfData.resultsDescriptionBien?.coef_ponderation ?? 1;
      let coef_class_page2 = 'coef-blue';
      if (coefPage2 >= 1.2) coef_class_page2 = 'coef-red';
      else if (coefPage2 >= 1.1) coef_class_page2 = 'coef-orange';
      
      const propertyDataPage2 = {
        ...pdfData,
        adresse: pdfData.adresse,
        prix_achat: pdfData.inputsBusinessPlan?.prix_achat,
        prix_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_pondere_m2,
        coefficient: pdfData.inputsGeneral?.ponderation_terrasse,
        images: pdfData.selectedBeforePhotosForPdf,
        description: pdfData.pdf_config?.dynamic_fields?.description_general,
        coverPhoto: coverPhotoUrlPage2,
        summary: 'Après rénovation on pourra appliquer un coefficient de pondération de <strong>' + pdfData.resultsDescriptionBien?.coef_ponderation + '</strong> par rapport au prix moyen du mètre carré des appartements avoisinants.',
        impacts_col1: impacts_col1_page2,
        impact_col2: impact_col2_page2,
        impacts_col3: impacts_col3_page2,
        impact_col4: impact_col4_page2,
        piecesImpact: piecesImpactPage2,
        coef_class: coef_class_page2,
        ...(pdfData.pdf_config?.dynamic_fields || {})
      };
      
      // Générer la page 2 (caractéristiques)
      htmlContent += compiledPropertyPage2(propertyDataPage2);
    }

    // ===== SECTION 2: RÉNOVATION DÉTAILLÉE =====
    const hasPlans = (project.photos?.selectedPlansPhotosForPdf || []).length > 0;
    const has3d = (project.photos?.selected3dPhotosForPdf || []).length > 0;
    if (hasPlans || has3d) {
      htmlContent += compiledSectionIntro({
        title: 'Rénovation Détaillée',
        description: 'Plans architecturaux et visualisations 3D du projet de rénovation.',
        description_2: '',
        summary: ''
      });
    }

    // ===== SECTION PLANS =====
    if ((project.photos?.selectedPlansPhotosForPdf || []).length > 0 && project.photos) {
      // Utiliser plansStructured si disponible, sinon migrer depuis plans
      const plansStructure = PlansMigrationService.mergePlansData(project.photos);
      
      if (plansStructure) {
        // Organiser les plans sélectionnés par type et étage
        // S'assurer que les IDs sont des nombres pour la comparaison
        const selectedIdsRaw = project.photos?.selectedPlansPhotosForPdf || [];
        const selectedIds = new Set(selectedIdsRaw.map(id => typeof id === 'string' ? parseInt(id, 10) : id));
        
        const organizePlans = (plans: PlanPhoto[] | undefined, section: string): Array<{url: string, floorLabel: string}> => {
          if (!plans) {
            return [];
          }
          const filtered = plans
            .filter(p => {
              const planId = typeof p.id === 'string' ? parseInt(p.id, 10) : p.id;
              const isSelected = selectedIds.has(planId);
              return isSelected;
            })
            .map(p => ({
              url: makeHttpUrl(p.url),
              floorLabel: p.floorLabel || PlansMigrationService.getFloorLabel(p.floor || 1)
            }));
          return filtered;
        };

        const structuredPlans = {
          before: {
            floor1: organizePlans(plansStructure.before?.floor1, 'before.floor1'),
            floor2: organizePlans(plansStructure.before?.floor2, 'before.floor2')
          },
          after: {
            floor1: organizePlans(plansStructure.after?.floor1, 'after.floor1'),
            floor2: organizePlans(plansStructure.after?.floor2, 'after.floor2')
          }
        };

        // Vérifier s'il y a des plans à afficher
        const hasPlans = 
          structuredPlans.before.floor1.length > 0 ||
          structuredPlans.before.floor2.length > 0 ||
          structuredPlans.after.floor1.length > 0 ||
          structuredPlans.after.floor2.length > 0;

        if (hasPlans) {
          // Détecter le nombre d'étages
          const hasFloor1 = structuredPlans.before.floor1.length > 0 || structuredPlans.after.floor1.length > 0;
          const hasFloor2 = structuredPlans.before.floor2.length > 0 || structuredPlans.after.floor2.length > 0;
          const hasMultipleFloors = hasFloor1 && hasFloor2;
          
        const plansTemplate = await fs.promises.readFile(
          path.join(templatesDir, 'photos_plans_modern.html'),
          'utf-8'
        );
        const compiledPlans = Handlebars.compile(plansTemplate);
          // Texte de description pour chaque niveau (depuis la BDD)
          const floor1Description = hasFloor1 
            ? (project.photos as any)?.floor1Description || ''
            : '';
          const floor2Description = hasFloor2
            ? (project.photos as any)?.floor2Description || ''
            : '';
          
          const plansData = {
            plans: structuredPlans,
            hasMultipleFloors: hasMultipleFloors,
            hasFloor1: hasFloor1,
            hasFloor2: hasFloor2,
            floor1Description: floor1Description,
            floor2Description: floor2Description
          };
          const renderedPlans = compiledPlans(plansData);
          htmlContent += renderedPlans;
          // Pas besoin de page-break supplémentaire car le template gère déjà les sauts de page
        }
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
      const photoCount = images3dRaw.length;
      
      // Photos en pleine largeur, 3 max par page avec titre répété
      const photosPerPage = 3;
      const totalPages = Math.ceil(photoCount / photosPerPage);
      
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const startIndex = pageIndex * photosPerPage;
        const endIndex = Math.min(startIndex + photosPerPage, photoCount);
        const pagePhotos = images3dRaw.slice(startIndex, endIndex);
      
        const images3dStyled = pagePhotos.map((url) => {
          return { url };
        });
      
        if (images3dStyled.length > 0) {
          const photos3dTemplate = await fs.promises.readFile(
            path.join(templatesDir, 'photos_3d_modern.html'),
            'utf-8'
          );
          const compiledPhotos3d = Handlebars.compile(photos3dTemplate);
          htmlContent += compiledPhotos3d({
            images: images3dStyled
          });
          // Pas besoin de page-break supplémentaire car le template a déjà page-break-after: always
        }
      }
    }

    // ===== SECTION 3: SUIVI DU PROJET =====
    // hasDuring et hasAfter sont déjà déclarés plus haut pour le sommaire
    if (hasDuring || hasAfter) {
      htmlContent += compiledSectionIntro({
        title: 'Suivi du projet',
        description: 'Photographies prises pendant et après les travaux de rénovation.',
        description_2: '',
        summary: ''
      });
      
      // TODO: Ajouter les templates pour les photos during et after
      // Pour l'instant, on garde la structure pour l'avenir
    }

    // ===== SECTION 4: JUSTIFICATIF DU PRIX =====
    // ===== SECTION ANALYSE DVF (KPI, graphique, tableau) =====
      // Calcul du prix ajusté avec le coefficient de pondération
      const selFinalAvg = pdfData.resultsDvfMetadata?.sel_final_avg ?? 0;
      const coefPonderation = pdfData.resultsDescriptionBien?.coef_ponderation ?? 1;
      const prixAjuste = selFinalAvg * coefPonderation;
      
      // Prix de vente FAI par m² pondéré (déjà calculé)
      const prixVenteFaiM2 = pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_pondere_m2 ?? 0;
      
      // Calculer la différence entre objectif et théorique pour déterminer le qualificatif
      const diffPct = prixVenteFaiM2 > 0 ? ((prixAjuste - prixVenteFaiM2) / prixVenteFaiM2) * 100 : 0;
      let qualificatif = 'cohérent';
      if (Math.abs(diffPct) <= 3) {
        qualificatif = 'cohérent';
      } else if (prixAjuste > prixVenteFaiM2) {
        qualificatif = 'conservateur';
      } else {
        qualificatif = 'optimiste';
      }
      
      // Amélioration de la lisibilité avec structure claire
      const rayonMetres = Math.round(Number(pdfData.inputsDvf?.rayon) * 1000);
      const moyenneAutour = formatKCurrency(selFinalAvg, 1);
      const prixTheorique = formatKCurrency(prixAjuste, 1);
      const objectifRevente = formatKCurrency(prixVenteFaiM2, 1);
      
      // Explication du coefficient de pondération
      let coefExplanation = '';
      if (coefPonderation > 1) {
        coefExplanation = `Le coefficient de pondération de <strong>${coefPonderation}</strong> reflète la valeur ajoutée du bien par rapport à la moyenne (vues, état, emplacement, etc.).`;
      } else if (coefPonderation < 1) {
        coefExplanation = `Le coefficient de pondération de <strong>${coefPonderation}</strong> reflète les éléments à améliorer du bien par rapport à la moyenne.`;
      } else {
        coefExplanation = `Le coefficient de pondération de <strong>${coefPonderation}</strong> indique que le bien est aligné avec la moyenne du marché.`;
      }
      
      // Résumé simplifié : juste la formule avec ** et explication en bas
      // Couleurs blanches pour être visibles sur fond bleu
      const summaryContent = `
        <div style="text-align: center; margin: 0.8em 0; padding: 0.8em; background: rgba(255, 255, 255, 0.15); border-radius: 8px; border-left: 4px solid rgba(255, 255, 255, 0.5);">
          <div style="font-size: 1.1em; font-weight: 800; color: #fff; line-height: 1.4;">
            ${moyenneAutour} k€/m²<sup style="font-size: 0.6em; vertical-align: super; color: #fff;">**</sup> × ${coefPonderation} = 
            <strong style="font-size: 1.05em; color: #fff;">${prixTheorique} k€/m²<sup style="font-size: 0.6em; vertical-align: super; color: #fff;">**</sup></strong>
          </div>
        </div>
        <div style="margin-top: 0.8em; line-height: 1.6;">
          <p style="margin: 0; font-size: 0.95em; color: #fff;">
            Ce qui est <strong style="color: #fff; background: rgba(255, 255, 255, 0.25); padding: 0.1em 0.4em; border-radius: 4px;">${qualificatif}</strong> avec notre objectif de revente de 
            <strong style="color: #fff; background: rgba(255, 255, 255, 0.25); padding: 0.1em 0.4em; border-radius: 4px;">${objectifRevente} k€/m²</strong> (FAI).
          </p>
        </div>
      `;
      
      const footerNote = '<span style="font-size: 0.85em; color: #666; font-style: italic;">** Moyenne pondérée par la surface et l\'ancienneté × coefficient de pondération, basé sur les transactions publiées dans la base DVF</span>';
      
      htmlContent += compiledSectionIntro({
        title: 'Justificatif Prix Vente',
        description: '<ul style="list-style:none; padding-left:0; margin:0; font-size:1.05em; line-height:1.8;"><li style="margin-bottom:0.75rem; display:flex; align-items:center; padding:0.4em 0;"><span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; min-height:32px; margin-right:1rem; background:var(--color-primary); border-radius:50%; line-height:1; box-shadow:0 2px 6px rgba(10, 108, 157, 0.25); flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="18" width="4" height="4" fill="white"/><rect x="9" y="14" width="4" height="8" fill="white"/><rect x="15" y="10" width="4" height="12" fill="white"/><rect x="21" y="6" width="4" height="16" fill="white"/></svg></span><span style="font-weight:500; font-size:1.05em; color:#1e293b; line-height:1.5;">Calcul de la moyenne autour du bien</span></li><li style="margin-bottom:0.75rem; display:flex; align-items:center; padding:0.4em 0;"><span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; min-height:32px; margin-right:1rem; background:var(--color-primary); border-radius:50%; line-height:1; box-shadow:0 2px 6px rgba(10, 108, 157, 0.25); flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 21h18v-2H3v2zM5 19V8l6-4 6 4v11H5z" fill="white"/><rect x="7" y="11" width="4" height="4" fill="white"/><rect x="13" y="11" width="4" height="4" fill="white"/></svg></span><span style="font-weight:500; font-size:1.05em; color:#1e293b; line-height:1.5;">Calcul de la moyenne dans l\'arrondissement</span></li><li style="display:flex; align-items:center; padding:0.4em 0;"><span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; min-height:32px; margin-right:1rem; background:var(--color-primary); border-radius:50%; line-height:1; box-shadow:0 2px 6px rgba(10, 108, 157, 0.25); flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span style="font-weight:500; font-size:1.05em; color:#1e293b; line-height:1.5;">Calcul de la moyenne des biens premium de l\'arrondissement</span></li></ul>',
        description_2: '',
        summary: summaryContent,
        footer_note: footerNote
      });
      
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
                      scaleLabel: { 
                        display: true, 
                        labelString: 'k€/m²',
                        font: {
                          size: 24,
                          weight: 'bold'
                        }
                      },
                      ticks: { 
                        min: y1Min, 
                        max: y1Max,
                        font: {
                          size: 20,
                          weight: 'bold'
                        }
                      }
                    },
                    {
                      id: 'y2',
                      type: 'linear',
                      position: 'right',
                      scaleLabel: { 
                        display: true, 
                        labelString: 'Premium (k€/m²)',
                        font: {
                          size: 24,
                          weight: 'bold'
                        }
                      },
                      ticks: { 
                        min: y2Min, 
                        max: y2Max,
                        font: {
                          size: 20,
                          weight: 'bold'
                        }
                      },
                      gridLines: { drawOnChartArea: false }
                    }
                  ],
                  xAxes: [
                    { 
                      scaleLabel: { 
                        display: true, 
                        labelString: 'Année',
                        font: {
                          size: 24,
                          weight: 'bold'
                        }
                      },
                      ticks: {
                        font: {
                          size: 20,
                          weight: 'bold'
                        }
                      }
                    }
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
        inputsDvf: pdfData.inputsDvf,
      });
      htmlContent += '<div class="page-break"></div>';

    // ===== SECTION 5: DONNÉES FINANCIÈRES =====
      htmlContent += compiledSectionIntro({
        title: 'Données financières',
        description: '<ul style="list-style:none; padding-left:0; margin:0; font-size:1.05em; line-height:1.8;"><li style="margin-bottom:0.75rem; display:flex; align-items:center; padding:0.4em 0;"><span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; min-height:32px; margin-right:1rem; background:var(--color-primary); border-radius:50%; line-height:1; box-shadow:0 2px 6px rgba(10, 108, 157, 0.25); flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" fill="white"/></svg></span><span style="font-weight:500; font-size:1.05em; color:#1e293b; line-height:1.5;">Hypothèses de coûts</span></li><li style="margin-bottom:0.75rem; display:flex; align-items:center; padding:0.4em 0;"><span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; min-height:32px; margin-right:1rem; background:var(--color-primary); border-radius:50%; line-height:1; box-shadow:0 2px 6px rgba(10, 108, 157, 0.25); flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="white"/></svg></span><span style="font-weight:500; font-size:1.05em; color:#1e293b; line-height:1.5;">Détail des postes</span></li><li style="margin-bottom:0.75rem; display:flex; align-items:center; padding:0.4em 0;"><span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; min-height:32px; margin-right:1rem; background:var(--color-primary); border-radius:50%; line-height:1; box-shadow:0 2px 6px rgba(10, 108, 157, 0.25); flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="white"/></svg></span><span style="font-weight:500; font-size:1.05em; color:#1e293b; line-height:1.5;">Financement</span></li><li style="margin-bottom:0.75rem; display:flex; align-items:center; padding:0.4em 0;"><span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; min-height:32px; margin-right:1rem; background:var(--color-primary); border-radius:50%; line-height:1; box-shadow:0 2px 6px rgba(10, 108, 157, 0.25); flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" fill="white"/></svg></span><span style="font-weight:500; font-size:1.05em; color:#1e293b; line-height:1.5;">Calcul des marges</span></li><li style="display:flex; align-items:center; padding:0.4em 0;"><span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; min-width:32px; min-height:32px; margin-right:1rem; background:var(--color-primary); border-radius:50%; line-height:1; box-shadow:0 2px 6px rgba(10, 108, 157, 0.25); flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="18" width="4" height="4" fill="white"/><rect x="9" y="14" width="4" height="8" fill="white"/><rect x="15" y="10" width="4" height="12" fill="white"/><rect x="21" y="6" width="4" height="16" fill="white"/></svg></span><span style="font-weight:500; font-size:1.05em; color:#1e293b; line-height:1.5;">Indicateurs financiers</span></li></ul>',
        description_2: '',
        summary: 'Selon les hypothèses de financement et de cout des travaux, le prix de revient sera de <strong>' + formatKCurrency(pdfData.resultsBusinessPlan?.couts_total, 0) + '</strong> et la marge nette sera de <strong>' + formatKCurrency(pdfData.resultsBusinessPlan?.resultats?.marge_nette, 0) + '</strong> (' + formatPercentage(pdfData.resultsBusinessPlan?.resultats?.rentabilite) + ').'
      });

    // ===== SECTION FINANCIAL =====
      
      // Préparer les données de synthèse des coûts avec pourcentages
      const syntheseCouts = pdfData.resultsBusinessPlan?.synthese_couts || [];
      const syntheseCoutsTotal = pdfData.resultsBusinessPlan?.synthese_couts_total || 1;
      const syntheseCoutsWithPct = syntheseCouts.map((item, idx) => {
        const pct = Math.round((item.montant / syntheseCoutsTotal) * 100);
        const colors = ['#0a6c9d', '#f59e42', '#64748b', '#b0c4de'];
        return {
          ...item,
          pct,
          color: colors[idx % colors.length]
        };
      });

      // Préparer les données de synthèse du financement avec pourcentages
      // Les intérêts sont déjà inclus dans les calculs, on utilise directement les montants utilisés
      const creditFoncierAlloue = pdfData.resultsBusinessPlan?.financement?.montants?.credit_foncier_output_amount || 0;
      const fondsPropresAlloue = pdfData.resultsBusinessPlan?.financement?.montants?.fonds_propres_output_amount || 0;
      const creditAccompagnementAlloue = pdfData.resultsBusinessPlan?.financement?.montants?.credit_accompagnement_output_amount || 0;
      
      const creditFoncierUtilise = pdfData.resultsBusinessPlan?.financement?.montants_utilises?.credit_foncier_output_amount || 0;
      const fondsPropresUtilise = pdfData.resultsBusinessPlan?.financement?.montants_utilises?.fonds_propres_output_amount || 0;
      const creditAccompagnementUtilise = pdfData.resultsBusinessPlan?.financement?.montants_utilises?.credit_accompagnement_output_amount || 0;
      
      // Le financement total vient directement de la BDD (déjà calculé dans le contrôleur)
      const financementTotal = pdfData.resultsBusinessPlan?.financement?.montants_utilises?.total_montants_utilises || 0;
      
      const syntheseFinancement = [
        {
          categorie: 'Crédit foncier',
          montant: creditFoncierUtilise,
          pct: financementTotal > 0 ? Math.round((creditFoncierUtilise / financementTotal) * 100) : 0,
          color: '#0a6c9d'
        },
        {
          categorie: 'Fonds propres',
          montant: fondsPropresUtilise,
          pct: financementTotal > 0 ? Math.round((fondsPropresUtilise / financementTotal) * 100) : 0,
          color: '#64748b'
        },
        {
          categorie: 'Crédit accompagnement',
          montant: creditAccompagnementUtilise,
          pct: financementTotal > 0 ? Math.round((creditAccompagnementUtilise / financementTotal) * 100) : 0,
          color: '#f59e42'
        }
      ];
      
      const financialTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'financial_data_modern.html'),
        'utf-8'
      );
      const compiledFinancial = Handlebars.compile(financialTemplate);

      // Génération des pie charts pour coûts et financement
      let couts_pie_chart_url = '';
      let financement_pie_chart_url = '';
      try {
        // Pie chart pour les coûts - avec pourcentages en blanc dans les segments
        const coutsChart = new QuickChart();
        const coutsConfig = {
          type: 'pie',
          data: {
            datasets: [{
              data: syntheseCoutsWithPct.map(item => item.montant),
              backgroundColor: syntheseCoutsWithPct.map(item => item.color),
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                enabled: false
              },
              datalabels: {
                display: true,
                color: '#ffffff',
                font: {
                  weight: 'bold',
                  size: 14
                },
                formatter: function(value: number, context: any) {
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  return Math.round((value / total) * 100) + '%';
                },
                anchor: 'center',
                align: 'center'
              }
            },
            elements: {
              arc: {
                borderWidth: 0
              }
            },
            layout: {
              padding: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
              }
            }
          }
        };
        coutsChart.setConfig(coutsConfig);
        coutsChart.setWidth(180).setHeight(180).setBackgroundColor('transparent');
        coutsChart.setFormat('png');
        couts_pie_chart_url = coutsChart.getUrl();

        // Pie chart pour le financement - avec pourcentages en blanc dans les segments
        const financementChart = new QuickChart();
        const financementConfig = {
          type: 'pie',
          data: {
            datasets: [{
              data: syntheseFinancement.map(item => item.montant),
              backgroundColor: syntheseFinancement.map(item => item.color),
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                enabled: false
              },
              datalabels: {
                display: true,
                color: '#ffffff',
                font: {
                  weight: 'bold',
                  size: 14
                },
                formatter: function(value: number, context: any) {
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  return Math.round((value / total) * 100) + '%';
                },
                anchor: 'center',
                align: 'center'
              }
            },
            elements: {
              arc: {
                borderWidth: 0
              }
            },
            layout: {
              padding: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
              }
            }
          }
        };
        financementChart.setConfig(financementConfig);
        financementChart.setWidth(180).setHeight(180).setBackgroundColor('transparent');
        financementChart.setFormat('png');
        financement_pie_chart_url = financementChart.getUrl();
      } catch (err) {
        console.error('[PDF] Erreur génération pie charts:', err);
      }

      // Génération du graphique financier
      let vente_chart_url = '';
      let gain_pondere_val = 0;
      let gain_carrez_val = 0;
      let gain_pondere_pct_val = 0;
      let gain_carrez_pct_val = 0;
      let gain_pondere_top_pct = 45; // Valeur par défaut
      let gain_carrez_top_pct = 45; // Valeur par défaut
      
      try {
        const chart = new QuickChart();
        const prix_achat = pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_pondere_m2 || 0;
        const prix_revient = pdfData.resultsBusinessPlan?.prix_m2?.prix_revient_pondere_m2 || 0;
        const prix_vente = pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_pondere_m2 || 0;
        const prix_achat_carrez = pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_carrez_m2 || 0;
        const prix_revient_carrez = pdfData.resultsBusinessPlan?.prix_m2?.prix_revient_carrez_m2 || 0;
        const prix_vente_carrez = pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_carrez_m2 || 0;
        const prix_m2_benchmark = pdfData.resultsDvfMetadata?.sel_final_avg || null;
        
        // Calculer les gains
        gain_pondere_val = prix_vente - prix_revient;
        gain_carrez_val = prix_vente_carrez - prix_revient_carrez;
        gain_pondere_pct_val = prix_revient > 0 ? Math.round((gain_pondere_val / prix_revient) * 100) : 0;
        gain_carrez_pct_val = prix_revient_carrez > 0 ? Math.round((gain_carrez_val / prix_revient_carrez) * 100) : 0;

        const allVals = [prix_achat, prix_revient, prix_vente, prix_achat_carrez, prix_revient_carrez, prix_vente_carrez].filter(v => typeof v === 'number' && v > 0);
        const minVal = Math.min(...allVals);
        const maxVal = Math.max(...allVals);
        // Calcul de la borne basse : prendre le min entre le benchmark/2 et le plus petit des données
        const benchmarkHalf = prix_m2_benchmark ? prix_m2_benchmark / 2 : null;
        const yMin = Math.max(0, Math.floor(Math.min(
          minVal - (maxVal - minVal) * 0.1,
          benchmarkHalf || minVal - (maxVal - minVal) * 0.1
        )));
        const yMax = Math.ceil(maxVal + (maxVal - minVal) * 0.1);

        // Calculer la position verticale des bulles sur les lignes entre Revient et Vente
        // La ligne est au milieu entre les deux valeurs
        const lignePondereY = (prix_revient + prix_vente) / 2;
        const ligneCarrezY = (prix_revient_carrez + prix_vente_carrez) / 2;
        
        // Convertir en pourcentage de la hauteur du graphique (en tenant compte du padding)
        // Dans un graphique, y=0 est en bas, donc on inverse : 100% = bas, 0% = haut
        // On tient compte du padding : top: 20px, bottom: 40px sur une hauteur de 1200px
        const chartHeight = 1200; // Résolution augmentée pour améliorer la qualité
        const paddingTop = 20; // Ajusté proportionnellement
        const paddingBottom = 40; // Ajusté proportionnellement
        const usableHeight = chartHeight - paddingTop - paddingBottom;
        
        // Position en pixels depuis le haut (0 = haut du graphique)
        const lignePonderePixel = paddingTop + ((yMax - lignePondereY) / (yMax - yMin)) * usableHeight;
        const ligneCarrezPixel = paddingTop + ((yMax - ligneCarrezY) / (yMax - yMin)) * usableHeight;
        
        // Convertir en pourcentage de la hauteur totale de l'image (1200px)
        // Note: L'image est redimensionnée dans le conteneur avec object-fit:contain
        // Les pourcentages sont relatifs au conteneur parent qui a position:relative
        gain_pondere_top_pct = Math.max(5, Math.min(95, (lignePonderePixel / chartHeight) * 100));
        gain_carrez_top_pct = Math.max(5, Math.min(95, (ligneCarrezPixel / chartHeight) * 100));
        
        // Log pour debug
        console.log(`[PDF] Positions bulles - Pondéré: ${gain_pondere_top_pct.toFixed(1)}% (ligneY: ${lignePondereY.toFixed(0)}, pixel: ${lignePonderePixel.toFixed(0)})`);
        console.log(`[PDF] Positions bulles - Carrez: ${gain_carrez_top_pct.toFixed(1)}% (ligneY: ${ligneCarrezY.toFixed(0)}, pixel: ${ligneCarrezPixel.toFixed(0)})`);

        const chartConfig = {
          type: 'bar',
          data: {
            labels: ['Achat\n(pondéré)', 'Revient\n(pondéré)', 'Vente\n(pondéré)', '', 'Achat\n(carrez)', 'Revient\n(carrez)', 'Vente\n(carrez)'],
            datasets: [
              {
                label: '',
                data: [prix_achat, prix_revient, prix_vente, null, prix_achat_carrez, prix_revient_carrez, prix_vente_carrez],
                backgroundColor: ['#bfa77a', '#c97c2b', '#0a6c9d', 'transparent', '#bfa77a', '#c97c2b', '#0a6c9d'],
                barThickness: 'flex',
                maxBarThickness: 80,
              },
              // Ligne pointillée pour montrer le gain entre Revient et Vente (pondéré)
              {
                type: 'line',
                label: '',
                data: [null, prix_revient, prix_vente, null, null, null, null],
                borderColor: '#0a6c9d',
                borderWidth: 4,
                borderDash: [10, 10],
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                steppedLine: false,
                lineTension: 0,
                spanGaps: true,
                showLine: true
              },
              // Ligne pointillée pour montrer le gain entre Revient et Vente (carrez)
              {
                type: 'line',
                label: '',
                data: [null, null, null, null, null, prix_revient_carrez, prix_vente_carrez],
                borderColor: '#0a6c9d',
                borderWidth: 4,
                borderDash: [10, 10],
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                steppedLine: false,
                lineTension: 0,
                spanGaps: true,
                showLine: true
              },
              // Supprimé le dataset benchmark en double - on garde seulement l'annotation HTML
            ]
          },
          options: {
            plugins: { 
              legend: { 
                display: false,
                labels: {
                  display: false
                }
              },
              datalabels: {
                display: false
              },
              // Plugin personnalisé pour afficher les gains à côté des lignes
              tooltip: {
                enabled: true
              },
            },
            legend: {
              display: false
            },
            scales: {
              yAxes: [{
                display: true,
                scaleLabel: { 
                  display: true, 
                  labelString: 'Prix (€/m²)',
                  font: {
                    size: 60,
                    weight: 'bold'
                  }
                },
                ticks: { 
                  min: yMin, 
                  max: yMax,
                  font: {
                    size: 56,
                    weight: 'bold'
                  }
                }, 
                gridLines: {
                  display: true
                  }
              }],
              x: { 
                title: { 
                  display: true, 
                  text: 'Type',
                  font: {
                    size: 60,
                    weight: 'bold'
                  }
                },
                ticks: {
                  padding: 30,
                  maxRotation: 0,
                  minRotation: 0,
                  font: {
                    size: 56,
                    weight: 'bold'
                  }
                }
              }
            },
            layout: {
              padding: {
                bottom: 40,
                left: 20,
                right: 20,
                top: 20
              }
            },
            elements: {
              line: {
                tension: 0, // Lignes droites
                borderCapStyle: 'round',
                borderJoinStyle: 'round'
              },
              point: {
                radius: 0
              }
            },
            animation: false, // Désactiver les animations pour un rendu plus net
            maintainAspectRatio: false
          }
        };

        chart.setConfig(chartConfig);
        // Augmenter la résolution pour améliorer la qualité et réduire la pixelisation
        chart.setWidth(1000).setHeight(1200).setBackgroundColor('transparent');
        const chartUrl = chart.getUrl();
        
        // Calculer la position du benchmark si présent
        let benchmarkTopPct = 0;
        let benchmarkLabel = '';
        if (prix_m2_benchmark) {
          const benchmarkPixel = paddingTop + ((yMax - prix_m2_benchmark) / (yMax - yMin)) * usableHeight;
          benchmarkTopPct = (benchmarkPixel / chartHeight) * 100;
          benchmarkLabel = `Prix moyen des comparables ${Math.round(prix_m2_benchmark / 1000)} k€`;
        }
        
        console.log(`[PDF] Génération graphique - Pondéré: ${gain_pondere_top_pct.toFixed(1)}%, Carrez: ${gain_carrez_top_pct.toFixed(1)}%`);
        
        // Télécharger l'image du graphique et la convertir en base64
        let chartImageBase64 = '';
        let useCompositeImage = false;
        try {
          const https = require('https');
          const http = require('http');
          const client = chartUrl.startsWith('https') ? https : http;
          
          chartImageBase64 = await new Promise((resolve, reject) => {
            const request = client.get(chartUrl, (response: any) => {
              if (response.statusCode !== 200) {
                reject(new Error(`Failed to download chart: ${response.statusCode}`));
                return;
              }
              const chunks: Buffer[] = [];
              response.on('data', (chunk: Buffer) => chunks.push(chunk));
              response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const base64 = buffer.toString('base64');
                resolve(`data:image/png;base64,${base64}`);
              });
            });
            request.on('error', reject);
            request.setTimeout(10000, () => {
              request.destroy();
              reject(new Error('Timeout downloading chart'));
            });
          });
          console.log('[PDF] Image graphique téléchargée avec succès');
          
          // Générer une image composite avec Puppeteer
          try {
            const browser = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            // Augmenter la résolution pour améliorer la pixelisation
            // Augmenter le deviceScaleFactor pour une meilleure qualité d'image
            await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 4 });
            
            // Créer un HTML avec le graphique et les annotations positionnées
            const chartHtml = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <style>
                    body { margin: 0; padding: 20px; background: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .chart-container { position: relative; width: 1000px; height: 1200px; background: white; }
                    .chart-img { width: 1000px; height: 1200px; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; image-rendering: pixelated; }
                    .annotation {
                      position: absolute;
                      background: rgba(255,255,255,0.95);
                      border: 2px solid #0a6c9d;
                      border-radius: 6px;
                      padding: 6px 14px;
                      text-align: center;
                      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                      white-space: nowrap;
                      font-family: Arial, sans-serif;
                      font-size: 26px;
                      font-weight: bold;
                      color: #0a6c9d;
                      z-index: 10;
                      transform: translate(-50%, -50%);
                      -webkit-font-smoothing: antialiased;
                      -moz-osx-font-smoothing: grayscale;
                      text-rendering: optimizeLegibility;
                    }
                    .annotation-benchmark {
                      border-color: #e53e3e;
                      color: #e53e3e;
                      font-size: 28px;
                      font-weight: 700;
                      transform: translate(-50%, -100%);
                      margin-top: -16px;
                      -webkit-font-smoothing: antialiased;
                      -moz-osx-font-smoothing: grayscale;
                      text-rendering: optimizeLegibility;
                      line-height: 1.3;
                      padding: 10px 24px;
                      letter-spacing: 0.3px;
                    }
                  </style>
                </head>
                <body>
                  <div class="chart-container">
                    <img src="${chartImageBase64}" class="chart-img" alt="Chart">
                    ${gain_pondere_pct_val > 0 ? `
                      <div class="annotation" style="left: 18%; top: ${gain_pondere_top_pct}%;">
                        +${gain_pondere_pct_val}%
                      </div>
                    ` : ''}
                    ${gain_carrez_pct_val > 0 ? `
                      <div class="annotation" style="left: 82%; top: ${gain_carrez_top_pct}%;">
                        +${gain_carrez_pct_val}%
                      </div>
                    ` : ''}
                    ${prix_m2_benchmark ? `
                      <div class="annotation annotation-benchmark" style="left: 50%; top: ${benchmarkTopPct}%;">
                        ${benchmarkLabel}
                      </div>
                    ` : ''}
                  </div>
                </body>
              </html>
            `;
            
            await page.setContent(chartHtml, { waitUntil: 'networkidle0' });
            
            // Attendre que l'image soit chargée
            // @ts-ignore - Code exécuté dans le navigateur
            await page.waitForFunction(() => {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const img = document.querySelector('.chart-img');
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              return img && img.complete && img.naturalHeight !== 0;
            }, { timeout: 10000 }).catch(() => {
              console.log('[PDF] Timeout attente image, continuation...');
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const container = await page.$('.chart-container');
            if (container) {
              const screenshot = await container.screenshot({ 
                type: 'png',
                omitBackground: false,
                fullPage: false
              });
              await browser.close();
              
              // Optimiser l'image avec meilleure qualité pour réduire la pixelisation
              // Garder la résolution élevée pour une meilleure netteté
              const optimizedBuffer = await sharp(Buffer.from(screenshot))
                .resize(1000, 1200, { 
                  fit: 'contain',
                  background: { r: 255, g: 255, b: 255, alpha: 1 },
                  kernel: 'lanczos3' // Meilleur algorithme de redimensionnement pour la netteté
                })
                .png({ 
                  quality: 100, 
                  compressionLevel: 9,
                  adaptiveFiltering: true,
                  palette: false
                })
                .sharpen({ sigma: 0.5 }) // Légère netteté supplémentaire
                .toBuffer();
              
              vente_chart_url = `data:image/png;base64,${optimizedBuffer.toString('base64')}`;
              useCompositeImage = true;
              console.log('[PDF] Graphique avec annotations généré avec succès');
            } else {
              await browser.close();
              console.log('[PDF] Container non trouvé, utilisation image originale');
            }
          } catch (annotationErr) {
            console.error('[PDF] Erreur génération annotations Puppeteer:', annotationErr);
          }
        } catch (downloadErr) {
          console.error('[PDF] Erreur téléchargement image graphique:', downloadErr);
        }
        
        // Si l'image composite n'a pas été générée, utiliser l'image originale
        // Les annotations HTML dans le template serviront de fallback
        if (!useCompositeImage) {
          vente_chart_url = chartUrl;
          console.log('[PDF] Utilisation image originale avec annotations HTML');
        }
      } catch (err) {
        console.error('[PDF] Erreur génération graphique vente:', err);
      }

      // Recalcule de secours (modern) – logs détaillés retirés
      let surfacePondereeApresModern = pdfData.inputsBusinessPlan?.surface_ponderee_apres_travaux as unknown as number | undefined;
      const needsRecomputeModern = (typeof surfacePondereeApresModern !== 'number') || isNaN(surfacePondereeApresModern) || surfacePondereeApresModern === 0;
      if (needsRecomputeModern && pdfData.inputsGeneral) {
        const bpCarrez = Number(pdfData.inputsBusinessPlan?.surface_carrez_apres_travaux || 0);
        const bpTerrasse = Number(pdfData.inputsBusinessPlan?.surface_terrasse_apres_travaux || 0);
      // Utiliser uniquement les données du business plan (pas de fallback renovation)
      const carrez = bpCarrez;
      const terrasse = bpTerrasse;
        const ponderation = Number(pdfData.inputsGeneral.ponderation_terrasse || 0);
        surfacePondereeApresModern = carrez + (terrasse * ponderation);
        // logs détaillés supprimés
      }

      const financialData = {
        ...pdfData,
        // Override éventuel de la surface pondérée
        inputsBusinessPlan: {
          ...(pdfData.inputsBusinessPlan || {}),
          surface_ponderee_apres_travaux: surfacePondereeApresModern,
        },
        vente_chart_url,
        prix_m2_benchmark_label: (pdfData.resultsDvfMetadata?.sel_final_avg) ? `Prix moyen des comparables ${Math.round((pdfData.resultsDvfMetadata?.sel_final_avg || 0) / 1000)} k€` : '',
        prix_m2_vente_pondere: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_pondere_m2,
        prix_m2_vente_carrez: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_carrez_m2,
        gain_pondere: gain_pondere_val || 0,
        gain_pondere_pct: gain_pondere_pct_val || 0,
        gain_pondere_top_pct: gain_pondere_top_pct || 45,
        gain_carrez: gain_carrez_val || 0,
        gain_carrez_pct: gain_carrez_pct_val || 0,
        gain_carrez_top_pct: gain_carrez_top_pct || 45,
        synthese_couts: syntheseCoutsWithPct,
        synthese_couts_total: syntheseCoutsTotal,
        synthese_financement: syntheseFinancement,
        financement_total: financementTotal,
        credit_foncier_alloue: creditFoncierAlloue,
        credit_foncier_utilise: creditFoncierUtilise,
        fonds_propres_alloue: fondsPropresAlloue,
        fonds_propres_utilise: fondsPropresUtilise,
        credit_accompagnement_alloue: creditAccompagnementAlloue,
        credit_accompagnement_utilise: creditAccompagnementUtilise,
        couts_pie_chart_url,
        financement_pie_chart_url,
        ...(pdfData.pdf_config?.dynamic_fields || {})
      };
      htmlContent += compiledFinancial(financialData);
      htmlContent += '<div class="page-break"></div>';

    // ===== SECTION MONDRIAN (Treemaps) =====
      // Calculer les valeurs pour les sous-titres
      const resultsBPForMondrian: any = pdfData.resultsBusinessPlan || {};
      const prixRevient = resultsBPForMondrian.couts_total || 0;
      const margeNette = resultsBPForMondrian.resultats?.marge_nette || 0;
      const prixFaiTotal = resultsBPForMondrian.resultats?.prix_fai || 0;
      const fraisAgenceVenteForSubtitle = prixFaiTotal && resultsBPForMondrian.resultats?.prix_hfa 
        ? prixFaiTotal - resultsBPForMondrian.resultats.prix_hfa 
        : 0;
      const totalCredits = (resultsBPForMondrian.financement?.montants_utilises?.credit_foncier_output_amount || 0) + 
                          (resultsBPForMondrian.financement?.montants_utilises?.credit_accompagnement_output_amount || 0);
      const totalFondsPropresForSubtitle = resultsBPForMondrian.financement?.montants_utilises?.fonds_propres_output_amount || 0;
      // Génération des graphiques Mondrian avec les données du projet
      let mondrianPrixFaiImage = '';
      let mondrianFinancementImage = '';
      try {
        // Préparer les données pour les Mondrian
        // Utilisation des valeurs déjà calculées et stockées en BDD (pas de recalcul)
        const resultsBP: any = pdfData.resultsBusinessPlan || {};
        
        // Données pour le Mondrian Prix FAI
        // Note: frais_agence_vente_output_amount contient le pourcentage, pas le montant
        // Le montant = prix_fai - prix_hfa (car prix_fai = prix_hfa * (1 + frais_agence_vente_percent / 100))
        const fraisAgenceVenteMontant = resultsBP.resultats?.prix_fai && resultsBP.resultats?.prix_hfa 
          ? resultsBP.resultats.prix_fai - resultsBP.resultats.prix_hfa 
          : 0;
        const prixFaiData = [
          {
            name: 'Agence',
            value: fraisAgenceVenteMontant,
            color: '#FF8042'
          },
          {
            name: 'Marge nette',
            value: resultsBP.resultats?.marge_nette ?? 0,
            color: '#4ECDC4'
          },
          {
            name: 'Banque',
            value: resultsBP.financement?.couts?.total_couts_financiers ?? 0,
            color: '#3B82F6'
          },
          {
            name: 'Gestion',
            value: resultsBP.couts_divers?.total_divers ?? 0,
            color: '#FBBF24'
          },
          {
            name: 'Travaux',
            value: resultsBP.couts_travaux?.total_travaux ?? 0,
            color: '#F87171'
          },
          {
            name: 'Achat',
            value: resultsBP.couts_acquisition?.total_acquisition ?? 0,
            color: '#22D3EE'
          }
        ].filter(item => item.value > 0);

        // Données pour le Mondrian Financement
        // Utilisation des totaux déjà calculés et stockés en BDD (pas besoin de .reduce())
        const totalCreditFoncier = resultsBP.financement?.montants_utilises?.credit_foncier_output_amount ?? 0;
        const totalFondsPropres = resultsBP.financement?.montants_utilises?.fonds_propres_output_amount ?? 0;
        const totalCreditAccompagnement = resultsBP.financement?.montants_utilises?.credit_accompagnement_output_amount ?? 0;
        const prixFaiFin = resultsBP.resultats?.prix_fai ?? 1;
        const prixFaiDataFin = [
          {
            name: 'Agence',
            value: fraisAgenceVenteMontant,
            color: '#FF8042'
          },
          {
            name: 'Marge nette',
            value: resultsBP.resultats?.marge_nette ?? 0,
            color: '#4ECDC4'
          },
          {
            name: 'Crédit foncier',
            value: totalCreditFoncier,
            color: '#3B82F6'
          },
          {
            name: 'Fonds propres',
            value: totalFondsPropres,
            color: '#22D3EE'
          },
          {
            name: 'Crédit accompagnement',
            value: totalCreditAccompagnement,
            color: '#FBBF24'
          }
        ].filter(item => item.value > 0);

        // Fonction pour générer un graphique Mondrian avec un algorithme Treemap simplifié
        const generateMondrianImage = async (data: any[], title: string, total: number): Promise<string> => {
          const mondrianHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f8fafc; }
                  .mondrian-container { background: #fff; border-radius: 16px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); width: 800px; }
                  .mondrian-title { font-weight: 800; font-size: 1.5rem; margin-bottom: 1rem; color: #1a3557; }
                  #mondrian-chart { width: 100%; height: 400px; position: relative; }
                </style>
              </head>
              <body>
                <div class="mondrian-container">
                  <div id="mondrian-chart">
                    <canvas id="canvas"></canvas>
                  </div>
                </div>
                <script>
                  const data = ${JSON.stringify(data)};
                  const total = ${total};
                  const canvas = document.getElementById('canvas');
                  const ctx = canvas.getContext('2d');
                  
                  // Augmenter la résolution pour meilleure qualité (devicePixelRatio)
                  const dpr = 2; // Double résolution
                  const baseWidth = 800;
                  const baseHeight = 450;
                  canvas.width = baseWidth * dpr;
                  canvas.height = baseHeight * dpr;
                  canvas.style.width = baseWidth + 'px';
                  canvas.style.height = baseHeight + 'px';
                  
                  // Mettre à l'échelle le contexte pour la haute résolution
                  ctx.scale(dpr, dpr);
                  
                  // Activer l'anti-aliasing pour les textes
                  ctx.textRenderingOptimization = 'optimizeQuality';
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = 'high';
                  
                  // Algorithme Treemap squarified simplifié
                  function squarify(items, x, y, width, height) {
                    if (items.length === 0) return [];
                    if (items.length === 1) {
                      return [{
                        ...items[0],
                        x, y, width, height
                      }];
                    }
                    
                    const itemTotal = items.reduce((sum, item) => sum + item.value, 0);
                    const area = width * height;
                    
                    // Trier par valeur décroissante
                    const sorted = [...items].sort((a, b) => b.value - a.value);
                    
                    const rects = [];
                    let currentX = x;
                    let currentY = y;
                    let remainingWidth = width;
                    let remainingHeight = height;
                    
                    sorted.forEach((item, index) => {
                      const itemArea = (item.value / itemTotal) * area;
                      const aspectRatio = remainingWidth / remainingHeight;
                      
                      let itemWidth, itemHeight;
                      if (aspectRatio > 1) {
                        // Plus large que haut
                        itemHeight = remainingHeight;
                        itemWidth = itemArea / itemHeight;
                        if (itemWidth > remainingWidth) {
                          itemWidth = remainingWidth;
                          itemHeight = itemArea / itemWidth;
                        }
                      } else {
                        // Plus haut que large
                        itemWidth = remainingWidth;
                        itemHeight = itemArea / itemWidth;
                        if (itemHeight > remainingHeight) {
                          itemHeight = remainingHeight;
                          itemWidth = itemArea / itemHeight;
                        }
                      }
                      
                      rects.push({
                        ...item,
                        x: currentX,
                        y: currentY,
                        width: itemWidth,
                        height: itemHeight
                      });
                      
                      // Mettre à jour la position et les dimensions restantes
                      if (remainingWidth > remainingHeight) {
                        currentX += itemWidth;
                        remainingWidth -= itemWidth;
                      } else {
                        currentY += itemHeight;
                        remainingHeight -= itemHeight;
                      }
                    });
                    
                    return rects;
                  }
                  
                  const rects = squarify(data, 0, 0, 800, 450);
                  
                  rects.forEach(rect => {
                    // Dessiner le rectangle
                    ctx.fillStyle = rect.color;
                    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
                    
                    // Bordure blanche
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 4; // Légèrement plus épais pour meilleure visibilité
                    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
                    
                    // Texte si assez grand - texte noir en gras pour meilleure lisibilité
                    if (rect.width > 50 && rect.height > 25) {
                      const pct = Math.round((rect.value / total) * 1000) / 10;
                      const valueK = Math.round(rect.value / 1000);
                      
                      // Taille de police adaptative (augmentée pour meilleure lisibilité)
                      const fontSize = Math.max(18, Math.min(28, Math.min(rect.width / 6, rect.height / 2.2)));
                      const smallFontSize = Math.max(14, Math.min(20, fontSize * 0.75));
                      
                      ctx.fillStyle = '#000000';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      
                      // Améliorer le rendu du texte
                      ctx.textRenderingOptimization = 'optimizeQuality';
                      
                      // Nom en noir et gras avec ombre légère pour meilleure lisibilité
                      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                      ctx.shadowBlur = 2;
                      ctx.shadowOffsetX = 1;
                      ctx.shadowOffsetY = 1;
                      ctx.font = 'bold ' + Math.round(fontSize) + 'px Arial, sans-serif';
                      ctx.fillText(rect.name, rect.x + rect.width / 2, rect.y + rect.height / 2 - 15);
                      
                      // Réinitialiser l'ombre
                      ctx.shadowColor = 'transparent';
                      ctx.shadowBlur = 0;
                      ctx.shadowOffsetX = 0;
                      ctx.shadowOffsetY = 0;
                      
                      // Valeur et pourcentage en noir et gras avec ombre
                      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                      ctx.shadowBlur = 2;
                      ctx.shadowOffsetX = 1;
                      ctx.shadowOffsetY = 1;
                      ctx.font = 'bold ' + Math.round(smallFontSize) + 'px Arial, sans-serif';
                      const valueText = valueK + ' k€ (' + pct + '%)';
                      ctx.fillText(valueText, rect.x + rect.width / 2, rect.y + rect.height / 2 + 10);
                      ctx.shadowColor = 'transparent';
                      ctx.shadowBlur = 0;
                      ctx.shadowOffsetX = 0;
                      ctx.shadowOffsetY = 0;
                    } else if (rect.width > 30 && rect.height > 15) {
                      // Pour les petits rectangles, afficher juste le pourcentage en noir et gras
                      const pct = Math.round((rect.value / total) * 1000) / 10;
                      ctx.fillStyle = '#000000';
                      ctx.textRenderingOptimization = 'optimizeQuality';
                      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                      ctx.shadowBlur = 2;
                      ctx.shadowOffsetX = 1;
                      ctx.shadowOffsetY = 1;
                      ctx.font = 'bold ' + Math.round(Math.max(14, Math.min(18, Math.min(rect.width / 3.5, rect.height / 1.6)))) + 'px Arial, sans-serif';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      const pctText = pct + '%';
                      ctx.fillText(pctText, rect.x + rect.width / 2, rect.y + rect.height / 2);
                      ctx.shadowColor = 'transparent';
                      ctx.shadowBlur = 0;
                      ctx.shadowOffsetX = 0;
                      ctx.shadowOffsetY = 0;
                    }
                  });
                </script>
              </body>
            </html>
          `;

          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-device-scale-factor=2']
          });
          const page = await browser.newPage();
          // Augmenter la résolution du viewport pour meilleure qualité
          await page.setViewport({ width: 1800, height: 1100, deviceScaleFactor: 2 });
          await page.setContent(mondrianHtml, { waitUntil: 'networkidle0' });
          
          // Attendre que le canvas soit rendu
          try {
            await page.waitForSelector('#canvas', { timeout: 5000 });
            // Attendre que le canvas soit complètement dessiné
            await page.evaluate(() => {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore - Code exécuté dans le navigateur
              return new Promise((resolve: any) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const canvas = document.getElementById('canvas');
                if (canvas) {
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const hasContent = imageData.data.some((val: any, idx: any) => idx % 4 !== 3 && val !== 0);
                    if (hasContent) {
                      resolve(true);
                    } else {
                      setTimeout(resolve, 500);
                    }
                  } else {
                    setTimeout(resolve, 500);
                  }
                } else {
                  setTimeout(resolve, 500);
                }
              });
            });
          } catch (e) {
            console.log('[PDF] Canvas non trouvé, continuation...');
          }
          
          // Attendre un peu pour le rendu complet du canvas
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Capturer uniquement le conteneur Mondrian avec haute qualité
          const container = await page.$('.mondrian-container');
          let screenshot: Buffer;
          if (container) {
            screenshot = Buffer.from(await container.screenshot({ 
              type: 'png',
              omitBackground: false
            }));
          } else {
            screenshot = Buffer.from(await page.screenshot({ 
              type: 'png',
              omitBackground: false
            }));
          }
          await browser.close();
          
          // Optimiser l'image Mondrian avec sharp - garder PNG pour meilleure qualité des textes
          const optimizedBuffer = await sharp(screenshot)
            .resize(1600, null, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ 
              quality: 95,
              compressionLevel: 6,
              adaptiveFiltering: true
            })
            .toBuffer();
          
          const base64 = optimizedBuffer.toString('base64');
          const originalSize = (screenshot.length / 1024).toFixed(2);
          const optimizedSize = (optimizedBuffer.length / 1024).toFixed(2);
          console.log(`[PDF] Image Mondrian optimisée: ${originalSize}KB -> ${optimizedSize}KB`);
          return `data:image/png;base64,${base64}`;
        };

        console.log(`[PDF] Génération Mondrian - Prix FAI: ${prixFaiData.length} items, Financement: ${prixFaiDataFin.length} items`);
        
        if (prixFaiData.length > 0) {
          mondrianPrixFaiImage = await generateMondrianImage(prixFaiData, 'Décomposition du prix FAI', resultsBP.resultats?.prix_fai || 1);
          console.log(`[PDF] Image Prix FAI générée: ${mondrianPrixFaiImage ? 'OK (' + mondrianPrixFaiImage.substring(0, 50) + '...)' : 'ÉCHEC'}`);
        }
        
        if (prixFaiDataFin.length > 0) {
          mondrianFinancementImage = await generateMondrianImage(prixFaiDataFin, 'Répartition financement FAI', prixFaiFin);
          console.log(`[PDF] Image Financement générée: ${mondrianFinancementImage ? 'OK (' + mondrianFinancementImage.substring(0, 50) + '...)' : 'ÉCHEC'}`);
        }
      } catch (err) {
        console.error('[PDF] Erreur génération Mondrian:', err);
      }

      // Ajouter la section Mondrian au PDF si les images sont disponibles
      if (mondrianPrixFaiImage || mondrianFinancementImage) {
        const mondrianSection = `
          <div style="padding: 1.5rem; font-family: Arial, sans-serif; background: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; gap: 2rem;">
            ${mondrianPrixFaiImage ? `
              <div style="margin-bottom: 1rem; page-break-inside: avoid;">
                <h2 style="font-weight: 800; font-size: 1.5rem; margin: 0 0 0.5rem 0; color: #1a3557; text-align: center;">
                  Décomposition du prix FAI
                </h2>
                <div style="text-align: center; margin-bottom: 1rem; font-size: 0.95rem; color: #64748b; font-weight: 600;">
                  Prix FAI = Prix de revient (${formatKCurrency(prixRevient)}) + Marge (${formatKCurrency(margeNette)}) + Frais agence vente (${formatKCurrency(fraisAgenceVenteForSubtitle)}) = ${formatKCurrency(prixFaiTotal)}
                </div>
                <div style="display: flex; justify-content: center; align-items: center;">
                  <img src="${mondrianPrixFaiImage}" alt="Décomposition du prix FAI" style="max-width: 100%; height: auto; border-radius: 8px; display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                </div>
              </div>
            ` : ''}
            ${mondrianFinancementImage ? `
              <div style="page-break-inside: avoid;">
                <h2 style="font-weight: 800; font-size: 1.5rem; margin: 0 0 0.5rem 0; color: #1a3557; text-align: center;">
                  Répartition financement FAI
                </h2>
                <div style="text-align: center; margin-bottom: 1rem; font-size: 0.9rem; color: #64748b; font-weight: 600;">
                  Prix FAI = Fonds propres (${formatKCurrency(totalFondsPropresForSubtitle)}) + Crédits (${formatKCurrency(totalCredits)}) + Marge (${formatKCurrency(margeNette)}) + Frais agence vente (${formatKCurrency(fraisAgenceVenteForSubtitle)}) = ${formatKCurrency(prixFaiTotal)}
                </div>
                <div style="display: flex; justify-content: center; align-items: center;">
                  <img src="${mondrianFinancementImage}" alt="Répartition financement FAI" style="max-width: 100%; height: auto; border-radius: 8px; display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                </div>
              </div>
            ` : ''}
          </div>
        `;
        htmlContent += mondrianSection;
        htmlContent += '<div class="page-break"></div>';
      } else {
        console.log('[PDF] Aucune image Mondrian générée - vérifier les données du business plan');
    }

    // ===== SECTION CHART PRIX/M2 =====
      const financialChartTemplate = await fs.promises.readFile(
        path.join(templatesDir, 'financial_chart_modern.html'),
        'utf-8'
      );
      const compiledFinancialChart = Handlebars.compile(financialChartTemplate);
      htmlContent += compiledFinancialChart(financialData);
      htmlContent += '<div class="page-break"></div>';

    // ===== SECTION 6: ANNEXES =====
      htmlContent += compiledSectionIntro({
      title: 'Annexes',
      description: 'Liste détaillée des transactions immobilières utilisées pour l\'analyse comparative.',
      description_2: '',
      summary: ''
    });

    // ===== SECTION TRANSACTIONS DVF (pagination) =====
    // Réutilisation des données DVF déjà préparées
    const dvfTransactionsSortedForPages = [...dvfTransactionsSorted].sort((a, b) => (b.date_mutation || '').localeCompare(a.date_mutation || ''));
      const pageSize = 20;
    const numPages = Math.ceil(dvfTransactionsSortedForPages.length / pageSize) || 1;

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
      const pageTransactions = dvfTransactionsSortedForPages.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);
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

    htmlContent += '</body></html>';

    // DEBUG: Sauvegarder le HTML généré
    const tempHtmlPath = `/data/lki/pdf_debug_${projectId}_${Date.now()}.html`;
    await fs.promises.writeFile(tempHtmlPath, htmlContent, 'utf-8');
    console.log(`[DEBUG] HTML sauvegardé dans: ${tempHtmlPath}`);

    // 5. Génération du PDF avec Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Configurer Puppeteer pour accéder aux fichiers locaux
    await page.setRequestInterception(true);
    
    // Variables pour le suivi des images
    let imageCount = 0;
    let totalImageSizeMB = 0;
    let photoCount = 0;
    let otherImageCount = 0;
    const imageLogs: Array<{name: string, size: number, optimized: boolean, type: string}> = [];
    const imageRequestCounts: Map<string, number> = new Map(); // Compter les requêtes par image
    
    page.on('request', request => {
        const url = request.url();
      // Gérer les images et PDFs depuis le système de fichiers local
      if (request.resourceType() === 'image' || url.endsWith('.pdf') || url.includes('/uploads/')) {
        let filePath: string;
        if (url.startsWith('http://localhost:3001/uploads/')) {
          filePath = url.replace('http://localhost:3001', '/data/lki');
        } else if (url.startsWith('http://163.172.32.45:3001/uploads/')) {
          // Gérer aussi l'IP directe (même serveur)
          filePath = url.replace('http://163.172.32.45:3001', '/data/lki');
        } else if (url.startsWith('/data/lki/')) {
          filePath = url;
        } else {
          request.continue();
          return;
        }
        
        if (fs.existsSync(filePath)) {
          try {
            const ext = path.extname(filePath).toLowerCase();
            const stats = fs.statSync(filePath);
            const originalSizeMB = stats.size / 1024 / 1024;
            const originalSizeKB = stats.size / 1024;
            
            // Identifier le type
            const isPhoto = /\/uploads\/\d+\/(before|during|after|3d|plans)\//.test(filePath);
            const fileName = path.basename(filePath);
            const imageType = ext === '.pdf' ? 'PDF' :
                            isPhoto ? 'PHOTO' : 
                            filePath.includes('LOGO') ? 'LOGO' :
                            filePath.includes('cover') ? 'COVER' :
                            filePath.includes('chart') ? 'CHART' :
                            filePath.includes('mondrian') ? 'MONDIAN' :
                            filePath.includes('map') ? 'MAP' : 'OTHER';
            
            // Compter les requêtes pour cette image
            const currentCount = imageRequestCounts.get(filePath) || 0;
            imageRequestCounts.set(filePath, currentCount + 1);
            if (currentCount > 0) {
              console.error(`[PDF] ⚠️ Image demandée ${currentCount + 1} fois: ${fileName} (${imageType})`);
            }
            
            // Pour les PDFs, servir directement
            if (ext === '.pdf') {
              const fileBuffer = fs.readFileSync(filePath);
            request.respond({
              status: 200,
                contentType: 'application/pdf',
                body: fileBuffer
              });
              return;
            }
            
            // Pour les photos, OPTIMISER FORCÉMENT pour éviter que Puppeteer gonfle le PDF
            if (isPhoto) {
              const originalBuffer = fs.readFileSync(filePath);
              
              // Optimiser la photo de manière asynchrone
              sharp(originalBuffer)
                .metadata()
                .then(metadata => {
                  const originalDimensions = metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : 'unknown';
                  
                  // Optimiser la photo : max 1200px (réduit drastiquement), qualité 60% (plus agressif)
                  // Cela limite la résolution que Puppeteer peut utiliser dans le PDF
                  return sharp(originalBuffer)
                    .resize(1200, null, {
                      fit: 'inside',
                      withoutEnlargement: true
                    })
                    .jpeg({ quality: 60 })
                    .toBuffer()
                    .then(optimizedBuffer => {
                      imageCount++;
                      totalImageSizeMB += originalSizeMB; // Compter la taille originale
                      photoCount++;
                      
                      imageLogs.push({
                        name: fileName,
                        size: originalSizeMB,
                        optimized: true,
                        type: imageType
                      });
                      
                      request.respond({
                        status: 200,
                        contentType: 'image/jpeg',
                        body: optimizedBuffer
                      });
                    });
                })
                .catch(err => {
                  console.error(`[PDF] Erreur optimisation photo ${filePath}:`, err);
                  // En cas d'erreur, servir l'original
                  imageCount++;
                  totalImageSizeMB += originalSizeMB;
                  photoCount++;
                  imageLogs.push({
                    name: fileName,
                    size: originalSizeMB,
                    optimized: false,
                    type: imageType
                  });
                  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                                     ext === '.png' ? 'image/png' :
                                     ext === '.webp' ? 'image/webp' :
                                     ext === '.gif' ? 'image/gif' : 'application/octet-stream';
                  request.respond({
                    status: 200,
                    contentType: contentType,
                    body: originalBuffer
                  });
                });
              return; // Important : ne pas continuer après avoir lancé l'optimisation async
            }
            
            // Pour les autres images (logos, charts, maps), servir directement
            const fileBuffer = fs.readFileSync(filePath);
            if (originalSizeKB > 100) {
              console.log(`[PDF] Image servie: ${fileName} (${imageType}) - ${originalSizeMB.toFixed(2)}MB`);
            }
            
            imageCount++;
            totalImageSizeMB += originalSizeMB;
            otherImageCount++;
            
            imageLogs.push({
              name: fileName,
              size: originalSizeMB,
              optimized: false,
              type: imageType
            });
            
            const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                               ext === '.png' ? 'image/png' :
                               ext === '.webp' ? 'image/webp' :
                               ext === '.gif' ? 'image/gif' : 'application/octet-stream';
            
            request.respond({
              status: 200,
              contentType: contentType,
              body: fileBuffer
            });
          } catch (error) {
            console.error(`Erreur lors de la lecture du fichier ${filePath}:`, error);
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
    
    // ===== RÉSUMÉ DÉTAILLÉ APRÈS GÉNÉRATION =====
    const pdfSizeMB = pdf.length / 1024 / 1024;
    console.log(`\n========== [PDF] RÉSUMÉ APRÈS GÉNÉRATION ==========`);
    console.log(`[PDF] Taille PDF généré par Puppeteer: ${pdfSizeMB.toFixed(2)} MB`);
    console.log(`[PDF] Total images servies: ${imageCount}`);
    console.log(`[PDF] Photos: ${photoCount}, Autres: ${otherImageCount}`);
    console.log(`[PDF] Taille totale des images servies: ${totalImageSizeMB.toFixed(2)} MB`);
    
    // Top 10 des plus grosses images
    const sortedImages = imageLogs.sort((a: {name: string, size: number, optimized: boolean, type: string}, b: {name: string, size: number, optimized: boolean, type: string}) => b.size - a.size).slice(0, 10);
    console.log(`\n[PDF] Top 10 des plus grosses images servies:`);
    sortedImages.forEach((img: {name: string, size: number, optimized: boolean, type: string}, idx: number) => {
      console.log(`  ${idx + 1}. ${img.name} (${img.type}) - ${img.size.toFixed(2)}MB`);
    });
    
    // Analyse de la différence
    const imageSizeRatio = totalImageSizeMB > 0 ? (pdfSizeMB / totalImageSizeMB).toFixed(2) : 'N/A';
    console.log(`\n[PDF] Ratio PDF/Images: ${imageSizeRatio}x (si > 10x, il y a probablement un problème)`);
    
    // Afficher les images chargées plusieurs fois
    const duplicateImages = Array.from(imageRequestCounts.entries()).filter(([_, count]) => count > 1);
    if (duplicateImages.length > 0) {
      console.log(`\n[PDF] ⚠️ Images chargées plusieurs fois:`);
      duplicateImages.forEach(([filePath, count]) => {
        console.log(`  ${path.basename(filePath)}: ${count} fois`);
      });
    }
    
    console.log(`==========================================\n`);

    // 6. Compression du PDF avec Ghostscript
    let compressedPdf = pdf;
    try {
      
      // Créer des fichiers temporaires
      const tempInputPath = `/tmp/pdf_input_${Date.now()}.pdf`;
      const tempOutputPath = `/tmp/pdf_output_${Date.now()}.pdf`;
      
      // Écrire le PDF dans un fichier temporaire
      fs.writeFileSync(tempInputPath, pdf);
      
      // Utiliser Ghostscript pour compresser le PDF
      // -dPDFSETTINGS=/screen : qualité la plus basse (72 dpi)
      // -dPDFSETTINGS=/ebook : qualité moyenne (150 dpi) - bon compromis
      // -dPDFSETTINGS=/prepress : qualité haute (300 dpi)
      // -dPDFSETTINGS=/printer : qualité impression (300 dpi)
      // On utilise /ebook pour un bon compromis qualité/taille
      const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${tempOutputPath} ${tempInputPath}`;
      
      await execAsync(gsCommand);
      
      // Lire le PDF compressé
      if (fs.existsSync(tempOutputPath)) {
        compressedPdf = fs.readFileSync(tempOutputPath);
        const compressedSize = compressedPdf.length / 1024 / 1024;
        // Nettoyer les fichiers temporaires
        fs.unlinkSync(tempInputPath);
        fs.unlinkSync(tempOutputPath);
      } else {
        throw new Error('Fichier de sortie Ghostscript non créé');
      }
    } catch (error) {
      console.error('[PDF] Erreur lors de la compression avec Ghostscript, utilisation du PDF original:', error);
      compressedPdf = pdf;
      // Nettoyer les fichiers temporaires en cas d'erreur
      try {
        const tempFiles = fs.readdirSync('/tmp').filter(f => f.startsWith('pdf_input_') || f.startsWith('pdf_output_'));
        tempFiles.forEach(f => {
          try { fs.unlinkSync(`/tmp/${f}`); } catch {}
        });
      } catch {}
    }

    // 7. Envoi du PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Business_Plan_Modern_${project_title.replace(/\s+/g, '_')}.pdf`);
    res.end(compressedPdf);

  } catch (error) {
    console.error('Erreur lors de la génération du PDF moderne:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du PDF moderne',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// Route pour générer le PDF de clôture de projet
router.post('/generate-closing', async (req: Request, res: Response) => {
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

    // Utiliser le PdfMappingClosingService pour extraire les données
    const pdfData = PdfMappingClosingService.mapProjectToPdfData(project, validatedConfig || {});

    // 1. Préparation des données
    const project_title = project.projectTitle || 'Sans titre';
    const dynamicFields = req.body.dynamicFields || {};

    // 2. Préparation des assets
    const logo_path = '/data/lki/uploads/LOGO-LK-noir_2025.png';
    const cover_image_path = '/data/lki/uploads/cover_LKI.png';
    const css_path = path.join(__dirname, '..', 'static', 'pdf_assets', 'styles_modern.css');

    // Conversion des images logo/cover en base64
    const logo_base64 = imageToBase64(logo_path);
    const cover_image_base64 = imageToBase64(cover_image_path);

    // 3. Lecture des templates et du CSS
    const templatesDir = path.join(__dirname, '..', 'templates', 'pdf', 'closing');
    const cssContent = await fs.promises.readFile(css_path, 'utf-8');

    // Lecture du template de clôture
    const closingTemplate = await fs.promises.readFile(
      path.join(templatesDir, 'closing.html'),
      'utf-8'
    );
    const compiledClosing = Handlebars.compile(closingTemplate);

    // Génération du graphique financier (comparatif prix achat/revient/vente) pour le réalisé
    let vente_chart_url = '';
    try {
      const prix_achat = pdfData.resultsBusinessPlanRealises?.prix_m2?.prix_achat_pondere_m2 || 0;
      const prix_revient = pdfData.resultsBusinessPlanRealises?.prix_m2?.prix_revient_pondere_m2 || 0;
      const prix_vente = pdfData.resultsBusinessPlanRealises?.prix_m2?.prix_vente_pondere_m2 || 0;
      const prix_achat_carrez = pdfData.resultsBusinessPlanRealises?.prix_m2?.prix_achat_carrez_m2 || 0;
      const prix_revient_carrez = pdfData.resultsBusinessPlanRealises?.prix_m2?.prix_revient_carrez_m2 || 0;
      const prix_vente_carrez = pdfData.resultsBusinessPlanRealises?.prix_m2?.prix_vente_carrez_m2 || 0;
      const prix_m2_benchmark = pdfData.resultsDvfMetadata?.sel_final_avg || null;

      const allVals = [prix_achat, prix_revient, prix_vente, prix_achat_carrez, prix_revient_carrez, prix_vente_carrez].filter(v => typeof v === 'number' && v > 0);
      const minVal = allVals.length > 0 ? Math.min(...allVals) : 0;
      const yMin = Math.max(0, Math.floor(minVal - 500));

      const chartConfig = {
        type: 'bar',
        data: {
          labels: ['Achat (pondéré)', 'Revient (pondéré)', 'Vente (pondéré)', 'Achat (carrez)', 'Revient (carrez)', 'Vente (carrez)'],
          datasets: [
            {
              label: 'Prix/m²',
              data: [prix_achat, prix_revient, prix_vente, prix_achat_carrez, prix_revient_carrez, prix_vente_carrez],
              backgroundColor: ['#bfa77a', '#c97c2b', '#0a6c9d', '#bfa77a', '#c97c2b', '#0a6c9d'],
            },
            ...(prix_m2_benchmark ? [{
              type: 'line',
              label: '',
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
          plugins: { 
            legend: { 
              display: false,
              labels: {
                display: false
              }
            },
            datalabels: {
              display: false
            }
          },
          scales: {
            yAxes: [{
              display: true,
              scaleLabel: { 
                display: true, 
                labelString: 'Prix (€/m²)',
                font: {
                  size: 30,
                  weight: 'bold'
                }
              },
              ticks: { 
                min: yMin,
                font: {
                  size: 36,
                  weight: 'bold'
                }
              }
            }],
            y: { 
              title: { 
                display: true, 
                text: 'Prix (€/m²)',
                font: {
                  size: 34,
                  weight: 'bold'
                }
              }, 
              min: yMin,
              ticks: {
                font: {
                  size: 36,
                  weight: 'bold'
                }
              }
            },
            x: { 
              title: { 
                display: true, 
                text: 'Type',
                font: {
                  size: 34,
                  weight: 'bold'
                }
              },
              ticks: {
                font: {
                  size: 36,
                  weight: 'bold'
                }
              }
            }
          }
        }
      };
      const chart = new QuickChart();
      chart.setConfig(chartConfig);
      chart.setWidth(700).setHeight(550).setBackgroundColor('transparent');
      vente_chart_url = chart.getUrl();
    } catch (err) {
      console.error('[PDF] Erreur génération graphique vente (closing):', err);
    }

    // Préparation des données pour le template
    const templateData = {
      ...pdfData,
      vente_chart_url,
      logo_path: logo_base64,
      cover_image_path: cover_image_base64,
      ...(pdfData.pdf_config?.dynamic_fields || {})
    };

    // Génération du HTML
    const htmlContent = compiledClosing(templateData);

    // DEBUG: Sauvegarder le HTML généré
    const tempHtmlPath = `/data/lki/pdf_closing_debug_${projectId}.html`;
    // 5. Génération du PDF avec Puppeteer
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

    // 6. Envoi du PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Project_Closing_${project_title.replace(/\s+/g, '_')}.pdf`);
    res.end(pdf);

  } catch (error) {
    console.error('Erreur lors de la génération du PDF closing:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération du PDF closing',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

export default router;

