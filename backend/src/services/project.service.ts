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
import { InputsRenovationBien } from '../../../shared/types/renovationBienInputs';
import { ResultsRenovationBien } from '../../../shared/types/renovationBienResults';


const prisma = new PrismaClient();

// Type pour la création d'un projet (hors id, createdAt, updatedAt)
type CreateProjectDto = Omit<Parameters<typeof prisma.project.create>[0]['data'], 'id' | 'createdAt' | 'updatedAt'>;

// Type pour la mise à jour d'un projet (tous les champs optionnels)
type UpdateProjectDto = Partial<CreateProjectDto>;

export class ProjectService {
  
  // Créer un projet (initialise uniquement les champs du nouveau schéma)
  async createProject(projectData: CreateProjectDto): Promise<Project> {
    const pdfConfig = projectData.pdfConfig ?? DEFAULT_PDF_CONFIG;
    const project = await prisma.project.create({
      data: {
        ...projectData,
        pdfConfig,
      }
    });
    return this.getProjectById(project.id) as Promise<Project>;
  }

  // Mettre à jour un projet
  async updateProject(id: number, data: UpdateProjectDto): Promise<Project> {
    console.log('[updateProject] Received update for project', id, 'with data:', JSON.stringify(data));
    
    // Normalize photos if present
    let normalizedData = { ...data };
    if (data.photos) {
      // Ensure photos is a native object
      const photos = typeof data.photos === 'string' ? JSON.parse(data.photos) : data.photos;
      
      // Normalize coverPhoto to be string or undefined
      if (photos.coverPhoto && typeof photos.coverPhoto === 'object') {
        photos.coverPhoto = photos.coverPhoto.url || undefined;
      }
      if (photos.coverPhoto === null) {
        delete photos.coverPhoto;
      }
      
      normalizedData.photos = photos;
    }

    console.log('[updateProject] Normalized data to be saved:', JSON.stringify(normalizedData));

    const project = await prisma.project.update({
      where: { id },
      data: normalizedData
    });
    
    console.log('[updateProject] Project updated. DB photos field:', project.photos);
    return this.getProjectById(project.id) as Promise<Project>;
  }

  // Parse JSON deeply (handles string, double-string, or object)
  private parseJsonDeep<T>(data: unknown): T | undefined {
    if (!data) return undefined;
    try {
      let value = data;
      while (typeof value === 'string') {
        value = JSON.parse(value);
      }
      return value as T;
    } catch {
      return undefined;
    }
  }

