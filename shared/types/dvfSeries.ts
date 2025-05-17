import { z } from 'zod';

export const DvfSeriesSchema = z.object({
  year: z.number(),
  selection_avg: z.number(),
  selection_count: z.number(),
  arrondissement_avg: z.number(),
  arrondissement_count: z.number(),
  premium_avg: z.number(),
  premium_count: z.number(),
});

export type DvfSeries = z.infer<typeof DvfSeriesSchema>; 