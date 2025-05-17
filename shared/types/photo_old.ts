import { z } from 'zod';

// Catégories de photos autorisées
export const PhotoCategoryEnum = z.enum(['before', '3d', 'during', 'after']);
export type PhotoCategory = z.infer<typeof PhotoCategoryEnum>;

// Schéma d'une photo (pour extension future, ex: légende, date, etc.)
export const PhotoSchema = z.object({
  path: z.string(), // Chemin relatif (ex: /uploads/123/before/photo.jpg)
  category: PhotoCategoryEnum,
  // Optionnel: légende, date, etc.
  // caption: z.string().optional(),
  // uploadedAt: z.string().optional(),
});
export type Photo = z.infer<typeof PhotoSchema>;

// Structure des photos par catégorie
export const PhotosByCategorySchema = z.record(PhotoCategoryEnum, z.array(z.string()));
export type PhotosByCategory = z.infer<typeof PhotosByCategorySchema>;

// Structure pour la sélection PDF
export const SelectedPhotosForPdfSchema = z.object({
  before: z.array(z.string()),
  '3d': z.array(z.string()),
});
export type SelectedPhotosForPdf = z.infer<typeof SelectedPhotosForPdfSchema>;

// Structure de retour API pour /api/photos/project/:projectId
export const ProjectPhotosApiResponseSchema = PhotosByCategorySchema;
export type ProjectPhotosApiResponse = PhotosByCategory;

// Structure de retour API pour /api/photos/:projectId/selected-for-pdf
export const SelectedPhotosApiResponseSchema = z.object({
  success: z.boolean(),
  selectedPhotos: SelectedPhotosForPdfSchema,
});
export type SelectedPhotosApiResponse = z.infer<typeof SelectedPhotosApiResponseSchema>;

// Type global pour toutes les photos d'un projet (catégories + sélection PDF + cover)
export const ProjectPhotosSchema = z.object({
  before: z.array(z.string()),
  after: z.array(z.string()),
  '3d': z.array(z.string()),
  during: z.array(z.string()),
  cover: z.string().optional(),
  selectedBeforePhotosForPdf: z.array(z.string()).optional(),
  selected3dPhotosForPdf: z.array(z.string()).optional()
});
export type ProjectPhotos = z.infer<typeof ProjectPhotosSchema>; 