import { z } from 'zod';

export const DvfScatterSchema = z.object({
  surface: z.number(),
  prixM2: z.number(),
  isOutlier: z.boolean(),
});

export type DvfScatter = z.infer<typeof DvfScatterSchema>; 