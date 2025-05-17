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
        // Champs dynamiques à plat pour le template
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

      function buildDvfTableHtml(transactions: any[] = []): string {
        if (!Array.isArray(transactions)) return '';
        const formatKCurrency = (value: number, decimals = 0) => {
          if (typeof value !== 'number' || isNaN(value)) return 'N/A';
          return (Math.round(value / 1000 * Math.pow(10, decimals)) / Math.pow(10, decimals))
            .toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        };
        // Tri décroissant par date
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

      function buildTrendTableHtml(trendSeries: any[] = []): string {
        if (!Array.isArray(trendSeries)) return '';
        const formatKCurrency = (value: number, decimals = 2) => {
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

      function buildTrendChartUrl(trendSeries: any[] = []): string {
        if (!Array.isArray(trendSeries) || !trendSeries.length) return '';
        const chart = new QuickChart();
        chart.setConfig({
          type: 'line',
          data: {
            labels: trendSeries.map(t => t.year),
            datasets: [
              {
                label: 'Sélection',
                data: trendSeries.map(t => t.selection_avg / 1000),
                borderColor: '#5C4033',
                fill: false,
              },
              {
                label: 'Arrondissement',
                data: trendSeries.map(t => t.arrondissement_avg / 1000),
                borderColor: '#bfa77a',
                fill: false,
              },
              {
                label: 'Premium (Top 10%)',
                data: trendSeries.map(t => t.premium_avg / 1000),
                borderColor: '#c97c2b',
                fill: false,
              },
            ],
          },
          options: {
            plugins: { title: { display: true, text: 'Évolution des prix/m² (2019-2024)' } },
            scales: {
              y: { title: { display: true, text: 'Prix (k€)' } },
              x: { title: { display: true, text: 'Année' } }
            }
          }
        });
        chart.setWidth(600).setHeight(300).setBackgroundColor('transparent');
        return chart.getUrl();
      }

      function buildDistributionChartUrl(distributionSeries: any[] = []): string {
        if (!Array.isArray(distributionSeries) || !distributionSeries.length) return '';
        // Log chaque objet de distributionSeries
        console.log('[PDF][DEBUG] distributionSeries objets (dans chart):', JSON.stringify(distributionSeries, null, 2));
        const labels = distributionSeries.map(d => d.bin ?? (typeof d.prixM2 === 'number' ? `${d.prixM2}` : ''));
        const data = distributionSeries.map(d => d.count ?? d.nombreTransactions ?? 0);
        console.log('[PDF][DEBUG] distributionSeries labels:', labels);
        console.log('[PDF][DEBUG] distributionSeries data:', data);

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

      // Ajoute des logs pour debug la structure de distributionSeries
      console.log('[PDF][DEBUG] distributionSeries (raw):', JSON.stringify(distributionSeries));
      if (distributionSeries.length > 0) {
        console.log('[PDF][DEBUG] distributionSeries[0]:', distributionSeries[0]);
      }

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

export default router;
