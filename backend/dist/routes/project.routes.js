"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const database_1 = __importDefault(require("../config/database"));
const openai_1 = require("openai");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// Schéma de validation pour la création/mise à jour d'un projet
const projectSchema = zod_1.z.object({
    projectTitle: zod_1.z.string().min(1, 'Le titre du projet est requis'),
    adresseBien: zod_1.z.string().optional().nullable(),
    lienAnnonce: zod_1.z.string().url('Le lien doit être une URL valide').optional().nullable(),
    latitude: zod_1.z.number().min(-90).max(90, 'La latitude doit être entre -90 et 90').optional().nullable(),
    longitude: zod_1.z.number().min(-180).max(180, 'La longitude doit être entre -180 et 180').optional().nullable(),
    inputsGeneral: zod_1.z.any().optional().nullable(),
    inputsDescriptionBien: zod_1.z.any().optional().nullable(),
    resultsDescriptionBien: zod_1.z.any().optional().nullable(),
    inputsBusinessPlan: zod_1.z.any().optional().nullable(),
    resultsBusinessPlan: zod_1.z.any().optional().nullable(),
    inputsDvf: zod_1.z.any().optional().nullable(),
    resultsDvf: zod_1.z.any().optional().nullable(),
    photosBefore: zod_1.z.array(zod_1.z.string()).optional(),
    photos3d: zod_1.z.array(zod_1.z.string()).optional(),
    photosDuring: zod_1.z.array(zod_1.z.string()).optional(),
    photosAfter: zod_1.z.array(zod_1.z.string()).optional(),
    pdfConfig: zod_1.z.any().optional().nullable(),
    description: zod_1.z.string().max(1000, 'La description ne doit pas dépasser 1000 caractères').optional().nullable(),
    coverPhoto: zod_1.z.string().optional().nullable(),
    generatedPdfPath: zod_1.z.string().optional().nullable(),
    lastPdfGeneration: zod_1.z.string().optional().nullable(),
    selectedBeforePhotosForPdf: zod_1.z.array(zod_1.z.string()).optional(),
    selected3dPhotosForPdf: zod_1.z.array(zod_1.z.string()).optional()
}).partial();
// Utilitaire pour garantir un tableau JSON pour Prisma
function ensureJsonArray(val) {
    if (Array.isArray(val))
        return val;
    if (val == null)
        return client_1.Prisma.JsonNull;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : client_1.Prisma.JsonNull;
        }
        catch (_a) {
            return client_1.Prisma.JsonNull;
        }
    }
    return client_1.Prisma.JsonNull;
}
// GET /api/projects - Liste tous les projets
router.get('/', async (req, res) => {
    try {
        const projects = await database_1.default.project.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(projects);
    }
    catch (error) {
        console.error('Erreur lors de la récupération des projets:', error);
        res.status(500).json({
            error: 'Erreur lors de la récupération des projets',
            details: error instanceof Error ? error.message : 'Erreur inconnue'
        });
    }
});
// GET /api/projects/:id - Récupère un projet spécifique
router.get('/:id', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const project = await database_1.default.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            return res.status(404).json({
                error: 'Projet non trouvé',
                message: `Aucun projet trouvé avec l'ID ${req.params.id}`
            });
        }
        res.json(project);
    }
    catch (error) {
        console.error('Erreur lors de la récupération du projet:', error);
        res.status(500).json({
            error: 'Erreur lors de la récupération du projet',
            details: error instanceof Error ? error.message : 'Erreur inconnue'
        });
    }
});
// POST /api/projects - Crée un nouveau projet
router.post('/', async (req, res) => {
    try {
        const validatedData = projectSchema.parse(req.body);
        const defaultProject = {
            projectTitle: 'Nouveau projet',
            adresseBien: null,
            lienAnnonce: null,
            latitude: null,
            longitude: null,
            inputsGeneral: null,
            inputsDescriptionBien: null,
            resultsDescriptionBien: null,
            inputsBusinessPlan: null,
            resultsBusinessPlan: null,
            inputsDvf: null,
            resultsDvf: null,
            photosBefore: [],
            photos3d: [],
            photosDuring: [],
            photosAfter: [],
            pdfConfig: null,
            description: null
        };
        const project = await database_1.default.project.create({
            data: Object.assign(Object.assign({}, defaultProject), validatedData)
        });
        res.status(201).json(project);
    }
    catch (error) {
        console.error('Erreur lors de la création du projet:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Données invalides',
                details: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors de la création du projet',
                details: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
// PUT /api/projects/:id - Met à jour un projet
router.put('/:id', async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const validatedData = projectSchema.parse(req.body);
        // Récupérer l'existant pour merger
        const existingProject = await database_1.default.project.findUnique({ where: { id: projectId } });
        if (!existingProject) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }
        // Construction du merge uniquement sur les champs métiers
        const dataForPrisma = {
            projectTitle: (_a = validatedData.projectTitle) !== null && _a !== void 0 ? _a : existingProject.projectTitle,
            adresseBien: (_b = validatedData.adresseBien) !== null && _b !== void 0 ? _b : existingProject.adresseBien,
            lienAnnonce: (_c = validatedData.lienAnnonce) !== null && _c !== void 0 ? _c : existingProject.lienAnnonce,
            latitude: (_d = validatedData.latitude) !== null && _d !== void 0 ? _d : existingProject.latitude,
            longitude: (_e = validatedData.longitude) !== null && _e !== void 0 ? _e : existingProject.longitude,
            description: (_f = validatedData.description) !== null && _f !== void 0 ? _f : existingProject.description,
            coverPhoto: (_g = validatedData.coverPhoto) !== null && _g !== void 0 ? _g : existingProject.coverPhoto,
            generatedPdfPath: (_h = validatedData.generatedPdfPath) !== null && _h !== void 0 ? _h : existingProject.generatedPdfPath,
            lastPdfGeneration: (_j = validatedData.lastPdfGeneration) !== null && _j !== void 0 ? _j : existingProject.lastPdfGeneration,
            photosBefore: (_l = (_k = validatedData.photosBefore) !== null && _k !== void 0 ? _k : existingProject.photosBefore) !== null && _l !== void 0 ? _l : [],
            photos3d: (_o = (_m = validatedData.photos3d) !== null && _m !== void 0 ? _m : existingProject.photos3d) !== null && _o !== void 0 ? _o : [],
            photosDuring: (_q = (_p = validatedData.photosDuring) !== null && _p !== void 0 ? _p : existingProject.photosDuring) !== null && _q !== void 0 ? _q : [],
            photosAfter: (_s = (_r = validatedData.photosAfter) !== null && _r !== void 0 ? _r : existingProject.photosAfter) !== null && _s !== void 0 ? _s : [],
            selectedBeforePhotosForPdf: ensureJsonArray((_t = validatedData.selectedBeforePhotosForPdf) !== null && _t !== void 0 ? _t : existingProject.selectedBeforePhotosForPdf),
            selected3dPhotosForPdf: ensureJsonArray((_u = validatedData.selected3dPhotosForPdf) !== null && _u !== void 0 ? _u : existingProject.selected3dPhotosForPdf),
            inputsGeneral: Object.assign(Object.assign({}, (typeof existingProject.inputsGeneral === 'object' && existingProject.inputsGeneral !== null ? existingProject.inputsGeneral : {})), (typeof validatedData.inputsGeneral === 'object' && validatedData.inputsGeneral !== null ? validatedData.inputsGeneral : {})),
            inputsDescriptionBien: Object.assign(Object.assign({}, (typeof existingProject.inputsDescriptionBien === 'object' && existingProject.inputsDescriptionBien !== null ? existingProject.inputsDescriptionBien : {})), (typeof validatedData.inputsDescriptionBien === 'object' && validatedData.inputsDescriptionBien !== null ? validatedData.inputsDescriptionBien : {})),
            resultsDescriptionBien: Object.assign(Object.assign({}, (typeof existingProject.resultsDescriptionBien === 'object' && existingProject.resultsDescriptionBien !== null ? existingProject.resultsDescriptionBien : {})), (typeof validatedData.resultsDescriptionBien === 'object' && validatedData.resultsDescriptionBien !== null ? validatedData.resultsDescriptionBien : {})),
            inputsBusinessPlan: Object.assign(Object.assign({}, (typeof existingProject.inputsBusinessPlan === 'object' && existingProject.inputsBusinessPlan !== null ? existingProject.inputsBusinessPlan : {})), (typeof validatedData.inputsBusinessPlan === 'object' && validatedData.inputsBusinessPlan !== null ? validatedData.inputsBusinessPlan : {})),
            resultsBusinessPlan: Object.assign(Object.assign({}, (typeof existingProject.resultsBusinessPlan === 'object' && existingProject.resultsBusinessPlan !== null ? existingProject.resultsBusinessPlan : {})), (typeof validatedData.resultsBusinessPlan === 'object' && validatedData.resultsBusinessPlan !== null ? validatedData.resultsBusinessPlan : {})),
            inputsDvf: Object.assign(Object.assign({}, (typeof existingProject.inputsDvf === 'object' && existingProject.inputsDvf !== null ? existingProject.inputsDvf : {})), (typeof validatedData.inputsDvf === 'object' && validatedData.inputsDvf !== null ? validatedData.inputsDvf : {})),
            resultsDvf: Object.assign(Object.assign({}, (typeof existingProject.resultsDvf === 'object' && existingProject.resultsDvf !== null ? existingProject.resultsDvf : {})), (typeof validatedData.resultsDvf === 'object' && validatedData.resultsDvf !== null ? validatedData.resultsDvf : {})),
            pdfConfig: Object.assign(Object.assign({}, (typeof existingProject.pdfConfig === 'object' && existingProject.pdfConfig !== null ? existingProject.pdfConfig : {})), (typeof validatedData.pdfConfig === 'object' && validatedData.pdfConfig !== null ? validatedData.pdfConfig : {}))
        };
        const project = await database_1.default.project.update({
            where: { id: projectId },
            data: dataForPrisma
        });
        res.json(project);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour du projet:', error);
        if (error instanceof zod_1.z.ZodError) {
            const details = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code
            }));
            console.error('Erreurs de validation:', JSON.stringify(details, null, 2));
            return res.status(400).json({
                error: 'Données invalides',
                details
            });
        }
        else if (error instanceof Error && error.message.includes('RecordNotFound')) {
            return res.status(404).json({
                error: 'Projet non trouvé',
                message: `Aucun projet trouvé avec l'ID ${req.params.id}`
            });
        }
        else {
            return res.status(500).json({
                error: 'Erreur lors de la mise à jour du projet',
                details: error instanceof Error ? error.message : 'Erreur inconnue',
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }
});
// DELETE /api/projects/:id - Supprime un projet
router.delete('/:id', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        await database_1.default.project.delete({
            where: { id: projectId }
        });
        res.json({ message: 'Projet supprimé avec succès' });
    }
    catch (error) {
        console.error('Erreur lors de la suppression du projet:', error);
        if (error instanceof Error && error.message.includes('RecordNotFound')) {
            res.status(404).json({
                error: 'Projet non trouvé',
                message: `Aucun projet trouvé avec l'ID ${req.params.id}`
            });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors de la suppression du projet',
                details: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
// PATCH /api/projects/:id/general-inputs - Met à jour les inputs généraux
router.patch('/:id/general-inputs', async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const generalInputsSchema = zod_1.z.object({
            surface: zod_1.z.number().min(0, 'La surface doit être positive').optional(),
            surfaceTerrasse: zod_1.z.number().min(0, 'La surface de la terrasse doit être positive').optional(),
            ponderationTerrasse: zod_1.z.number().min(0, 'La pondération de la terrasse doit être positive').optional(),
            description_quartier: zod_1.z.string().optional()
        });
        console.log('[GENERAL-INPUTS][RECEIVED] Payload:', JSON.stringify(req.body));
        const validatedData = generalInputsSchema.parse(req.body);
        // Récupérer l'existant pour merger
        const project = await database_1.default.project.findUnique({ where: { id: projectId } });
        let currentInputs = (project === null || project === void 0 ? void 0 : project.inputsGeneral) || {};
        // Si currentInputs est une string (JSON), on parse
        if (typeof currentInputs === 'string') {
            try {
                currentInputs = JSON.parse(currentInputs);
            }
            catch (e) {
                currentInputs = {};
            }
        }
        // S'assurer que currentInputs est bien un objet
        if (typeof currentInputs !== 'object' || Array.isArray(currentInputs) || currentInputs === null) {
            currentInputs = {};
        }
        const surface = (_b = (_a = validatedData.surface) !== null && _a !== void 0 ? _a : currentInputs.superficie) !== null && _b !== void 0 ? _b : 0;
        const surfaceTerrasse = (_d = (_c = validatedData.surfaceTerrasse) !== null && _c !== void 0 ? _c : currentInputs.superficie_terrasse) !== null && _d !== void 0 ? _d : 0;
        const ponderationTerrasse = (_f = (_e = validatedData.ponderationTerrasse) !== null && _e !== void 0 ? _e : currentInputs.ponderation_terrasse) !== null && _f !== void 0 ? _f : 0;
        const surface_totale = surface + (surfaceTerrasse * ponderationTerrasse);
        const newInputsGeneral = Object.assign(Object.assign(Object.assign({}, currentInputs), { superficie: surface, superficie_terrasse: surfaceTerrasse, ponderation_terrasse: ponderationTerrasse, surface_totale }), ('description_quartier' in validatedData ? { description_quartier: validatedData.description_quartier } : {}));
        console.log('[GENERAL-INPUTS][TO-SAVE] inputsGeneral:', JSON.stringify(newInputsGeneral));
        const updatedProject = await database_1.default.project.update({
            where: { id: projectId },
            data: { inputsGeneral: newInputsGeneral }
        });
        console.log('[GENERAL-INPUTS][SAVED] inputsGeneral en base:', JSON.stringify(updatedProject.inputsGeneral));
        console.log('[GENERAL-INPUTS][RESPONSE] Projet renvoyé:', JSON.stringify(updatedProject));
        res.json(updatedProject);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour des inputs généraux:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Données invalides',
                details: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors de la mise à jour des inputs généraux',
                details: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
// PATCH /api/projects/:id/property-description - Met à jour la description du bien
router.patch('/:id/property-description', async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const propertyDescriptionSchema = zod_1.z.object({
            propertyParams: zod_1.z.object({
                view: zod_1.z.string(),
                floor: zod_1.z.string(),
                elevator: zod_1.z.string(),
                outdoor: zod_1.z.string(),
                address: zod_1.z.string(),
                condition: zod_1.z.string(),
                number_of_rooms: zod_1.z.number().min(1)
            }),
            surface: zod_1.z.number().min(0, 'La surface doit être positive'),
            surfaceTerrasse: zod_1.z.number().min(0, 'La surface de la terrasse doit être positive'),
            ponderationTerrasse: zod_1.z.number().min(0, 'La pondération de la terrasse doit être positive'),
            coef_ponderation: zod_1.z.number().optional(),
            surface_totale: zod_1.z.number().optional()
        });
        const validatedData = propertyDescriptionSchema.parse(req.body);
        // Récupérer le projet existant pour merger les champs
        const existingProject = await database_1.default.project.findUnique({ where: { id: projectId } });
        if (!existingProject) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }
        // Calcul de la surface totale
        const surface_totale = validatedData.surface + (validatedData.surfaceTerrasse * validatedData.ponderationTerrasse);
        const inputsGeneralToSave = Object.assign(Object.assign({}, (typeof existingProject.inputsGeneral === 'object' && existingProject.inputsGeneral !== null ? existingProject.inputsGeneral : {})), { superficie: validatedData.surface, superficie_terrasse: validatedData.surfaceTerrasse, ponderation_terrasse: validatedData.ponderationTerrasse, surface_totale: surface_totale });
        const inputsDescriptionBienToSave = Object.assign(Object.assign({}, (typeof existingProject.inputsDescriptionBien === 'object' && existingProject.inputsDescriptionBien !== null ? existingProject.inputsDescriptionBien : {})), { vue: validatedData.propertyParams.view, etage: validatedData.propertyParams.floor, ascenseur: validatedData.propertyParams.elevator, exterieur: validatedData.propertyParams.outdoor, adresse: validatedData.propertyParams.address, etat: validatedData.propertyParams.condition, nombre_pieces: validatedData.propertyParams.number_of_rooms });
        const resultsDescriptionBienToSave = Object.assign(Object.assign({}, (typeof existingProject.resultsDescriptionBien === 'object' && existingProject.resultsDescriptionBien !== null ? existingProject.resultsDescriptionBien : {})), { coef_ponderation: validatedData.coef_ponderation });
        const project = await database_1.default.project.update({
            where: { id: projectId },
            data: {
                inputsDescriptionBien: inputsDescriptionBienToSave,
                resultsDescriptionBien: resultsDescriptionBienToSave,
                inputsGeneral: inputsGeneralToSave
            }
        });
        res.json(project);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour de la description du bien:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Données invalides',
                details: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors de la mise à jour de la description du bien',
                details: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
// PATCH /api/projects/:id - Met à jour un projet
router.patch('/:id', async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const { coverPhoto } = req.body;
        const validatedData = projectSchema.parse(req.body);
        // Récupérer l'existant pour merger
        const existingProject = await database_1.default.project.findUnique({ where: { id: projectId } });
        if (!existingProject) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }
        let dataForPrisma = Object.assign(Object.assign(Object.assign({}, existingProject), validatedData), { photosBefore: (_b = (_a = validatedData.photosBefore) !== null && _a !== void 0 ? _a : existingProject.photosBefore) !== null && _b !== void 0 ? _b : [], photos3d: (_d = (_c = validatedData.photos3d) !== null && _c !== void 0 ? _c : existingProject.photos3d) !== null && _d !== void 0 ? _d : [], photosDuring: (_f = (_e = validatedData.photosDuring) !== null && _e !== void 0 ? _e : existingProject.photosDuring) !== null && _f !== void 0 ? _f : [], photosAfter: (_h = (_g = validatedData.photosAfter) !== null && _g !== void 0 ? _g : existingProject.photosAfter) !== null && _h !== void 0 ? _h : [], coverPhoto, selectedBeforePhotosForPdf: ensureJsonArray((_j = validatedData.selectedBeforePhotosForPdf) !== null && _j !== void 0 ? _j : existingProject.selectedBeforePhotosForPdf), selected3dPhotosForPdf: ensureJsonArray((_k = validatedData.selected3dPhotosForPdf) !== null && _k !== void 0 ? _k : existingProject.selected3dPhotosForPdf), inputsGeneral: Object.assign(Object.assign({}, (typeof existingProject.inputsGeneral === 'object' && existingProject.inputsGeneral !== null ? existingProject.inputsGeneral : {})), (typeof validatedData.inputsGeneral === 'object' && validatedData.inputsGeneral !== null ? validatedData.inputsGeneral : {})), inputsDescriptionBien: Object.assign(Object.assign({}, (typeof existingProject.inputsDescriptionBien === 'object' && existingProject.inputsDescriptionBien !== null ? existingProject.inputsDescriptionBien : {})), (typeof validatedData.inputsDescriptionBien === 'object' && validatedData.inputsDescriptionBien !== null ? validatedData.inputsDescriptionBien : {})), resultsDescriptionBien: Object.assign(Object.assign({}, (typeof existingProject.resultsDescriptionBien === 'object' && existingProject.resultsDescriptionBien !== null ? existingProject.resultsDescriptionBien : {})), (typeof validatedData.resultsDescriptionBien === 'object' && validatedData.resultsDescriptionBien !== null ? validatedData.resultsDescriptionBien : {})), inputsBusinessPlan: Object.assign(Object.assign({}, (typeof existingProject.inputsBusinessPlan === 'object' && existingProject.inputsBusinessPlan !== null ? existingProject.inputsBusinessPlan : {})), (typeof validatedData.inputsBusinessPlan === 'object' && validatedData.inputsBusinessPlan !== null ? validatedData.inputsBusinessPlan : {})), resultsBusinessPlan: Object.assign(Object.assign({}, (typeof existingProject.resultsBusinessPlan === 'object' && existingProject.resultsBusinessPlan !== null ? existingProject.resultsBusinessPlan : {})), (typeof validatedData.resultsBusinessPlan === 'object' && validatedData.resultsBusinessPlan !== null ? validatedData.resultsBusinessPlan : {})), inputsDvf: Object.assign(Object.assign({}, (typeof existingProject.inputsDvf === 'object' && existingProject.inputsDvf !== null ? existingProject.inputsDvf : {})), (typeof validatedData.inputsDvf === 'object' && validatedData.inputsDvf !== null ? validatedData.inputsDvf : {})), resultsDvf: Object.assign(Object.assign({}, (typeof existingProject.resultsDvf === 'object' && existingProject.resultsDvf !== null ? existingProject.resultsDvf : {})), (typeof validatedData.resultsDvf === 'object' && validatedData.resultsDvf !== null ? validatedData.resultsDvf : {})), pdfConfig: Object.assign(Object.assign({}, (typeof existingProject.pdfConfig === 'object' && existingProject.pdfConfig !== null ? existingProject.pdfConfig : {})), (typeof validatedData.pdfConfig === 'object' && validatedData.pdfConfig !== null ? validatedData.pdfConfig : {})) });
        // Si inputsGeneral est présent, recalculer surface_totale
        if (dataForPrisma.inputsGeneral) {
            const { superficie = 0, superficie_terrasse = 0, ponderation_terrasse = 0 } = dataForPrisma.inputsGeneral;
            const surface_totale = superficie + (superficie_terrasse * ponderation_terrasse);
            dataForPrisma.inputsGeneral = Object.assign(Object.assign({}, dataForPrisma.inputsGeneral), { surface_totale });
            console.log('[PATCH /:id] Calcul surface_totale =', surface_totale, '| inputsGeneral =', JSON.stringify(dataForPrisma.inputsGeneral));
        }
        const project = await database_1.default.project.update({
            where: { id: projectId },
            data: dataForPrisma
        });
        res.json(project);
    }
    catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du projet' });
    }
});
// POST /api/projects/:id/generate-quartier-description
router.post('/:id/generate-quartier-description', async (req, res) => {
    var _a, _b;
    try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
            console.error('[OpenAI] ID de projet invalide:', req.params.id);
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const project = await database_1.default.project.findUnique({ where: { id: projectId } });
        if (!project) {
            console.error('[OpenAI] Projet non trouvé pour id:', projectId);
            return res.status(404).json({ error: 'Projet non trouvé' });
        }
        if (!project.adresseBien) {
            console.error('[OpenAI] Adresse du bien manquante pour le projet:', projectId);
            return res.status(400).json({ error: 'Adresse du bien manquante' });
        }
        // Préparer le prompt pour OpenAI
        const prompt = `Décris le quartier de ${project.adresseBien} en mettant en avant ses caractéristiques, son ambiance, ses atouts et ses points d'intérêt. La description doit être concise mais détaillée, en français, et ne pas dépasser 60 mots.`;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Tu es un expert immobilier qui décrit les quartiers de manière professionnelle et engageante."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 300,
            temperature: 0.7,
        });
        const description = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
        if (!description) {
            throw new Error('Pas de réponse de l\'API OpenAI');
        }
        // Sauvegarder la description dans le projet
        let currentInputs = project.inputsGeneral || {};
        if (typeof currentInputs === 'string') {
            try {
                currentInputs = JSON.parse(currentInputs);
            }
            catch (e) {
                currentInputs = {};
            }
        }
        if (typeof currentInputs !== 'object' || Array.isArray(currentInputs) || currentInputs === null) {
            currentInputs = {};
        }
        await database_1.default.project.update({
            where: { id: projectId },
            data: {
                inputsGeneral: Object.assign(Object.assign({}, currentInputs), { description_quartier: description })
            }
        });
        res.json({ description });
    }
    catch (error) {
        console.error('Erreur lors de la génération de la description:', error);
        res.status(500).json({
            error: 'Erreur lors de la génération de la description',
            details: error instanceof Error ? error.message : 'Erreur inconnue'
        });
    }
});
exports.default = router;
