import { z } from 'zod';

export const DEFAULT_VALUES = {
  frais_notaire_percent: 2.5,
  frais_agence_achat_percent: 0,
  frais_agence_vente_percent: 3.5,
  frais_dossier_amount: 5000,
  cout_travaux_m2: 1200,
  cout_maitrise_oeuvre_percent: 8,
  cout_alea_percent: 3,
  cout_terrasse_input_amount: 0,
  cout_demolition_input_amount: 3500,
  cout_honoraires_tech_input_amount: 1500,
  cout_prorata_foncier_input_amount: 4500,
  cout_diagnostics_input_amount: 1500,
  cout_mobilier_input_amount: 0,
  financement_credit_foncier_amount: 500000,
  financement_fonds_propres_amount: 500000,
  financement_credit_accompagnement_amount: 500000,
  financement_taux_credit_percent: 4.5,
  financement_commission_percent: 1,
  duree_projet: 365,
  prix_achat: 0,
  prix_affiche: 0,
  prix_vente_reel_pondere_m2: 10000,
  surface_carrez_apres_travaux: 0,
  surface_terrasse_apres_travaux: 0,
  surface_ponderee_apres_travaux: 0,
  date_achat: '',
  date_vente: '',
} as const;

export const BusinessPlanInputsSchema = z.object({
  // Prix d'achat
  prix_achat: z.number(),
  prix_affiche: z.number(),

  // Frais (en pourcentage ou montant)
  frais_notaire_percent: z.number(),
  frais_agence_achat_percent: z.number(),
  frais_agence_vente_percent: z.number(),
  frais_dossier_amount: z.number(),

  // Coûts travaux
  cout_travaux_m2: z.number(),
  cout_maitrise_oeuvre_percent: z.number(),
  cout_alea_percent: z.number(),
  cout_terrasse_input_amount: z.number(),
  cout_demolition_input_amount: z.number(),
  cout_honoraires_tech_input_amount: z.number(),

  // Coûts divers
  cout_prorata_foncier_input_amount: z.number(),
  cout_diagnostics_input_amount: z.number(),
  cout_mobilier_input_amount: z.number(),

  // Financement
  financement_credit_foncier_amount: z.number(),
  financement_fonds_propres_amount: z.number(),
  financement_credit_accompagnement_amount: z.number(),
  financement_taux_credit_percent: z.number(),
  financement_commission_percent: z.number(),

  // Dates et durée
  date_achat: z.string(),
  date_vente: z.string(),
  duree_projet: z.number(),

  // Prix de vente et surfaces
  prix_vente_reel_pondere_m2: z.number(),
  surface_carrez_apres_travaux: z.number(),
  surface_terrasse_apres_travaux: z.number(),
  surface_ponderee_apres_travaux: z.number(),
});

export type BusinessPlanInputs = z.infer<typeof BusinessPlanInputsSchema>;

export const DEFAULT_INPUTS: BusinessPlanInputs = {
  prix_achat: 500000,
  prix_affiche: 500000,
  frais_notaire_percent: 2.5,
  frais_agence_achat_percent: 0,
  frais_agence_vente_percent: 3.5,
  frais_dossier_amount: 5000,
  cout_travaux_m2: 1500,
  cout_maitrise_oeuvre_percent: 0,
  cout_alea_percent: 3,
  cout_terrasse_input_amount: 0,
  cout_demolition_input_amount: 3500,
  cout_honoraires_tech_input_amount: 1500,
  cout_prorata_foncier_input_amount: 4500,
  cout_diagnostics_input_amount: 1500,
  cout_mobilier_input_amount: 0,
  financement_credit_foncier_amount: 500000,
  financement_fonds_propres_amount: 300000,
  financement_credit_accompagnement_amount: 500000,
  financement_taux_credit_percent: 4.5,
  financement_commission_percent: 1,
  date_achat: new Date().toISOString().split('T')[0],
  date_vente: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  duree_projet: 365,
  prix_vente_reel_pondere_m2: 10000,
  surface_carrez_apres_travaux: 0,
  surface_terrasse_apres_travaux: 0,
  surface_ponderee_apres_travaux: 0,
}; 