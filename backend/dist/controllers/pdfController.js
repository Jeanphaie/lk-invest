"use strict";
const extractPdfVariables = require('../utils/extractPdfVariables');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
// Fonctions utilitaires pour le formatage
const formatCurrency = (value, unit = '€', decimals = 0) => {
    if (value === null || value === undefined || value === 0)
        return 'N/A';
    return `${Number(value).toFixed(decimals)} ${unit}`;
};
const formatKCurrency = (value, decimals = 0) => {
    return formatCurrency(value, 'k€', decimals);
};
const formatPercentage = (value, decimals = 2) => {
    if (value === null || value === undefined)
        return 'N/A';
    return `${Number(value).toFixed(decimals)}%`;
};
// Enregistrer les helpers Handlebars
handlebars.registerHelper('formatCurrency', formatCurrency);
handlebars.registerHelper('formatKCurrency', formatKCurrency);
handlebars.registerHelper('formatPercentage', formatPercentage);
class PDFController {
    constructor() {
        this.templatesPath = path.join(__dirname, '../templates');
    }
    async loadTemplate(templateName) {
        const templatePath = path.join(this.templatesPath, `${templateName}.html`);
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        return handlebars.compile(templateContent);
    }
    async generatePDF(projectTitle) {
        try {
            // 1. Extraire toutes les données du projet
            const pdfData = await extractPdfVariables(projectTitle);
            if (!pdfData) {
                throw new Error(`Aucune donnée trouvée pour le projet ${projectTitle}`);
            }
            // 2. Charger tous les templates
            const templates = {
                cover: await this.loadTemplate('cover_page'),
                summary: await this.loadTemplate('toc_page'),
                property: await this.loadTemplate('property_description'),
                valuation_lk: await this.loadTemplate('valuation_lk_invest'),
                valuation_casa: await this.loadTemplate('valuation_casafari'),
                financial: await this.loadTemplate('financial_data')
            };
            // 3. Générer le HTML pour chaque section
            const htmlContent = {
                cover: templates.cover(pdfData.cover),
                summary: templates.summary(pdfData),
                property: templates.property(pdfData.property),
                valuation_lk: templates.valuation_lk(pdfData.market),
                valuation_casa: templates.valuation_casa(pdfData.market),
                financial: templates.financial(pdfData.businessPlan)
            };
            // 4. Assembler le HTML final
            const finalHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              /* Styles communs pour le PDF */
              body { font-family: Arial, sans-serif; }
              .page-break { page-break-after: always; }
              /* Autres styles... */
            </style>
          </head>
          <body>
            ${htmlContent.cover}
            <div class="page-break"></div>
            ${htmlContent.summary}
            <div class="page-break"></div>
            ${htmlContent.property}
            <div class="page-break"></div>
            ${htmlContent.valuation_lk}
            <div class="page-break"></div>
            ${htmlContent.valuation_casa}
            <div class="page-break"></div>
            ${htmlContent.financial}
          </body>
        </html>
      `;
            // 5. Générer le PDF avec Puppeteer
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox']
            });
            const page = await browser.newPage();
            await page.setContent(finalHtml, {
                waitUntil: 'networkidle0'
            });
            // Configurer le format du PDF
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
            return pdfBuffer;
        }
        catch (error) {
            console.error('Erreur lors de la génération du PDF:', error);
            throw error;
        }
    }
}
module.exports = new PDFController();
