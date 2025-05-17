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
  resultsBusinessPlan: BusinessPlanResultsSchema.optional(),
  inputsDvf: z.any().optional(),
  resultsDvfMetadata: z.any().optional(),
  photos: PhotosSchema.optional(),
  pdfConfig: z.any().optional(),
  description: z.string().max(1000, 'La description ne doit pas dépasser 1000 caractères').optional()
}).partial();

function normalizeProjectData(validatedData: any, isCreate = false) {
  return {
    ...validatedData,
    projectTitle: validatedData.projectTitle || 'Nouveau projet',
    inputsGeneral: (validatedData.inputsGeneral === null || validatedData.inputsGeneral === undefined)
      ? { projectTitle: validatedData.projectTitle || 'Nouveau projet', superficie: 0, superficie_terrasse: 0, ponderation_terrasse: 0 }
      : validatedData.inputsGeneral,
    inputsBusinessPlan: validatedData.inputsBusinessPlan === null ? undefined : validatedData.inputsBusinessPlan,
    resultsBusinessPlan: validatedData.resultsBusinessPlan === null ? undefined : validatedData.resultsBusinessPlan,
    inputsDescriptionBien: validatedData.inputsDescriptionBien === null ? undefined : validatedData.inputsDescriptionBien,
    resultsDescriptionBien: validatedData.resultsDescriptionBien === null ? undefined : validatedData.resultsDescriptionBien,
    inputsDvf: validatedData.inputsDvf === null ? undefined : validatedData.inputsDvf,
    resultsDvfMetadata: validatedData.resultsDvfMetadata === null ? undefined : validatedData.resultsDvfMetadata,
    photos: validatedData.photos === null ? undefined : validatedData.photos,
    pdfConfig: validatedData.pdfConfig === null ? undefined : validatedData.pdfConfig,
    description: validatedData.description === null ? undefined : validatedData.description
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
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }
    const existingProject = await projectService.getProjectById(projectId);
    if (!existingProject) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    const validatedData = projectSchema.parse(req.body);
    // Merge champ par champ pour chaque sous-objet explicitement géré
    const data: any = {
      projectTitle: validatedData.projectTitle ?? existingProject.projectTitle,
      inputsGeneral: validatedData.inputsGeneral
        ? { ...existingProject.inputsGeneral, ...validatedData.inputsGeneral }
        : existingProject.inputsGeneral,
      inputsBusinessPlan: validatedData.inputsBusinessPlan
        ? { ...existingProject.inputsBusinessPlan, ...validatedData.inputsBusinessPlan }
        : existingProject.inputsBusinessPlan,
      resultsBusinessPlan: validatedData.resultsBusinessPlan
        ? { ...existingProject.resultsBusinessPlan, ...validatedData.resultsBusinessPlan }
        : existingProject.resultsBusinessPlan,
      inputsDescriptionBien: validatedData.inputsDescriptionBien
        ? { ...existingProject.inputsDescriptionBien, ...validatedData.inputsDescriptionBien }
        : existingProject.inputsDescriptionBien,
      resultsDescriptionBien: validatedData.resultsDescriptionBien
        ? { ...existingProject.resultsDescriptionBien, ...validatedData.resultsDescriptionBien }
        : existingProject.resultsDescriptionBien,
      inputsDvf: validatedData.inputsDvf
        ? { ...existingProject.inputsDvf, ...validatedData.inputsDvf }
        : existingProject.inputsDvf,
      resultsDvfMetadata: validatedData.resultsDvfMetadata
        ? { ...existingProject.resultsDvfMetadata, ...validatedData.resultsDvfMetadata }
        : existingProject.resultsDvfMetadata,
      photos: validatedData.photos
        ? { ...existingProject.photos, ...validatedData.photos }
        : existingProject.photos,
      pdfConfig: validatedData.pdfConfig
        ? { ...existingProject.pdfConfig, ...validatedData.pdfConfig }
        : existingProject.pdfConfig,
    };
    const project = await projectService.updateProject(projectId, data);
    res.json(project);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du projet:', error);
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
        error: 'Erreur lors de la mise à jour du projet',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});

// PATCH /api/projects/:id - Mise à jour partielle d'un projet (coverPhoto, photos, etc.)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de projet invalide' });
    }
    console.log('[PATCH /api/projects/:id] Received body:', JSON.stringify(req.body));
    const updatedProject = await projectService.updateProject(projectId, req.body);
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