"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBusinessPlan = void 0;
const cleanNumeric = (value, defaultValue = 0) => {
    if (value === null || value === undefined)
        return defaultValue;
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? defaultValue : num;
    }
    return defaultValue;
};
const calculateMonthlyPayment = (principal, annualRate, months) => {
    if (months === 0 || annualRate === 0)
        return 0;
    const monthlyRate = annualRate / 12 / 100;
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
};
const calculateTRI = (cashFlows) => {
    const npv = (rate) => {
        return cashFlows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + rate, i), 0);
    };
    let left = -0.99, right = 1.0;
    while (right - left > 1e-6) {
        const mid = (left + right) / 2;
        if (npv(mid) > 0) {
            left = mid;
        }
        else {
            right = mid;
        }
    }
    return (left + right) / 2 * 100;
};
const calculateBusinessPlan = async (req, res) => {
    var _a, _b;
    try {
        const data = req.body;
        console.log('Données reçues:', JSON.stringify(data, null, 2));
        // Validation et nettoyage des données
        const surface_totale = data.surface_totale;
        if (typeof surface_totale !== 'number' || isNaN(surface_totale) || surface_totale <= 0) {
            return res.status(400).json({ error: "surface_totale doit être fournie dans les données et > 0" });
        }
        const surface = cleanNumeric(data.surface);
        const surface_terrasse = cleanNumeric(data.surface_terrasse);
        const ponderation_terrasse = cleanNumeric(data.ponderation_terrasse, 0.3);
        const prix_achat = cleanNumeric(data.prix_achat);
        const prix_affiche = cleanNumeric(data.prix_affiche) || prix_achat * 1.2;
        const duree_projet = cleanNumeric(data.duree_projet, 365);
        // Validation améliorée
        if (isNaN(surface) || surface <= 0) {
            return res.status(400).json({ error: "La surface doit être un nombre supérieur à 0" });
        }
        if (isNaN(prix_achat) || prix_achat <= 0) {
            return res.status(400).json({ error: "Le prix d'achat doit être un nombre supérieur à 0" });
        }
        if (isNaN(duree_projet) || duree_projet <= 0) {
            return res.status(400).json({ error: "La durée du projet doit être un nombre supérieur à 0" });
        }
        // --- Calcul des coûts de travaux ---
        const cout_travaux = cleanNumeric(data.cout_travaux);
        const cout_travaux_total = surface * cout_travaux;
        const salaire_maitrise = cleanNumeric(data.salaire_maitrise);
        const alea_travaux = cleanNumeric(data.alea_travaux);
        const cout_maitrise_oeuvre = cout_travaux_total * (salaire_maitrise / 100);
        const cout_aleas = cout_travaux_total * (alea_travaux / 100);
        const cout_amenagement_terrasse = cleanNumeric(data.amenagement_terrasse);
        const mobilier = cleanNumeric(data.mobilier);
        const cout_demolition = cleanNumeric(data.demolition);
        // --- Calcul des frais ---
        const frais_notaire = prix_achat * (cleanNumeric(data.frais_notaire) / 100);
        const frais_agence = prix_achat * (cleanNumeric(data.frais_agence) / 100);
        const frais_agence_vente = cleanNumeric(data.frais_agence_vente);
        const frais_dossier = cleanNumeric(data.frais_dossier);
        // --- Calcul des frais divers ---
        const honoraires_techniques = cleanNumeric(data.honoraires_techniques);
        const prorata_foncier = cleanNumeric(data.prorata_foncier);
        const diagnostics = cleanNumeric(data.diagnostics);
        // --- Calcul des totaux par catégorie (hors financement) ---
        const total_acquisition = prix_achat + frais_notaire + frais_agence;
        const total_travaux = cout_travaux_total + cout_maitrise_oeuvre + cout_aleas +
            cout_amenagement_terrasse + mobilier + cout_demolition;
        const total_divers = honoraires_techniques + prorata_foncier + diagnostics;
        // --- Calcul des prix au m² ---
        const prix_achat_pondere_m2 = prix_achat / surface_totale;
        const prix_achat_carrez_m2 = prix_achat / surface;
        // --- Calcul du prix de vente FAI et HFA selon la bonne formule ---
        const prix_benchmark = cleanNumeric(data.benchmark);
        const coef_ponderation = cleanNumeric(data.coef_ponderation, 1);
        const prix_vente_reel_pondere_m2 = (_a = data.prix_vente_reel_pondere_m2) !== null && _a !== void 0 ? _a : (_b = data.inputsBusinessPlan) === null || _b === void 0 ? void 0 : _b.prix_vente_reel_pondere_m2;
        const prix_vente_fai = (prix_vente_reel_pondere_m2 !== null && prix_vente_reel_pondere_m2 !== void 0 ? prix_vente_reel_pondere_m2 : (prix_benchmark * coef_ponderation)) * surface_totale;
        const prix_vente_hfa = prix_vente_fai / (1 + (frais_agence_vente / 100));
        // --- Calculs trimestriels ---
        const date_achat = new Date(data.date_achat || new Date());
        const date_vente = new Date(date_achat);
        date_vente.setDate(date_achat.getDate() + duree_projet);
        // Génération des trimestres
        const trimestres = [];
        let current_year = date_achat.getFullYear();
        while (new Date(current_year, 0, 1) <= date_vente) {
            for (let q = 1; q <= 4; q++) {
                const t_start = new Date(current_year, (q - 1) * 3, 1);
                const t_end = q < 4 ? new Date(current_year, q * 3, 0) : new Date(current_year, 11, 31);
                if (t_start > date_vente)
                    break;
                if (t_end < date_achat)
                    continue;
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
        const nb_trimestres = trimestres.length;
        const credit_foncier = cleanNumeric(data.credit_foncier);
        const fonds_propres = cleanNumeric(data.fonds_propres);
        const credit_accompagnement = cleanNumeric(data.credit_accompagnement_total);
        const taux_credit = cleanNumeric(data.taux_credit);
        const commission_rate = cleanNumeric(data.commission_rate);
        // Répartition des coûts par trimestre
        const travaux_par_trimestre = total_travaux / nb_trimestres;
        const honoraires_techniques_par_trimestre = honoraires_techniques / nb_trimestres;
        const prorata_foncier_par_trimestre = prorata_foncier / nb_trimestres;
        const diagnostics_par_trimestre = diagnostics / nb_trimestres;
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
        let commission_a_payer = 0;
        let total_interets_foncier = 0;
        let total_interets_accompagnement = 0;
        let total_commission = 0;
        // Fonction utilitaire pour financer une dépense dans l'ordre foncier > fonds propres > accompagnement
        function financer(montant) {
            let foncier = 0, fonds = 0, accomp = 0;
            if (credit_foncier_restant > 0) {
                foncier = Math.min(montant, credit_foncier_restant);
                credit_foncier_restant -= foncier;
                encours_foncier += foncier;
                credit_foncier_utilise_total += foncier;
                montant -= foncier;
            }
            if (montant > 0 && fonds_propres_restant > 0) {
                fonds = Math.min(montant, fonds_propres_restant);
                fonds_propres_restant -= fonds;
                encours_fonds_propres += fonds;
                fonds_propres_utilise_total += fonds;
                montant -= fonds;
            }
            if (montant > 0 && credit_accomp_restant > 0) {
                accomp = Math.min(montant, credit_accomp_restant);
                credit_accomp_restant -= accomp;
                encours_accompagnement += accomp;
                credit_accomp_utilise_total += accomp;
                montant -= accomp;
            }
            return { foncier, fonds, accomp };
        }
        // Calcul des détails trimestriels
        const trimestre_details = [];
        for (let i = 0; i < nb_trimestres; i++) {
            const trimestre = trimestres[i];
            const jours = trimestre.jours;
            // 1. Paiement des intérêts et commission générés le trimestre précédent
            let interets_foncier_payes = 0;
            let interets_accompagnement_payes = 0;
            let commission_payee = 0;
            let fp_foncier = 0, fp_fonds = 0, fp_accomp = 0;
            let fa_foncier = 0, fa_fonds = 0, fa_accomp = 0;
            let fc_foncier = 0, fc_fonds = 0, fc_accomp = 0;
            if (i > 0) {
                // Paiement des intérêts foncier
                let res = financer(interets_foncier_a_payer);
                fp_foncier = res.foncier;
                fp_fonds = res.fonds;
                fp_accomp = res.accomp;
                interets_foncier_payes = interets_foncier_a_payer;
                // Paiement des intérêts accompagnement
                res = financer(interets_accompagnement_a_payer);
                fa_foncier = res.foncier;
                fa_fonds = res.fonds;
                fa_accomp = res.accomp;
                interets_accompagnement_payes = interets_accompagnement_a_payer;
                // Paiement de la commission
                res = financer(commission_a_payer);
                fc_foncier = res.foncier;
                fc_fonds = res.fonds;
                fc_accomp = res.accomp;
                commission_payee = commission_a_payer;
            }
            // 2. Calcul du coût du trimestre (hors intérêts et commission)
            let commission_trimestre = (credit_foncier + credit_accompagnement) * (commission_rate / 100) * (jours / 365);
            let cout_trimestre = 0;
            if (i === 0) {
                cout_trimestre = prix_achat + frais_notaire + frais_agence + frais_dossier +
                    honoraires_techniques_par_trimestre + prorata_foncier_par_trimestre +
                    diagnostics_par_trimestre + travaux_par_trimestre;
            }
            else {
                cout_trimestre = travaux_par_trimestre + honoraires_techniques_par_trimestre +
                    prorata_foncier_par_trimestre + diagnostics_par_trimestre;
            }
            // 3. Financement du coût du trimestre (ordre foncier > fonds propres > accompagnement)
            const res_cout = financer(cout_trimestre);
            const foncier_utilise_trimestre = res_cout.foncier;
            const fonds_utilise_trimestre = res_cout.fonds;
            const accomp_utilise_trimestre = res_cout.accomp;
            // 4. Calcul des intérêts générés sur l'encours à la fin du trimestre (à payer au trimestre suivant)
            const interets_foncier_genere = encours_foncier * (taux_credit / 100) * (jours / 365);
            const interets_accompagnement_genere = encours_accompagnement * (taux_credit / 100) * (jours / 365);
            // 5. Report des intérêts et commission à payer au trimestre suivant
            interets_foncier_a_payer = interets_foncier_genere;
            interets_accompagnement_a_payer = interets_accompagnement_genere;
            commission_a_payer = commission_trimestre;
            // 6. Stockage dans trimestre_details (on affiche ce qui est payé ce trimestre)
            trimestre_details.push({
                trimestre: trimestre.trimestre,
                jours,
                start_date: trimestre.start_date,
                end_date: trimestre.end_date,
                credit_foncier_utilise: foncier_utilise_trimestre + fp_foncier + fa_foncier + fc_foncier,
                fonds_propres_utilise: fonds_utilise_trimestre + fp_fonds + fa_fonds + fc_fonds,
                credit_accompagnement_utilise: accomp_utilise_trimestre + fp_accomp + fa_accomp + fc_accomp,
                interets_foncier: interets_foncier_payes,
                interets_accompagnement: interets_accompagnement_payes,
                commission_accompagnement: commission_payee,
                cout_financier_trimestre: interets_foncier_payes + interets_accompagnement_payes + commission_payee
            });
            // 7. Cumuls pour la synthèse
            total_interets_foncier += interets_foncier_payes;
            total_interets_accompagnement += interets_accompagnement_payes;
            total_commission += commission_payee;
        }
        // Paiement des intérêts et commission générés sur le dernier trimestre (à la toute fin)
        if (nb_trimestres > 0) {
            let res = financer(interets_foncier_a_payer);
            total_interets_foncier += interets_foncier_a_payer;
            let res2 = financer(interets_accompagnement_a_payer);
            total_interets_accompagnement += interets_accompagnement_a_payer;
            let res3 = financer(commission_a_payer);
            total_commission += commission_a_payer;
            // Ajout au dernier trimestre du détail
            const last = trimestre_details[trimestre_details.length - 1];
            if (last) {
                last.credit_foncier_utilise += res.foncier + res2.foncier + res3.foncier;
                last.fonds_propres_utilise += res.fonds + res2.fonds + res3.fonds;
                last.credit_accompagnement_utilise += res.accomp + res2.accomp + res3.accomp;
                last.interets_foncier += interets_foncier_a_payer;
                last.interets_accompagnement += interets_accompagnement_a_payer;
                last.commission_accompagnement += commission_a_payer;
                last.cout_financier_trimestre += interets_foncier_a_payer + interets_accompagnement_a_payer + commission_a_payer;
            }
        }
        // --- Calcul du total des frais financiers APRÈS la boucle ---
        const total_couts_financiers = total_interets_foncier + total_interets_accompagnement + total_commission + frais_dossier;
        // --- Calcul du prix de revient APRÈS la boucle ---
        const prix_revient = total_acquisition + total_travaux + total_divers + total_couts_financiers;
        // --- Calcul des résultats principaux ---
        const marge_brute = prix_vente_fai - prix_revient;
        const marge_nette = prix_vente_hfa - prix_revient;
        const rentabilite = (marge_nette / prix_revient) * 100;
        // --- Calcul des prix au m² de revient et vente ---
        const prix_revient_pondere_m2 = prix_revient / surface_totale;
        const prix_revient_carrez_m2 = prix_revient / surface;
        const prix_vente_pondere_m2 = prix_vente_reel_pondere_m2;
        const prix_vente_carrez_m2 = prix_vente_fai / surface;
        // --- Calcul des pourcentages de répartition des coûts ---
        const total_cout = prix_revient;
        const pourcentage_acquisition = (total_acquisition / total_cout) * 100;
        const pourcentage_travaux = (total_travaux / total_cout) * 100;
        const pourcentage_divers = (total_divers / total_cout) * 100;
        // --- Préparation des résultats selon la nouvelle structure ---
        const results = {
            resultats: {
                prix_revient,
                prix_vente_fai,
                prix_vente_hfa,
                marge_brute,
                marge_nette,
                rentabilite,
                cash_flow_mensuel: 0, // À calculer avec les détails trimestriels
                tri: 0, // À calculer avec les cash flows
                date_vente: new Date(new Date(data.date_achat || new Date()).getTime() + duree_projet * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            prix_m2: {
                prix_achat_pondere_m2,
                prix_achat_carrez_m2,
                prix_revient_pondere_m2,
                prix_revient_carrez_m2,
                prix_vente_pondere_m2,
                prix_vente_carrez_m2
            },
            repartition_couts: {
                acquisition: {
                    montant: total_acquisition,
                    pourcentage: pourcentage_acquisition
                },
                travaux: {
                    montant: total_travaux,
                    pourcentage: pourcentage_travaux
                },
                financement: {
                    montant: total_couts_financiers,
                    pourcentage: (total_couts_financiers / prix_revient) * 100
                },
                divers: {
                    montant: total_divers,
                    pourcentage: pourcentage_divers
                },
                total: prix_revient
            },
            detail_couts: {
                acquisition: {
                    prix_achat,
                    frais_notaire_montant: frais_notaire,
                    frais_agence_montant: frais_agence,
                    total: total_acquisition
                },
                travaux: {
                    cout_travaux: cout_travaux_total,
                    maitrise_oeuvre: cout_maitrise_oeuvre,
                    aleas: cout_aleas,
                    amenagement_terrasse: cout_amenagement_terrasse,
                    mobilier,
                    demolition: cout_demolition,
                    total: total_travaux
                },
                financement: {
                    interets_foncier: total_interets_foncier,
                    interets_accompagnement: total_interets_accompagnement,
                    commission_accompagnement: total_commission,
                    frais_dossier,
                    total: total_couts_financiers
                },
                divers: {
                    honoraires_techniques,
                    prorata_foncier,
                    diagnostics,
                    total: total_divers
                }
            },
            financement: {
                sources: [], // À remplir avec les détails trimestriels
                details: {
                    credit_foncier: {
                        montant_utilise: 0, // À calculer avec les détails trimestriels
                        interets: 0 // À calculer avec les détails trimestriels
                    },
                    fonds_propres: {
                        montant_utilise: 0 // À calculer avec les détails trimestriels
                    },
                    credit_accompagnement: {
                        montant_utilise: 0, // À calculer avec les détails trimestriels
                        interets: 0, // À calculer avec les détails trimestriels
                        commission_montant: 0 // À calculer avec les détails trimestriels
                    }
                },
                total: 0 // À calculer avec les détails trimestriels
            },
            trimestre_details,
            total_jours: duree_projet,
            total_credit_foncier_utilise: credit_foncier_utilise_total,
            total_fonds_propres_utilise: fonds_propres_utilise_total,
            total_credit_accompagnement_utilise: credit_accomp_utilise_total,
            total_interets_foncier: total_interets_foncier,
            total_interets_accompagnement: total_interets_accompagnement,
            total_commission_accompagnement: total_commission,
            total_cout_financier_trimestre: trimestre_details.reduce((sum, t) => sum + (t.cout_financier_trimestre || 0), 0)
        };
        // --- Calcul du cash flow mensuel et du TRI
        const cash_flow_mensuel = (prix_vente_hfa - prix_revient) / duree_projet;
        results.resultats.cash_flow_mensuel = cash_flow_mensuel;
        results.resultats.tri = calculateTRI([
            -prix_revient,
            ...Array(duree_projet).fill(cash_flow_mensuel),
            prix_vente_hfa - prix_revient
        ]);
        // Mise à jour des totaux de financement
        const total_financement = credit_foncier_utilise_total + fonds_propres_utilise_total + credit_accomp_utilise_total;
        results.financement.sources = [
            {
                source: 'credit_foncier',
                montant: credit_foncier_utilise_total,
                pourcentage: (credit_foncier_utilise_total / total_financement) * 100
            },
            {
                source: 'fonds_propres',
                montant: fonds_propres_utilise_total,
                pourcentage: (fonds_propres_utilise_total / total_financement) * 100
            },
            {
                source: 'credit_accompagnement',
                montant: credit_accomp_utilise_total,
                pourcentage: (credit_accomp_utilise_total / total_financement) * 100
            }
        ];
        // Mise à jour des détails de financement
        results.financement.details = {
            credit_foncier: {
                montant_utilise: credit_foncier_utilise_total,
                interets: total_interets_foncier
            },
            fonds_propres: {
                montant_utilise: fonds_propres_utilise_total
            },
            credit_accompagnement: {
                montant_utilise: credit_accomp_utilise_total,
                interets: total_interets_accompagnement,
                commission_montant: total_commission
            }
        };
        // Mise à jour des coûts financiers
        results.detail_couts.financement = {
            interets_foncier: total_interets_foncier,
            interets_accompagnement: total_interets_accompagnement,
            commission_accompagnement: total_commission,
            frais_dossier,
            total: total_couts_financiers
        };
        // Mise à jour de la répartition des coûts
        results.repartition_couts.financement = {
            montant: total_couts_financiers,
            pourcentage: (total_couts_financiers / results.repartition_couts.total) * 100
        };
        // Mise à jour du total de financement
        results.financement.total = total_financement;
        console.log('Résultats finaux:', results);
        return res.json(results);
    }
    catch (error) {
        console.error('Erreur lors du calcul du business plan:', error);
        return res.status(500).json({ error: 'Erreur lors du calcul du business plan' });
    }
};
exports.calculateBusinessPlan = calculateBusinessPlan;
