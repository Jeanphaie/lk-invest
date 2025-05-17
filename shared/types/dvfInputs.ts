import { z } from 'zod';

export const InputsDvfSchema = z.object({
  rayon: z.number(),
  prixMin: z.number().nullable(),
  surfaceMin: z.number().nullable(),
  prixM2Min: z.number().nullable(),
  outlierLowerBoundPercent: z.number(),
  outlierUpperBoundCoeff: z.number(),
});

export type InputsDvf = z.infer<typeof InputsDvfSchema>; 