import { z } from 'zod';

export const InputsRenovationBienSchema = z.object({
  // Surfaces et nombre de pièces
  superficie_apres: z.number().min(0, "La surface intérieure doit être positive"),
  superficie_exterieur_apres: z.number().min(0, "La surface extérieure doit être positive"),
  nombre_pieces_apres: z.number().int().min(1, "Le nombre de pièces doit être d'au moins 1"),

  // Calendrier
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  duree_mois: z.number().int().min(1, "La durée doit être d'au moins 1 mois"),

  // Plans et explications
  plan_renovation: z.string().optional(),
  explication_3d: z.string().optional()
});

export type InputsRenovationBien = z.infer<typeof InputsRenovationBienSchema>; 