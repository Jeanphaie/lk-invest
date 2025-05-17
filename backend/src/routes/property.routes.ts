import express, { Request, Response, Router } from 'express';
import { z } from 'zod';
import { ProjectService } from '../services/project.service';
import { DescriptionBienInputsSchema } from '../../../shared/types/descriptionBienInputs';
import { DescriptionBienResultsSchema } from '../../../shared/types/descriptionBienResults';

const router: Router = express.Router();
const projectService = new ProjectService();

interface CoefficientParams {
  project_id: number;
  view: string;
  floor: string;
  elevator: string;
  outdoor: string;
  address: string;
  condition: string;
  number_of_rooms: number;
}

interface CoefficientResult {
  coefficient: number;
  impacts: Array<{
    parameter: string;
    value: string;
    impact: number;
    description: string;
  }>;
}

async function calculateCoefficient(params: CoefficientParams): Promise<CoefficientResult> {
  const impacts: CoefficientResult['impacts'] = [];
  let coefficient = 1.0;

  // Vue
  const viewImpactMap: Record<string, number> = {
    'Exceptional': 0.20,
    'Good': 0.10,
    'Average': 0.00,
    'Poor': -0.20
  };
  const viewImpact = viewImpactMap[params.view] || 0;
  impacts.push({
    parameter: 'Vue',
    value: params.view,
    impact: viewImpact,
    description: 'Impact de la qualité de la vue'
  });
  coefficient += viewImpact;

  // Étage
  const floorImpactMap: Record<string, number> = {
    'High (≥ 5th)': params.elevator === 'Yes' ? 0.05 : -0.20,
    'Mid (2nd-4th)': params.elevator === 'Yes' ? 0.00 : -0.10,
    'Low (1st)': -0.05,
    'Ground Floor': -0.10
  };
  const floorImpact = floorImpactMap[params.floor] || 0;
  impacts.push({
    parameter: 'Étage',
    value: params.floor,
    impact: floorImpact,
    description: 'Impact de la hauteur et de l\'ascenseur'
  });
  coefficient += floorImpact;

  // Ascenseur
  impacts.push({
    parameter: 'Ascenseur',
    value: params.elevator,
    impact: 0,
    description: 'Impact de l\'ascenseur'
  });

  // Extérieur
  const outdoorImpactMap: Record<string, number> = {
    'Large (≥ 50 m²)': 0.10,
    'Medium (20-49 m²)': 0.03,
    'Small (5-19 m²)': 0.00,
    'None (< 5 m²)': 0.00
  };
  const outdoorImpact = outdoorImpactMap[params.outdoor] || 0;
  impacts.push({
    parameter: 'Extérieur',
    value: params.outdoor,
    impact: outdoorImpact,
    description: 'Impact de la surface extérieure'
  });
  coefficient += outdoorImpact;

  // Adresse
  const addressImpactMap: Record<string, number> = {
    'Highly Sought-After': 0.10,
    'Moderately Sought-After': 0.05,
    'Standard': 0.00
  };
  const addressImpact = addressImpactMap[params.address] || 0;
  impacts.push({
    parameter: 'Adresse',
    value: params.address,
    impact: addressImpact,
    description: 'Impact de la qualité de l\'adresse'
  });
  coefficient += addressImpact;

  // État
  const conditionImpactMap: Record<string, number> = {
    'Renovated by Architect': 0.10,
    'Simply Renovated': 0.05,
    'Good Condition': 0.00,
    'Needs Refreshing': -0.05,
    'Needs Renovation': -0.10
  };
  const conditionImpact = conditionImpactMap[params.condition] || 0;
  impacts.push({
    parameter: 'État',
    value: params.condition,
    impact: conditionImpact,
    description: 'Impact de l\'état du bien'
  });
  coefficient += conditionImpact;

  // Nombre de pièces
  const roomsImpact = params.number_of_rooms < 3 ? -0.02 : 0.00;
  impacts.push({
    parameter: 'Pièces',
    value: params.number_of_rooms.toString(),
    impact: roomsImpact,
    description: 'Impact du nombre de pièces'
  });
  coefficient += roomsImpact;

  return {
    coefficient: Number(coefficient.toFixed(2)),
    impacts
  };
}

