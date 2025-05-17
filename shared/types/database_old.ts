import { z } from 'zod';

// =============================================
// Types de Base (Réutilisables)
// =============================================

export const CoordinatesSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const AddressSchema = z.object({
    numero: z.string().optional(),
    voie: z.string(),
    code_postal: z.string(),
    ville: z.string(),
    complement: z.string().optional(),
});

export type Address = z.infer<typeof AddressSchema>;

// =============================================
// Types pour les Inputs Généraux
// =============================================

export const InputsGeneralSchema = z.object({
    projectTitle: z.string(),
    superficie: z.number().positive(),
    superficie_terrasse: z.number().min(0),
    ponderation_terrasse: z.number().min(0).max(1),
    description_quartier: z.string().optional(),
    ...CoordinatesSchema.shape,
});

export type InputsGeneral = z.infer<typeof InputsGeneralSchema>;

// =============================================
// Types pour la Description du Bien
// =============================================

export const DescriptionBienInputsSchema = z.object({
    vue: z.enum(['EXCELLENTE', 'BONNE', 'MOYENNE', 'MAUVAISE']),
    etage: z.enum(['RDC', '1', '2', '3', '4', '5', '6+']),
    ascenseur: z.enum(['OUI', 'NON', 'EN_CONSTRUCTION']),
    exterieur: z.enum(['BALCON', 'TERRASSE', 'JARDIN', 'AUCUN']),
    adresse: z.enum(['EXCELLENTE', 'BONNE', 'MOYENNE', 'MAUVAISE']),
    etat: z.enum(['NEUF', 'BON', 'MOYEN', 'MAUVAIS']),
    nombre_pieces: z.number().int().min(1),
});

export type DescriptionBienInputs = z.infer<typeof DescriptionBienInputsSchema>;

export const DescriptionBienResultsSchema = z.object({
    coef_ponderation: z.number().min(0).max(2),
    surface_totale: z.number().positive(),
    impacts: z.array(z.object({
        parameter: z.string(),
        value: z.string(),
        impact: z.number(),
        description: z.string(),
    })),
});

export type DescriptionBienResults = z.infer<typeof DescriptionBienResultsSchema>;

// =============================================
// Types pour le Business Plan
// =============================================

