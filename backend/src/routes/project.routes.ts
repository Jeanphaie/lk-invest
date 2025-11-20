import express, { Request, Response, Router } from 'express';
import { z } from 'zod';
import { ProjectService } from '../services/project.service';
import { InputsGeneralSchema } from '../../../shared/types/generalInputs';
import { BusinessPlanInputsSchema } from '../../../shared/types/businessPlanInputs';
import { BusinessPlanResultsSchema } from '../../../shared/types/businessPlanResults';
import { PhotosSchema } from '../../../shared/types/photos';
import { DescriptionBienInputsSchema } from '../../../shared/types/descriptionBienInputs';
import { DescriptionBienResultsSchema } from '../../../shared/types/descriptionBienResults';
// Ajoute ici d'autres imports de schémas Zod partagés si besoin

const router: Router = express.Router();
const projectService = new ProjectService();

// Schéma de validation pour la création/mise à jour d'un projet
const projectSchema = z.object({
  projectTitle: z.string().min(1, 'Le titre du projet est requis'),
  inputsGeneral: InputsGeneralSchema.optional(),
  inputsDescriptionBien: DescriptionBienInputsSchema.optional(),
  resultsDescriptionBien: DescriptionBienResultsSchema.optional(),
  inputsBusinessPlan: BusinessPlanInputsSchema.optional(),
  inputsBusinessPlanRealises: BusinessPlanInputsSchema.optional(),
  resultsBusinessPlan: BusinessPlanResultsSchema.optional(),
  resultsBusinessPlanRealises: BusinessPlanResultsSchema.optional(),
  inputsDvf: z.any().optional(),
  resultsDvfMetadata: z.any().optional(),
  photos: PhotosSchema.optional(),
  pdfConfig: z.any().optional(),
  description: z.string().max(1000, 'La description ne doit pas dépasser 1000 caractères').optional(),
  inputsRenovationBien: z.any().optional(),
  resultsRenovationBien: z.any().optional(),
}).partial();

function normalizeProjectData(validatedData: any, isCreate = false) {
  return {
    ...validatedData,
    projectTitle: validatedData.projectTitle || 'Nouveau projet',
    inputsGeneral: (validatedData.inputsGeneral === null || validatedData.inputsGeneral === undefined)
      ? { projectTitle: validatedData.projectTitle || 'Nouveau projet', superficie: 0, superficie_terrasse: 0, ponderation_terrasse: 0 }
      : validatedData.inputsGeneral,
    inputsBusinessPlan: validatedData.inputsBusinessPlan === null ? undefined : validatedData.inputsBusinessPlan,
    inputsBusinessPlanRealises: validatedData.inputsBusinessPlanRealises === null ? undefined : validatedData.inputsBusinessPlanRealises,
    resultsBusinessPlan: validatedData.resultsBusinessPlan === null ? undefined : validatedData.resultsBusinessPlan,
    resultsBusinessPlanRealises: validatedData.resultsBusinessPlanRealises === null ? undefined : validatedData.resultsBusinessPlanRealises,
    inputsDescriptionBien: validatedData.inputsDescriptionBien === null ? undefined : validatedData.inputsDescriptionBien,
    resultsDescriptionBien: validatedData.resultsDescriptionBien === null ? undefined : validatedData.resultsDescriptionBien,
    inputsDvf: validatedData.inputsDvf === null ? undefined : validatedData.inputsDvf,
    resultsDvfMetadata: validatedData.resultsDvfMetadata === null ? undefined : validatedData.resultsDvfMetadata,
    photos: validatedData.photos === null ? undefined : validatedData.photos,
    pdfConfig: validatedData.pdfConfig === null ? undefined : validatedData.pdfConfig,
    description: validatedData.description === null ? undefined : validatedData.description,
    inputsRenovationBien: validatedData.inputsRenovationBien === null ? undefined : validatedData.inputsRenovationBien,
    resultsRenovationBien: validatedData.resultsRenovationBien === null ? undefined : validatedData.resultsRenovationBien,
  };
}

