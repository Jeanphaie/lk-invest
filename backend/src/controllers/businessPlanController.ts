import { Request, Response } from 'express';
import { z } from 'zod';
import { 
  BusinessPlanInputsSchema,
  BusinessPlanInputs,
  DEFAULT_VALUES
} from '../../../shared/types/businessPlanInputs';
import { 
  BusinessPlanResultsSchema,
  BusinessPlanResults
} from '../../../shared/types/businessPlanResults';
import { InputsGeneral } from '../../../shared/types/generalInputs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('[DEBUG] businessPlanController chargé');

const cleanNumeric = (value: any, defaultValue: number = 0): number => {
  console.log('cleanNumeric input:', { value, type: typeof value });
  
  if (value === null || value === undefined) {
    console.log('cleanNumeric: valeur null/undefined, retourne defaultValue:', defaultValue);
    return defaultValue;
  }
  
  if (typeof value === 'number') {
    console.log('cleanNumeric: valeur déjà numérique:', value);
    return value;
  }
  
  if (typeof value === 'string') {
    // Supprime tous les caractères non numériques sauf le point et le moins
    const cleaned = value.replace(/[^\d.-]/g, '');
    console.log('cleanNumeric: chaîne nettoyée:', cleaned);
    
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      console.log('cleanNumeric: parseFloat a échoué, retourne defaultValue:', defaultValue);
      return defaultValue;
    }
    console.log('cleanNumeric: valeur convertie:', num);
    return num;
  }
  
  console.log('cleanNumeric: type non géré:', typeof value, 'retourne defaultValue:', defaultValue);
  return defaultValue;
};

const calculateMonthlyPayment = (principal: number, annualRate: number, months: number): number => {
  if (months === 0 || annualRate === 0) return 0;
  const monthlyRate = annualRate / 12 / 100;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
};

const calculateTRI = (cashFlows: number[]): number => {
  const npv = (rate: number): number => {
    return cashFlows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0);
  };

  let left = -0.99, right = 1.0;
  while (right - left > 1e-6) {
    const mid = (left + right) / 2;
    if (npv(mid) > 0) {
      left = mid;
    } else {
      right = mid;
    }
  }
  return (left + right) / 2 * 100;
};

// Ajout utilitaire pour remplacer tous les null par 0 dans les objets imbriqués
function replaceNullsWithZero(obj: any) {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (obj[key] === null) obj[key] = 0;
      else if (typeof obj[key] === 'object') replaceNullsWithZero(obj[key]);
    }
  }
}

// Ajout utilitaire pour division sécurisée (évite NaN/Infinity)
function safeDiv(a: number, b: number): number {
  if (!b || !isFinite(a / b)) return 0;
  return a / b;
}

const applyDefaultIfNullOrUndefined = (value: any, fallback: number) => {
  return (value === null || value === undefined) ? fallback : value;
};

