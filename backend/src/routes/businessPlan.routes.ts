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
      results: project.resultsBusinessPlan,
      inputsRealises: project.inputsBusinessPlanRealises,
      resultsRealises: project.resultsBusinessPlanRealises
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

// POST /api/business-plan/:projectId/calculate - Calcule le business plan
router.post('/:projectId/calculate', calculateBusinessPlan);

// POST /api/business-plan/:projectId/calculate-realises - Calcule et sauvegarde les résultats réalisés
router.post('/:projectId/calculate-realises', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }

    // Valider les inputs réalisés
    const validatedInputs = BusinessPlanInputsSchema.safeParse(req.body);
    if (!validatedInputs.success) {
      return res.status(400).json({
        error: 'Données invalides',
        details: validatedInputs.error.errors
      });
    }

    // Calculer les résultats réalisés (réutilise la logique du contrôleur)
    const { calculateBusinessPlan } = require('../controllers/businessPlanController');
    // On simule un req/res pour la fonction existante
    req.body = validatedInputs.data;
    (req as any)._isRealises = true; // Indique au contrôleur d'utiliser les champs Realises
    return calculateBusinessPlan(req, res);
  } catch (error) {
    console.error('Erreur lors du calcul du business plan réalisé:', error);
    res.status(500).json({
      error: 'Erreur lors du calcul du business plan réalisé',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

export default router; 