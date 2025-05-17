import { z } from 'zod';
import { InputsGeneralSchema } from './generalInputs';
import { InputsDvfSchema } from './dvfInputs';
import { ResultsDvfMetadataSchema } from './dvfMetadataResults';
import { BusinessPlanInputsSchema } from './businessPlanInputs';
import { BusinessPlanResultsSchema } from './businessPlanResults';
import { PhotosSchema } from './photos';
import { InputsRenovationBienSchema } from './renovationBienInputs';
import { ResultsRenovationBienSchema } from './renovationBienResults';
import { DescriptionBienInputsSchema } from './descriptionBienInputs';
import { DescriptionBienResultsSchema } from './descriptionBienResults';

// Valeurs par défaut centralisées
const DEFAULT_SECTIONS = {
  cover: true,
  summary: true,
  property: true,
  valuation_lk: true,
  valuation_casa: true,
  financial: true
} as const;

const DEFAULT_DYNAMIC_FIELDS = {
  sous_titre_projet: '',
  contact1_nom: 'Jean-Philippe Keundjian',
  contact1_email: 'jpk@lk-invest.fr',
  contact1_tel: '+33 6 15 52 06 51',
  contact2_nom: 'Simon Lecoy',
  contact2_email: 'simon@lk-invest.fr',
  contact2_tel: '+33 6 22 56 23 84',
  description_general: "Niché au coeur du Marais, cet appartement est une opportunité rare pour une rénovation d'exception. Aucun mur porteur dans la zone principale - liberté totale pour repenser l'espace. Avec 3,1 m de hauteur sous plafond, ce bien allie charme historique et potentiel moderne.",
  titre_renovation: 'Rénovation élégante',
  projet_renovation: "L'ensemble des pièces sera repensé pour offrir une organisation plus fonctionnelle et harmonieuse : Toutes les chambres seront repositionnées côté cour, garantissant calme et intimité. Le salon et la cuisine seront ouverts sur toute la façade côté rue, créant un vaste espace de vie lumineux et convivial d'environ 40 m². Création d'une suite parentale de 15 m² avec une salle de bain attenante de 8 m², équipée d'une baignoire, et d'une double douche.",
  detail_renovation: "Aménagements prévus Aménagement d'une chambre supplémentaire de 10 m² pouvant servir de chambre d'enfant ou de chambre d'ami. Ajout d'une salle de bain dédiée à la chambre d'ami pour un confort optimal. Installation d'un second WC, améliorant la praticité du bien."
} as const;

// Schéma des sections à inclure dans le PDF
export const PdfSectionsSchema = z.object({
  cover: z.boolean().optional().default(DEFAULT_SECTIONS.cover),
  summary: z.boolean().optional().default(DEFAULT_SECTIONS.summary),
  property: z.boolean().optional().default(DEFAULT_SECTIONS.property),
  valuation_lk: z.boolean().optional().default(DEFAULT_SECTIONS.valuation_lk),
  valuation_casa: z.boolean().optional().default(DEFAULT_SECTIONS.valuation_casa),
  financial: z.boolean().optional().default(DEFAULT_SECTIONS.financial)
});

// Schéma des champs dynamiques du PDF
export const PdfDynamicFieldsSchema = z.object({
  sous_titre_projet: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.sous_titre_projet),
  contact1_nom: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.contact1_nom),
  contact1_email: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.contact1_email),
  contact1_tel: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.contact1_tel),
  contact2_nom: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.contact2_nom),
  contact2_email: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.contact2_email),
  contact2_tel: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.contact2_tel),
  description_general: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.description_general),
  titre_renovation: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.titre_renovation),
  projet_renovation: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.projet_renovation),
  detail_renovation: z.string().optional().default(DEFAULT_DYNAMIC_FIELDS.detail_renovation)
});

// Schéma de personnalisation optionnelle
export const PdfCustomizationSchema = z.object({
  logo: z.string().optional(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional()
});

// Schéma principal de configuration PDF
export const PdfConfigSchema = z.object({
  sections: PdfSectionsSchema.optional(),
  dynamic_fields: PdfDynamicFieldsSchema.optional(),
  customization: PdfCustomizationSchema.optional()
});

// Types TypeScript dérivés
export type PdfSections = z.infer<typeof PdfSectionsSchema>;
export type PdfDynamicFields = z.infer<typeof PdfDynamicFieldsSchema>;
export type PdfCustomization = z.infer<typeof PdfCustomizationSchema>;
export type PdfConfig = {
  sections?: PdfSections;
  dynamic_fields?: PdfDynamicFields;
  customization?: PdfCustomization;
};

// Export des valeurs par défaut
export const DEFAULT_PDF_SECTIONS = DEFAULT_SECTIONS;
export const DEFAULT_PDF_DYNAMIC_FIELDS = DEFAULT_DYNAMIC_FIELDS;
export const DEFAULT_PDF_CONFIG: PdfConfig = {
  sections: DEFAULT_SECTIONS,
  dynamic_fields: DEFAULT_DYNAMIC_FIELDS
};

// Types pour les données DVF
export interface DvfResults {
  prix_m2?: number;
  prix_total?: number;
  evolution?: number;
  [key: string]: any;
}

export interface Transaction {
  date?: string;
  prix?: number;
  surface?: number;
  prix_m2?: number;
  [key: string]: any;
}

export interface Statistiques {
  moyenne?: number;
  mediane?: number;
  min?: number;
  max?: number;
  [key: string]: any;
}

// Types pour les données financières
export interface Financement {
  total?: number;
  mensualite?: number;
  cout_credit?: number;
  frais_financiers?: number;
}

export interface CoutTotal {
  acquisition?: number;
  travaux?: number;
  autres_frais?: number;
  total?: number;
}

// Type pour les données PDF complètes
export const PdfDataSchema = z.object({
  // Données générales du projet
  project_title: z.string(),
  adresse: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  
  // Configuration du PDF
  pdf_config: PdfConfigSchema,
  
  // Données des différents onglets
  inputsGeneral: InputsGeneralSchema,
  inputsDvf: InputsDvfSchema.optional(),
  resultsDvfMetadata: ResultsDvfMetadataSchema.optional(),
  inputsBusinessPlan: BusinessPlanInputsSchema.optional(),
  resultsBusinessPlan: BusinessPlanResultsSchema.optional(),
  photos: PhotosSchema.optional(),
  inputsRenovationBien: InputsRenovationBienSchema.optional(),
  resultsRenovationBien: ResultsRenovationBienSchema.optional(),
  inputsDescriptionBien: DescriptionBienInputsSchema.optional(),
  resultsDescriptionBien: DescriptionBienResultsSchema.optional(),
  
  // Champs spécifiques au PDF
  logo_path: z.string().optional(),
  cover_image_path: z.string().optional(),
  selectedBeforePhotosForPdf: z.array(z.string()).optional(),
  selected3dPhotosForPdf: z.array(z.string()).optional(),
  image1: z.string().optional(),
  image2: z.string().optional(),
  image3: z.string().optional(),
  image4: z.string().optional(),
  image5: z.string().optional(),
  image1_base64: z.string().optional(),
  image2_base64: z.string().optional(),
  image3_base64: z.string().optional(),
  image4_base64: z.string().optional(),
  image5_base64: z.string().optional(),
  image3d1: z.string().optional(),
  image3d2: z.string().optional(),
  image3d3: z.string().optional(),
  
  // Métadonnées
  date_creation: z.date(),
  date_modification: z.date()
});

export type PdfData = z.infer<typeof PdfDataSchema>; 