import { z } from 'zod';

export const ResultsDvfMetadataSchema = z.object({
  sel_final_avg: z.number(),
  arr_final_avg: z.number(),
  premium_final_avg: z.number(),
  outlier_lower_bound: z.number(),
  outlier_upper_bound: z.number(),
  arrondissement_avg_for_outliers: z.number(),
  selection_total_count: z.number(),
  selection_outlier_count: z.number(),
  arrondissement_total_count: z.number(),
  arrondissement_outlier_count: z.number(),
  premium_total_count: z.number(),
  premium_outlier_count: z.number(),
});

export type ResultsDvfMetadata = z.infer<typeof ResultsDvfMetadataSchema>; 