export const calculateBusinessPlan = async (req: Request, res: Response) => {
  console.log(`[BP] Calcul business plan projet #${req.params.projectId} | Inputs:`, JSON.stringify(req.body));

  try {
    const projectId = parseInt(req.params.projectId);
    if (isNaN(projectId)) {
      console.error('Project ID invalide:', req.params.projectId);
      return res.status(400).json({ error: 'Project ID invalide' });
    }

    const inputs = req.body;
    if (!inputs) {
      console.error('Aucun input reçu');
      return res.status(400).json({ error: 'Aucun input reçu' });
    }

    // Validation des inputs
    console.log('Validation des inputs...');
    const validationResult = BusinessPlanInputsSchema.safeParse(inputs);
    if (!validationResult.success) {
      console.error('Erreur de validation des inputs:', validationResult.error.errors);
      return res.status(400).json({
        error: 'Données invalides',
        details: validationResult.error.errors
      });
    }
    console.log('Validation des inputs réussie');

    // Récupération du projet avec les inputs généraux
    console.log('Récupération du projet...');
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      console.error('Projet non trouvé');
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    console.log('Projet trouvé:', project.id);

    // Récupération de la pondération terrasse depuis les inputs généraux
    const generalInputs = project.inputsGeneral as InputsGeneral;
    if (!generalInputs) {
      console.error('Inputs généraux non trouvés');
      return res.status(400).json({ error: 'Inputs généraux non trouvés' });
    }
    console.log('Inputs généraux récupérés');

    const ponderation_terrasse = generalInputs?.ponderation_terrasse ?? 0.3;
    console.log('Pondération terrasse:', ponderation_terrasse);

    // Calcul des résultats avec la pondération terrasse des inputs généraux
    try {
      const results = calculateResults(validationResult.data, ponderation_terrasse, generalInputs);
      // Log synthétique des résultats principaux
      console.log(`[BP] Résultats projet #${req.params.projectId} | Prix de revient: ${results.resultats.prix_revient} | Total travaux: ${results.couts_travaux.total_travaux} | Total acquisition: ${results.couts_acquisition.total_acquisition} | Total divers: ${results.couts_divers.total_divers} | Total financiers: ${results.financement.couts.total_couts_financiers} | Marge nette: ${results.resultats.marge_nette} | Rentabilité: ${results.resultats.rentabilite}%`);

      // Validation des résultats
      console.log('Validation des résultats...');
      const resultsValidation = BusinessPlanResultsSchema.safeParse(results);
      if (!resultsValidation.success) {
        console.error('Erreur de validation des résultats:', resultsValidation.error.errors);
        return res.status(400).json({
          error: 'Données invalides',
          details: resultsValidation.error.errors
        });
      }
      console.log('Validation des résultats réussie');

      // Mise à jour du projet
      console.log('Mise à jour du projet...');
      await prisma.project.update({
        where: { id: projectId },
        data: {
          inputsBusinessPlan: validationResult.data,
          resultsBusinessPlan: resultsValidation.data
        }
      });
      console.log('Projet mis à jour avec succès');

      // Ajout : calcul des pourcentages pour le template PDF
      const total_montants_utilises = resultsValidation.data.financement.montants_utilises.total_montants_utilises || 1;
      const pct_credit_foncier_utilise = resultsValidation.data.financement.montants_utilises.credit_foncier_output_amount / total_montants_utilises * 100;
      const pct_fonds_propres_utilise = resultsValidation.data.financement.montants_utilises.fonds_propres_output_amount / total_montants_utilises * 100;

      return res.json({
        ...resultsValidation.data,
        pct_credit_foncier_utilise,
        pct_fonds_propres_utilise
      });

    } catch (calcError) {
      console.error('Erreur lors du calcul des résultats:', calcError);
      return res.status(500).json({ 
        error: 'Erreur lors du calcul des résultats',
        details: calcError instanceof Error ? calcError.message : String(calcError)
      });
    }

  } catch (error) {
    console.error('Erreur générale:', error);
    return res.status(500).json({ 
      error: 'Erreur lors du calcul du business plan',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

const calculateResults = (inputs: BusinessPlanInputs, ponderation_terrasse: number, generalInputs: any): BusinessPlanResults => {
  console.log('=== Début du calcul des résultats ===');
  console.log('Inputs pour le calcul:', JSON.stringify(inputs, null, 2));

  try {
    // --- Récupération des surfaces AVANT travaux depuis les inputs généraux ---
    const surface_carrez_avant_travaux = generalInputs?.superficie || 0;
    const surface_terrasse_avant_travaux = generalInputs?.superficie_terrasse || 0;
    const surface_ponderee_avant_travaux = surface_carrez_avant_travaux + surface_terrasse_avant_travaux * ponderation_terrasse;

    console.log('Surfaces avant travaux:', {
      surface_carrez_avant_travaux,
      surface_terrasse_avant_travaux,
      surface_ponderee_avant_travaux
    });

    // Appliquer le fallback pour tous les inputs numériques clés
    const safeInputs = {
      ...inputs,
      surface_carrez_apres_travaux: applyDefaultIfNullOrUndefined(inputs.surface_carrez_apres_travaux, surface_carrez_avant_travaux),
      surface_terrasse_apres_travaux: applyDefaultIfNullOrUndefined(inputs.surface_terrasse_apres_travaux, surface_terrasse_avant_travaux),
      surface_ponderee_apres_travaux: applyDefaultIfNullOrUndefined(
        inputs.surface_ponderee_apres_travaux,
        surface_carrez_avant_travaux + surface_terrasse_avant_travaux * ponderation_terrasse
      ),
      cout_travaux_m2: applyDefaultIfNullOrUndefined(inputs.cout_travaux_m2, DEFAULT_VALUES.cout_travaux_m2),
      cout_maitrise_oeuvre_percent: applyDefaultIfNullOrUndefined(inputs.cout_maitrise_oeuvre_percent, DEFAULT_VALUES.cout_maitrise_oeuvre_percent),
      cout_alea_percent: applyDefaultIfNullOrUndefined(inputs.cout_alea_percent, DEFAULT_VALUES.cout_alea_percent),
      cout_terrasse_input_amount: applyDefaultIfNullOrUndefined(inputs.cout_terrasse_input_amount, DEFAULT_VALUES.cout_terrasse_input_amount),
      cout_mobilier_input_amount: applyDefaultIfNullOrUndefined(inputs.cout_mobilier_input_amount, DEFAULT_VALUES.cout_mobilier_input_amount),
      cout_demolition_input_amount: applyDefaultIfNullOrUndefined(inputs.cout_demolition_input_amount, DEFAULT_VALUES.cout_demolition_input_amount),
      cout_honoraires_tech_input_amount: applyDefaultIfNullOrUndefined(inputs.cout_honoraires_tech_input_amount, DEFAULT_VALUES.cout_honoraires_tech_input_amount),
      cout_prorata_foncier_input_amount: applyDefaultIfNullOrUndefined(inputs.cout_prorata_foncier_input_amount, DEFAULT_VALUES.cout_prorata_foncier_input_amount),
      cout_diagnostics_input_amount: applyDefaultIfNullOrUndefined(inputs.cout_diagnostics_input_amount, DEFAULT_VALUES.cout_diagnostics_input_amount),
      frais_notaire_percent: applyDefaultIfNullOrUndefined(inputs.frais_notaire_percent, DEFAULT_VALUES.frais_notaire_percent),
      frais_agence_achat_percent: applyDefaultIfNullOrUndefined(inputs.frais_agence_achat_percent, DEFAULT_VALUES.frais_agence_achat_percent),
      frais_agence_vente_percent: applyDefaultIfNullOrUndefined(inputs.frais_agence_vente_percent, DEFAULT_VALUES.frais_agence_vente_percent),
      frais_dossier_amount: applyDefaultIfNullOrUndefined(inputs.frais_dossier_amount, DEFAULT_VALUES.frais_dossier_amount),
      financement_credit_foncier_amount: applyDefaultIfNullOrUndefined(inputs.financement_credit_foncier_amount, DEFAULT_VALUES.financement_credit_foncier_amount),
      financement_fonds_propres_amount: applyDefaultIfNullOrUndefined(inputs.financement_fonds_propres_amount, DEFAULT_VALUES.financement_fonds_propres_amount),
      financement_credit_accompagnement_amount: applyDefaultIfNullOrUndefined(inputs.financement_credit_accompagnement_amount, DEFAULT_VALUES.financement_credit_accompagnement_amount),
      financement_taux_credit_percent: applyDefaultIfNullOrUndefined(inputs.financement_taux_credit_percent, DEFAULT_VALUES.financement_taux_credit_percent),
      financement_commission_percent: applyDefaultIfNullOrUndefined(inputs.financement_commission_percent, DEFAULT_VALUES.financement_commission_percent),
      duree_projet: applyDefaultIfNullOrUndefined(inputs.duree_projet, DEFAULT_VALUES.duree_projet),
      prix_achat: applyDefaultIfNullOrUndefined(inputs.prix_achat, DEFAULT_VALUES.prix_achat),
      prix_affiche: applyDefaultIfNullOrUndefined(inputs.prix_affiche, DEFAULT_VALUES.prix_affiche),
      prix_vente_reel_pondere_m2: applyDefaultIfNullOrUndefined(inputs.prix_vente_reel_pondere_m2, DEFAULT_VALUES.prix_vente_reel_pondere_m2)
    };

    // Utiliser safeInputs partout dans la suite du calcul
    // --- surfaces après travaux ---
    const surface = safeInputs.surface_carrez_apres_travaux;
    const surface_terrasse = safeInputs.surface_terrasse_apres_travaux;
    const surface_totale = surface;
    const surface_carrez_apres_travaux = safeInputs.surface_carrez_apres_travaux;
    const surface_terrasse_apres_travaux = safeInputs.surface_terrasse_apres_travaux;
    const surface_ponderee_apres_travaux = safeInputs.surface_ponderee_apres_travaux;
    const prix_achat = safeInputs.prix_achat;
    const prix_affiche = safeInputs.prix_affiche;
    const duree_projet = safeInputs.duree_projet;

    // --- Calcul des coûts travaux ---
    console.log('Calcul des coûts travaux...');
    const cout_travaux_total = surface_carrez_apres_travaux * safeInputs.cout_travaux_m2;
    const cout_amenagement_terrasse = safeInputs.cout_terrasse_input_amount;
    const mobilier = safeInputs.cout_mobilier_input_amount;
    const cout_demolition = safeInputs.cout_demolition_input_amount;

    // Nouvelle base travaux
    const base_travaux = cout_travaux_total + cout_amenagement_terrasse + mobilier + cout_demolition;
    const cout_aleas = base_travaux * (safeInputs.cout_alea_percent / 100);
    const cout_maitrise_oeuvre = (base_travaux + cout_aleas) * (safeInputs.cout_maitrise_oeuvre_percent / 100);
    
    console.log('Coûts travaux calculés:', {
      cout_travaux_total,
      cout_amenagement_terrasse,
      mobilier,
      cout_demolition,
      base_travaux,
      cout_aleas,
      cout_maitrise_oeuvre
    });

    // --- Calcul des frais ---
    console.log('Calcul des frais...');
    const frais_notaire = prix_achat * (safeInputs.frais_notaire_percent / 100);
    const frais_agence = prix_achat * (safeInputs.frais_agence_achat_percent / 100);
    const frais_agence_vente = safeInputs.frais_agence_vente_percent;
    const frais_dossier = safeInputs.frais_dossier_amount;

    console.log('Frais calculés:', {
      frais_notaire,
      frais_agence,
      frais_agence_vente,
      frais_dossier
    });

    // --- Calcul des frais divers ---
    console.log('Calcul des frais divers...');
    const honoraires_techniques = safeInputs.cout_honoraires_tech_input_amount;
    const prorata_foncier = safeInputs.cout_prorata_foncier_input_amount;
    const diagnostics = safeInputs.cout_diagnostics_input_amount;

    console.log('Frais divers calculés:', {
      honoraires_techniques,
      prorata_foncier,
      diagnostics
    });

    // --- Calcul des totaux par catégorie (hors financement) ---
    console.log('Calcul des totaux par catégorie...');
    const total_acquisition = prix_achat + frais_notaire + frais_agence;
    const total_travaux = base_travaux + cout_aleas + cout_maitrise_oeuvre;
    const total_divers = honoraires_techniques + prorata_foncier + diagnostics;

    console.log('Totaux calculés:', {
      total_acquisition,
      total_travaux,
      total_divers
    });

    // --- Calcul du prix de vente FAI et HFA ---
    console.log('Calcul des prix de vente...');
    const prix_vente_reel_pondere_m2 = safeInputs.prix_vente_reel_pondere_m2;
    const prix_fai = surface_ponderee_apres_travaux * prix_vente_reel_pondere_m2;
    const prix_hfa = prix_fai / (1 + (safeInputs.frais_agence_vente_percent || 0) / 100);

    console.log('Prix de vente calculés:', {
      prix_vente_reel_pondere_m2,
      prix_fai,
      prix_hfa
    });

    // --- Calculs trimestriels ---
    console.log('Début des calculs trimestriels...');
    const date_achat = new Date(safeInputs.date_achat);
    const date_vente = new Date(date_achat);
    date_vente.setDate(date_achat.getDate() + duree_projet);

    console.log('Dates calculées:', {
      date_achat: date_achat.toISOString(),
      date_vente: date_vente.toISOString(),
      duree_projet
    });

    // Génération des trimestres
    const trimestres = [];
    let current_year = date_achat.getFullYear();
    while (new Date(current_year, 0, 1) <= date_vente) {
      for (let q = 1; q <= 4; q++) {
        const t_start = new Date(current_year, (q - 1) * 3, 1);
        const t_end = q < 4 ? new Date(current_year, q * 3, 0) : new Date(current_year, 11, 31);
        if (t_start > date_vente) break;
        if (t_end < date_achat) continue;
        const trimestre_start = t_start > date_achat ? t_start : date_achat;
        const trimestre_end = t_end < date_vente ? t_end : date_vente;
        const jours = Math.floor((trimestre_end.getTime() - trimestre_start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        trimestres.push({
          trimestre: `T${q} ${current_year}`,
          jours,
          start_date: trimestre_start.toISOString().split('T')[0],
          end_date: trimestre_end.toISOString().split('T')[0]
        });
      }
      current_year++;
    }

    // Initialisation des variables pour les calculs trimestriels
    console.log('Initialisation des variables de financement...');
    const nb_trimestres = trimestres.length;
    
    // Log des valeurs et types avant nettoyage
    console.log('DEBUG financement types:', {
      credit_foncier: safeInputs.financement_credit_foncier_amount,
      type_credit_foncier: typeof safeInputs.financement_credit_foncier_amount,
      fonds_propres: safeInputs.financement_fonds_propres_amount,
      type_fonds_propres: typeof safeInputs.financement_fonds_propres_amount,
      credit_accompagnement: safeInputs.financement_credit_accompagnement_amount,
      type_credit_accompagnement: typeof safeInputs.financement_credit_accompagnement_amount,
    });

    // Conversion robuste
    const credit_foncier = Number(safeInputs.financement_credit_foncier_amount) || 0;
    const fonds_propres = Number(safeInputs.financement_fonds_propres_amount) || 0;
    const credit_accompagnement = Number(safeInputs.financement_credit_accompagnement_amount) || 0;
    const taux_credit = Number(safeInputs.financement_taux_credit_percent) || 0;
    const commission_rate = Number(safeInputs.financement_commission_percent) || 0;

    console.log('DEBUG cleanNumeric results:', {
      credit_foncier,
      fonds_propres,
      credit_accompagnement,
      taux_credit,
      commission_rate
    });

    // Vérification du financement total avec logs détaillés
    const financement_total = credit_foncier + fonds_propres + credit_accompagnement;
    console.log('Détail du financement:', {
      credit_foncier,
      fonds_propres,
      credit_accompagnement,
      financement_total,
      total_acquisition,
      difference: financement_total - total_acquisition
    });

    if (financement_total < total_acquisition) {
      console.error('Financement insuffisant:', {
        financement_total,
        total_acquisition,
        manque: total_acquisition - financement_total,
        details: {
          credit_foncier,
          fonds_propres,
          credit_accompagnement
        }
      });
      throw new Error(`Le financement total (${financement_total}€) est insuffisant pour couvrir l'acquisition (${total_acquisition}€). Il manque ${total_acquisition - financement_total}€.`);
    }

    // Répartition des coûts par trimestre
    console.log('Répartition des coûts par trimestre...');
    const travaux_par_trimestre = total_travaux / nb_trimestres;
    const honoraires_techniques_par_trimestre = honoraires_techniques / nb_trimestres;
    const prorata_foncier_par_trimestre = prorata_foncier / nb_trimestres;
    const diagnostics_par_trimestre = diagnostics / nb_trimestres;

    console.log('Coûts par trimestre:', {
      travaux_par_trimestre,
      honoraires_techniques_par_trimestre,
      prorata_foncier_par_trimestre,
      diagnostics_par_trimestre
    });

    // Variables de suivi
    let credit_foncier_restant = credit_foncier;
    let fonds_propres_restant = fonds_propres;
    let credit_accomp_restant = credit_accompagnement;
    let encours_foncier = 0;
    let encours_accompagnement = 0;
    let encours_fonds_propres = 0;
    let credit_foncier_utilise_total = 0;
    let fonds_propres_utilise_total = 0;
    let credit_accomp_utilise_total = 0;
    let commission_total = 0;
    let interets_foncier_a_payer = 0;
    let interets_accompagnement_a_payer = 0;
    let total_interets_foncier = 0;
    let total_interets_accompagnement = 0;
    let total_commission = 0;

    console.log('Variables de suivi initialisées');

    // Calcul de l'assiette de la commission
    console.log('Calcul de l\'assiette de la commission...');
    const assiette_commission = credit_foncier + credit_accompagnement;
    const commission_annuelle = assiette_commission * (commission_rate / 100);

    console.log('Commission calculée:', {
      assiette_commission,
      commission_annuelle
    });

    // Fonction utilitaire pour financer une dépense dans l'ordre foncier > fonds propres > accompagnement
    function financer(montant: number) {
      console.log(`Financer montant: ${montant}`);
      let foncier = 0, fonds = 0, accomp = 0;
      if (credit_foncier_restant > 0) {
        foncier = Math.min(montant, credit_foncier_restant);
        credit_foncier_restant -= foncier;
        encours_foncier += foncier;
        credit_foncier_utilise_total += foncier;
        montant -= foncier;
        console.log(`Utilisation crédit foncier: ${foncier}, reste: ${credit_foncier_restant}`);
      }
      if (montant > 0 && fonds_propres_restant > 0) {
        fonds = Math.min(montant, fonds_propres_restant);
        fonds_propres_restant -= fonds;
        encours_fonds_propres += fonds;
        fonds_propres_utilise_total += fonds;
        montant -= fonds;
        console.log(`Utilisation fonds propres: ${fonds}, reste: ${fonds_propres_restant}`);
      }
      if (montant > 0 && credit_accomp_restant > 0) {
        accomp = Math.min(montant, credit_accomp_restant);
        credit_accomp_restant -= accomp;
        encours_accompagnement += accomp;
        credit_accomp_utilise_total += accomp;
        montant -= accomp;
        console.log(`Utilisation crédit accompagnement: ${accomp}, reste: ${credit_accomp_restant}`);
      }
      if (montant > 0) {
        console.warn(`Montant non financé: ${montant}`);
      }
      return { foncier, fonds, accomp };
    }

    // --- Calcul des détails trimestriels ---
    console.log('Début du calcul des détails trimestriels...');
    const trimestre_details = [];
    for (let i = 0; i < nb_trimestres; i++) {
      console.log(`Calcul du trimestre ${i + 1}/${nb_trimestres}...`);
      const trimestre = trimestres[i];
      const jours = trimestre.jours;

      // Calcul de la commission au prorata des jours pour ce trimestre
      const commission_trimestrielle = commission_annuelle * (jours / 365);

      // 1. Calcul des coûts "classiques" du trimestre
      let cout_trimestre = 0;
      if (i === 0) {
        cout_trimestre += total_acquisition + frais_dossier;
      }
      cout_trimestre += travaux_par_trimestre + honoraires_techniques_par_trimestre + prorata_foncier_par_trimestre + diagnostics_par_trimestre;

      // 2. Financement des coûts "classiques" du trimestre
      let financement = financer(cout_trimestre);
      let credit_foncier_utilise = financement.foncier;
      let fonds_propres_utilise = financement.fonds;
      let credit_accompagnement_utilise = financement.accomp;

      // 3. Calcul des intérêts générés sur l'encours à la fin du trimestre (au prorata des jours)
      const interets_foncier_genere = encours_foncier * (taux_credit / 100) * (jours / 365);
      const interets_accompagnement_genere = encours_accompagnement * (taux_credit / 100) * (jours / 365);

      // 4. Paiement des intérêts stockés du trimestre précédent (sauf T1)
      let interets_foncier_payes = 0;
      let interets_accompagnement_payes = 0;
      let fp_foncier = 0, fp_fonds = 0, fp_accomp = 0;
      let fa_foncier = 0, fa_fonds = 0, fa_accomp = 0;
      if (i > 0) {
        let res = financer(interets_foncier_a_payer);
        fp_foncier = res.foncier;
        fp_fonds = res.fonds;
        fp_accomp = res.accomp;
        interets_foncier_payes = interets_foncier_a_payer;
        total_interets_foncier += interets_foncier_payes;

        let res2 = financer(interets_accompagnement_a_payer);
        fa_foncier = res2.foncier;
        fa_fonds = res2.fonds;
        fa_accomp = res2.accomp;
        interets_accompagnement_payes = interets_accompagnement_a_payer;
        total_interets_accompagnement += interets_accompagnement_payes;
      }

      // 5. Stocker les intérêts générés ce trimestre pour paiement au suivant
      interets_foncier_a_payer = interets_foncier_genere;
      interets_accompagnement_a_payer = interets_accompagnement_genere;

      // 6. Si dernier trimestre, solder tout ce qui reste à payer (payer aussi les intérêts générés ce trimestre)
      if (i === nb_trimestres - 1) {
        let res = financer(interets_foncier_a_payer);
        fp_foncier += res.foncier;
        fp_fonds += res.fonds;
        fp_accomp += res.accomp;
        interets_foncier_payes += interets_foncier_a_payer;
        total_interets_foncier += interets_foncier_a_payer;

        let res2 = financer(interets_accompagnement_a_payer);
        fa_foncier += res2.foncier;
        fa_fonds += res2.fonds;
        fa_accomp += res2.accomp;
        interets_accompagnement_payes += interets_accompagnement_a_payer;
        total_interets_accompagnement += interets_accompagnement_a_payer;
      }

      // 7. Paiement de la commission trimestrielle (dès T1)
      let fc_foncier = 0, fc_fonds = 0, fc_accomp = 0;
      let commission_payee = 0;
      let res3 = financer(commission_trimestrielle);
      fc_foncier = res3.foncier;
      fc_fonds = res3.fonds;
      fc_accomp = res3.accomp;
      commission_payee = commission_trimestrielle;
      total_commission += commission_payee;

      // 8. Remplir la ligne du tableau
      trimestre_details.push({
        trimestre: i + 1,
        jours,
        start_date: trimestre.start_date,
        end_date: trimestre.end_date,
        credit_foncier_utilise: credit_foncier_utilise + fp_foncier + fa_foncier + fc_foncier,
        fonds_propres_utilise: fonds_propres_utilise + fp_fonds + fa_fonds + fc_fonds,
        credit_accompagnement_utilise: credit_accompagnement_utilise + fp_accomp + fa_accomp + fc_accomp,
        interets_foncier: interets_foncier_payes,
        interets_accompagnement: interets_accompagnement_payes,
        commission_accompagnement: commission_payee,
        cout_financier_trimestre: interets_foncier_payes + interets_accompagnement_payes + commission_payee,
      });
    }
    console.log('Calcul des détails trimestriels terminé');

    // --- Calcul du total des frais financiers ---
    console.log('Calcul du total des frais financiers...');
    const total_couts_financiers = total_interets_foncier + total_interets_accompagnement + total_commission + frais_dossier;

    console.log('Frais financiers calculés:', {
      total_interets_foncier,
      total_interets_accompagnement,
      total_commission,
      frais_dossier,
      total_couts_financiers
    });

    // --- Calcul du prix de revient ---
    const prix_revient = total_acquisition + total_travaux + total_divers + total_couts_financiers;

    // --- Vérification du financement suffisant (pour tout le projet) ---
    const financement_suffisant = financement_total >= prix_revient;

    // --- Calcul des résultats principaux ---
    const marge_brute = prix_fai - prix_revient;
    const marge_nette = prix_hfa - prix_revient;
    const rentabilite = (marge_nette / prix_revient) * 100;
    const cash_flow_mensuel = (prix_hfa - prix_revient) / duree_projet;
    const tri = calculateTRI([
      -prix_revient,
      ...Array(duree_projet).fill(cash_flow_mensuel),
      prix_hfa - prix_revient
    ]);

    // --- Préparation des résultats selon la nouvelle structure ---
    const synthese_couts = [
      { categorie: 'Acquisition', montant: total_acquisition },
      { categorie: 'Travaux', montant: total_travaux },
      { categorie: 'Divers', montant: total_divers },
      { categorie: 'Financiers', montant: total_couts_financiers }
    ];
    const synthese_couts_total = total_acquisition + total_travaux + total_divers + total_couts_financiers;

    const results: BusinessPlanResults & { financement_suffisant: boolean } = {
      resultats: {
        prix_revient,
        marge_brute,
        commission: frais_agence_vente,
        marge_nette,
        rentabilite,
        cash_flow_mensuel,
        tri,
        date_vente: date_vente.toISOString().split('T')[0],
        prix_fai,
        prix_hfa
      },
      prix_m2: {
        prix_achat_pondere_m2: safeDiv(prix_achat, surface_ponderee_avant_travaux),
        prix_achat_carrez_m2: safeDiv(prix_achat, surface_carrez_avant_travaux),
        prix_revient_pondere_m2: safeDiv(prix_revient, surface_ponderee_apres_travaux),
        prix_revient_carrez_m2: safeDiv(prix_revient, surface_carrez_apres_travaux),
        prix_vente_pondere_m2: safeDiv(prix_fai, surface_ponderee_apres_travaux),
        prix_vente_carrez_m2: safeDiv(prix_fai, surface_carrez_apres_travaux)
      },
      prorata: {
        acquisition: (total_acquisition / prix_revient) * 100,
        travaux: (total_travaux / prix_revient) * 100,
        financement: (total_couts_financiers / prix_revient) * 100,
        frais_divers: (total_divers / prix_revient) * 100
      },
      couts_acquisition: {
        prix_achat: prix_achat,
        frais_notaire_output_amount: frais_notaire,
        frais_agence_achat_output_amount: frais_agence,
        total_acquisition: prix_achat + frais_notaire + frais_agence
      },
      couts_travaux: {
        total_output_amount: cout_travaux_total,
        maitrise_oeuvre_output_amount: cout_maitrise_oeuvre,
        alea_output_amount: cout_aleas,
        terrasse_output_amount: cout_amenagement_terrasse,
        mobilier_output_amount: mobilier,
        demolition_output_amount: cout_demolition,
        honoraires_tech_output_amount: honoraires_techniques,
        total_travaux: base_travaux + cout_aleas + cout_maitrise_oeuvre
      },
      couts_divers: {
        honoraires_tech_output_amount: honoraires_techniques,
        prorata_foncier_output_amount: prorata_foncier,
        diagnostics_output_amount: diagnostics,
        total_divers: honoraires_techniques + prorata_foncier + diagnostics
      },
      couts_total: prix_revient,
      financement: {
        montants: {
          credit_foncier_output_amount: credit_foncier,
          fonds_propres_output_amount: fonds_propres,
          credit_accompagnement_output_amount: credit_accompagnement,
          total_montants_alloues: credit_foncier + fonds_propres + credit_accompagnement
        },
        montants_utilises: {
          credit_foncier_output_amount: credit_foncier_utilise_total,
          fonds_propres_output_amount: fonds_propres_utilise_total,
          credit_accompagnement_output_amount: credit_accomp_utilise_total,
          total_montants_utilises: credit_foncier_utilise_total + fonds_propres_utilise_total + credit_accomp_utilise_total
        },
        couts: {
          interets_pret_output_amount: total_interets_foncier + total_interets_accompagnement,
          commission_accompagnement_output_amount: total_commission,
          frais_dossier_output_amount: frais_dossier,
          total_couts_financiers: total_interets_foncier + total_interets_accompagnement + total_commission + frais_dossier
        },
        mensualites: {
          credit_foncier_output_amount: calculateMonthlyPayment(credit_foncier, taux_credit, duree_projet),
          credit_accompagnement_output_amount: calculateMonthlyPayment(credit_accompagnement, taux_credit, duree_projet),
          total_mensualites: calculateMonthlyPayment(credit_foncier + credit_accompagnement, taux_credit, duree_projet)
        }
      },
      frais: {
        frais_notaire_output_amount: frais_notaire,
        frais_agence_achat_output_amount: frais_agence,
        frais_agence_vente_output_amount: frais_agence_vente,
        frais_dossier_output_amount: frais_dossier,
        total_frais: frais_notaire + frais_agence + frais_agence_vente + frais_dossier
      },
      trimestre_details,
      // Ajout synthèse des coûts
      synthese_couts,
      synthese_couts_total,
      financement_suffisant
    };

    console.log('Résultats finaux:', JSON.stringify(results, null, 2));
    console.log('=== Fin du calcul des résultats ===');

    return results;
  } catch (error) {
    console.error('Erreur lors du calcul des résultats:', error);
    throw error;
  }
}; 