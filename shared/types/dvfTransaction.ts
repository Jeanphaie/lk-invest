import { z } from 'zod';

export const DvfTransactionSchema = z.object({
  id: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  prix: z.number(),
  surface: z.number(),
  prix_m2: z.number(),
  date_mutation: z.string(),
  numero: z.string().optional(),
  voie: z.string(),
  code_postal: z.string(),
  ville: z.string(),
  complement: z.string().optional(),
  type: z.string(),
  is_outlier: z.boolean(),
  valeur_fonciere: z.number().optional(),
  surface_reelle_bati: z.number().optional(),
  nombre_pieces_principales: z.number().optional(),
});

export type DvfTransaction = z.infer<typeof DvfTransactionSchema>; 