export const BusinessPlanInputsSchema = z.object({
    prix_achat: z.number().positive(),
    prix_affiche: z.number().positive(),
    frais_notaire: z.number().min(0),
    frais_agence: z.number().min(0),
    frais_agence_vente: z.number().min(0),
    frais_dossier: z.number().min(0),
    cout_travaux: z.number().min(0),
    salaire_maitrise: z.number().min(0),
    alea_travaux: z.number().min(0).max(100),
    amenagement_terrasse: z.number().min(0),
    demolition: z.number().min(0),
    honoraires_techniques: z.number().min(0),
    prorata_foncier: z.number().min(0).max(1),
    diagnostics: z.number().min(0),
    mobilier: z.number().min(0),
    credit_foncier: z.number().min(0),
    fonds_propres: z.number().min(0),
    credit_accompagnement_total: z.number().min(0),
    taux_credit: z.number().min(0).max(100),
    commission_rate: z.number().min(0).max(100),
    date_achat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    date_vente: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    duree_projet: z.number().int().min(1),
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

// =============================================
// Types pour l'Analyse DVF
// =============================================

export const DvfFiltersSchema = z.object({
    rayon: z.number().min(0).max(100),
    prixMin: z.number().nullable(),
    surfaceMin: z.number().nullable(),
    prixM2Min: z.number().nullable(),
    outlierLowerBoundPercent: z.number().min(0).max(100).default(65),
    outlierUpperBoundCoeff: z.number().min(1).default(3),
});

export type DvfFilters = z.infer<typeof DvfFiltersSchema>;

export const DvfPropertySchema = z.object({
    id: z.number(),
    ...CoordinatesSchema.shape,
    prix: z.number().positive(),
    surface: z.number().positive(),
    prix_m2: z.number().positive(),
    date_mutation: z.string(),
    ...AddressSchema.shape,
    type: z.string(),
    is_outlier: z.boolean(),
    valeur_fonciere: z.number().optional(),
    surface_reelle_bati: z.number().optional(),
    nombre_pieces_principales: z.number().optional(),
});

export type DvfProperty = z.infer<typeof DvfPropertySchema>;

export const DvfResultsSchema = z.object({
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

export type DvfResults = z.infer<typeof DvfResultsSchema>;

export const DvfTrendSeriesSchema = z.object({
    year: z.number(),
    selection_avg: z.number(),
    selection_count: z.number(),
    arrondissement_avg: z.number(),
    arrondissement_count: z.number(),
    premium_avg: z.number(),
    premium_count: z.number(),
});

export type DvfTrendSeries = z.infer<typeof DvfTrendSeriesSchema>;

export const DvfDistributionSeriesSchema = z.object({
    prixM2: z.number(),
    nombreTransactions: z.number(),
});

export type DvfDistributionSeries = z.infer<typeof DvfDistributionSeriesSchema>;

export const DvfScatterSeriesSchema = z.object({
    surface: z.number(),
    prixM2: z.number(),
    isOutlier: z.boolean(),
});

export type DvfScatterSeries = z.infer<typeof DvfScatterSeriesSchema>;

// =============================================
// Types pour les Photos
// =============================================

export const PhotoSchema = z.object({
    id: z.number(),
    url: z.string(),
    category: z.enum(['BEFORE', 'DURING', 'AFTER', '3D']),
    selectedForPdf: z.boolean(),
    order: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type Photo = z.infer<typeof PhotoSchema>;

export const ProjectPhotosSchema = z.object({
    before: z.array(PhotoSchema),
    during: z.array(PhotoSchema),
    after: z.array(PhotoSchema),
    '3d': z.array(PhotoSchema),
    selectedBeforePhotosForPdf: z.array(z.number()),
    selected3dPhotosForPdf: z.array(z.number()),
});

export type ProjectPhotos = z.infer<typeof ProjectPhotosSchema>;

// =============================================
// Types pour la Configuration PDF
// =============================================

export const PdfConfigSchema = z.object({
    sections: z.object({
        cover: z.boolean(),
        summary: z.boolean(),
        property: z.boolean(),
        valuation_lk: z.boolean(),
        valuation_casa: z.boolean(),
        financial: z.boolean(),
    }),
    dynamic_fields: z.object({
        // Champs dynamiques pour le PDF
    }),
    customization: z.object({
        // Options de personnalisation
    }),
});

export type PdfConfig = z.infer<typeof PdfConfigSchema>;

// =============================================
// Type Principal du Projet
// =============================================

export const ProjectSchema = z.object({
    id: z.number(),
    projectTitle: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    inputsGeneral: InputsGeneralSchema,
    inputsDescriptionBien: DescriptionBienInputsSchema,
    resultsDescriptionBien: DescriptionBienResultsSchema,
    inputsBusinessPlan: BusinessPlanInputsSchema,
    resultsBusinessPlan: BusinessPlanResultsSchema,
    inputsDvf: DvfFiltersSchema,
    resultsDvf: DvfResultsSchema,
    photos: ProjectPhotosSchema,
    pdfConfig: PdfConfigSchema,
});

export type Project = z.infer<typeof ProjectSchema>;

// =============================================
// Types pour les Réponses API
// =============================================

export const DvfAnalyseResponseSchema = z.object({
    dvfProperties: z.array(DvfPropertySchema),
    dvfResults: DvfResultsSchema,
    trendSeries: z.array(DvfTrendSeriesSchema),
    distributionSeries: z.array(DvfDistributionSeriesSchema),
    scatterSeries: z.array(DvfScatterSeriesSchema),
});

export type DvfAnalyseResponse = z.infer<typeof DvfAnalyseResponseSchema>; 