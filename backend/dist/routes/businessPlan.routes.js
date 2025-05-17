"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const database_1 = __importDefault(require("../config/database"));
const businessPlanController_1 = require("../controllers/businessPlanController");
const router = express_1.default.Router();
// Schéma de validation pour les inputs du business plan
const businessPlanInputSchema = zod_1.z.object({
    surface: zod_1.z.number().optional(),
    surface_terrasse: zod_1.z.number().optional(),
    ponderation_terrasse: zod_1.z.number().optional(),
    prix_achat: zod_1.z.number().optional(),
    prix_affiche: zod_1.z.number().optional(),
    frais_notaire: zod_1.z.number().optional(),
    frais_agence: zod_1.z.number().optional(),
    frais_agence_vente: zod_1.z.number().optional(),
    frais_dossier: zod_1.z.number().optional(),
    cout_travaux: zod_1.z.number().optional(),
    salaire_maitrise: zod_1.z.number().optional(),
    alea_travaux: zod_1.z.number().optional(),
    amenagement_terrasse: zod_1.z.number().optional(),
    demolition: zod_1.z.number().optional(),
    honoraires_techniques: zod_1.z.number().optional(),
    prorata_foncier: zod_1.z.number().optional(),
    diagnostics: zod_1.z.number().optional(),
    credit_foncier: zod_1.z.number().optional(),
    fonds_propres: zod_1.z.number().optional(),
    credit_accompagnement_total: zod_1.z.number().optional(),
    duree_projet: zod_1.z.number().optional(),
    mobilier: zod_1.z.number().optional(),
    taux_credit: zod_1.z.number().optional(),
    commission_rate: zod_1.z.number().optional(),
    date_achat: zod_1.z.string().optional(),
    date_vente: zod_1.z.string().optional()
});
// GET /api/business-plan/:projectId - Récupère le business plan d'un projet
router.get('/:projectId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const project = await database_1.default.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }
        res.json({
            inputs: project.inputsBusinessPlan,
            results: project.resultsBusinessPlan
        });
    }
    catch (error) {
        console.error('Erreur lors de la récupération du business plan:', error);
        res.status(500).json({
            error: 'Erreur lors de la récupération du business plan',
            details: error instanceof Error ? error.message : 'Erreur inconnue'
        });
    }
});
// PUT /api/business-plan/:projectId - Met à jour les inputs du business plan
router.put('/:projectId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const validatedData = businessPlanInputSchema.parse(req.body);
        const project = await database_1.default.project.update({
            where: { id: projectId },
            data: {
                inputsBusinessPlan: validatedData
            }
        });
        res.json(project);
    }
    catch (error) {
        console.error('Erreur lors de la mise à jour du business plan:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Données invalides', details: error.errors });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors de la mise à jour du business plan',
                details: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
function camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
function convertKeysToSnakeCase(obj) {
    if (typeof obj !== 'object' || obj === null)
        return obj;
    if (Array.isArray(obj))
        return obj.map(convertKeysToSnakeCase);
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [camelToSnake(k), convertKeysToSnakeCase(v)]));
}
// POST /api/business-plan/:projectId/calculate - Calcule les résultats du business plan
router.post('/:projectId/calculate', async (req, res, next) => {
    try {
        const projectId = parseInt(req.params.projectId);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide' });
        }
        const project = await database_1.default.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }
        // Log du body reçu
        console.log('[LKI LOG] Body reçu pour calcul:', req.body);
        // Si inputsBusinessPlan est null, initialiser un objet vide
        const currentInputs = project.inputsBusinessPlan || {};
        console.log('[LKI LOG] Valeurs actuelles de la BDD:', currentInputs);
        // Conversion camelCase -> snake_case sur toutes les clés
        const snakeBody = convertKeysToSnakeCase(currentInputs);
        console.log('[LKI LOG] Body inputsBusinessPlan converti snake_case:', snakeBody);
        // Ajoute les valeurs du body de la requête (venant du front) si elles existent
        Object.assign(snakeBody, convertKeysToSnakeCase(req.body));
        console.log('[LKI LOG] Body final transmis au contrôleur:', snakeBody);
        // Vérification des champs requis
        const requiredFields = ['surface', 'prix_achat', 'duree_projet'];
        const missingFields = requiredFields.filter(field => !snakeBody[field]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Champs requis manquants',
                details: `Les champs suivants sont requis : ${missingFields.join(', ')}`
            });
        }
        // Vérification du financement
        const prix_achat = Number(snakeBody.prix_achat) || 0;
        const frais_notaire = prix_achat * (Number(snakeBody.frais_notaire) || 0) / 100;
        const frais_dossier = Number(snakeBody.frais_dossier) || 0;
        const besoin_acquisition = prix_achat + frais_notaire + frais_dossier;
        const credit_foncier = Number(snakeBody.credit_foncier) || 0;
        const fonds_propres = Number(snakeBody.fonds_propres) || 0;
        const financement_total = credit_foncier + fonds_propres;
        if (financement_total < besoin_acquisition) {
            return res.status(400).json({
                error: 'Financement insuffisant',
                details: `Le financement total (${financement_total}€) est insuffisant pour couvrir l'acquisition (${besoin_acquisition}€). Il manque ${besoin_acquisition - financement_total}€.`,
                required: {
                    besoin_acquisition,
                    financement_disponible: financement_total,
                    manquant: besoin_acquisition - financement_total
                }
            });
        }
        req.body = snakeBody;
        return (0, businessPlanController_1.calculateBusinessPlan)(req, res);
    }
    catch (error) {
        console.error('Erreur lors du calcul du business plan:', error);
        res.status(500).json({
            error: 'Erreur lors du calcul du business plan',
            details: error instanceof Error ? error.message : 'Erreur inconnue'
        });
    }
});
exports.default = router;
