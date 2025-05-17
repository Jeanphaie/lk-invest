import { z } from 'zod';

// Valeurs par défaut
export const DEFAULT_VALUES = {
  taux_credit: 4.5,
  commission_rate: 3,
  duree_projet: 365,
  alea_travaux: 10,
  prorata_foncier: 4500 // Valeur par défaut en euros
} as const;

// =============================================
// Types pour le Business Plan
// =============================================

export const BusinessPlanInputsSchema = z.object({
  // Prix et frais
  prix_achat: z.number().positive(),
  prix_affiche: z.number().positive(),
  frais_notaire: z.number().min(0),
  frais_agence: z.number().min(0),
  frais_agence_vente: z.number().min(0),
  frais_dossier: z.number().min(0),

  // Travaux
  cout_travaux: z.number().min(0),
  salaire_maitrise: z.number().min(0),
  alea_travaux: z.number().min(0).max(100),
  amenagement_terrasse: z.number().min(0),
  demolition: z.number().min(0),
  honoraires_techniques: z.number().min(0),

  // Prorata et diagnostics
  prorata_foncier: z.number().min(0).max(1),
  diagnostics: z.number().min(0),
  mobilier: z.number().min(0),

  // Financement
  credit_foncier: z.number().min(0),
  fonds_propres: z.number().min(0),
  credit_accompagnement_total: z.number().min(0),
  taux_credit: z.number().min(0).max(100),
  commission_rate: z.number().min(0).max(100),

  // Dates et durée
  date_achat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_vente: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duree_projet: z.number().int().min(1),

  // Prix de vente
  prix_vente_reel_pondere_m2: z.number().min(0, "Le prix de vente au m² doit être positif"),

  // Surfaces après travaux
  surface_carrez_apres_travaux: z.number().min(0, "La surface Carrez après travaux doit être positive"),
  surface_terrasse_apres_travaux: z.number().min(0, "La surface terrasse après travaux doit être positive"),
});

export type BusinessPlanInputs = z.infer<typeof BusinessPlanInputsSchema>;

export const BusinessPlanResultsSchema = z.object({
  resultats: z.object({
    prix_revient: z.number(),
    marge_brute: z.number(),
    commission: z.number(),
    marge_nette: z.number(),
    rentabilite: z.number(),
    cash_flow_mensuel: z.number(),
    tri: z.number(),
    date_vente: z.string(),
    prix_fai: z.number(),
    prix_hfa: z.number(),
  }),
  prix_m2: z.object({
    prix_m2: z.number(),
    prix_m2_terrasse: z.number(),
    prix_revient_m2: z.number(),
    prix_revient_m2_carrez: z.number(),
    prix_m2_vente: z.number(),
    prix_m2_carrez_vente: z.number(),
  }),
  prorata: z.object({
    acquisition: z.number(),
    travaux: z.number(),
    financement: z.number(),
    frais_divers: z.number(),
  }),
  couts_acquisition: z.object({
    prix_achat: z.number(),
    frais_notaire: z.number(),
    frais_agence: z.number(),
    frais_dossier: z.number(),
    total: z.number(),
  }),
  couts_travaux: z.object({
    cout_travaux_total: z.number(),
    cout_maitrise_oeuvre: z.number(),
    cout_aleas: z.number(),
    cout_amenagement_terrasse: z.number(),
    cout_mobilier: z.number(),
    cout_demolition: z.number(),
    cout_honoraires_techniques: z.number(),
    total: z.number(),
  }),
  financement: z.object({
    credit_foncier: z.number(),
    fonds_propres: z.number(),
    credit_accompagnement: z.number(),
    mensualite_credit_foncier: z.number(),
    mensualite_credit_accompagnement: z.number(),
    total_mensualites: z.number(),
    interets_pret: z.number(),
    commission_accompagnement: z.number(),
    total_financement: z.number(),
    total_interets: z.number(),
    total_commission: z.number(),
  }),
  frais: z.object({
    frais_notaire: z.number(),
    frais_agence: z.number(),
    frais_agence_vente: z.number(),
    frais_dossier: z.number(),
    total: z.number(),
  }),
  trimestre_details: z.array(z.object({
    trimestre: z.number(),
    jours: z.number(),
    start_date: z.string(),
    end_date: z.string(),
    credit_foncier_utilise: z.number(),
    fonds_propres_utilise: z.number(),
    credit_accompagnement_utilise: z.number(),
    interets_foncier: z.number(),
    interets_accompagnement: z.number(),
    commission_accompagnement: z.number(),
  })),
});

export type BusinessPlanResults = z.infer<typeof BusinessPlanResultsSchema>;

// Types utilitaires
export type TrimestreDetail = z.infer<typeof BusinessPlanResultsSchema>['trimestre_details'][number];
export type Resultats = z.infer<typeof BusinessPlanResultsSchema>['resultats'];
export type PrixM2 = z.infer<typeof BusinessPlanResultsSchema>['prix_m2'];
export type RepartitionCouts = z.infer<typeof BusinessPlanResultsSchema>['repartition_couts'];
export type DetailCouts = z.infer<typeof BusinessPlanResultsSchema>['detail_couts'];
export type Financement = z.infer<typeof BusinessPlanResultsSchema>['financement']; 