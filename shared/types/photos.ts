import { z } from 'zod';

// =============================================
// Types pour les Photos
// =============================================

export const PhotoSchema = z.object({
    id: z.number(),
    url: z.string(),
    category: z.string(),
    selectedForPdf: z.boolean(),
    order: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type Photo = z.infer<typeof PhotoSchema>;

// Schéma étendu pour les plans avec métadonnées
export const PlanPhotoSchema = PhotoSchema.extend({
    planType: z.enum(['before', 'after']).optional(), // 'before' = avant travaux, 'after' = après rénovation
    floor: z.number().optional(), // 1 = RDC/1er étage, 2 = 2ème étage (null si pas applicable)
    floorLabel: z.string().optional(), // "RDC", "1er étage", "2ème étage" pour affichage
});

export type PlanPhoto = z.infer<typeof PlanPhotoSchema>;

// Structure organisée pour les plans
export const PlansStructureSchema = z.object({
    before: z.object({
        floor1: z.array(PlanPhotoSchema).optional(), // Plans avant - étage 1
        floor2: z.array(PlanPhotoSchema).optional(), // Plans avant - étage 2 (optionnel)
    }).optional(),
    after: z.object({
        floor1: z.array(PlanPhotoSchema).optional(), // Plans après - étage 1
        floor2: z.array(PlanPhotoSchema).optional(), // Plans après - étage 2 (optionnel)
    }).optional(),
});

export type PlansStructure = z.infer<typeof PlansStructureSchema>;

export const PhotosSchema = z.object({
    before: z.array(PhotoSchema).default([]),
    plans: z.array(PhotoSchema).default([]), // Ancien format (rétrocompatibilité)
    plansStructured: PlansStructureSchema.optional(), // Nouveau format structuré
    during: z.array(PhotoSchema).default([]),
    after: z.array(PhotoSchema).default([]),
    '3d': z.array(PhotoSchema).default([]),
    selectedBeforePhotosForPdf: z.array(z.number()).default([]),
    selected3dPhotosForPdf: z.array(z.number()).default([]),
    selectedPlansPhotosForPdf: z.array(z.number()).default([]),
    selectedDuringPhotosForPdf: z.array(z.number()).default([]),
    selectedAfterPhotosForPdf: z.array(z.number()).default([]),
    coverPhoto: z.string().optional(),
    floor1Description: z.string().optional(), // Description pour le niveau 1 (1er niveau)
    floor2Description: z.string().optional(), // Description pour le niveau 2 (2ème niveau)
    floor1Prompt: z.string().optional(), // Prompt pour génération AI - niveau 1
    floor2Prompt: z.string().optional() // Prompt pour génération AI - niveau 2
}).passthrough(); // Permet des champs supplémentaires pour la rétrocompatibilité

export type Photos = z.infer<typeof PhotosSchema>;

export const PhotoCategory = z.enum(['before', '3d', 'during', 'after', 'plans']);
export type PhotoCategory = z.infer<typeof PhotoCategory>; 