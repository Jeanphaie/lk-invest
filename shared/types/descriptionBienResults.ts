import { z } from 'zod';

export const DescriptionBienResultsSchema = z.object({
  coef_ponderation: z.number(),
  surface_totale: z.number(),
  impacts: z.array(z.object({
    parameter: z.string(),
    value: z.string(),
    impact: z.number(),
    description: z.string(),
  })),
});

export type DescriptionBienResults = z.infer<typeof DescriptionBienResultsSchema>; 