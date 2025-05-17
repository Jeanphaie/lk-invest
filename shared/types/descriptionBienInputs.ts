import { z } from 'zod';

// Enums pour les valeurs possibles
export const VueEnum = z.enum(['Exceptional', 'Good', 'Average', 'Poor']);
export const EtageEnum = z.enum(['High (≥ 5th)', 'Mid (2nd-4th)', 'Low (1st)', 'Ground Floor']);
export const AscenseurEnum = z.enum(['Yes', 'No', 'In Construction']);
export const ExterieurEnum = z.enum(['Large (≥ 50 m²)', 'Medium (20-49 m²)', 'Small (5-19 m²)', 'None (< 5 m²)']);
export const AdresseEnum = z.enum(['Highly Sought-After', 'Moderately Sought-After', 'Standard']);
export const EtatEnum = z.enum(['Renovated by Architect', 'Simply Renovated', 'Good Condition', 'Needs Refreshing', 'Needs Renovation']);

export const DescriptionBienInputsSchema = z.object({
  vue: VueEnum,
  etage: EtageEnum,
  ascenseur: AscenseurEnum,
  exterieur: ExterieurEnum,
  adresse: AdresseEnum,
  etat: EtatEnum,
  nombre_pieces: z.number(),
});

export type DescriptionBienInputs = z.infer<typeof DescriptionBienInputsSchema>;

// Types pour les enums
export type Vue = z.infer<typeof VueEnum>;
export type Etage = z.infer<typeof EtageEnum>;
export type Ascenseur = z.infer<typeof AscenseurEnum>;
export type Exterieur = z.infer<typeof ExterieurEnum>;
export type Adresse = z.infer<typeof AdresseEnum>;
export type Etat = z.infer<typeof EtatEnum>; 