import { PrismaClient } from '@prisma/client';
import { Photos, Photo, PhotosSchema } from '../../../shared/types/photos';
import { PlansMigrationService } from './plansMigration.service';

const prisma = new PrismaClient();

// Type guard pour s'assurer qu'on manipule une catégorie de Photo[]
function isPhotoCategory(category: keyof Photos): category is 'before' | 'during' | 'after' | '3d' | 'plans' {
  return category === 'before' || category === 'during' || category === 'after' || category === '3d' || category === 'plans';
}

export class PhotoService {
  // Récupérer les photos d'un projet
  async getProjectPhotos(projectId: number): Promise<Photos> {
    const project = await prisma.project.findUnique({
      where: { project_id: projectId },
      select: { photos: true }
    });
    const photos = project?.photos || {
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
    };
    
    // Validation stricte
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    
    // Migration automatique : synchroniser plansStructured si nécessaire
    const syncedPhotos = PlansMigrationService.syncPlansData(parsed.data);
    
    // Sauvegarder la structure synchronisée si elle a été créée ET si des plans existent
    // Vérifier si plansStructured a été créé (n'existait pas avant mais existe maintenant)
    const hadPlansStructured = !!(photos as any).plansStructured;
    const hasPlansStructured = !!syncedPhotos.plansStructured;
    const hasPlans = ((photos as any).plans?.length || 0) > 0;
    
    if (hasPlansStructured && !hadPlansStructured && hasPlans) {
      await this.savePhotos(projectId, syncedPhotos);
      // Recharger pour avoir la version à jour
      return await this.getProjectPhotos(projectId);
    }
    
    return syncedPhotos;
  }
  
