import { Project } from '../../../shared/types/project';
import { PdfDataSchema, PdfConfigSchema, PdfData, PdfConfig } from '../../../shared/types/pdf';
import { BusinessPlanInputsSchema } from '../../../shared/types/businessPlanInputs';
import { BusinessPlanResultsSchema } from '../../../shared/types/businessPlanResults';
import { InputsGeneralSchema } from '../../../shared/types/generalInputs';
import { InputsDvfSchema } from '../../../shared/types/dvfInputs';
import { ResultsDvfMetadataSchema } from '../../../shared/types/dvfMetadataResults';
import { DescriptionBienInputsSchema } from '../../../shared/types/descriptionBienInputs';
import { DescriptionBienResultsSchema } from '../../../shared/types/descriptionBienResults';

export class PdfMappingService {
  static mapProjectToPdfData(project: Project, pdfConfig: PdfConfig): PdfData {
    // Validation stricte de chaque bloc (lève si invalide)
    const validatedConfig = PdfConfigSchema.parse(pdfConfig);
    const validatedInputsGeneral = InputsGeneralSchema.parse(project.inputsGeneral);
    const validatedInputsDvf = project.inputsDvf ? InputsDvfSchema.parse(project.inputsDvf) : undefined;
    const validatedResultsDvfMetadata = project.resultsDvfMetadata ? ResultsDvfMetadataSchema.parse(project.resultsDvfMetadata) : undefined;
    const validatedInputsBusinessPlan = project.inputsBusinessPlan ? BusinessPlanInputsSchema.parse(project.inputsBusinessPlan) : undefined;
    const validatedResultsBusinessPlan = project.resultsBusinessPlan ? BusinessPlanResultsSchema.parse(project.resultsBusinessPlan) : undefined;
    const validatedInputsDescriptionBien = project.inputsDescriptionBien ? DescriptionBienInputsSchema.parse(project.inputsDescriptionBien) : undefined;
    const validatedResultsDescriptionBien = project.resultsDescriptionBien ? DescriptionBienResultsSchema.parse(project.resultsDescriptionBien) : undefined;

    // Factorisation pour éviter les linter warnings
    const photos = project.photos;
    const hasPhotos = !!photos;
    const beforePhotos = hasPhotos && Array.isArray(photos.before) ? photos.before : [];
    const selectedBeforeIds = hasPhotos && Array.isArray(photos.selectedBeforePhotosForPdf) ? photos.selectedBeforePhotosForPdf : [];
    const photos3d = hasPhotos && Array.isArray(photos['3d']) ? photos['3d'] : [];
    const selected3dIds = hasPhotos && Array.isArray(photos.selected3dPhotosForPdf) ? photos.selected3dPhotosForPdf : [];
    const duringPhotos = hasPhotos && Array.isArray(photos.during) ? photos.during : [];
    const selectedDuringIds = hasPhotos && Array.isArray(photos.selectedDuringPhotosForPdf) ? photos.selectedDuringPhotosForPdf : [];
    const afterPhotos = hasPhotos && Array.isArray(photos.after) ? photos.after : [];
    const selectedAfterIds = hasPhotos && Array.isArray(photos.selectedAfterPhotosForPdf) ? photos.selectedAfterPhotosForPdf : [];

    // Construction de l'objet PdfData
    const pdfData: PdfData = {
      project_title: project.projectTitle,
      adresse: project.inputsGeneral?.adresseBien || '',
      latitude: project.inputsGeneral?.latitude ?? null,
      longitude: project.inputsGeneral?.longitude ?? null,
      pdf_config: validatedConfig,
      inputsGeneral: validatedInputsGeneral,
      inputsDvf: validatedInputsDvf,
      resultsDvfMetadata: validatedResultsDvfMetadata,
      inputsBusinessPlan: validatedInputsBusinessPlan,
      resultsBusinessPlan: validatedResultsBusinessPlan,
      inputsDescriptionBien: validatedInputsDescriptionBien,
      resultsDescriptionBien: validatedResultsDescriptionBien,
      // Champs optionnels (photos, dates, etc.) à compléter selon besoin
      date_creation: new Date(project.createdAt),
      date_modification: new Date(project.updatedAt),
      image1: beforePhotos.find(p => p.id === selectedBeforeIds[0])?.url || '',
      image2: beforePhotos.find(p => p.id === selectedBeforeIds[1])?.url || '',
      image3: beforePhotos.find(p => p.id === selectedBeforeIds[2])?.url || '',
      image4: beforePhotos.find(p => p.id === selectedBeforeIds[3])?.url || '',
      image5: beforePhotos.find(p => p.id === selectedBeforeIds[4])?.url || '',
      image3d1: photos3d.find(p => p.id === selected3dIds[0])?.url || '',
      image3d2: photos3d.find(p => p.id === selected3dIds[1])?.url || '',
      image3d3: photos3d.find(p => p.id === selected3dIds[2])?.url || '',
      selectedBeforePhotosForPdf: selectedBeforeIds.map(id => beforePhotos.find(p => p.id === id)?.url).filter((url): url is string => typeof url === 'string'),
      selectedDuringPhotosForPdf: selectedDuringIds.map(id => duringPhotos.find(p => p.id === id)?.url).filter((url): url is string => typeof url === 'string'),
      selectedAfterPhotosForPdf: selectedAfterIds.map(id => afterPhotos.find(p => p.id === id)?.url).filter((url): url is string => typeof url === 'string'),
      inputsRenovationBien: project.inputsRenovationBien,
      resultsRenovationBien: project.resultsRenovationBien,
    };
    // PATCH: Images PDF en URL HTTP (comme dans l'ancien extractPdfData)
    const BASE_IMAGE_URL = process.env.BASE_PDF_IMAGE_URL || 'http://localhost:3001';
    function toHttpUrl(relPath: string | undefined): string {
      if (!relPath) return '';
      if (relPath.startsWith('/uploads/')) return `${BASE_IMAGE_URL}${relPath}`;
      return relPath;
    }
    const imageFields = [
      'image1', 'image2', 'image3', 'image4', 'image5',
      'image3d1', 'image3d2', 'image3d3'
    ];
    const pdfDataAny = pdfData as any;
    for (const field of imageFields) {
      if (pdfDataAny[field]) {
        pdfDataAny[field] = toHttpUrl(pdfDataAny[field]);
      }
    }
    if (Array.isArray(pdfDataAny.selectedBeforePhotosForPdf)) {
      pdfDataAny.selectedBeforePhotosForPdf = pdfDataAny.selectedBeforePhotosForPdf.map(toHttpUrl);
    }
    if (Array.isArray(pdfDataAny.selectedDuringPhotosForPdf)) {
      pdfDataAny.selectedDuringPhotosForPdf = pdfDataAny.selectedDuringPhotosForPdf.map(toHttpUrl);
    }
    if (Array.isArray(pdfDataAny.selectedAfterPhotosForPdf)) {
      pdfDataAny.selectedAfterPhotosForPdf = pdfDataAny.selectedAfterPhotosForPdf.map(toHttpUrl);
    }
    // Correction : alimenter surface_ponderee_apres_travaux si absent dans le business plan
    if (pdfData.inputsBusinessPlan && pdfData.inputsRenovationBien && pdfData.inputsGeneral) {
      if (typeof pdfData.inputsBusinessPlan.surface_ponderee_apres_travaux !== 'number' || isNaN(pdfData.inputsBusinessPlan.surface_ponderee_apres_travaux)) {
        const { superficie_apres = 0, superficie_exterieur_apres = 0 } = pdfData.inputsRenovationBien;
        const ponderation = pdfData.inputsGeneral.ponderation_terrasse || 0;
        pdfData.inputsBusinessPlan.surface_ponderee_apres_travaux = superficie_apres + (superficie_exterieur_apres * ponderation);
      }
    }
    // Validation finale de l'objet complet
    return PdfDataSchema.parse(pdfData);
  }
} 