  // Récupérer un projet par son ID
  async getProjectById(id: number): Promise<Project | null> {
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
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
        dvfTransactions: { select: { data: true } },
        dvfSeries: { select: { data: true, type: true } },
        dvfDistributions: { select: { data: true } },
        dvfPremiumTransactions: { select: { data: true } },
      }
    });

    if (!project) return null;

    // Parse photos field and normalize coverPhoto
    let photos = this.parseJsonDeep<Photos>(project.photos);
    if (photos) {
      // Ensure coverPhoto is string or undefined
      if (photos.coverPhoto && typeof photos.coverPhoto === 'object') {
        const coverPhotoObj = photos.coverPhoto as { url?: string };
        photos.coverPhoto = coverPhotoObj.url || undefined;
      }
      if (photos.coverPhoto === null) {
        delete photos.coverPhoto;
      }
    } else {
      photos = {
        before: [],
        during: [],
        after: [],
        '3d': [],
        selectedBeforePhotosForPdf: [],
        selected3dPhotosForPdf: [],
        coverPhoto: undefined
      };
    }

    return {
      id: project.id,
      projectTitle: project.projectTitle,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      inputsGeneral: this.validateJson<InputsGeneral>(project.inputsGeneral) ?? {
        superficie: 0,
        superficie_terrasse: 0,
        ponderation_terrasse: 0,
      },
      inputsDescriptionBien: this.validateJson<DescriptionBienInputs>(project.inputsDescriptionBien) ?? undefined,
      resultsDescriptionBien: this.validateJson<DescriptionBienResults>(project.resultsDescriptionBien) ?? undefined,
      inputsBusinessPlan: this.validateJson<BusinessPlanInputs>(project.inputsBusinessPlan) ?? undefined,
      resultsBusinessPlan: this.validateJson<BusinessPlanResults>(project.resultsBusinessPlan) ?? undefined,
      inputsDvf: this.validateJson<InputsDvf>(project.inputsDvf) ?? undefined,
      resultsDvfMetadata: this.validateJson<ResultsDvfMetadata>(project.resultsDvfMetadata) ?? undefined,
      photos,
      pdfConfig: this.validateJson<PdfConfig>(project.pdfConfig) ?? DEFAULT_PDF_CONFIG,
      inputsRenovationBien: this.validateJson<InputsRenovationBien>(project.inputsRenovationBien) ?? undefined,
      resultsRenovationBien: this.validateJson<ResultsRenovationBien>(project.resultsRenovationBien) ?? undefined,
      dvfTransactions: project.dvfTransactions?.map(t => {
        const d = t.data as any;
        return {
          id: d.id ?? '',
          latitude: d.latitude ?? 0,
          longitude: d.longitude ?? 0,
          type: d.type ?? '',
          prix_m2: d.prix_m2 ?? 0,
          prix: d.prix ?? d.valeur_fonciere ?? 0,
          surface: d.surface ?? d.surface_reelle_bati ?? 0,
          date_mutation: d.date_mutation ?? '',
          numero: d.numero ?? d.adresse_numero ?? '',
          voie: d.voie ?? d.adresse_nom_voie ?? '',
          ville: d.ville ?? d.nom_commune ?? '',
          code_postal: d.code_postal ?? '',
          is_outlier: d.is_outlier ?? false,
          valeur_fonciere: d.valeur_fonciere ?? 0,
          surface_reelle_bati: d.surface_reelle_bati ?? 0,
          nombre_pieces_principales: d.nombre_pieces_principales ?? 0,
        };
      }).filter(Boolean) ?? [],
      dvfSeries: project.dvfSeries?.map(s => {
        const d = s.data as any;
        return {
          ...d,
          type: s.type ?? d.type ?? '',
          year: d.year ?? 0,
          selection_avg: d.selection_avg ?? 0,
          selection_count: d.selection_count ?? 0,
          arrondissement_avg: d.arrondissement_avg ?? 0,
          arrondissement_count: d.arrondissement_count ?? 0,
          premium_avg: d.premium_avg ?? 0,
          premium_count: d.premium_count ?? 0,
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
        return {
          ...dist,
          prixM2,
          nombreTransactions: dist.count ?? dist.nombreTransactions ?? 0,
        };
      }).filter(Boolean) ?? [],
      dvfPremiumTransactions: project.dvfPremiumTransactions?.map(t => {
        const d = t.data as any;
        return {
          id: d.id ?? '',
          latitude: d.latitude ?? 0,
          longitude: d.longitude ?? 0,
          type: d.type ?? '',
          prix_m2: d.prix_m2 ?? 0,
          prix: d.prix ?? d.valeur_fonciere ?? 0,
          surface: d.surface ?? d.surface_reelle_bati ?? 0,
          date_mutation: d.date_mutation ?? '',
          numero: d.numero ?? d.adresse_numero ?? '',
          voie: d.voie ?? d.adresse_nom_voie ?? '',
          ville: d.ville ?? d.nom_commune ?? '',
          code_postal: d.code_postal ?? '',
          is_outlier: d.is_outlier ?? false,
          valeur_fonciere: d.valeur_fonciere ?? 0,
          surface_reelle_bati: d.surface_reelle_bati ?? 0,
          nombre_pieces_principales: d.nombre_pieces_principales ?? 0,
        };
      }).filter(Boolean) ?? [],
    };
  }



  // Valider les données JSON
  private validateJson<T>(data: unknown): T | undefined {
    if (!data) return undefined;
    try {
      if (typeof data === 'string') {
        return JSON.parse(data) as T;
      }
      return data as T;
    } catch {
      return undefined;
    }
  }

  // Récupérer tous les projets
  async getAllProjects(): Promise<Project[]> {
    const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
    return Promise.all(projects.map(p => this.getProjectById(p.id) as Promise<Project>));
  }

  // Supprimer un projet
  async deleteProject(id: number): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }

} 