  // Méthode privée pour sauvegarder les photos
  private async savePhotos(projectId: number, photos: Photos): Promise<void> {
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: photos as any }
    });
  }

  // Ajouter une photo à une catégorie
  async addPhotoToCategory(projectId: number, category: keyof Photos, photo: Photo): Promise<Photos> {
    // Récupérer l'objet photos existant
    const project = await prisma.project.findUnique({ where: { project_id: projectId } });
    let photos = project?.photos;
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos); } catch { photos = {}; }
    }
    if (!photos || typeof photos !== 'object') {
      photos = {};
    }
    // Initialiser les champs si absents et PRÉSERVER tous les champs existants
    const currentSelectedBefore = (photos as any).selectedBeforePhotosForPdf || [];
    const currentSelected3d = (photos as any).selected3dPhotosForPdf || [];
    const currentSelectedPlans = (photos as any).selectedPlansPhotosForPdf || [];
    const currentCover = (photos as any).coverPhoto || undefined;
    photos = {
      before: (photos as any).before || [],
      '3d': (photos as any)['3d'] || [],
      during: (photos as any).during || [],
      after: (photos as any).after || [],
      plans: (photos as any).plans || [],
      plansStructured: (photos as any).plansStructured || undefined, // PRÉSERVER la structure des plans
      selectedBeforePhotosForPdf: currentSelectedBefore,
      selected3dPhotosForPdf: currentSelected3d,
      selectedPlansPhotosForPdf: currentSelectedPlans,
      selectedDuringPhotosForPdf: (photos as any).selectedDuringPhotosForPdf || [],
      selectedAfterPhotosForPdf: (photos as any).selectedAfterPhotosForPdf || [],
      coverPhoto: currentCover,
      floor1Description: (photos as any).floor1Description || undefined, // PRÉSERVER les descriptions
      floor2Description: (photos as any).floor2Description || undefined,
      floor1Prompt: (photos as any).floor1Prompt || undefined, // PRÉSERVER les prompts
      floor2Prompt: (photos as any).floor2Prompt || undefined,
    };
    // Ajouter la photo à la bonne catégorie
    if (isPhotoCategory(category)) {
      const current = Array.isArray(photos[category]) ? photos[category] : [];
      photos[category] = [...current, photo];
    } else {
      throw new Error('Invalid category for addPhotoToCategory');
    }
    // Validation stricte
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });
    return parsed.data;
  }

  // Supprimer une photo d'une catégorie par index
  async removePhoto(projectId: number, category: keyof Photos, index: number): Promise<{photos: Photos, deletedPhoto: Photo | undefined}> {
    const photos = await this.getProjectPhotos(projectId);
    let deletedPhoto: Photo | undefined = undefined;
    if (isPhotoCategory(category)) {
      deletedPhoto = photos[category][index];
      photos[category] = photos[category].filter((_, i) => i !== index);
    } else {
      throw new Error('Invalid category for removePhoto');
    }
    if (deletedPhoto) {
      // Remove from coverPhoto if needed
      if (photos.coverPhoto && deletedPhoto.url === photos.coverPhoto) {
        photos.coverPhoto = undefined;
      }
      // Remove from selected*PhotosForPdf if needed
      photos.selectedBeforePhotosForPdf = photos.selectedBeforePhotosForPdf.filter(id => id !== deletedPhoto!.id);
      photos.selected3dPhotosForPdf = photos.selected3dPhotosForPdf.filter(id => id !== deletedPhoto!.id);
      photos.selectedPlansPhotosForPdf = photos.selectedPlansPhotosForPdf.filter(id => id !== deletedPhoto!.id);
      photos.selectedDuringPhotosForPdf = photos.selectedDuringPhotosForPdf.filter(id => id !== deletedPhoto!.id);
      photos.selectedAfterPhotosForPdf = photos.selectedAfterPhotosForPdf.filter(id => id !== deletedPhoto!.id);
    }
    // Validation stricte
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });
    return { photos: parsed.data, deletedPhoto };
  }

  // Récupérer les photos d'une catégorie
  async getCategoryPhotos(projectId: number, category: keyof Photos): Promise<Photo[]> {
    const photos = await this.getProjectPhotos(projectId);
    return isPhotoCategory(category) ? photos[category] : [];
  }

  // Sélectionner/désélectionner une photo pour le PDF (par id)
  async togglePhotoForPdf(projectId: number, photoId: number, selected: boolean, type: 'selectedBeforePhotosForPdf' | 'selected3dPhotosForPdf' | 'selectedPlansPhotosForPdf' | 'selectedDuringPhotosForPdf' | 'selectedAfterPhotosForPdf'): Promise<void> {
    const photos = await this.getProjectPhotos(projectId);
    if (selected && !photos[type].includes(photoId)) {
      photos[type] = [...photos[type], photoId];
    } else if (!selected) {
      photos[type] = photos[type].filter(id => id !== photoId);
    }
    
    // Si c'est pour les plans, synchroniser aussi selectedForPdf dans plansStructured
    if (type === 'selectedPlansPhotosForPdf' && photos.plansStructured) {
      const updatePlanSelectedForPdf = (plan: any) => {
        if (plan.id === photoId) {
          plan.selectedForPdf = selected;
        }
      };
      
      // Mettre à jour dans plansStructured
      if (photos.plansStructured.before) {
        photos.plansStructured.before.floor1?.forEach(updatePlanSelectedForPdf);
        photos.plansStructured.before.floor2?.forEach(updatePlanSelectedForPdf);
      }
      if (photos.plansStructured.after) {
        photos.plansStructured.after.floor1?.forEach(updatePlanSelectedForPdf);
        photos.plansStructured.after.floor2?.forEach(updatePlanSelectedForPdf);
      }
      
      // Mettre à jour aussi dans plans (ancien format) pour rétrocompatibilité
      if (photos.plans) {
        photos.plans.forEach(updatePlanSelectedForPdf);
      }
    }
    
    // Validation stricte
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });
  }

  // Récupérer les photos sélectionnées pour le PDF
  async getSelectedPhotosForPdf(projectId: number): Promise<{ 
    selectedBeforePhotosForPdf: number[]; 
    selected3dPhotosForPdf: number[]; 
    selectedPlansPhotosForPdf: number[];
    selectedDuringPhotosForPdf: number[];
    selectedAfterPhotosForPdf: number[];
  }> {
    const photos = await this.getProjectPhotos(projectId);
    return {
      selectedBeforePhotosForPdf: photos.selectedBeforePhotosForPdf,
      selected3dPhotosForPdf: photos.selected3dPhotosForPdf,
      selectedPlansPhotosForPdf: photos.selectedPlansPhotosForPdf,
      selectedDuringPhotosForPdf: photos.selectedDuringPhotosForPdf,
      selectedAfterPhotosForPdf: photos.selectedAfterPhotosForPdf
    };
  }

  // Mettre à jour la photo de couverture
  async updateCoverPhoto(projectId: number, photoUrl: string | undefined): Promise<Photos> {
    const project = await prisma.project.findUnique({ where: { project_id: projectId } });
    let photos = project?.photos;
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos); } catch { photos = {}; }
    }
    if (!photos || typeof photos !== 'object') {
      photos = {};
    }

    // Récupérer toutes les données existantes d'abord et PRÉSERVER tous les champs
    const existingData = {
      before: (photos as any).before || [],
      '3d': (photos as any)['3d'] || [],
      during: (photos as any).during || [],
      after: (photos as any).after || [],
      plans: (photos as any).plans || [],
      selectedBeforePhotosForPdf: (photos as any).selectedBeforePhotosForPdf || [],
      selected3dPhotosForPdf: (photos as any).selected3dPhotosForPdf || [],
      selectedPlansPhotosForPdf: (photos as any).selectedPlansPhotosForPdf || [],
      selectedDuringPhotosForPdf: (photos as any).selectedDuringPhotosForPdf || [],
      selectedAfterPhotosForPdf: (photos as any).selectedAfterPhotosForPdf || [],
      plansStructured: (photos as any).plansStructured || undefined, // PRÉSERVER la structure des plans
      floor1Description: (photos as any).floor1Description || undefined, // PRÉSERVER les descriptions
      floor2Description: (photos as any).floor2Description || undefined,
      floor1Prompt: (photos as any).floor1Prompt || undefined, // PRÉSERVER les prompts
      floor2Prompt: (photos as any).floor2Prompt || undefined,
      ...photos // merge tout le reste au cas où
    };

    // Mettre à jour la photo de couverture en dernier
    const updatedPhotos = {
      ...existingData,
      coverPhoto: photoUrl
    };

    // Validation stricte
    const parsed = PhotosSchema.safeParse(updatedPhotos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }

    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });

    return parsed.data;
  }

  // Remplace toute la sélection PDF pour un type donné
  async setSelectedPhotosForPdf(projectId: number, type: 'selectedBeforePhotosForPdf' | 'selected3dPhotosForPdf' | 'selectedPlansPhotosForPdf' | 'selectedDuringPhotosForPdf' | 'selectedAfterPhotosForPdf', ids: number[]): Promise<void> {
    const photos = await this.getProjectPhotos(projectId);
    photos[type] = ids;
    
    // Si c'est pour les plans, synchroniser aussi selectedForPdf dans plansStructured
    if (type === 'selectedPlansPhotosForPdf' && photos.plansStructured) {
      const updatePlanSelectedForPdf = (plan: any) => {
        plan.selectedForPdf = ids.includes(plan.id);
      };
      
      // Mettre à jour dans plansStructured
      if (photos.plansStructured.before) {
        photos.plansStructured.before.floor1?.forEach(updatePlanSelectedForPdf);
        photos.plansStructured.before.floor2?.forEach(updatePlanSelectedForPdf);
      }
      if (photos.plansStructured.after) {
        photos.plansStructured.after.floor1?.forEach(updatePlanSelectedForPdf);
        photos.plansStructured.after.floor2?.forEach(updatePlanSelectedForPdf);
      }
      
      // Mettre à jour aussi dans plans (ancien format) pour rétrocompatibilité
      if (photos.plans) {
        photos.plans.forEach(updatePlanSelectedForPdf);
      }
    }
    
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });
  }
} 