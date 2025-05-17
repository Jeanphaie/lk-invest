"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const client_1 = require("@prisma/client");
const pdfMapping_1 = require("./pdfMapping");
const prisma = new client_1.PrismaClient();
class ProjectService {
    // Récupérer un projet par son ID avec validation des types
    async getProjectById(id) {
        const project = await prisma.project.findUnique({
            where: { id },
            select: {
                id: true,
                projectTitle: true,
                adresseBien: true,
                lienAnnonce: true,
                latitude: true,
                longitude: true,
                inputsGeneral: true,
                inputsDescriptionBien: true,
                resultsDescriptionBien: true,
                inputsBusinessPlan: true,
                resultsBusinessPlan: true,
                inputsDvf: true,
                resultsDvf: true,
                photosBefore: true,
                photos3d: true,
                photosDuring: true,
                photosAfter: true,
                pdfConfig: true,
                coverPhoto: true,
                selectedBeforePhotosForPdf: true,
                selected3dPhotosForPdf: true,
                createdAt: true,
                updatedAt: true
            }
        });
        console.log('DEBUG RAW PRISMA PROJECT:', project);
        if (!project)
            return null;
        // Cast et validation des types JSON
        const validatedProject = {
            id: project.id,
            projectTitle: project.projectTitle,
            adresseBien: project.adresseBien || undefined,
            lienAnnonce: project.lienAnnonce || undefined,
            inputsGeneral: this.validateJson(project.inputsGeneral),
            inputsDescriptionBien: this.validateJson(project.inputsDescriptionBien),
            resultsDescriptionBien: this.validateJson(project.resultsDescriptionBien),
            inputsBusinessPlan: this.validateJson(project.inputsBusinessPlan),
            resultsBusinessPlan: this.validateJson(project.resultsBusinessPlan),
            inputsDvf: this.validateJson(project.inputsDvf),
            resultsDvf: this.validateJson(project.resultsDvf),
            photosBefore: this.validateJson(project.photosBefore) || [],
            photos3d: this.validateJson(project.photos3d) || [],
            photosDuring: this.validateJson(project.photosDuring) || [],
            photosAfter: this.validateJson(project.photosAfter) || [],
            pdfConfig: this.validateJson(project.pdfConfig),
            coverPhoto: project.coverPhoto || undefined,
            selectedBeforePhotosForPdf: this.validateJson(project.selectedBeforePhotosForPdf) || [],
            selected3dPhotosForPdf: this.validateJson(project.selected3dPhotosForPdf) || [],
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            latitude: project.latitude,
            longitude: project.longitude
        };
        console.log('DEBUG FINAL PROJECT OBJ:', validatedProject);
        return validatedProject;
    }
    // Extraire les données pour le PDF
    async extractPdfData(id) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
        const project = await this.getProjectById(id);
        if (!project)
            throw new Error(`Project with ID ${id} not found`);
        console.log('DEBUG PROJECT OBJ:', project);
        // Correction : parser les champs sélectionnés pour PDF si besoin
        if (typeof project.selectedBeforePhotosForPdf === 'string') {
            try {
                project.selectedBeforePhotosForPdf = JSON.parse(project.selectedBeforePhotosForPdf);
            }
            catch (_z) {
                project.selectedBeforePhotosForPdf = [];
            }
        }
        if (!Array.isArray(project.selectedBeforePhotosForPdf)) {
            project.selectedBeforePhotosForPdf = [];
        }
        if (typeof project.selected3dPhotosForPdf === 'string') {
            try {
                project.selected3dPhotosForPdf = JSON.parse(project.selected3dPhotosForPdf);
            }
            catch (_0) {
                project.selected3dPhotosForPdf = [];
            }
        }
        if (!Array.isArray(project.selected3dPhotosForPdf)) {
            project.selected3dPhotosForPdf = [];
        }
        // Utiliser le mapping pour extraire les données
        const pdfData = (0, pdfMapping_1.mapProjectToPDFData)(project);
        console.log('DEBUG pdfData:', pdfData);
        // === PATCH: Images PDF en URL HTTP ===
        const BASE_IMAGE_URL = process.env.BASE_PDF_IMAGE_URL || 'http://localhost:3001';
        function toHttpUrl(relPath) {
            if (!relPath)
                return '';
            if (relPath.startsWith('/uploads/'))
                return `${BASE_IMAGE_URL}${relPath}`;
            return relPath;
        }
        // --- Nouvelle logique (HTTP URL) ---
        const selectedPhotos = project.selectedBeforePhotosForPdf || [];
        pdfData.image1 = toHttpUrl(selectedPhotos[0]);
        pdfData.image2 = toHttpUrl(selectedPhotos[1]);
        pdfData.image3 = toHttpUrl(selectedPhotos[2]);
        pdfData.image4 = toHttpUrl(selectedPhotos[3]);
        pdfData.image5 = toHttpUrl(selectedPhotos[4]);
        // Ajout pour images 3D sélectionnées
        const selected3dPhotos = project.selected3dPhotosForPdf || [];
        pdfData.image3d1 = toHttpUrl(selected3dPhotos[0]);
        pdfData.image3d2 = toHttpUrl(selected3dPhotos[1]);
        pdfData.image3d3 = toHttpUrl(selected3dPhotos[2]);
        // --- Ancienne logique (chemin relatif) ---
        // pdfData.image1 = selectedPhotos[0] || '';
        // pdfData.image2 = selectedPhotos[1] || '';
        // pdfData.image3 = selectedPhotos[2] || '';
        // pdfData.image4 = selectedPhotos[3] || '';
        // pdfData.image5 = selectedPhotos[4] || '';
        // Ajouter les données spécifiques qui ne sont pas dans le mapping
        const finalData = Object.assign(Object.assign({ 
            // PATCH : forcer la présence des bonnes coordonnées pour le mapping PDF
            lat: project.latitude, lng: project.longitude }, pdfData), { 
            // Données DVF spécifiques
            dvf_results: (_a = project.resultsDvf) === null || _a === void 0 ? void 0 : _a.dvfResults, transactions: (_b = project.resultsDvf) === null || _b === void 0 ? void 0 : _b.transactions, statistiques: (_c = project.resultsDvf) === null || _c === void 0 ? void 0 : _c.statistiques, 
            // Données de financement spécifiques
            financement_total: (_e = (_d = project.resultsBusinessPlan) === null || _d === void 0 ? void 0 : _d.financement) === null || _e === void 0 ? void 0 : _e.total, mensualite: (_g = (_f = project.resultsBusinessPlan) === null || _f === void 0 ? void 0 : _f.financement) === null || _g === void 0 ? void 0 : _g.mensualite, cout_credit: (_j = (_h = project.resultsBusinessPlan) === null || _h === void 0 ? void 0 : _h.financement) === null || _j === void 0 ? void 0 : _j.cout_credit, frais_financiers: (_l = (_k = project.resultsBusinessPlan) === null || _k === void 0 ? void 0 : _k.financement) === null || _l === void 0 ? void 0 : _l.frais_financiers, 
            // Données de coûts spécifiques
            cout_total_acquisition: (_o = (_m = project.resultsBusinessPlan) === null || _m === void 0 ? void 0 : _m.cout_total) === null || _o === void 0 ? void 0 : _o.acquisition, cout_total_travaux: (_q = (_p = project.resultsBusinessPlan) === null || _p === void 0 ? void 0 : _p.cout_total) === null || _q === void 0 ? void 0 : _q.travaux, cout_total_autres_frais: (_s = (_r = project.resultsBusinessPlan) === null || _r === void 0 ? void 0 : _r.cout_total) === null || _s === void 0 ? void 0 : _s.autres_frais, cout_total: (_u = (_t = project.resultsBusinessPlan) === null || _t === void 0 ? void 0 : _t.cout_total) === null || _u === void 0 ? void 0 : _u.total, 
            // Points forts/faibles
            potentiel_amelioration: (_v = project.resultsDescriptionBien) === null || _v === void 0 ? void 0 : _v.potentiel_amelioration, points_forts: (_w = project.resultsDescriptionBien) === null || _w === void 0 ? void 0 : _w.points_forts, points_faibles: (_x = project.resultsDescriptionBien) === null || _x === void 0 ? void 0 : _x.points_faibles, travaux_suggeres: (_y = project.resultsDescriptionBien) === null || _y === void 0 ? void 0 : _y.travaux_suggeres, 
            // Dates
            date_creation: project.createdAt, date_modification: project.updatedAt, 
            // Configuration PDF
            pdf_config: project.pdfConfig, 
            // Add selected photos for PDF so the mapping can use them
            selectedBeforePhotosForPdf: project.selectedBeforePhotosForPdf, selected3dPhotosForPdf: project.selected3dPhotosForPdf });
        console.log('DEBUG finalData:', finalData);
        return finalData;
    }
    // Valider les données JSON
    validateJson(data) {
        if (!data)
            return undefined;
        try {
            if (typeof data === 'string') {
                return JSON.parse(data);
            }
            return data;
        }
        catch (_a) {
            return undefined;
        }
    }
}
exports.ProjectService = ProjectService;
