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

export const PhotosSchema = z.object({
    before: z.array(PhotoSchema),
    during: z.array(PhotoSchema),
    after: z.array(PhotoSchema),
    '3d': z.array(PhotoSchema),
    selectedBeforePhotosForPdf: z.array(z.number()),
    selected3dPhotosForPdf: z.array(z.number()),
    coverPhoto: z.string().optional()
});

export interface Photos {
    before: Photo[];
    '3d': Photo[];
    during: Photo[];
    after: Photo[];
    selectedBeforePhotosForPdf: number[];
    selected3dPhotosForPdf: number[];
    coverPhoto?: string;
    [key: string]: unknown; // Pour la compatibilité avec Prisma InputJsonValue
} 