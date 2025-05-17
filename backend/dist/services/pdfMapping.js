"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfMapping = void 0;
exports.getValueFromPath = getValueFromPath;
exports.mapProjectToPDFData = mapProjectToPDFData;
const QuickChart = require('quickchart-js');
exports.pdfMapping = {
    // Données de base
    'project_title': {
        source: 'projectTitle',
        defaultValue: 'Sans titre'
    },
    'adresse': {
        source: 'adresseBien',
        defaultValue: ''
    },
    'lien_annonce': {
        source: 'lienAnnonce',
        defaultValue: ''
    },
    'subtitle': {
        source: 'inputsGeneral.subtitle',
        defaultValue: ''
    },
    'contact_name_1': {
        source: 'inputsGeneral.contact_name_1',
        defaultValue: ''
    },
    'contact_email_1': {
        source: 'inputsGeneral.contact_email_1',
        defaultValue: ''
    },
    'contact_tel_1': {
        source: 'inputsGeneral.contact_tel_1',
        defaultValue: ''
    },
    'contact_name_2': {
        source: 'inputsGeneral.contact_name_2',
        defaultValue: ''
    },
    'contact_email_2': {
        source: 'inputsGeneral.contact_email_2',
        defaultValue: ''
    },
    'contact_tel_2': {
        source: 'inputsGeneral.contact_tel_2',
        defaultValue: ''
    },
    // Données générales
    'superficie': {
        source: 'inputsGeneral.superficie',
        defaultValue: 0
    },
    'superficie_terrasse': {
        source: 'inputsGeneral.superficie_terrasse',
        defaultValue: 0
    },
    'ponderation_terrasse': {
        source: 'inputsGeneral.ponderation_terrasse',
        defaultValue: 0
    },
    'superficie_totale': {
        source: 'inputsGeneral.surface_totale',
        defaultValue: 0
    },
    // Données DVF (corrigé)
    'rayon': {
        source: 'inputsDvf.rayon',
        defaultValue: '0 m',
        transform: (value) => value !== undefined && value !== null ? `${Math.round(value * 1000)} m` : '0 m'
    },
    'prix_min': {
        source: 'inputsDvf.prixMin',
        defaultValue: 0
    },
    'outlier_lower_bound_percent': {
        source: 'inputsDvf.outlierLowerBoundPercent',
        defaultValue: 0
    },
    'outlier_upper_bound_coeff': {
        source: 'inputsDvf.outlierUpperBoundCoeff',
        defaultValue: 0
    },
    'weighted_avg_price_m2': {
        source: 'resultsDvf.dvfResults.arr_final_avg',
        defaultValue: 0
    },
    'premium_avg': {
        source: 'resultsDvf.dvfResults.premium_final_avg',
        defaultValue: 0
    },
    'lat': {
        source: 'latitude',
        defaultValue: 0
    },
    'lng': {
        source: 'longitude',
        defaultValue: 0
    },
    'description_quartier': {
        source: 'inputsGeneral.description_quartier',
        defaultValue: ''
    },
    'dvf_arr_final_avg': {
        source: 'resultsDvf.dvfResults.arr_final_avg',
        defaultValue: 0
    },
    'dvf_sel_final_avg': {
        source: 'resultsDvf.dvfResults.sel_final_avg',
        defaultValue: 0
    },
    'dvf_premium_final_avg': {
        source: 'resultsDvf.dvfResults.premium_final_avg',
        defaultValue: 0
    },
    'dvf_outlier_lower_bound': {
        source: 'resultsDvf.dvfResults.outlier_lower_bound',
        defaultValue: 0
    },
    'dvf_outlier_upper_bound': {
        source: 'resultsDvf.dvfResults.outlier_upper_bound',
        defaultValue: 0
    },
    'dvf_arrondissement_avg_for_outliers': {
        source: 'resultsDvf.dvfResults.arrondissement_avg_for_outliers',
        defaultValue: 0
    },
    // === BUSINESS PLAN (inputs & résultats) ===
    // --- Inputs Business Plan ---
    'prix_achat': { source: 'inputsBusinessPlan.prix_achat', defaultValue: 0 },
    'prix_affiche': { source: 'inputsBusinessPlan.prix_affiche', defaultValue: 0 },
    'frais_notaire': { source: 'inputsBusinessPlan.frais_notaire', defaultValue: 0 },
    'frais_agence': { source: 'inputsBusinessPlan.frais_agence', defaultValue: 0 },
    'frais_agence_vente': { source: 'inputsBusinessPlan.frais_agence_vente', defaultValue: 0 },
    'frais_dossier': { source: 'inputsBusinessPlan.frais_dossier', defaultValue: 0 },
    'cout_travaux': { source: 'inputsBusinessPlan.cout_travaux', defaultValue: 0 },
    'salaire_maitrise': { source: 'inputsBusinessPlan.salaire_maitrise', defaultValue: 0 },
    'alea_travaux': { source: 'inputsBusinessPlan.alea_travaux', defaultValue: 0 },
    'amenagement_terrasse': { source: 'inputsBusinessPlan.amenagement_terrasse', defaultValue: 0 },
    'demolition': { source: 'inputsBusinessPlan.demolition', defaultValue: 0 },
    'honoraires_techniques': { source: 'inputsBusinessPlan.honoraires_techniques', defaultValue: 0 },
    'prorata_foncier': { source: 'inputsBusinessPlan.prorata_foncier', defaultValue: 0 },
    'diagnostics': { source: 'inputsBusinessPlan.diagnostics', defaultValue: 0 },
    'mobilier': { source: 'inputsBusinessPlan.mobilier', defaultValue: 0 },
    'credit_foncier': { source: 'inputsBusinessPlan.credit_foncier', defaultValue: 0 },
    'fonds_propres': { source: 'inputsBusinessPlan.fonds_propres', defaultValue: 0 },
    'credit_accompagnement_total': { source: 'inputsBusinessPlan.credit_accompagnement_total', defaultValue: 0 },
    'taux_credit': { source: 'inputsBusinessPlan.taux_credit', defaultValue: 0 },
    'commission_rate': { source: 'inputsBusinessPlan.commission_rate', defaultValue: 0 },
    'duree_projet': { source: 'inputsBusinessPlan.duree_projet', defaultValue: 0 },
    'date_achat': { source: 'inputsBusinessPlan.date_achat', defaultValue: '' },
    'date_vente': { source: 'inputsBusinessPlan.date_vente', defaultValue: '' },
    'prix_benchmark': { source: 'resultsDvf.dvfResults.sel_final_avg', defaultValue: 0 },
    'ponderation': { source: 'resultsDescriptionBien.coef_ponderation', defaultValue: 1 },
    // --- Prix au m² (prix_m2) ---
    'prix_m2_prix_achat_carrez_m2': { source: 'resultsBusinessPlan.prix_m2.prix_achat_carrez_m2', defaultValue: 0 },
    'prix_m2_prix_vente_carrez_m2': { source: 'resultsBusinessPlan.prix_m2.prix_vente_carrez_m2', defaultValue: 0 },
    'prix_m2_prix_achat_pondere_m2': { source: 'resultsBusinessPlan.prix_m2.prix_achat_pondere_m2', defaultValue: 0 },
    'prix_m2_prix_vente_pondere_m2': { source: 'resultsBusinessPlan.prix_m2.prix_vente_pondere_m2', defaultValue: 0 },
    'prix_m2_prix_revient_carrez_m2': { source: 'resultsBusinessPlan.prix_m2.prix_revient_carrez_m2', defaultValue: 0 },
    'prix_m2_prix_revient_pondere_m2': { source: 'resultsBusinessPlan.prix_m2.prix_revient_pondere_m2', defaultValue: 0 },
    // --- Résultats principaux (resultats) ---
    'resultats_tri': { source: 'resultsBusinessPlan.resultats.tri', defaultValue: 0 },
    'resultats_date_vente': { source: 'resultsBusinessPlan.resultats.date_vente', defaultValue: '' },
    'resultats_marge_brute': { source: 'resultsBusinessPlan.resultats.marge_brute', defaultValue: 0 },
    'resultats_marge_nette': { source: 'resultsBusinessPlan.resultats.marge_nette', defaultValue: 0 },
    'resultats_rentabilite': { source: 'resultsBusinessPlan.resultats.rentabilite', defaultValue: 0 },
    'resultats_prix_revient': { source: 'resultsBusinessPlan.resultats.prix_revient', defaultValue: 0 },
    'resultats_prix_vente_fai': { source: 'resultsBusinessPlan.resultats.prix_vente_fai', defaultValue: 0 },
    'resultats_prix_vente_hfa': { source: 'resultsBusinessPlan.resultats.prix_vente_hfa', defaultValue: 0 },
    'resultats_cash_flow_mensuel': { source: 'resultsBusinessPlan.resultats.cash_flow_mensuel', defaultValue: 0 },
    // --- Financement (financement, financement.details, financement.sources) ---
    'financement_total': { source: 'resultsBusinessPlan.financement.total', defaultValue: 0 },
    'financement_details_fonds_propres_montant_utilise': { source: 'resultsBusinessPlan.financement.details.fonds_propres.montant_utilise', defaultValue: 0 },
    'financement_details_credit_foncier_montant_utilise': { source: 'resultsBusinessPlan.financement.details.credit_foncier.montant_utilise', defaultValue: 0 },
    'financement_details_credit_foncier_interets': { source: 'resultsBusinessPlan.financement.details.credit_foncier.interets', defaultValue: 0 },
    'financement_details_credit_accompagnement_montant_utilise': { source: 'resultsBusinessPlan.financement.details.credit_accompagnement.montant_utilise', defaultValue: 0 },
    'financement_details_credit_accompagnement_interets': { source: 'resultsBusinessPlan.financement.details.credit_accompagnement.interets', defaultValue: 0 },
    'financement_details_credit_accompagnement_commission_montant': { source: 'resultsBusinessPlan.financement.details.credit_accompagnement.commission_montant', defaultValue: 0 },
    'credit_total_utilise': {
        source: 'resultsBusinessPlan.financement.details',
        transform: (details) => {
            var _a, _b;
            if (!details)
                return 0;
            return (((_a = details.credit_foncier) === null || _a === void 0 ? void 0 : _a.montant_utilise) || 0) + (((_b = details.credit_accompagnement) === null || _b === void 0 ? void 0 : _b.montant_utilise) || 0);
        },
        defaultValue: 0
    },
    'fonds_propres_utilises': {
        source: 'resultsBusinessPlan.financement.details.fonds_propres.montant_utilise',
        defaultValue: 0
    },
    'financement_bancaire_pct': {
        source: 'resultsBusinessPlan.financement.details',
        transform: (details) => {
            var _a, _b, _c;
            if (!details)
                return 0;
            const credit = (((_a = details.credit_foncier) === null || _a === void 0 ? void 0 : _a.montant_utilise) || 0) + (((_b = details.credit_accompagnement) === null || _b === void 0 ? void 0 : _b.montant_utilise) || 0);
            const fonds = ((_c = details.fonds_propres) === null || _c === void 0 ? void 0 : _c.montant_utilise) || 0;
            const total = credit + fonds;
            if (total === 0)
                return 0;
            return Math.round((credit / total) * 100);
        },
        defaultValue: 0
    },
    'fonds_propres_pct': {
        source: 'resultsBusinessPlan.financement.details',
        transform: (details) => {
            var _a, _b, _c;
            if (!details)
                return 0;
            const credit = (((_a = details.credit_foncier) === null || _a === void 0 ? void 0 : _a.montant_utilise) || 0) + (((_b = details.credit_accompagnement) === null || _b === void 0 ? void 0 : _b.montant_utilise) || 0);
            const fonds = ((_c = details.fonds_propres) === null || _c === void 0 ? void 0 : _c.montant_utilise) || 0;
            const total = credit + fonds;
            if (total === 0)
                return 0;
            return Math.round((fonds / total) * 100);
        },
        defaultValue: 0
    },
    // --- Détail des coûts (detail_couts) ---
    'detail_couts_divers_total': { source: 'resultsBusinessPlan.detail_couts.divers.total', defaultValue: 0 },
    'detail_couts_divers_diagnostics': { source: 'resultsBusinessPlan.detail_couts.divers.diagnostics', defaultValue: 0 },
    'detail_couts_divers_prorata_foncier': { source: 'resultsBusinessPlan.detail_couts.divers.prorata_foncier', defaultValue: 0 },
    'detail_couts_divers_honoraires_techniques': { source: 'resultsBusinessPlan.detail_couts.divers.honoraires_techniques', defaultValue: 0 },
    'detail_couts_travaux_aleas': { source: 'resultsBusinessPlan.detail_couts.travaux.aleas', defaultValue: 0 },
    'detail_couts_travaux_total': { source: 'resultsBusinessPlan.detail_couts.travaux.total', defaultValue: 0 },
    'detail_couts_travaux_mobilier': { source: 'resultsBusinessPlan.detail_couts.travaux.mobilier', defaultValue: 0 },
    'detail_couts_travaux_demolition': { source: 'resultsBusinessPlan.detail_couts.travaux.demolition', defaultValue: 0 },
    'detail_couts_travaux_cout_travaux': { source: 'resultsBusinessPlan.detail_couts.travaux.cout_travaux', defaultValue: 0 },
    'detail_couts_travaux_maitrise_oeuvre': { source: 'resultsBusinessPlan.detail_couts.travaux.maitrise_oeuvre', defaultValue: 0 },
    'detail_couts_travaux_amenagement_terrasse': { source: 'resultsBusinessPlan.detail_couts.travaux.amenagement_terrasse', defaultValue: 0 },
    'detail_couts_acquisition_total': { source: 'resultsBusinessPlan.detail_couts.acquisition.total', defaultValue: 0 },
    'detail_couts_acquisition_prix_achat': { source: 'resultsBusinessPlan.detail_couts.acquisition.prix_achat', defaultValue: 0 },
    'detail_couts_acquisition_frais_agence_montant': { source: 'resultsBusinessPlan.detail_couts.acquisition.frais_agence_montant', defaultValue: 0 },
    'detail_couts_acquisition_frais_notaire_montant': { source: 'resultsBusinessPlan.detail_couts.acquisition.frais_notaire_montant', defaultValue: 0 },
    'detail_couts_financement_total': { source: 'resultsBusinessPlan.detail_couts.financement.total', defaultValue: 0 },
    'detail_couts_financement_frais_dossier': { source: 'resultsBusinessPlan.detail_couts.financement.frais_dossier', defaultValue: 0 },
    'detail_couts_financement_interets_foncier': { source: 'resultsBusinessPlan.detail_couts.financement.interets_foncier', defaultValue: 0 },
    'detail_couts_financement_interets_accompagnement': { source: 'resultsBusinessPlan.detail_couts.financement.interets_accompagnement', defaultValue: 0 },
    'detail_couts_financement_commission_accompagnement': { source: 'resultsBusinessPlan.detail_couts.financement.commission_accompagnement', defaultValue: 0 },
    // --- Répartition des coûts (repartition_couts) ---
    'repartition_couts_total': { source: 'resultsBusinessPlan.repartition_couts.total', defaultValue: 0 },
    'repartition_couts_divers_montant': { source: 'resultsBusinessPlan.repartition_couts.divers.montant', defaultValue: 0 },
    'repartition_couts_divers_pourcentage': { source: 'resultsBusinessPlan.repartition_couts.divers.pourcentage', defaultValue: 0 },
    'repartition_couts_travaux_montant': { source: 'resultsBusinessPlan.repartition_couts.travaux.montant', defaultValue: 0 },
    'repartition_couts_travaux_pourcentage': { source: 'resultsBusinessPlan.repartition_couts.travaux.pourcentage', defaultValue: 0 },
    'repartition_couts_acquisition_montant': { source: 'resultsBusinessPlan.repartition_couts.acquisition.montant', defaultValue: 0 },
    'repartition_couts_acquisition_pourcentage': { source: 'resultsBusinessPlan.repartition_couts.acquisition.pourcentage', defaultValue: 0 },
    'repartition_couts_financement_montant': { source: 'resultsBusinessPlan.repartition_couts.financement.montant', defaultValue: 0 },
    'repartition_couts_financement_pourcentage': { source: 'resultsBusinessPlan.repartition_couts.financement.pourcentage', defaultValue: 0 },
    // --- Détail par trimestre ---
    'trimestre_details': { source: 'resultsBusinessPlan.trimestre_details', defaultValue: [] },
    // --- Prorata et calculs spécifiques (corrigé pour pointer vers les résultats calculés) ---
    'prorata_acquisition': { source: 'resultsBusinessPlan.prorata.acquisition', defaultValue: 0 },
    'prorata_travaux': { source: 'resultsBusinessPlan.prorata.travaux', defaultValue: 0 },
    'prorata_financement': { source: 'resultsBusinessPlan.prorata.financement', defaultValue: 0 },
    'prorata_frais_divers': { source: 'resultsBusinessPlan.prorata.frais_divers', defaultValue: 0 },
    'commission_achat': { source: 'resultsBusinessPlan.detail_couts.acquisition.frais_agence_montant', defaultValue: 0 },
    'frais_notaire_calc': { source: 'resultsBusinessPlan.detail_couts.acquisition.frais_notaire_montant', defaultValue: 0 },
    'interieur_habitable': { source: 'resultsBusinessPlan.detail_couts.travaux.cout_travaux', defaultValue: 0 },
    'moe_maitrise_suivi': { source: 'resultsBusinessPlan.detail_couts.travaux.maitrise_oeuvre', defaultValue: 0 },
    'alea_calc': { source: 'resultsBusinessPlan.detail_couts.travaux.aleas', defaultValue: 0 },
    'total_jours': { source: 'resultsBusinessPlan.total_jours', defaultValue: 0 },
    'total_credit_foncier_utilise': { source: 'resultsBusinessPlan.total_credit_foncier_utilise', defaultValue: 0 },
    'total_fonds_propres_utilise': { source: 'resultsBusinessPlan.total_fonds_propres_utilise', defaultValue: 0 },
    'total_credit_accompagnement_utilise': { source: 'resultsBusinessPlan.total_credit_accompagnement_utilise', defaultValue: 0 },
    'total_interets_foncier': { source: 'resultsBusinessPlan.total_interets_foncier', defaultValue: 0 },
    'total_interets_accompagnement': { source: 'resultsBusinessPlan.total_interets_accompagnement', defaultValue: 0 },
    'total_commission_accompagnement': { source: 'resultsBusinessPlan.total_commission_accompagnement', defaultValue: 0 },
    'total_cout_financier_trimestre': { source: 'resultsBusinessPlan.total_cout_financier_trimestre', defaultValue: 0 },
    // Description du bien
    'type_bien': {
        source: 'inputsDescriptionBien.type_bien',
        defaultValue: ''
    },
    'nombre_pieces': {
        source: 'inputsDescriptionBien.nombre_pieces',
        defaultValue: 0
    },
    'nombre_chambres': {
        source: 'inputsDescriptionBien.nombre_chambres',
        defaultValue: 0
    },
    'etage': {
        source: 'inputsDescriptionBien.etage',
        defaultValue: 0
    },
    'theme': {
        source: 'inputsDescriptionBien.theme',
        defaultValue: ''
    },
    'renovation_explain': {
        source: 'inputsDescriptionBien.renovation_explain',
        defaultValue: ''
    },
    'renovation_explain_2': {
        source: 'inputsDescriptionBien.renovation_explain_2',
        defaultValue: ''
    },
    // Points forts/faibles
    'potentiel_amelioration': {
        source: 'resultsDescriptionBien.potentiel_amelioration',
        defaultValue: []
    },
    'points_forts': {
        source: 'resultsDescriptionBien.points_forts',
        defaultValue: []
    },
    'points_faibles': {
        source: 'resultsDescriptionBien.points_faibles',
        defaultValue: []
    },
    'travaux_suggeres': {
        source: 'resultsDescriptionBien.travaux_suggeres',
        defaultValue: []
    },
    'atouts': {
        source: 'resultsDescriptionBien.atouts',
        defaultValue: ''
    },
    // Photos
    'photos_before': {
        source: 'photosBefore',
        defaultValue: []
    },
    'photos_after': {
        source: 'photosAfter',
        defaultValue: []
    },
    'photos_during': {
        source: 'photosDuring',
        defaultValue: []
    },
    'photos_3d': {
        source: 'photos3d',
        defaultValue: []
    },
    'cover_photo': {
        source: 'coverPhoto',
        defaultValue: ''
    },
    'image1': {
        source: 'photosBefore[0]',
        defaultValue: ''
    },
    'image2': {
        source: 'photosBefore[1]',
        defaultValue: ''
    },
    'image3': {
        source: 'photosBefore[2]',
        defaultValue: ''
    },
    'image4': {
        source: 'photosBefore[3]',
        defaultValue: ''
    },
    'plan': {
        source: 'photos3d[0]',
        defaultValue: ''
    },
    'image3d1': {
        source: 'photos3d[1]',
        defaultValue: ''
    },
    'image3d2': {
        source: 'photos3d[2]',
        defaultValue: ''
    },
    'image3d3': {
        source: 'photos3d[3]',
        defaultValue: ''
    },
    // Variables dynamiques
    'description_general': { source: 'pdfConfig.description_general', defaultValue: '' },
    'titre_renovation': { source: 'pdfConfig.titre_renovation', defaultValue: '' },
    'projet_renovation': { source: 'pdfConfig.projet_renovation', defaultValue: '' },
    'detail_renovation': { source: 'pdfConfig.detail_renovation', defaultValue: '' },
    'sous_titre_projet': { source: 'pdfConfig.sous_titre_projet', defaultValue: '' },
    'contact1_nom': { source: 'pdfConfig.contact1_nom', defaultValue: '' },
    'contact1_email': { source: 'pdfConfig.contact1_email', defaultValue: '' },
    'contact1_tel': { source: 'pdfConfig.contact1_tel', defaultValue: '' },
    'contact2_nom': { source: 'pdfConfig.contact2_nom', defaultValue: '' },
    'contact2_email': { source: 'pdfConfig.contact2_email', defaultValue: '' },
    'contact2_tel': { source: 'pdfConfig.contact2_tel', defaultValue: '' },
    'prix_revient_terrasse_m2': { source: 'resultsBusinessPlan.prix_m2.prix_revient_terrasse_m2', defaultValue: 0 },
    // Ajout des compteurs de transactions
    'total_arrondissement_transactions': {
        source: 'resultsDvf.trendSeries',
        defaultValue: 0,
        transform: (trendSeries) => {
            if (!trendSeries || !trendSeries.length)
                return 0;
            return trendSeries.reduce((sum, year) => sum + (year.arrondissement_count || 0), 0);
        }
    },
    'selection_cleaned_transactions': {
        source: 'resultsDvf.trendSeries',
        defaultValue: 0,
        transform: (trendSeries) => {
            if (!trendSeries || !trendSeries.length)
                return 0;
            return trendSeries.reduce((sum, year) => sum + (year.selection_count || 0), 0);
        }
    },
    'total_premium_transactions': {
        source: 'resultsDvf.trendSeries',
        defaultValue: 0,
        transform: (trendSeries) => {
            if (!trendSeries || !trendSeries.length)
                return 0;
            return trendSeries.reduce((sum, year) => sum + (year.premium_count || 0), 0);
        }
    },
    'dvf_table_html': {
        source: 'resultsDvf.dvfProperties',
        defaultValue: '',
        transform: (dvfProperties) => {
            if (!Array.isArray(dvfProperties))
                return '';
            // Tri décroissant par date
            const sorted = [...dvfProperties].sort((a, b) => {
                // Dates au format YYYY-MM-DD
                return (b.date_mutation || '').localeCompare(a.date_mutation || '');
            });
            const formatKCurrency = (value, decimals = 0) => {
                if (typeof value !== 'number' || isNaN(value))
                    return 'N/A';
                return (Math.round(value / 1000 * Math.pow(10, decimals)) / Math.pow(10, decimals))
                    .toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            };
            return sorted.slice(0, 30).map((prop) => {
                var _a;
                return `
        <tr class="${prop.is_outlier ? 'outlier-row' : ''}">
          <td class="col-date">${prop.date_mutation || 'N/A'}</td>
          <td class="col-adresse">${prop.adresse_numero || ''} ${prop.adresse_nom_voie || 'Inconnu'}</td>
          <td class="col-cp">${prop.code_postal || 'N/A'}</td>
          <td class="col-valeur">${formatKCurrency(prop.valeur_fonciere, 0)}</td>
          <td class="col-pieces">${(_a = prop.nombre_pieces_principales) !== null && _a !== void 0 ? _a : 'N/A'}</td>
          <td class="col-surface">${prop.surface_reelle_bati ? Math.round(prop.surface_reelle_bati) : 'N/A'}</td>
          <td class="col-prixm2">${formatKCurrency(prop.prix_m2, 2)}</td>
        </tr>
      `;
            }).join('\n');
        }
    },
    'trend_table_html': {
        source: 'resultsDvf.trendSeries',
        defaultValue: '',
        transform: (trendSeries) => {
            if (!Array.isArray(trendSeries))
                return '';
            const formatKCurrency = (value, decimals = 2) => {
                if (typeof value !== 'number' || isNaN(value))
                    return 'N/A';
                return (Math.round(value / 1000 * Math.pow(10, decimals)) / Math.pow(10, decimals))
                    .toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
            };
            return trendSeries.map(trend => `
        <tr>
          <td>${trend.year || ''}</td>
          <td>${formatKCurrency(trend.selection_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.selection_count || 0})</span></td>
          <td>${formatKCurrency(trend.arrondissement_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.arrondissement_count || 0})</span></td>
          <td>${formatKCurrency(trend.premium_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.premium_count || 0})</span></td>
        </tr>
      `).join('\n');
        }
    },
    'trend_chart_url': {
        source: 'resultsDvf.trendSeries',
        defaultValue: '',
        transform: (trendSeries) => {
            if (!Array.isArray(trendSeries) || !trendSeries.length)
                return '';
            const chart = new QuickChart();
            chart.setConfig({
                type: 'line',
                data: {
                    labels: trendSeries.map(t => t.year),
                    datasets: [
                        {
                            label: 'Sélection',
                            data: trendSeries.map(t => t.selection_avg / 1000),
                            borderColor: '#5C4033',
                            fill: false,
                        },
                        {
                            label: 'Arrondissement',
                            data: trendSeries.map(t => t.arrondissement_avg / 1000),
                            borderColor: '#bfa77a',
                            fill: false,
                        },
                        {
                            label: 'Premium (Top 10%)',
                            data: trendSeries.map(t => t.premium_avg / 1000),
                            borderColor: '#c97c2b',
                            fill: false,
                        },
                    ],
                },
                options: {
                    plugins: { title: { display: true, text: 'Évolution des prix/m² (2019-2024)' } },
                    scales: {
                        y: { title: { display: true, text: 'Prix (k€)' } },
                        x: { title: { display: true, text: 'Année' } }
                    }
                }
            });
            chart.setWidth(600).setHeight(300).setBackgroundColor('transparent');
            return chart.getUrl();
        }
    },
    'distribution_chart_url': {
        source: 'resultsDvf.distributionSeries',
        defaultValue: '',
        transform: (distributionSeries) => {
            if (!Array.isArray(distributionSeries) || !distributionSeries.length)
                return '';
            const chart = new QuickChart();
            chart.setConfig({
                type: 'bar',
                data: {
                    labels: distributionSeries.map(d => d.price_bin),
                    datasets: [
                        {
                            label: 'Nombre de transactions',
                            data: distributionSeries.map(d => d.count),
                            backgroundColor: '#bfa77a',
                        },
                    ],
                },
                options: {
                    plugins: { title: { display: true, text: 'Nombre de transactions par groupe de prix' } },
                    scales: {
                        y: { title: { display: true, text: 'Nombre de transactions' } },
                        x: { title: { display: true, text: 'Prix/m² (k€)' } }
                    }
                }
            });
            chart.setWidth(600).setHeight(300).setBackgroundColor('transparent');
            return chart.getUrl();
        }
    },
};
function getValueFromPath(obj, path) {
    return path.split('.').reduce((current, key) => current === null || current === void 0 ? void 0 : current[key], obj);
}
function mapProjectToPDFData(project) {
    const result = {};
    console.log('[DEBUG RAYON] Projet complet:', JSON.stringify(project, null, 2));
    for (const [key, mapping] of Object.entries(exports.pdfMapping)) {
        let value = getValueFromPath(project, mapping.source);
        // Debug logs pour le rayon
        if (key === 'rayon') {
            console.log('[DEBUG RAYON] Source path:', mapping.source);
            console.log('[DEBUG RAYON] Valeur initiale:', value);
            console.log('[DEBUG RAYON] Type:', typeof value);
            console.log('[DEBUG RAYON] Project inputsDvf:', project.inputsDvf);
        }
        // Appliquer la transformation si elle existe et si la valeur n'est pas undefined
        if (value !== undefined && mapping.transform) {
            try {
                value = mapping.transform(value);
                // Debug logs pour le rayon après transformation
                if (key === 'rayon') {
                    console.log('[DEBUG RAYON] Après transformation:', value);
                }
            }
            catch (error) {
                console.error(`Error transforming ${key}:`, error);
                value = mapping.defaultValue;
            }
        }
        // Utiliser la valeur transformée ou la valeur par défaut
        result[key] = value !== undefined ? value : mapping.defaultValue;
        // Debug logs pour le rayon final
        if (key === 'rayon') {
            console.log('[DEBUG RAYON] Valeur finale dans le mapping:', result[key]);
        }
    }
    console.log('[DEBUG RAYON] Données finales complètes:', result);
    return result;
}