// PATCH /api/property/:id/property-description - Met à jour la description du bien
router.patch('/:id/property-description', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }

    // Validation stricte avec le schéma partagé
    const validatedData = DescriptionBienInputsSchema.parse(req.body);

    // Récupérer le projet existant via ProjectService
    const existingProject = await projectService.getProjectById(projectId);
    if (!existingProject) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const inputsGeneral = existingProject.inputsGeneral;
    const inputsDescriptionBien = validatedData;
    const superficie = inputsGeneral.superficie;
    const superficie_terrasse = inputsGeneral.superficie_terrasse;
    const ponderation_terrasse = inputsGeneral.ponderation_terrasse;

    let surface_totale: number | undefined = undefined;
    if (
      typeof superficie === 'number' &&
      !isNaN(superficie) &&
      typeof superficie_terrasse === 'number' &&
      !isNaN(superficie_terrasse) &&
      typeof ponderation_terrasse === 'number' &&
      !isNaN(ponderation_terrasse)
    ) {
      surface_totale = superficie + superficie_terrasse * ponderation_terrasse;
    } else {
      surface_totale = undefined;
    }

    // Calcul du coefficient de pondération
    const coefficient = await calculateCoefficient({
      project_id: projectId,
      view: inputsDescriptionBien.vue,
      floor: inputsDescriptionBien.etage,
      elevator: inputsDescriptionBien.ascenseur,
      outdoor: inputsDescriptionBien.exterieur,
      address: inputsDescriptionBien.adresse,
      condition: inputsDescriptionBien.etat,
      number_of_rooms: inputsDescriptionBien.nombre_pieces
    });

    // Prépare la sauvegarde avec les résultats (conforme au schéma partagé)
    const resultsDescriptionBien = {
      coef_ponderation: coefficient.coefficient,
      surface_totale,
      impacts: coefficient.impacts
    };
    // Validation finale du résultat
    DescriptionBienResultsSchema.parse(resultsDescriptionBien);

    // Mettre à jour le projet via ProjectService
    await projectService.updateProject(projectId, {
      inputsGeneral: {
        ...inputsGeneral,
        surface_totale,
      },
      inputsDescriptionBien,
      resultsDescriptionBien
    });

    // Refetch le projet complet via ProjectService
    const updatedProject = await projectService.getProjectById(projectId);
    res.json(updatedProject);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la description du bien:', error);
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
        error: 'Erreur lors de la mise à jour de la description du bien',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});

// PATCH /api/projects/:id/general-inputs - Met à jour les inputs généraux
router.patch('/:id/general-inputs', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }
    
    const generalInputsSchema = z.object({
      surface: z.number().min(0, 'La surface doit être positive').optional(),
      surfaceTerrasse: z.number().min(0, 'La surface de la terrasse doit être positive').optional(),
      ponderationTerrasse: z.number().min(0, 'La pondération de la terrasse doit être positive').optional(),
      description_quartier: z.string().optional()
    });

    console.log('[GENERAL-INPUTS][RECEIVED] Payload:', JSON.stringify(req.body));
    const validatedData = generalInputsSchema.parse(req.body);
    
    // Récupérer l'existant pour merger
    const project = await projectService.getProjectById(projectId);
    let currentInputs = project?.inputsGeneral || {};
    if (typeof currentInputs === 'string') {
      try {
        currentInputs = JSON.parse(currentInputs);
      } catch (e) {
        currentInputs = {};
      }
    }
    if (typeof currentInputs !== 'object' || Array.isArray(currentInputs) || currentInputs === null) {
      currentInputs = {};
    }
    // Merge intelligent : on garde tous les champs existants, on écrase seulement ceux envoyés
    const newInputsGeneral = {
      ...currentInputs,
      ...req.body,
    };
    // Calcul surface_totale si on a les champs nécessaires
    if (
      typeof newInputsGeneral.superficie === 'number' &&
      !isNaN(newInputsGeneral.superficie) &&
      typeof newInputsGeneral.superficie_terrasse === 'number' &&
      !isNaN(newInputsGeneral.superficie_terrasse) &&
      typeof newInputsGeneral.ponderation_terrasse === 'number' &&
      !isNaN(newInputsGeneral.ponderation_terrasse)
    ) {
      newInputsGeneral.surface_totale = newInputsGeneral.superficie + (newInputsGeneral.superficie_terrasse * newInputsGeneral.ponderation_terrasse);
    }
    console.log('[GENERAL-INPUTS][TO-SAVE] inputsGeneral:', JSON.stringify(newInputsGeneral));

    const updatedProject = await projectService.updateProject(projectId, {
      inputsGeneral: newInputsGeneral
    });
    console.log('[GENERAL-INPUTS][SAVED] inputsGeneral en base:', JSON.stringify(updatedProject.inputsGeneral));
    console.log('[GENERAL-INPUTS][RESPONSE] Projet renvoyé:', JSON.stringify(updatedProject));
    
    res.json(updatedProject);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des inputs généraux:', error);
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
        error: 'Erreur lors de la mise à jour des inputs généraux',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});


export default router; 