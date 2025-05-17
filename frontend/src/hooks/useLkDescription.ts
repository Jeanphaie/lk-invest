import { useState } from 'react';

export interface ProjectData {
  surface?: number;
  surface_terrasse?: number;
  ponderation_terrasse?: number;
  'prix-achat'?: number;
  'prix-affiche'?: number;
  'frais-notaire'?: number;
  frais_agence?: number;
  frais_agence_vente?: number;
  frais_dossier?: number;
  credit_foncier?: number;
  fonds_propres?: number;
  credit_accompagnement_total?: number;
  taux_credit?: number;
  cout_travaux?: number;
  salaire_maitrise?: number;
  alea_travaux?: number;
  amenagement_terrasse?: number;
  mobilier?: number;
  demolition?: number;
  prix_benchmark?: number;
  ponderation_vente?: number;
  date_achat?: string;
}

export interface BusinessPlanResults {
  resultats: {
    prix_revient: number;
    marge_nette: number;
    rentabilite: number;
    tri: number;
  };
  prix_m2: {
    prix_revient_m2: number;
    prix_revient_m2_carrez: number;
    prix_m2_vente: number;
    prix_m2_carrez_vente: number;
  };
  prorata: {
    acquisition: number;
    travaux: number;
    financement: number;
    frais_divers: number;
  };
  couts_travaux: {
    total: number;
  };
  financement: {
    total_financement: number;
  };
  frais: {
    total: number;
  };
  trimestre_details: Array<{
    trimestre: string;
    jours: number;
    credit_used: number;
    fonds_propres_used: number;
    interets_trimestre: number;
    commission_accompagnement: number;
  }>;
}

export const useLkDescription = () => {
  const [projectData, setProjectData] = useState<ProjectData>({});

  const updateProjectData = (newData: Partial<ProjectData>) => {
    setProjectData(prev => ({ ...prev, ...newData }));
  };

  return {
    projectData,
    updateProjectData,
  };
}; 