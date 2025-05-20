import { z } from 'zod';

export const ResultsRenovationBienSchema = z.object({
  // Surfaces et dates
  surface_ponderee_apres: z.number().min(0, "La surface pondérée doit être positive"),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)")
});

export type ResultsRenovationBien = z.infer<typeof ResultsRenovationBienSchema>; 