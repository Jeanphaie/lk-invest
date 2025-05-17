import { z } from 'zod';

export const DvfDistributionSchema = z.object({
  prixM2: z.number(),
  nombreTransactions: z.number(),
});

export type DvfDistribution = z.infer<typeof DvfDistributionSchema>; 