// GET /api/projects - Liste tous les projets
router.get('/', async (req: Request, res: Response) => {
  try {
    const projects = await projectService.getAllProjects();
    res.json(projects);
  } catch (error) {
    console.error('Erreur lors de la récupération des projets:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des projets',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// GET /api/projects/:id - Récupère un projet spécifique
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ 
        error: 'Projet non trouvé',
        message: `Aucun projet trouvé avec l'ID ${req.params.id}`
      });
    }
    res.json(project);
  } catch (error) {
    console.error('Erreur lors de la récupération du projet:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération du projet',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// POST /api/projects - Crée un nouveau projet
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = projectSchema.parse(req.body);
    const data = normalizeProjectData(validatedData, true);
    const project = await projectService.createProject(data);
    res.status(201).json(project);
  } catch (error) {
    console.error('Erreur lors de la création du projet:', error);
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
        error: 'Erreur lors de la création du projet',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});

// PUT /api/projects/:id - Met à jour un projet
router.put('/:id', async (req: Request, res: Response) => {
  // Logs verbeux supprimés (ne garder que l'essentiel)
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }

    const validatedData = projectSchema.parse(req.body);
    const existingProject = await projectService.getProjectById(projectId);
    if (!existingProject) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Déterminer si la mise à jour concerne les données réalisées ou prévisionnelles
    const isRealizedUpdate = 'inputsBusinessPlanRealises' in validatedData || 'resultsBusinessPlanRealises' in validatedData;
    const isForecastedUpdate = 'inputsBusinessPlan' in validatedData || 'resultsBusinessPlan' in validatedData;

    const data: any = {};
    
    // Mise à jour des champs communs
    if ('projectTitle' in validatedData) {
      data.projectTitle = validatedData.projectTitle ?? existingProject.projectTitle;
    }
    if ('inputsGeneral' in validatedData) {
      data.inputsGeneral = validatedData.inputsGeneral
        ? { ...existingProject.inputsGeneral, ...validatedData.inputsGeneral }
        : existingProject.inputsGeneral;
    }
    if ('inputsDescriptionBien' in validatedData) {
      data.inputsDescriptionBien = validatedData.inputsDescriptionBien
        ? { ...existingProject.inputsDescriptionBien, ...validatedData.inputsDescriptionBien }
        : existingProject.inputsDescriptionBien;
    }
    if ('resultsDescriptionBien' in validatedData) {
      data.resultsDescriptionBien = validatedData.resultsDescriptionBien
        ? { ...existingProject.resultsDescriptionBien, ...validatedData.resultsDescriptionBien }
        : existingProject.resultsDescriptionBien;
    }
    if ('inputsDvf' in validatedData) {
      data.inputsDvf = validatedData.inputsDvf
        ? { ...existingProject.inputsDvf, ...validatedData.inputsDvf }
        : existingProject.inputsDvf;
    }
    if ('resultsDvfMetadata' in validatedData) {
      data.resultsDvfMetadata = validatedData.resultsDvfMetadata
        ? { ...existingProject.resultsDvfMetadata, ...validatedData.resultsDvfMetadata }
        : existingProject.resultsDvfMetadata;
    }
    if ('photos' in validatedData) {
      data.photos = validatedData.photos
        ? { ...existingProject.photos, ...validatedData.photos }
        : existingProject.photos;
    }
    if ('pdfConfig' in validatedData) {
      data.pdfConfig = validatedData.pdfConfig
        ? { ...existingProject.pdfConfig, ...validatedData.pdfConfig }
        : existingProject.pdfConfig;
    }
    if ('inputsRenovationBien' in validatedData) {
      data.inputsRenovationBien = validatedData.inputsRenovationBien
        ? { ...existingProject.inputsRenovationBien, ...validatedData.inputsRenovationBien }
        : existingProject.inputsRenovationBien;
    }
    if ('resultsRenovationBien' in validatedData) {
      data.resultsRenovationBien = validatedData.resultsRenovationBien
        ? { ...existingProject.resultsRenovationBien, ...validatedData.resultsRenovationBien }
        : existingProject.resultsRenovationBien;
    }

    // Mise à jour des données prévisionnelles
    if (isForecastedUpdate) {
      if ('inputsBusinessPlan' in validatedData) {
        data.inputsBusinessPlan = validatedData.inputsBusinessPlan || null;
      }
      if ('resultsBusinessPlan' in validatedData) {
        data.resultsBusinessPlan = validatedData.resultsBusinessPlan || null;
      }
    } else {
      // Si ce n'est pas une mise à jour des données prévisionnelles, on garde les valeurs existantes
      data.inputsBusinessPlan = existingProject.inputsBusinessPlan;
      data.resultsBusinessPlan = existingProject.resultsBusinessPlan;
    }

    // Mise à jour des données réalisées
    if (isRealizedUpdate) {
      if ('inputsBusinessPlanRealises' in validatedData) {
        data.inputsBusinessPlanRealises = validatedData.inputsBusinessPlanRealises || null;
      }
      if ('resultsBusinessPlanRealises' in validatedData) {
        data.resultsBusinessPlanRealises = validatedData.resultsBusinessPlanRealises || null;
      }
    } else {
      // Si ce n'est pas une mise à jour des données réalisées, on garde les valeurs existantes
      data.inputsBusinessPlanRealises = existingProject.inputsBusinessPlanRealises;
      data.resultsBusinessPlanRealises = existingProject.resultsBusinessPlanRealises;
    }

    // Sécurité : si les deux champs sont présents, on ne garde que celui qui a changé
    if (isRealizedUpdate && isForecastedUpdate) {
      // On privilégie le champ réalisé si c'est une update réalisée
      delete data.inputsBusinessPlan;
      delete data.resultsBusinessPlan;
    }
    if (isForecastedUpdate && !isRealizedUpdate) {
      delete data.inputsBusinessPlanRealises;
      delete data.resultsBusinessPlanRealises;
    }
    if (isRealizedUpdate && !isForecastedUpdate) {
      delete data.inputsBusinessPlan;
      delete data.resultsBusinessPlan;
    }

    // Logs détaillés supprimés
    const project = await projectService.updateProject(projectId, data);
    // Log synthétique
    console.log('[PUT] Projet mis à jour', { id: project.id });
    res.json(project);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du projet:', error);
    if (error instanceof z.ZodError) {
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
    } else if (error instanceof Error && error.message.includes('RecordNotFound')) {
      return res.status(404).json({
        error: 'Projet non trouvé',
        message: `Aucun projet trouvé avec l'ID ${req.params.id}`
      });
    } else {
      return res.status(500).json({
        error: 'Erreur lors de la mise à jour du projet',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }
});

// PATCH /api/projects/:id - Mise à jour partielle d'un projet (coverPhoto, photos, etc.)
router.patch('/:id', async (req: Request, res: Response) => {
  // Logs verbeux supprimés (ne garder que l'essentiel)
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }
    // Sécurité : n'envoyer à updateProject QUE les champs explicitement présents dans le body
    const allowedFields = [
      'projectTitle', 'inputsGeneral', 'inputsDescriptionBien', 'resultsDescriptionBien',
      'inputsBusinessPlan', 'inputsBusinessPlanRealises', 'resultsBusinessPlan', 'resultsBusinessPlanRealises',
      'inputsDvf', 'resultsDvfMetadata', 'photos', 'pdfConfig',
      'inputsRenovationBien', 'resultsRenovationBien', 'description'
    ];
    const filtered = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
    );
    // Logs détaillés supprimés
    const updatedProject = await projectService.updateProject(projectId, filtered);
    console.log('[PATCH] Projet mis à jour', { id: updatedProject.id });
    res.json(updatedProject);
  } catch (error) {
    console.error('[PATCH /api/projects/:id] Error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du projet' });
  }
});

// DELETE /api/projects/:id - Supprime un projet
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }
    
    await projectService.deleteProject(projectId);
    
    res.json({ message: 'Projet supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du projet:', error);
    if (error instanceof Error && error.message.includes('RecordNotFound')) {
      res.status(404).json({ 
        error: 'Projet non trouvé',
        message: `Aucun projet trouvé avec l'ID ${req.params.id}`
      });
    } else {
      res.status(500).json({ 
        error: 'Erreur lors de la suppression du projet',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});

export default router; 