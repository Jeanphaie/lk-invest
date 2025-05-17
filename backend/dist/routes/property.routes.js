"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const router = express_1.default.Router();
// Schéma de validation pour le calcul du coefficient
const coefficientRequestSchema = zod_1.z.object({
    project_id: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    view: zod_1.z.string(),
    floor: zod_1.z.string(),
    elevator: zod_1.z.string(),
    outdoor: zod_1.z.string(),
    address: zod_1.z.string(),
    condition: zod_1.z.string(),
    number_of_rooms: zod_1.z.number().min(1, 'Le nombre de pièces doit être au moins 1')
});
// POST /api/property/calculate-coefficient - Calcule le coefficient de pondération
router.post('/calculate-coefficient', async (req, res) => {
    try {
        const data = coefficientRequestSchema.parse(req.body);
        let coef = 1.00;
        const impacts = [];
        // Impact de la vue
        const viewImpact = {
            'Exceptional': 0.20,
            'Good': 0.10,
            'Poor': -0.20,
            'Average': 0.00
        }[data.view] || 0;
        coef += viewImpact;
        impacts.push({
            parameter: 'Vue',
            value: data.view,
            impact: viewImpact,
            description: 'Impact de la qualité de la vue'
        });
        // Impact de l'étage et ascenseur
        let floorImpact = 0;
        if (data.floor === 'High (≥ 5th)') {
            floorImpact = data.elevator === 'Yes' ? 0.05 : -0.20;
        }
        else if (data.floor === 'Mid (2nd-4th)') {
            floorImpact = data.elevator === 'Yes' ? 0.00 : -0.10;
        }
        else if (data.floor === 'Low (1st)') {
            floorImpact = -0.05;
        }
        else { // Ground Floor
            floorImpact = -0.10;
        }
        coef += floorImpact;
        impacts.push({
            parameter: 'Étage',
            value: `${data.floor} (${data.elevator === 'Yes' ? 'avec' : 'sans'} ascenseur)`,
            impact: floorImpact,
            description: 'Impact de la hauteur de l\'étage et de la présence d\'ascenseur'
        });
        // Impact de l'extérieur
        const outdoorImpact = {
            'Large (≥ 50 m²)': 0.10,
            'Medium (20-49 m²)': 0.03,
            'Small (5-19 m²)': 0.00,
            'None (< 5 m²)': 0.00
        }[data.outdoor] || 0;
        coef += outdoorImpact;
        impacts.push({
            parameter: 'Extérieur',
            value: data.outdoor,
            impact: outdoorImpact,
            description: 'Impact de la surface extérieure'
        });
        // Impact de l'adresse
        const addressImpact = {
            'Highly Sought-After': 0.10,
            'Moderately Sought-After': 0.05,
            'Standard': 0.00
        }[data.address] || 0;
        coef += addressImpact;
        impacts.push({
            parameter: 'Adresse',
            value: data.address,
            impact: addressImpact,
            description: 'Impact de la qualité de l\'adresse'
        });
        // Impact de l'état
        const conditionImpact = {
            'Renovated by Architect': 0.10,
            'Simply Renovated': 0.05,
            'Good Condition': 0.00,
            'Needs Refreshing': -0.05,
            'Needs Renovation': -0.10
        }[data.condition] || 0;
        coef += conditionImpact;
        impacts.push({
            parameter: 'État',
            value: data.condition,
            impact: conditionImpact,
            description: 'Impact de l\'état du bien'
        });
        // Impact du nombre de pièces
        let roomsImpact = 0;
        if (data.number_of_rooms < 3) {
            roomsImpact = -0.02;
        }
        else {
            roomsImpact = 0.00;
        }
        coef += roomsImpact;
        impacts.push({
            parameter: 'Nombre de pièces',
            value: data.number_of_rooms.toString(),
            impact: roomsImpact,
            description: 'Malus si moins de 3 pièces'
        });
        // Ajustement final du coefficient
        coef = Math.max(0.7, Math.min(1.5, coef));
        const updated_params = {
            coef_ponderation: coef
        };
        res.json({
            coefficient: coef,
            impacts,
            updated_params
        });
    }
    catch (error) {
        console.error('Erreur lors du calcul du coefficient:', error);
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                error: 'Données invalides',
                details: error.errors
            });
        }
        else {
            res.status(500).json({
                error: 'Erreur lors du calcul du coefficient',
                message: error instanceof Error ? error.message : 'Erreur inconnue'
            });
        }
    }
});
exports.default = router;
