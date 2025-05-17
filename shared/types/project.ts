import { z } from 'zod';
import { InputsGeneralSchema } from './generalInputs';
import { InputsDvfSchema } from './dvfInputs';
import { ResultsDvfMetadataSchema } from './dvfMetadataResults';
import { BusinessPlanInputsSchema } from './businessPlanInputs';
import { BusinessPlanResultsSchema } from './businessPlanResults';
import { PdfConfigSchema } from './pdf';
import { PhotosSchema } from './photos';
import { InputsRenovationBienSchema } from './renovationBienInputs';
import { ResultsRenovationBienSchema } from './renovationBienResults';
import { DescriptionBienInputsSchema } from './descriptionBienInputs';
import { DescriptionBienResultsSchema } from './descriptionBienResults';
import { DvfTransactionSchema } from './dvfTransaction';
import { DvfSeriesSchema } from './dvfSeries';
import { DvfDistributionSchema } from './dvfDistribution';
import { DvfScatterSchema } from './dvfScatter';
import { DvfPremiumTransactionSchema } from './dvfPremiumTransaction';

// =============================================
// Type Project (Principal)
// =============================================

export const ProjectSchema = z.object({
    id: z.number(),
    projectTitle: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    
    // Champs JSON
    inputsGeneral: InputsGeneralSchema,
    inputsDvf: InputsDvfSchema.optional(),
    resultsDvfMetadata: ResultsDvfMetadataSchema.optional(),
    inputsBusinessPlan: BusinessPlanInputsSchema.optional(),
    resultsBusinessPlan: BusinessPlanResultsSchema.optional(),
    pdfConfig: PdfConfigSchema.optional(),
    photos: PhotosSchema.optional(),
    inputsRenovationBien: InputsRenovationBienSchema.optional(),
    resultsRenovationBien: ResultsRenovationBienSchema.optional(),
    inputsDescriptionBien: DescriptionBienInputsSchema.optional(),
    resultsDescriptionBien: DescriptionBienResultsSchema.optional(),
    // Pour référence, on peut aussi stocker des tableaux de transactions/séries DVF si besoin :
    dvfTransactions: z.array(DvfTransactionSchema).optional(),
    dvfSeries: z.array(DvfSeriesSchema).optional(),
    dvfDistributions: z.array(DvfDistributionSchema).optional(),
    dvfScatters: z.array(DvfScatterSchema).optional(),
    dvfPremiumTransactions: z.array(DvfPremiumTransactionSchema).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

