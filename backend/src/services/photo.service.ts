import { PrismaClient } from '@prisma/client';
import { Photos, Photo, PhotosSchema } from '../../../shared/types/photos';

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
    return parsed.data;
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
    // Initialiser les champs si absents
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
      selectedBeforePhotosForPdf: currentSelectedBefore,
      selected3dPhotosForPdf: currentSelected3d,
      selectedPlansPhotosForPdf: currentSelectedPlans,
      selectedDuringPhotosForPdf: (photos as any).selectedDuringPhotosForPdf || [],
      selectedAfterPhotosForPdf: (photos as any).selectedAfterPhotosForPdf || [],
      coverPhoto: currentCover,
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
      data: { photos: parsed.data }
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
        console.log('[BACK][DELETE][COVER] Removing coverPhoto reference');
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
    console.log('[BACK][DELETE][BEFORE SAVE]', JSON.stringify(parsed.data, null, 2));
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data }
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
    console.log('[BACK][PDF][BEFORE]', { photoId, selected, type, current: photos[type] });
    if (selected && !photos[type].includes(photoId)) {
      photos[type] = [...photos[type], photoId];
    } else if (!selected) {
      photos[type] = photos[type].filter(id => id !== photoId);
    }
    // Validation stricte
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    console.log('[BACK][PDF][BEFORE SAVE]', JSON.stringify(parsed.data, null, 2));
    console.log('[BACK][PDF][TYPES]', {
      selectedBeforePhotosForPdf: parsed.data.selectedBeforePhotosForPdf.map(x => typeof x),
      selected3dPhotosForPdf: parsed.data.selected3dPhotosForPdf.map(x => typeof x),
      selectedPlansPhotosForPdf: parsed.data.selectedPlansPhotosForPdf.map(x => typeof x),
      selectedDuringPhotosForPdf: parsed.data.selectedDuringPhotosForPdf.map(x => typeof x),
      selectedAfterPhotosForPdf: parsed.data.selectedAfterPhotosForPdf.map(x => typeof x),
    });
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data }
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

    // Récupérer toutes les données existantes d'abord
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
      ...photos // merge tout le reste au cas où
    };

    // Mettre à jour la photo de couverture en dernier
    const updatedPhotos = {
      ...existingData,
      coverPhoto: photoUrl
    };

    console.log('[BACK][COVER][UPDATE] Updating cover photo:', {
      projectId,
      newCoverPhoto: photoUrl,
      existingCoverPhoto: (photos as any).coverPhoto,
      finalCoverPhoto: updatedPhotos.coverPhoto
    });

    // Validation stricte
    const parsed = PhotosSchema.safeParse(updatedPhotos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }

    console.log('[BACK][COVER][BEFORE SAVE]', JSON.stringify(parsed.data, null, 2));

    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data }
    });

    return parsed.data;
  }

  // Remplace toute la sélection PDF pour un type donné
  async setSelectedPhotosForPdf(projectId: number, type: 'selectedBeforePhotosForPdf' | 'selected3dPhotosForPdf' | 'selectedPlansPhotosForPdf' | 'selectedDuringPhotosForPdf' | 'selectedAfterPhotosForPdf', ids: number[]): Promise<void> {
    const photos = await this.getProjectPhotos(projectId);
    photos[type] = ids;
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    console.log('[BACK][PDF][SET][BEFORE SAVE]', type, ids);
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data }
    });
  }
} 