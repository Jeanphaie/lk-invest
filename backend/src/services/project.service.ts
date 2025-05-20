import { PrismaClient } from '@prisma/client';
import { Project } from '../../../shared/types/project';
import { InputsGeneral } from '../../../shared/types/generalInputs';
import { DescriptionBienInputs } from '../../../shared/types/descriptionBienInputs';
import { DescriptionBienResults } from '../../../shared/types/descriptionBienResults';
import { BusinessPlanInputs } from '../../../shared/types/businessPlanInputs';
import { BusinessPlanResults } from '../../../shared/types/businessPlanResults';
import { Photos } from '../../../shared/types/photos';
import { PdfConfig, PdfData, DEFAULT_PDF_CONFIG, DEFAULT_PDF_DYNAMIC_FIELDS } from '../../../shared/types/pdf';
import { InputsDvf } from '../../../shared/types/dvfInputs';
import { ResultsDvfMetadata } from '../../../shared/types/dvfMetadataResults';
import { RenovationBienInputsSchema, RenovationBienInputs } from '../../../shared/types/renovationBienInputs';
import { RenovationBienResultsSchema, RenovationBienResults } from '../../../shared/types/renovationBienResults';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Type pour la création d'un projet (hors project_id, createdAt, updatedAt)
type CreateProjectDto = Omit<Parameters<typeof prisma.project.create>[0]['data'], 'project_id' | 'createdAt' | 'updatedAt'>;

// Type pour la mise à jour d'un projet (tous les champs optionnels)
type UpdateProjectDto = Partial<CreateProjectDto>;

interface Photo {
  id: number;
  url: string;
  category: string;
  selectedForPdf: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectPhotos {
  '3d': Photo[];
  after: Photo[];
  before: Photo[];
  during: Photo[];
  plans: Photo[];
  coverPhoto: string;
  selected3dPhotosForPdf: number[];
  selectedPlansPhotosForPdf: number[];
  selectedBeforePhotosForPdf: number[];
}

export class ProjectService {
  
