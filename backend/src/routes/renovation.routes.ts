import express, { Request, Response, Router } from 'express';
import { ProjectService } from '../services/project.service';
import { RenovationBienInputsSchema } from '../../../shared/types/renovationBienInputs';
import { RenovationBienResultsSchema } from '../../../shared/types/renovationBienResults';
import { z } from 'zod';

const router: Router = express.Router();
const projectService = new ProjectService();

// PATCH /api/renovation/:id - Met à jour les données de rénovation
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }

    // Validation stricte avec le schéma partagé
    const validatedData = RenovationBienInputsSchema.parse(req.body);

    // Récupérer le projet existant via ProjectService
    const existingProject = await projectService.getProjectById(projectId);
    if (!existingProject) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Calcul de la surface pondérée après travaux
    const surface_ponderee_apres = validatedData.superficie_apres + 
      (validatedData.superficie_exterieur_apres * (existingProject.inputsGeneral?.ponderation_terrasse || 0));

    // Calcul de la date de fin des travaux
    const date_debut = new Date(validatedData.date_debut);
    const date_fin = new Date(date_debut);
    date_fin.setMonth(date_fin.getMonth() + validatedData.duree_mois);

    // Prépare la sauvegarde avec les résultats (conforme au schéma partagé)
    const resultsRenovationBien = {
      surface_ponderee_apres,
      date_fin: date_fin.toISOString().split('T')[0]
    };

    // Validation finale du résultat
    RenovationBienResultsSchema.parse(resultsRenovationBien);

    // Mettre à jour le projet via ProjectService
    await projectService.updateProject(projectId, {
      inputsRenovationBien: validatedData,
      resultsRenovationBien
    });

    // Refetch le projet complet via ProjectService
    const updatedProject = await projectService.getProjectById(projectId);
    res.json(updatedProject);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des données de rénovation:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Données invalides',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    } else {
      res.status(500).json({
        error: 'Erreur lors de la mise à jour des données de rénovation',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});

export default router; 