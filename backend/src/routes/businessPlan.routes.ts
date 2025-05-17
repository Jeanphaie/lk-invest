import express, { Request, Response } from 'express';
import { z } from 'zod';
import { calculateBusinessPlan } from '../controllers/businessPlanController';
import { BusinessPlanInputsSchema } from '../../../shared/types/businessPlanInputs';
import { BusinessPlanResultsSchema } from '../../../shared/types/businessPlanResults';
import { ProjectService } from '../services/project.service';

const router = express.Router();
const projectService = new ProjectService();

// GET /api/business-plan/:projectId - Récupère le business plan d'un projet
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }

    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json({ 
      inputs: project.inputsBusinessPlan, 
      results: project.resultsBusinessPlan 
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du business plan:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération du business plan',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// PUT /api/business-plan/:projectId - Met à jour les inputs du business plan
router.put('/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }

    // Validation des données avec Zod
    const validatedData = BusinessPlanInputsSchema.parse(req.body);
    
    const project = await projectService.updateProject(projectId, { inputsBusinessPlan: validatedData });
    res.json(project);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du business plan:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Données invalides', details: error.errors });
    } else {
      res.status(500).json({ 
        error: 'Erreur lors de la mise à jour du business plan',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertKeysToSnakeCase(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [camelToSnake(k), convertKeysToSnakeCase(v)])
  );
}

// POST /api/business-plan/:projectId/calculate - Calcule les résultats du business plan
router.post('/:projectId/calculate', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }

    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Log du body reçu
    console.log('[LKI LOG] Body reçu pour calcul:', req.body);
    
    // Si inputsBusinessPlan est null, initialiser avec les valeurs par défaut
    const currentInputs = project.inputsBusinessPlan || {};
    console.log('[LKI LOG] Valeurs actuelles de la BDD:', currentInputs);
    
    // Conversion camelCase -> snake_case sur toutes les clés
    const snakeBody = convertKeysToSnakeCase(currentInputs);
    console.log('[LKI LOG] Body inputsBusinessPlan converti snake_case:', snakeBody);
    
    // Ajoute les valeurs du body de la requête (venant du front) si elles existent
    Object.assign(snakeBody, convertKeysToSnakeCase(req.body));
    console.log('[LKI LOG] Body final transmis au contrôleur:', snakeBody);
    
    // Validation des données avec Zod
    const validatedInputs = BusinessPlanInputsSchema.parse(snakeBody);

    // Vérification du financement avec les nouveaux noms
    const prix_achat = validatedInputs.prix_achat;
    const frais_notaire = prix_achat * (validatedInputs.frais_notaire_percent || 0) / 100;
    const frais_dossier = validatedInputs.frais_dossier_amount || 0;
    const besoin_acquisition = prix_achat + frais_notaire + frais_dossier;
    
    const credit_foncier = validatedInputs.financement_credit_foncier_amount || 0;
    const fonds_propres = validatedInputs.financement_fonds_propres_amount || 0;
    const credit_accompagnement = validatedInputs.financement_credit_accompagnement_amount || 0;
    const financement_total = credit_foncier + fonds_propres + credit_accompagnement;

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

    req.body = validatedInputs;
    return calculateBusinessPlan(req, res);
  } catch (error) {
    console.error('Erreur lors du calcul du business plan:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        error: 'Données invalides', 
        details: error.errors 
      });
    } else {
      res.status(500).json({
        error: 'Erreur lors du calcul du business plan',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});

export default router; 