  private validateJson<T>(data: unknown): T | undefined {
    if (data === undefined || data === null) return undefined;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as T;
      } catch {
        return undefined;
      }
    }
    return data as T;
  }

  // Créer un projet (initialise uniquement les champs du nouveau schéma)
  async createProject(projectData: CreateProjectDto): Promise<Project> {
    const pdfConfig = projectData.pdfConfig ?? DEFAULT_PDF_CONFIG;
    let photosRaw = projectData.photos;
    let photos: any = {};
    if (photosRaw) {
      if (typeof photosRaw === 'string') {
        try {
          photos = JSON.parse(photosRaw);
        } catch {
          photos = {};
        }
      } else if (typeof photosRaw === 'object' && photosRaw !== null) {
        photos = photosRaw;
      } else {
        photos = {};
      }
    }
    photos = {
      before: Array.isArray(photos.before) ? photos.before : [],
      during: Array.isArray(photos.during) ? photos.during : [],
      after: Array.isArray(photos.after) ? photos.after : [],
      '3d': Array.isArray(photos['3d']) ? photos['3d'] : [],
      plans: Array.isArray(photos.plans) ? photos.plans : [],
      selectedBeforePhotosForPdf: Array.isArray(photos.selectedBeforePhotosForPdf) ? photos.selectedBeforePhotosForPdf : [],
      selected3dPhotosForPdf: Array.isArray(photos.selected3dPhotosForPdf) ? photos.selected3dPhotosForPdf : [],
      selectedPlansPhotosForPdf: Array.isArray(photos.selectedPlansPhotosForPdf) ? photos.selectedPlansPhotosForPdf : [],
      coverPhoto: photos.coverPhoto ?? undefined
    };
    const project = await prisma.project.create({
      data: {
        ...projectData,
        pdfConfig,
        photos,
      }
    });
    return this.getProjectById(project.project_id) as Promise<Project>;
  }

  private normalizeProjectData(data: UpdateProjectDto): Record<string, unknown> {
    return Object.entries(data).reduce((acc, [key, value]) => {
      if (value === undefined) return acc;
      acc[key] = this.parseJsonDeep(value);
      return acc;
    }, {} as Record<string, unknown>);
  }

  // Mettre à jour un projet
  async updateProject(id: number, data: any): Promise<Project> {
    console.log('[updateProject] Starting update for project:', id);
    console.log('[updateProject] Input data:', JSON.stringify(data, null, 2));

    // Récupérer le projet existant pour préserver les photos
    const existingProject = await prisma.project.findUnique({
      where: { project_id: id },
      select: {
        photos: true,
        inputsGeneral: true,
        inputsBusinessPlan: true,
        inputsDescriptionBien: true,
        inputsDvf: true,
        resultsBusinessPlan: true,
        resultsDescriptionBien: true,
        resultsDvfMetadata: true,
        pdfConfig: true
      }
    });

    if (!existingProject) {
      throw new Error(`Project with id ${id} not found`);
    }

    console.log('[updateProject] Existing project photos:', {
      raw: existingProject.photos,
      parsed: this.validateJson(existingProject.photos),
      coverPhoto: existingProject.photos ? (existingProject.photos as any).coverPhoto : undefined
    });

    // Normaliser les données
    const normalizedData = this.normalizeProjectData(data);
    console.log('[updateProject] Normalized data:', {
      raw: normalizedData,
      photos: normalizedData.photos,
      coverPhoto: normalizedData.photos ? (normalizedData.photos as any).coverPhoto : undefined
    });

    // Préserver les sélections PDF existantes
    const existingPhotos = existingProject.photos as unknown as ProjectPhotos;
    const newPhotos = (normalizedData.photos || {}) as unknown as ProjectPhotos;
    
    console.log('[updateProject] Photos comparison:', {
      existing: {
        coverPhoto: existingPhotos.coverPhoto,
        hasCoverPhoto: !!existingPhotos.coverPhoto,
        coverPhotoType: typeof existingPhotos.coverPhoto
      },
      new: {
        coverPhoto: newPhotos.coverPhoto,
        hasCoverPhoto: !!newPhotos.coverPhoto,
        coverPhotoType: typeof newPhotos.coverPhoto
      }
    });

    // Fusionner les photos en préservant les sélections PDF
    let mergedCoverPhoto = (typeof newPhotos.coverPhoto === 'string' && newPhotos.coverPhoto.trim() !== '')
      ? newPhotos.coverPhoto
      : existingPhotos.coverPhoto;
    if (typeof mergedCoverPhoto !== 'string') mergedCoverPhoto = '';
    const mergedPhotos = {
      '3d': Array.isArray(newPhotos['3d']) && newPhotos['3d'].length > 0 ? newPhotos['3d'] : existingPhotos['3d'] || [],
      after: Array.isArray(newPhotos.after) && newPhotos.after.length > 0 ? newPhotos.after : existingPhotos.after || [],
      before: Array.isArray(newPhotos.before) && newPhotos.before.length > 0 ? newPhotos.before : existingPhotos.before || [],
      during: Array.isArray(newPhotos.during) && newPhotos.during.length > 0 ? newPhotos.during : existingPhotos.during || [],
      plans: Array.isArray(newPhotos.plans) && newPhotos.plans.length > 0 ? newPhotos.plans : existingPhotos.plans || [],
      coverPhoto: mergedCoverPhoto,
      selected3dPhotosForPdf: Array.isArray(newPhotos.selected3dPhotosForPdf) && newPhotos.selected3dPhotosForPdf.length > 0 
        ? [...new Set([...existingPhotos.selected3dPhotosForPdf, ...newPhotos.selected3dPhotosForPdf])]
        : existingPhotos.selected3dPhotosForPdf || [],
      selectedPlansPhotosForPdf: Array.isArray(newPhotos.selectedPlansPhotosForPdf) && newPhotos.selectedPlansPhotosForPdf.length > 0 
        ? [...new Set([...existingPhotos.selectedPlansPhotosForPdf, ...newPhotos.selectedPlansPhotosForPdf])]
        : existingPhotos.selectedPlansPhotosForPdf || [],
      selectedBeforePhotosForPdf: Array.isArray(newPhotos.selectedBeforePhotosForPdf) && newPhotos.selectedBeforePhotosForPdf.length > 0 
        ? [...new Set([...existingPhotos.selectedBeforePhotosForPdf, ...newPhotos.selectedBeforePhotosForPdf])]
        : existingPhotos.selectedBeforePhotosForPdf || []
    };

    console.log('[updateProject] Cover photo state:', {
      existingCoverPhoto: existingPhotos.coverPhoto,
      newCoverPhoto: newPhotos.coverPhoto,
      isNewCoverEmpty: newPhotos.coverPhoto === '',
      isNewCoverSameAsExisting: newPhotos.coverPhoto === existingPhotos.coverPhoto,
      finalCoverPhoto: mergedPhotos.coverPhoto,
      context: 'Tab change detected, preserving existing cover photo'
    });

    console.log('[updateProject] Merged photos state:', {
      coverPhoto: {
        value: mergedPhotos.coverPhoto,
        exists: !!mergedPhotos.coverPhoto,
        type: typeof mergedPhotos.coverPhoto
      },
      photos: {
        '3d': mergedPhotos['3d']?.length || 0,
        after: mergedPhotos.after?.length || 0,
        before: mergedPhotos.before?.length || 0,
        during: mergedPhotos.during?.length || 0,
        plans: mergedPhotos.plans?.length || 0
      }
    });

    // Filtrage des photos inexistantes AVANT sauvegarde
    const uploadsRoot = path.resolve(__dirname, '../../../uploads');
    const filterExisting = (arr: any[]) => arr.filter(photo => {
      if (!photo.url) return false;
      const filePath = path.join(uploadsRoot, photo.url.replace(/^\/uploads\//, ''));
      return fs.existsSync(filePath);
    });
    mergedPhotos.before = filterExisting(mergedPhotos.before || []);
    mergedPhotos.after = filterExisting(mergedPhotos.after || []);
    mergedPhotos['3d'] = filterExisting(mergedPhotos['3d'] || []);
    mergedPhotos.during = filterExisting(mergedPhotos.during || []);
    mergedPhotos.plans = filterExisting(mergedPhotos.plans || []);
    // coverPhoto: ne garder que si le fichier existe, sinon vide
    if (mergedPhotos.coverPhoto && typeof mergedPhotos.coverPhoto === 'string') {
      const coverPath = path.join(uploadsRoot, mergedPhotos.coverPhoto.replace(/^\/uploads\//, ''));
      if (!fs.existsSync(coverPath)) {
        mergedPhotos.coverPhoto = '';
      }
    } else {
      mergedPhotos.coverPhoto = '';
    }

    // Log détaillé de la structure des photos juste avant la sauvegarde
    console.log('[updateProject][BEFORE SAVE][PHOTOS STRUCTURE]', JSON.stringify({
      '3d': mergedPhotos['3d'],
      after: mergedPhotos.after,
      before: mergedPhotos.before,
      during: mergedPhotos.during,
      plans: mergedPhotos.plans,
      coverPhoto: mergedPhotos.coverPhoto,
      selected3dPhotosForPdf: mergedPhotos.selected3dPhotosForPdf,
      selectedPlansPhotosForPdf: mergedPhotos.selectedPlansPhotosForPdf,
      selectedBeforePhotosForPdf: mergedPhotos.selectedBeforePhotosForPdf
    }, null, 2));

    // Mettre à jour le projet avec les données normalisées et les photos fusionnées
    const updatedProject = await prisma.project.update({
      where: { project_id: id },
      data: {
        ...normalizedData,
        photos: mergedPhotos as any
      }
    });

    console.log('[updateProject] Updated project photos:', {
      raw: updatedProject.photos,
      parsed: this.validateJson(updatedProject.photos),
      coverPhoto: updatedProject.photos ? (updatedProject.photos as any).coverPhoto : undefined
    });

    return {
      ...updatedProject,
      id: updatedProject.project_id,
      projectTitle: updatedProject.projectTitle,
      createdAt: updatedProject.createdAt.toISOString(),
      updatedAt: updatedProject.updatedAt.toISOString(),
      inputsGeneral: this.validateJson(updatedProject.inputsGeneral) ?? {
        superficie_terrasse: 0,
        ponderation_terrasse: 0
      },
      inputsDescriptionBien: this.validateJson(updatedProject.inputsDescriptionBien),
      resultsDescriptionBien: this.validateJson(updatedProject.resultsDescriptionBien),
      inputsBusinessPlan: this.validateJson(updatedProject.inputsBusinessPlan),
      resultsBusinessPlan: this.validateJson(updatedProject.resultsBusinessPlan),
      inputsDvf: this.validateJson(updatedProject.inputsDvf),
      resultsDvfMetadata: this.validateJson(updatedProject.resultsDvfMetadata),
      inputsRenovationBien: this.validateJson(updatedProject.inputsRenovationBien),
      resultsRenovationBien: this.validateJson(updatedProject.resultsRenovationBien),
      photos: this.validateJson(updatedProject.photos) ?? {
        before: [],
        during: [],
        after: [],
        '3d': [],
        plans: [],
        selectedBeforePhotosForPdf: [],
        selected3dPhotosForPdf: [],
        selectedPlansPhotosForPdf: [],
        coverPhoto: undefined
      },
      pdfConfig: this.validateJson(updatedProject.pdfConfig) ?? DEFAULT_PDF_CONFIG,
      dvfTransactions: [],
      dvfSeries: [],
      dvfDistributions: [],
      dvfPremiumTransactions: []
    };
  }

  // Parse JSON deeply (handles string, double-string, or object)
  private parseJsonDeep<T>(data: unknown): T | undefined {
    if (data === undefined || data === null) return undefined;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as T;
      }
    }
    return data as T;
  }

  async getProjectById(id: number): Promise<Project | null> {
    const project = await prisma.project.findUnique({
      where: { project_id: id },
      select: {
        project_id: true,
        projectTitle: true,
        createdAt: true,
        updatedAt: true,
        inputsGeneral: true,
        inputsDescriptionBien: true,
        resultsDescriptionBien: true,
        inputsBusinessPlan: true,
        resultsBusinessPlan: true,
        inputsDvf: true,
        resultsDvfMetadata: true,
        photos: true,
        pdfConfig: true,
        inputsRenovationBien: true,
        resultsRenovationBien: true,
        dvfTransactions: true,
        dvfSeries: true,
        dvfDistributions: true,
        dvfPremiumTransactions: true
      }
    });

    if (!project) return null;

    // Parse photos with default values
    let photos: Photos;
    if (project.photos) {
      photos = this.validateJson<Photos>(project.photos) ?? {
        before: [],
        during: [],
        after: [],
        '3d': [],
        plans: [],
        selectedBeforePhotosForPdf: [],
        selected3dPhotosForPdf: [],
        selectedPlansPhotosForPdf: [],
        coverPhoto: ''
      };
    } else {
      photos = {
        before: [],
        during: [],
        after: [],
        '3d': [],
        plans: [],
        selectedBeforePhotosForPdf: [],
        selected3dPhotosForPdf: [],
        selectedPlansPhotosForPdf: [],
        coverPhoto: ''
      };
    }

    // Filtrer les photos dont le fichier n'existe pas
    const uploadsRoot = path.resolve(__dirname, '../../../uploads');
    const filterExisting = (arr: any[]) => arr.filter(photo => {
      if (!photo.url) return false;
      const filePath = path.join(uploadsRoot, photo.url.replace(/^\/uploads\//, ''));
      return fs.existsSync(filePath);
    });
    photos.before = filterExisting(photos.before || []);
    photos.after = filterExisting(photos.after || []);
    photos['3d'] = filterExisting(photos['3d'] || []);
    photos.during = filterExisting(photos.during || []);
    photos.plans = filterExisting(photos.plans || []);
    // coverPhoto: ne garder que si le fichier existe, sinon vide
    if (photos.coverPhoto && typeof photos.coverPhoto === 'string') {
      const coverPath = path.join(uploadsRoot, photos.coverPhoto.replace(/^\/uploads\//, ''));
      if (!fs.existsSync(coverPath)) {
        photos.coverPhoto = '';
      }
    } else {
      photos.coverPhoto = '';
    }

    return {
      id: project.project_id,
      projectTitle: project.projectTitle,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      inputsGeneral: this.validateJson<InputsGeneral>(project.inputsGeneral) ?? {
        superficie_terrasse: 0,
        ponderation_terrasse: 0
      },
      inputsDescriptionBien: this.validateJson<DescriptionBienInputs>(project.inputsDescriptionBien) ?? undefined,
      resultsDescriptionBien: this.validateJson<DescriptionBienResults>(project.resultsDescriptionBien) ?? undefined,
      inputsBusinessPlan: this.validateJson<BusinessPlanInputs>(project.inputsBusinessPlan) ?? undefined,
      resultsBusinessPlan: this.validateJson<BusinessPlanResults>(project.resultsBusinessPlan) ?? undefined,
      inputsDvf: this.validateJson<InputsDvf>(project.inputsDvf) ?? undefined,
      resultsDvfMetadata: this.validateJson<ResultsDvfMetadata>(project.resultsDvfMetadata) ?? undefined,
      photos,
      pdfConfig: this.validateJson<PdfConfig>(project.pdfConfig) ?? DEFAULT_PDF_CONFIG,
      inputsRenovationBien: this.validateJson<RenovationBienInputs>(project.inputsRenovationBien) ?? undefined,
      resultsRenovationBien: this.validateJson<RenovationBienResults>(project.resultsRenovationBien) ?? undefined,
      dvfTransactions: project.dvfTransactions?.map(t => {
        const d = t.data as any;
        return {
          id: d.id ?? 0,
          latitude: d.latitude ?? 0,
          longitude: d.longitude ?? 0,
          type: d.type ?? '',
          prix_m2: d.prix_m2 ?? 0,
          prix: d.prix ?? d.valeur_fonciere ?? 0,
          surface: d.surface ?? d.surface_reelle_bati ?? 0,
          date_mutation: d.date_mutation ?? '',
          numero: d.numero ?? d.adresse_numero ?? '',
          voie: d.voie ?? d.adresse_nom_voie ?? '',
          adresse_complete: [
            d.numero ?? d.adresse_numero ?? '',
            d.voie ?? d.adresse_nom_voie ?? ''
          ].filter(Boolean).join(' '),
          code_postal: d.code_postal ?? '',
          ville: d.ville ?? '',
          is_outlier: d.is_outlier ?? false,
          valeur_fonciere: d.valeur_fonciere ?? 0,
          surface_reelle_bati: d.surface_reelle_bati ?? 0,
          nombre_pieces_principales: d.nombre_pieces_principales ?? 0
        };
      }).filter(Boolean) ?? [],
      dvfSeries: project.dvfSeries?.map(s => {
        const d = s.data as any;
        return {
          ...d,
          type: s.type
        };
      }).filter(Boolean) ?? [],
      dvfDistributions: project.dvfDistributions?.map(d => {
        const dist = d.data as any;
        let prixM2 = dist.prixM2;
        if (dist.bin && typeof dist.bin === 'string') {
          const [minStr, maxStr] = dist.bin.split('-');
          const min = parseFloat(minStr.replace('k', '000'));
          const max = parseFloat(maxStr.replace('k', '000'));
          prixM2 = (min + max) / 2;
        }
        prixM2 = typeof prixM2 === 'number' && !isNaN(prixM2) ? prixM2 : 0;
        const nombreTransactions = typeof dist.count === 'number'
          ? dist.count
          : typeof dist.nombreTransactions === 'number'
            ? dist.nombreTransactions
            : 0;
        return {
          ...dist,
          prixM2,
          nombreTransactions,
        };
      }).filter(Boolean) ?? [],
      dvfPremiumTransactions: project.dvfPremiumTransactions?.map(t => {
        const d = t.data as any;
        return {
          id: d.id ?? 0,
          latitude: d.latitude ?? 0,
          longitude: d.longitude ?? 0,
          type: d.type ?? '',
          prix_m2: d.prix_m2 ?? 0,
          prix: d.prix ?? d.valeur_fonciere ?? 0,
          surface: d.surface ?? d.surface_reelle_bati ?? 0,
          date_mutation: d.date_mutation ?? '',
          numero: d.numero ?? d.adresse_numero ?? '',
          voie: d.voie ?? d.adresse_nom_voie ?? '',
          adresse_complete: [
            d.numero ?? d.adresse_numero ?? '',
            d.voie ?? d.adresse_nom_voie ?? ''
          ].filter(Boolean).join(' '),
          code_postal: d.code_postal ?? '',
          ville: d.ville ?? '',
          is_outlier: d.is_outlier ?? false,
          valeur_fonciere: d.valeur_fonciere ?? 0,
          surface_reelle_bati: d.surface_reelle_bati ?? 0,
          nombre_pieces_principales: d.nombre_pieces_principales ?? 0
        };
      }).filter(Boolean) ?? []
    };
  }

  async getAllProjects(): Promise<Project[]> {
    const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
    return Promise.all(projects.map(p => this.getProjectById(p.project_id) as Promise<Project>));
  }

  // Supprimer un projet
  async deleteProject(id: number): Promise<void> {
    // Supprimer toutes les entrées liées avant de supprimer le projet
    await prisma.dvfTransaction.deleteMany({ where: { projectId: id } });
    await prisma.dvfSeries.deleteMany({ where: { projectId: id } });
    await prisma.dvfDistribution.deleteMany({ where: { projectId: id } });
    await prisma.dvfPremiumTransaction.deleteMany({ where: { projectId: id } });

    // Ensuite, supprimer le projet
    await prisma.project.delete({ where: { project_id: id } });
  }
} 