import { z } from 'zod';

export const InputsGeneralSchema = z.object({
  adresseBien: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description_quartier: z.string().optional(),
  superficie: z.number().optional(),
  superficie_terrasse: z.number(),
  ponderation_terrasse: z.number(),
});

export type InputsGeneral = z.infer<typeof InputsGeneralSchema>; 