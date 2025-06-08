import { Project } from '../../../shared/types/project';
import { PdfDataSchema, PdfConfigSchema, PdfData, PdfConfig, PdfClosingData, PdfClosingDataSchema } from '../../../shared/types/pdf';
import { BusinessPlanInputsSchema } from '../../../shared/types/businessPlanInputs';
import { BusinessPlanResultsSchema } from '../../../shared/types/businessPlanResults';
import { InputsGeneralSchema } from '../../../shared/types/generalInputs';

export class PdfMappingClosingService {
  static mapProjectToPdfData(project: Project, pdfConfig: PdfConfig): PdfClosingData {
    // Validation stricte de chaque bloc
    const validatedConfig = PdfConfigSchema.parse(pdfConfig);
    const validatedInputsGeneral = InputsGeneralSchema.parse(project.inputsGeneral);
    const validatedInputsBusinessPlan = project.inputsBusinessPlan ? BusinessPlanInputsSchema.parse(project.inputsBusinessPlan) : undefined;
    const validatedResultsBusinessPlan = project.resultsBusinessPlan ? BusinessPlanResultsSchema.parse(project.resultsBusinessPlan) : undefined;
    const validatedInputsBusinessPlanRealises = project.inputsBusinessPlanRealises ? BusinessPlanInputsSchema.parse(project.inputsBusinessPlanRealises) : undefined;
    const validatedResultsBusinessPlanRealises = project.resultsBusinessPlanRealises ? BusinessPlanResultsSchema.parse(project.resultsBusinessPlanRealises) : undefined;

    // Construction de l'objet PdfData
    const pdfData: PdfClosingData = {
      // Données de base (héritées de PdfData)
      project_title: project.projectTitle,
      adresse: project.inputsGeneral?.adresseBien || '',
      latitude: project.inputsGeneral?.latitude ?? null,
      longitude: project.inputsGeneral?.longitude ?? null,
      pdf_config: validatedConfig,
      inputsGeneral: validatedInputsGeneral,
      inputsDvf: project.inputsDvf,
      resultsDvfMetadata: project.resultsDvfMetadata,
      resultsBusinessPlan: validatedResultsBusinessPlan,
      resultsBusinessPlanRealises: validatedResultsBusinessPlanRealises,
      inputsBusinessPlan: validatedInputsBusinessPlan,
      inputsBusinessPlanRealises: validatedInputsBusinessPlanRealises,
      inputsDescriptionBien: project.inputsDescriptionBien,
      resultsDescriptionBien: project.resultsDescriptionBien,
      date_creation: new Date(project.createdAt),
      date_modification: new Date(project.updatedAt),

      // Données spécifiques au PDF de clôture
      date_cloture: new Date().toLocaleDateString('fr-FR'),

      // Résumé exécutif (KPI cards)
      resultats_prix_revient: validatedResultsBusinessPlan?.resultats.prix_revient || 0,
      resultats_realises_prix_revient: validatedResultsBusinessPlanRealises?.resultats.prix_revient || 0,
      ecart_prix_revient: (validatedResultsBusinessPlanRealises?.resultats.prix_revient || 0) - (validatedResultsBusinessPlan?.resultats.prix_revient || 0),

      resultats_marge_nette: validatedResultsBusinessPlan?.resultats.marge_nette || 0,
      resultats_realises_marge_nette: validatedResultsBusinessPlanRealises?.resultats.marge_nette || 0,
      ecart_marge_nette: (validatedResultsBusinessPlanRealises?.resultats.marge_nette || 0) - (validatedResultsBusinessPlan?.resultats.marge_nette || 0),

      resultats_rentabilite: validatedResultsBusinessPlan?.resultats.rentabilite || 0,
      resultats_realises_rentabilite: validatedResultsBusinessPlanRealises?.resultats.rentabilite || 0,
      ecart_rentabilite: (validatedResultsBusinessPlanRealises?.resultats.rentabilite || 0) - (validatedResultsBusinessPlan?.resultats.rentabilite || 0),

      resultats_tri: validatedResultsBusinessPlan?.resultats.tri || 0,
      resultats_realises_tri: validatedResultsBusinessPlanRealises?.resultats.tri || 0,

      // Synthèse financière détaillée
      couts_acquisition_total: validatedResultsBusinessPlan?.couts_acquisition.total_acquisition || 0,
      couts_travaux_total: validatedResultsBusinessPlan?.couts_travaux.total_travaux || 0,
      couts_financement_total: validatedResultsBusinessPlan?.financement.couts.total_couts_financiers || 0,
      couts_divers_total: validatedResultsBusinessPlan?.couts_divers.total_divers || 0,
      couts_total: validatedResultsBusinessPlan?.couts_total || 0,

      // Synthèse des surfaces
      surface_carrez_avant: validatedInputsGeneral.superficie || 0,
      surface_carrez_apres: validatedInputsBusinessPlan?.surface_carrez_apres_travaux || 0,
      surface_carrez_apres_realise: validatedInputsBusinessPlanRealises?.surface_carrez_apres_travaux || 0,

      surface_terrasse_avant: validatedInputsGeneral.superficie_terrasse || 0,
      surface_terrasse_apres: validatedInputsBusinessPlan?.surface_terrasse_apres_travaux || 0,
      surface_terrasse_apres_realise: validatedInputsBusinessPlanRealises?.surface_terrasse_apres_travaux || 0,

      // Calcul des surfaces pondérées
      surface_ponderee_apres: (validatedInputsBusinessPlan?.surface_carrez_apres_travaux || 0) + 
        ((validatedInputsBusinessPlan?.surface_terrasse_apres_travaux || 0) * (validatedInputsGeneral.ponderation_terrasse || 0)),
      surface_ponderee_apres_realise: (validatedInputsBusinessPlanRealises?.surface_carrez_apres_travaux || 0) + 
        ((validatedInputsBusinessPlanRealises?.surface_terrasse_apres_travaux || 0) * (validatedInputsGeneral.ponderation_terrasse || 0)),

      // Détail par trimestre
      trimestre_details: validatedResultsBusinessPlan?.trimestre_details || [],
      trimestre_details_realises: validatedResultsBusinessPlanRealises?.trimestre_details || [],

      // Photos
      selectedBeforePhotosForPdf: project.photos?.selectedBeforePhotosForPdf?.map(id => 
        project.photos?.before?.find(p => p.id === id)?.url
      ).filter((url): url is string => typeof url === 'string') || [],
      selected3dPhotosForPdf: project.photos?.selected3dPhotosForPdf?.map(id => 
        project.photos?.['3d']?.find(p => p.id === id)?.url
      ).filter((url): url is string => typeof url === 'string') || [],
      selectedDuringPhotosForPdf: project.photos?.selectedDuringPhotosForPdf?.map(id => 
        project.photos?.during?.find(p => p.id === id)?.url
      ).filter((url): url is string => typeof url === 'string') || [],
      selectedAfterPhotosForPdf: project.photos?.selectedAfterPhotosForPdf?.map(id => 
        project.photos?.after?.find(p => p.id === id)?.url
      ).filter((url): url is string => typeof url === 'string') || [],

    };

    // PATCH: Images PDF en URL HTTP
    const BASE_IMAGE_URL = process.env.BASE_PDF_IMAGE_URL || 'http://localhost:3001';
    function toHttpUrl(relPath: string | undefined): string {
      if (!relPath) return '';
      if (relPath.startsWith('/uploads/')) return `${BASE_IMAGE_URL}${relPath}`;
      return relPath;
    }

    // Conversion des URLs des photos
    const photoArrays = [
      'selectedBeforePhotosForPdf',
      'selected3dPhotosForPdf',
      'selectedDuringPhotosForPdf',
      'selectedAfterPhotosForPdf'
    ] as const;

    for (const field of photoArrays) {
      if (Array.isArray(pdfData[field])) {
        (pdfData as any)[field] = (pdfData[field] as string[]).map(toHttpUrl);
      }
    }

    // Validation finale de l'objet complet
    return PdfClosingDataSchema.parse(pdfData);
  }
} 