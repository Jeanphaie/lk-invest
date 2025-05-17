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
      // Mapping images: on prend les urls des photos sélectionnées (par id)
      image1: project.photos && Array.isArray(project.photos.selectedBeforePhotosForPdf) && Array.isArray(project.photos.before) ?
        (project.photos.before.find(p => p.id === project.photos.selectedBeforePhotosForPdf[0])?.url || '') : '',
      image2: project.photos && Array.isArray(project.photos.selectedBeforePhotosForPdf) && Array.isArray(project.photos.before) ?
        (project.photos.before.find(p => p.id === project.photos.selectedBeforePhotosForPdf[1])?.url || '') : '',
      image3: project.photos && Array.isArray(project.photos.selectedBeforePhotosForPdf) && Array.isArray(project.photos.before) ?
        (project.photos.before.find(p => p.id === project.photos.selectedBeforePhotosForPdf[2])?.url || '') : '',
      image4: project.photos && Array.isArray(project.photos.selectedBeforePhotosForPdf) && Array.isArray(project.photos.before) ?
        (project.photos.before.find(p => p.id === project.photos.selectedBeforePhotosForPdf[3])?.url || '') : '',
      image5: project.photos && Array.isArray(project.photos.selectedBeforePhotosForPdf) && Array.isArray(project.photos.before) ?
        (project.photos.before.find(p => p.id === project.photos.selectedBeforePhotosForPdf[4])?.url || '') : '',
      image3d1: project.photos && Array.isArray(project.photos.selected3dPhotosForPdf) && Array.isArray(project.photos['3d']) ?
        (project.photos['3d'].find(p => p.id === project.photos.selected3dPhotosForPdf[0])?.url || '') : '',
      image3d2: project.photos && Array.isArray(project.photos.selected3dPhotosForPdf) && Array.isArray(project.photos['3d']) ?
        (project.photos['3d'].find(p => p.id === project.photos.selected3dPhotosForPdf[1])?.url || '') : '',
      image3d3: project.photos && Array.isArray(project.photos.selected3dPhotosForPdf) && Array.isArray(project.photos['3d']) ?
        (project.photos['3d'].find(p => p.id === project.photos.selected3dPhotosForPdf[2])?.url || '') : '',
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
    // Validation finale de l'objet complet
    return PdfDataSchema.parse(pdfData);
  }
} 