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
import { ProjectSchema } from '../../../shared/types/project';
import { BusinessPlanRealised, BusinessPlanRealisedSchema } from '../../../shared/types/businessPlanRealised';

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
  selectedDuringPhotosForPdf: number[];
  selectedAfterPhotosForPdf: number[];
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
      selectedDuringPhotosForPdf: Array.isArray(photos.selectedDuringPhotosForPdf) ? photos.selectedDuringPhotosForPdf : [],
      selectedAfterPhotosForPdf: Array.isArray(photos.selectedAfterPhotosForPdf) ? photos.selectedAfterPhotosForPdf : [],
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
    console.log('[LOG][updateProject] Appelée avec id:', id, 'et data:', JSON.stringify(data, null, 2));
    // Récupérer le projet existant pour préserver les photos
    const existingProject = await prisma.project.findUnique({
      where: { project_id: id },
      select: {
        photos: true,
        inputsGeneral: true,
        inputsBusinessPlan: true,
        inputsBusinessPlanRealises: true,
        inputsDescriptionBien: true,
        inputsDvf: true,
        resultsBusinessPlan: true,
        resultsBusinessPlanRealises: true,
        resultsDescriptionBien: true,
        resultsDvfMetadata: true,
        pdfConfig: true
      }
    });

    if (!existingProject) {
      throw new Error(`Project with id ${id} not found`);
    }

    
    // Normaliser les données
    const normalizedData = this.normalizeProjectData(data);
    console.log('[LOG][updateProject] normalizedData:', JSON.stringify(normalizedData, null, 2));
    
    // Préserver les sélections PDF existantes
    const existingPhotos = existingProject.photos as unknown as ProjectPhotos;
    const newPhotos = (normalizedData.photos || {}) as unknown as ProjectPhotos;
    
    
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
        : existingPhotos.selectedBeforePhotosForPdf || [],
      selectedDuringPhotosForPdf: Array.isArray(newPhotos.selectedDuringPhotosForPdf) && newPhotos.selectedDuringPhotosForPdf.length > 0 
        ? [...new Set([...existingPhotos.selectedDuringPhotosForPdf, ...newPhotos.selectedDuringPhotosForPdf])]
        : existingPhotos.selectedDuringPhotosForPdf || [],
      selectedAfterPhotosForPdf: Array.isArray(newPhotos.selectedAfterPhotosForPdf) && newPhotos.selectedAfterPhotosForPdf.length > 0 
        ? [...new Set([...existingPhotos.selectedAfterPhotosForPdf, ...newPhotos.selectedAfterPhotosForPdf])]
        : existingPhotos.selectedAfterPhotosForPdf || [],
    };

    
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
    
    // Log détaillé pour inputsBusinessPlanRealises
    let mergedInputsBusinessPlanRealises = existingProject.inputsBusinessPlanRealises;
    if (normalizedData.inputsBusinessPlanRealises) {
      mergedInputsBusinessPlanRealises = JSON.parse(JSON.stringify({
        ...(existingProject.inputsBusinessPlanRealises as BusinessPlanRealised),
        ...(normalizedData.inputsBusinessPlanRealises as BusinessPlanRealised)
      }));
    
    }

    if (mergedInputsBusinessPlanRealises === null || mergedInputsBusinessPlanRealises === undefined) {
      // On n'inclut pas la clé dans l'objet de mise à jour
    }

    // Construction stricte de updateData :
    const updateData: any = {};
    if ('inputsBusinessPlan' in normalizedData) {
      updateData.inputsBusinessPlan = normalizedData.inputsBusinessPlan;
    }
    if ('inputsBusinessPlanRealises' in normalizedData) {
      updateData.inputsBusinessPlanRealises = normalizedData.inputsBusinessPlanRealises;
    }
    if ('resultsBusinessPlan' in normalizedData) {
      updateData.resultsBusinessPlan = normalizedData.resultsBusinessPlan;
    }
    if ('resultsBusinessPlanRealises' in normalizedData) {
      updateData.resultsBusinessPlanRealises = normalizedData.resultsBusinessPlanRealises;
    }
    if ('photos' in normalizedData) {
      updateData.photos = mergedPhotos;
    }
    console.log('[LOG][updateProject] updateData envoyé à Prisma:', JSON.stringify(updateData, null, 2));

    if (updateData.inputsBusinessPlan) {
      console.trace('[ALERTE][SERVICE] updateData.inputsBusinessPlan va être modifié !', JSON.stringify(updateData.inputsBusinessPlan, null, 2));
    }

    // Mettre à jour le projet avec les données normalisées et les photos fusionnées
    const updatedProject = await prisma.project.update({
      where: { project_id: id },
      data: updateData
    });
    console.log('[LOG][updateProject] Résultat complet retourné par Prisma:', JSON.stringify(updatedProject, null, 2));

    const projectData = {
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
      inputsBusinessPlanRealises: this.validateJson(updatedProject.inputsBusinessPlanRealises),
      resultsBusinessPlan: this.validateJson(updatedProject.resultsBusinessPlan),
      resultsBusinessPlanRealises: this.validateJson(updatedProject.resultsBusinessPlanRealises),
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
        selectedDuringPhotosForPdf: [],
        selectedAfterPhotosForPdf: [],
        coverPhoto: undefined
      },
      pdfConfig: this.validateJson(updatedProject.pdfConfig) ?? DEFAULT_PDF_CONFIG,
      dvfTransactions: [],
      dvfSeries: [],
      dvfDistributions: [],
      dvfPremiumTransactions: []
    };
    console.log('[LOG][updateProject] projectData retourné au contrôleur:', JSON.stringify({
      id: projectData.id,
      inputsBusinessPlan: projectData.inputsBusinessPlan,
      inputsBusinessPlanRealises: projectData.inputsBusinessPlanRealises,
      resultsBusinessPlan: projectData.resultsBusinessPlan,
      resultsBusinessPlanRealises: projectData.resultsBusinessPlanRealises
    }, null, 2));

    // Filtrer les clés undefined avant de retourner le projet
    Object.keys(projectData).forEach(key => {
      if ((projectData as any)[key] === undefined) {
        delete (projectData as any)[key];
      }
    });

    return ProjectSchema.parse(projectData);
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
        inputsBusinessPlan: true,
        inputsBusinessPlanRealises: true,
        inputsDescriptionBien: true,
        resultsDescriptionBien: true,
        resultsBusinessPlan: true,
        resultsBusinessPlanRealises: true,
        inputsDvf: true,
        resultsDvfMetadata: true,
        photos: true,
        pdfConfig: true,
        inputsRenovationBien: true,
        resultsRenovationBien: true,
        dvfTransactions: {
          select: {
            data: true
          }
        },
        dvfSeries: {
          select: {
            data: true
          }
        },
        dvfDistributions: {
          select: {
            data: true
          }
        },
        dvfPremiumTransactions: {
          select: {
            data: true
          }
        }
      }
    });

    if (!project) return null;

    console.log('[LOG][getProjectById] id:', id, 'inputsBusinessPlan:', project.inputsBusinessPlan, 'inputsBusinessPlanRealises:', project.inputsBusinessPlanRealises);

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
        selectedDuringPhotosForPdf: [],
        selectedAfterPhotosForPdf: [],
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
        selectedDuringPhotosForPdf: [],
        selectedAfterPhotosForPdf: [],
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

    // Après avoir obtenu ou construit l'objet photos :
    if (!photos.selectedDuringPhotosForPdf) photos.selectedDuringPhotosForPdf = [];
    if (!photos.selectedAfterPhotosForPdf) photos.selectedAfterPhotosForPdf = [];

    const raw = project.inputsBusinessPlanRealises;
    const parsed = this.validateJson<BusinessPlanInputs>(raw);
    const inputsBusinessPlanRealises = (parsed === null || parsed === undefined) ? undefined : parsed;

    const projectData = {
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
      inputsBusinessPlanRealises: this.validateJson<BusinessPlanInputs>(project.inputsBusinessPlanRealises) ?? undefined,
      resultsBusinessPlan: this.validateJson<BusinessPlanResults>(project.resultsBusinessPlan) ?? undefined,
      resultsBusinessPlanRealises: this.validateJson<BusinessPlanResults>(project.resultsBusinessPlanRealises) ?? undefined,
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
        } as const;
      }).filter(Boolean) ?? [],
      dvfSeries: project.dvfSeries?.map(s => {
        const d = s.data as any;
        return {
          year: d.year ?? 0,
          selection_avg: d.selection_avg ?? 0,
          selection_count: d.selection_count ?? 0,
          arrondissement_avg: d.arrondissement_avg ?? 0,
          arrondissement_count: d.arrondissement_count ?? 0,
          premium_avg: d.premium_avg ?? 0,
          premium_count: d.premium_count ?? 0
        } as const;
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
          prixM2,
          nombreTransactions
        } as const;
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
        } as const;
      }).filter(Boolean) ?? []
    };

    return ProjectSchema.parse(projectData);
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