import { z } from 'zod';

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
    prix_achat_pondere_m2: z.number(),
    prix_achat_carrez_m2: z.number(),
    prix_revient_pondere_m2: z.number(),
    prix_revient_carrez_m2: z.number(),
    prix_vente_pondere_m2: z.number(),
    prix_vente_carrez_m2: z.number(),
  }),
  prorata: z.object({
    acquisition: z.number(),
    travaux: z.number(),
    financement: z.number(),
    frais_divers: z.number(),
  }),
  couts_acquisition: z.object({
    prix_achat: z.number(),
    frais_notaire_output_amount: z.number(),
    frais_agence_achat_output_amount: z.number(),
    total_acquisition: z.number(),
  }),
  couts_travaux: z.object({
    total_output_amount: z.number(),
    maitrise_oeuvre_output_amount: z.number(),
    alea_output_amount: z.number(),
    terrasse_output_amount: z.number(),
    mobilier_output_amount: z.number(),
    demolition_output_amount: z.number(),
    honoraires_tech_output_amount: z.number(),
    total_travaux: z.number(),
  }),
  couts_divers: z.object({
    honoraires_tech_output_amount: z.number(),
    prorata_foncier_output_amount: z.number(),
    diagnostics_output_amount: z.number(),
    total_divers: z.number(),
  }),
  couts_total: z.number(),
  financement: z.object({
    // Montants des crédits alloués
    montants: z.object({
      credit_foncier_output_amount: z.number(),
      fonds_propres_output_amount: z.number(),
      credit_accompagnement_output_amount: z.number(),
      total_montants_alloues: z.number(),
    }),
    // Montants réellement utilisés
    montants_utilises: z.object({
      credit_foncier_output_amount: z.number(),
      fonds_propres_output_amount: z.number(),
      credit_accompagnement_output_amount: z.number(),
      total_montants_utilises: z.number(),
    }),
    // Coûts financiers
    couts: z.object({
      interets_pret_output_amount: z.number(),
      commission_accompagnement_output_amount: z.number(),
      frais_dossier_output_amount: z.number(),
      total_couts_financiers: z.number(),
    }),
    // Mensualités
    mensualites: z.object({
      credit_foncier_output_amount: z.number(),
      credit_accompagnement_output_amount: z.number(),
      total_mensualites: z.number(),
    }),
  }),
  frais: z.object({
    frais_notaire_output_amount: z.number(),
    frais_agence_achat_output_amount: z.number(),
    frais_agence_vente_output_amount: z.number(),
    frais_dossier_output_amount: z.number(),
    total_frais: z.number(),
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
    cout_financier_trimestre: z.number(),
  })),
  synthese_couts: z.array(z.object({
    categorie: z.string(),
    montant: z.number(),
  })),
  synthese_couts_total: z.number(),
});

export type BusinessPlanResults = z.infer<typeof BusinessPlanResultsSchema>;
export type TrimestreDetail = z.infer<typeof BusinessPlanResultsSchema>["trimestre_details"][number]; 