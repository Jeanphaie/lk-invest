"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_1 = require("@prisma/client");
const Handlebars = __importStar(require("handlebars"));
const project_service_1 = require("../services/project.service");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const projectService = new project_service_1.ProjectService();
// Fonctions utilitaires pour le formatage
const formatCurrency = (value, unit = '€', decimals = 0) => {
    if (value === null || value === undefined)
        return '0 ' + unit;
    try {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return `${numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${unit}`;
    }
    catch (_a) {
        return '0 ' + unit;
    }
};
const formatKCurrency = (value, decimals = 0) => {
    if (value === null || value === undefined)
        return '0 k€';
    try {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return formatCurrency(numValue / 1000, 'k€', decimals);
    }
    catch (_a) {
        return '0 k€';
    }
};
const formatPercentage = (value) => {
    if (value === null || value === undefined)
        return '0%';
    return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + '%';
};
const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined)
        return '0';
    try {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return numValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
    catch (_a) {
        return '0';
    }
};
// Enregistrer les helpers Handlebars
Handlebars.registerHelper('formatCurrency', formatCurrency);
Handlebars.registerHelper('formatKCurrency', formatKCurrency);
Handlebars.registerHelper('formatPercentage', formatPercentage);
Handlebars.registerHelper('formatNumber', formatNumber);
Handlebars.registerHelper('multiply', (a, b) => a * b);
// Fonction pour convertir une image en base64
const imageToBase64 = (filePath) => {
    try {
        const image = fs_1.default.readFileSync(filePath);
        return `data:image/${path_1.default.extname(filePath).slice(1)};base64,${image.toString('base64')}`;
    }
    catch (error) {
        console.error('Erreur lors de la conversion de l\'image:', error);
        return '';
    }
};
// Route pour générer le PDF à partir d'un projet existant
router.get('/generate/:projectId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        console.log('Generating PDF for project:', projectId);
        // Récupérer le projet
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        // Utiliser le service pour extraire les données (déjà aplaties)
        const pdfData = await projectService.extractPdfData(projectId);
        // Préparation des assets
        const templatesDir = path_1.default.join(__dirname, '..', 'templates');
        const cssPath = path_1.default.join(__dirname, '..', 'static', 'pdf_assets', 'styles_new.css');
        const cssContent = await fs_1.default.promises.readFile(cssPath, 'utf-8');
        // Charger et compiler les templates avec Handlebars
        const templates = {
            cover: Handlebars.compile(await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'cover_page.html'), 'utf-8')),
            summary: Handlebars.compile(await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'toc_page.html'), 'utf-8')),
            property: Handlebars.compile(await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'property_description.html'), 'utf-8')),
            valuation_lk: Handlebars.compile(await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'valuation_lk_invest.html'), 'utf-8')),
            valuation_casa: Handlebars.compile(await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'valuation_casafari.html'), 'utf-8')),
            valuation_renovation: Handlebars.compile(await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'valuation_renovation.html'), 'utf-8')),
            financial: Handlebars.compile(await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'financial_data.html'), 'utf-8'))
        };
        // Debug: afficher les données complètes
        console.log('Données complètes du PDF:', JSON.stringify(pdfData, null, 2));
        // Assembler le HTML final
        let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>${cssContent}</style>
        </head>
        <body>
    `;
        // Ajouter le logo et les images
        const pdfDataWithAssets = Object.assign(Object.assign({}, pdfData), { logo_path: imageToBase64('/data/lki/uploads/LOGO-LK-noir_2025.png'), cover_image_path: imageToBase64('/data/lki/uploads/cover_LKI.png') });
        // Utiliser directement les données aplaties pour chaque template
        htmlContent += templates.cover(pdfDataWithAssets);
        htmlContent += '<div class="page-break"></div>' + templates.summary(pdfDataWithAssets);
        htmlContent += '<div class="page-break"></div>' + templates.property(pdfDataWithAssets);
        htmlContent += '<div class="page-break"></div>' + templates.valuation_lk(pdfDataWithAssets);
        htmlContent += '<div class="page-break"></div>' + templates.valuation_casa(pdfDataWithAssets);
        htmlContent += '<div class="page-break"></div>' + templates.valuation_renovation(pdfDataWithAssets);
        htmlContent += '<div class="page-break"></div>' + templates.financial(pdfDataWithAssets);
        htmlContent += '</body></html>';
        // DEBUG: Sauvegarder le HTML généré dans un fichier temporaire
        const tempHtmlPath = `/tmp/pdf_debug_${projectId}.html`;
        try {
            fs_1.default.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
            console.log(`[PDF DEBUG] HTML sauvegardé dans ${tempHtmlPath}`);
        }
        catch (err) {
            console.error('[PDF DEBUG] Erreur lors de la sauvegarde du HTML:', err);
        }
        // Générer le PDF avec Puppeteer
        const browser = await puppeteer_1.default.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });
        await browser.close();
        // Envoyer le PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${project.projectTitle || 'projet'}.pdf`);
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        res.status(500).json({
            error: 'Erreur lors de la génération du PDF',
            details: error instanceof Error ? error.message : 'Erreur inconnue'
        });
    }
});
// Route pour générer le PDF à partir des données POST
router.post('/generate', async (req, res) => {
    try {
        console.log('[PDF] Début de la génération du PDF');
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        // Récupérer le projet depuis la base de données
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        // Utiliser le service pour extraire les données
        const data = await projectService.extractPdfData(projectId);
        // 1. Préparation des données
        const project_title = project.projectTitle || 'Sans titre';
        const adresse = project.adresseBien || '';
        const includeSections = req.body.includeSections || {};
        const dynamicFields = req.body.dynamicFields || {};
        // 2. Préparation des assets
        const logo_path = '/data/lki/uploads/LOGO-LK-noir_2025.png';
        const cover_image_path = '/data/lki/uploads/cover_LKI.png';
        const css_path = path_1.default.join(__dirname, '..', 'static', 'pdf_assets', 'styles_new.css');
        // Conversion des images en base64
        const logo_base64 = imageToBase64(logo_path);
        const cover_image_base64 = imageToBase64(cover_image_path);
        // 3. Lecture des templates et du CSS
        const templatesDir = path_1.default.join(__dirname, '..', 'templates');
        console.log('[PDF] Lecture du CSS');
        const cssContent = await fs_1.default.promises.readFile(css_path, 'utf-8');
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
            console.log('[PDF] Génération de la page de couverture');
            const coverTemplate = await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'cover_page.html'), 'utf-8');
            const compiledCover = Handlebars.compile(coverTemplate);
            const coverData = Object.assign(Object.assign(Object.assign({}, data), { logo_path: logo_base64, cover_image_path: cover_image_base64 }), dynamicFields);
            console.log('[PDF] Données pour la couverture:', coverData);
            htmlContent += compiledCover(coverData);
            htmlContent += '<div class="page-break"></div>';
        }
        if (includeSections.summary) {
            console.log('[PDF] Génération de la table des matières');
            const tocTemplate = await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'toc_page.html'), 'utf-8');
            const compiledToc = Handlebars.compile(tocTemplate);
            htmlContent += compiledToc(data);
            htmlContent += '<div class="page-break"></div>';
        }
        if (includeSections.property_description) {
            console.log('[PDF] Génération de la description du bien');
            const propertyTemplate = await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'property_description.html'), 'utf-8');
            const compiledProperty = Handlebars.compile(propertyTemplate);
            htmlContent += compiledProperty(data);
        }
        if (includeSections.valuation_lk_invest) {
            console.log('[PDF] Génération de l\'évaluation LK Invest');
            console.log('[PDF] DEBUG RAYON - Avant compilation template LK Invest, rayon:', data.rayon);
            console.log('[PDF] DEBUG RAYON - Données complètes pour LK Invest:', JSON.stringify(data, null, 2));
            const valuationLkTemplate = await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'valuation_lk_invest.html'), 'utf-8');
            const compiledValuationLk = Handlebars.compile(valuationLkTemplate);
            htmlContent += compiledValuationLk(data);
        }
        // if (includeSections.valuation_casafari) {
        //   console.log('[PDF] Génération de l\'évaluation Casafari');
        //   const valuationCasaTemplate = await fs.promises.readFile(
        //     path.join(templatesDir, 'valuation_casafari.html'),
        //     'utf-8'
        //   );
        //   const compiledValuationCasa = Handlebars.compile(valuationCasaTemplate);
        //   htmlContent += compiledValuationCasa(data);
        //   htmlContent += '<div class="page-break"></div>';
        // }
        if (includeSections.financial_data) {
            console.log('[PDF] Génération des données financières');
            const financialTemplate = await fs_1.default.promises.readFile(path_1.default.join(templatesDir, 'financial_data.html'), 'utf-8');
            const compiledFinancial = Handlebars.compile(financialTemplate);
            htmlContent += compiledFinancial(data);
        }
        htmlContent += '</body></html>';
        // DEBUG: Sauvegarder le HTML généré dans un fichier temporaire
        const tempHtmlPath = `/data/lki/pdf_debug_post_${projectId}.html`;
        try {
            fs_1.default.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
            console.log(`[PDF DEBUG] HTML sauvegardé dans ${tempHtmlPath}`);
        }
        catch (err) {
            console.error('[PDF DEBUG] Erreur lors de la sauvegarde du HTML:', err);
        }
        // 5. Génération du PDF avec Puppeteer
        console.log('[PDF] Début de la génération du PDF avec Puppeteer');
        const browser = await puppeteer_1.default.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
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
    }
    catch (error) {
        console.error('[PDF] Erreur lors de la génération du PDF:', error);
        res.status(500).json({
            error: 'Erreur lors de la génération du PDF',
            message: error instanceof Error ? error.message : 'Erreur inconnue'
        });
    }
});
exports.default = router;
