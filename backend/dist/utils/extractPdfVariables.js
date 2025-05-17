"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function safeParseJson(value, defaultValue) {
    if (!value)
        return defaultValue;
    if (typeof value === 'object')
        return value;
    try {
        return JSON.parse(String(value));
    }
    catch (e) {
        console.error('Erreur de parsing JSON:', e);
        return defaultValue;
    }
}
function getString(value, defaultValue = '') {
    if (typeof value === 'string')
        return value;
    if (value === null || value === undefined)
        return defaultValue;
    return String(value);
}
function getNumber(value, defaultValue = 0) {
    if (typeof value === 'number')
        return value;
    if (value === null || value === undefined)
        return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
}
function getArray(value, defaultValue = []) {
    return Array.isArray(value) ? value : defaultValue;
}
async function extractPdfVariables(projectTitle) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const project = await prisma.project.findFirst({
            where: { projectTitle }
        });
        if (!project) {
            throw new Error(`Projet ${projectTitle} non trouvé`);
        }
        // Parse JSON fields with proper typing
        const inputsGeneral = safeParseJson(project.inputsGeneral, {});
        const inputsDescriptionBien = safeParseJson(project.inputsDescriptionBien, {});
        const resultsDescriptionBien = safeParseJson(project.resultsDescriptionBien, {});
        const inputsBusinessPlan = safeParseJson(project.inputsBusinessPlan, {
            prix_achat: 0,
            frais_notaire: 0,
            frais_agence: 0,
            cout_travaux: 0,
            alea_travaux: 0,
            mobilier: 0,
            honoraires_techniques: 0,
            prorata_foncier: 0,
            diagnostics: 0,
            demolition: 0,
            amenagement_terrasse: 0,
            date_achat: '',
            duree_projet: 0
        });
        const resultsBusinessPlan = safeParseJson(project.resultsBusinessPlan, {
            resultats: {
                prix_revient: 0,
                prix_vente_fai: 0,
                prix_vente_hfa: 0,
                marge_brute: 0,
                marge_nette: 0,
                rentabilite: 0,
                cash_flow_mensuel: 0,
                tri: 0,
                date_vente: ''
            },
            prix_m2: {
                prix_achat_pondere_m2: 0,
                prix_achat_carrez_m2: 0,
                prix_revient_pondere_m2: 0,
                prix_revient_carrez_m2: 0,
                prix_vente_pondere_m2: 0,
                prix_vente_carrez_m2: 0
            },
            repartition_couts: {
                acquisition: { montant: 0, pourcentage: 0 },
                travaux: { montant: 0, pourcentage: 0 },
                financement: { montant: 0, pourcentage: 0 },
                divers: { montant: 0, pourcentage: 0 },
                total: 0
            },
            detail_couts: {
                acquisition: {
                    prix_achat: 0,
                    frais_notaire_montant: 0,
                    frais_agence_montant: 0,
                    total: 0
                },
                travaux: {
                    cout_travaux: 0,
                    maitrise_oeuvre: 0,
                    aleas: 0,
                    amenagement_terrasse: 0,
                    mobilier: 0,
                    demolition: 0,
                    total: 0
                },
                financement: {
                    interets_foncier: 0,
                    interets_accompagnement: 0,
                    commission_accompagnement: 0,
                    frais_dossier: 0,
                    total: 0
                },
                divers: {
                    honoraires_techniques: 0,
                    prorata_foncier: 0,
                    diagnostics: 0,
                    total: 0
                }
            },
            financement: {
                sources: [],
                details: {
                    credit_foncier: { montant_utilise: 0, interets: 0 },
                    fonds_propres: { montant_utilise: 0 },
                    credit_accompagnement: { montant_utilise: 0, interets: 0, commission_montant: 0 }
                },
                total: 0
            },
            trimestre_details: [],
            total_jours: 0,
            total_credit_foncier_utilise: 0,
            total_fonds_propres_utilise: 0,
            total_credit_accompagnement_utilise: 0,
            total_interets_foncier: 0,
            total_interets_accompagnement: 0,
            total_commission_accompagnement: 0,
            total_cout_financier_trimestre: 0
        });
        const resultsDvf = safeParseJson(project.resultsDvf, {});
        const inputsDvf = safeParseJson(project.inputsDvf, {});
        // Mapping selon la nouvelle structure
        const bpResults = resultsBusinessPlan.resultats || {};
        const repartition = resultsBusinessPlan.repartition_couts || {};
        const prixM2 = resultsBusinessPlan.prix_m2 || {};
        const financement = resultsBusinessPlan.financement || {};
        const trimestreDetails = resultsBusinessPlan.trimestre_details || [];
        const pdfData = {
            cover: {
                title: project.projectTitle,
                address: getString(project.adresseBien),
                photo: project.coverPhoto || '',
                coordinates: {
                    latitude: project.latitude,
                    longitude: project.longitude
                }
            },
            property: {
                general: {
                    surface: getNumber(inputsGeneral.superficie),
                    rooms: inputsDescriptionBien.rooms ? getNumber(inputsDescriptionBien.rooms) : undefined,
                    floor: getString(inputsDescriptionBien.floor),
                    buildingType: getString(inputsDescriptionBien.buildingType),
                    view: getString(inputsDescriptionBien.vue),
                    condition: getString(inputsDescriptionBien.condition),
                    features: getArray(inputsDescriptionBien.features)
                },
                description: {
                    text: getString(resultsDescriptionBien.text),
                    photos: getArray(resultsDescriptionBien.photos)
                }
            },
            market: {
                searchRadius: getNumber(inputsDvf.rayon),
                statistics: {
                    averagePrice: getNumber(resultsDvf.averagePrice),
                    medianPrice: getNumber(resultsDvf.medianPrice),
                    priceRange: getString(resultsDvf.priceRange),
                    transactionCount: getArray(resultsDvf.transactions).length
                },
                distribution: getArray(resultsDvf.distributionSeries),
                comparables: getArray(resultsDvf.transactions),
                charts: {
                    scatter: getArray(resultsDvf.scatterSeries),
                    distribution: getArray(resultsDvf.distributionSeries)
                }
            },
            businessPlan: {
                inputs: {
                    purchasePrice: getNumber(inputsBusinessPlan.prix_achat),
                    notaryFees: getNumber(inputsBusinessPlan.frais_notaire),
                    agencyFees: getNumber(inputsBusinessPlan.frais_agence),
                    worksCost: getNumber(inputsBusinessPlan.cout_travaux),
                    contingency: getNumber(inputsBusinessPlan.alea_travaux),
                    furniture: getNumber(inputsBusinessPlan.mobilier),
                    technicalFees: getNumber(inputsBusinessPlan.honoraires_techniques),
                    propertyTax: getNumber(inputsBusinessPlan.prorata_foncier),
                    diagnostics: getNumber(inputsBusinessPlan.diagnostics),
                    demolition: getNumber(inputsBusinessPlan.demolition),
                    terraceWork: getNumber(inputsBusinessPlan.amenagement_terrasse),
                    date_achat: getString(inputsBusinessPlan.date_achat),
                    duree_projet: getNumber(inputsBusinessPlan.duree_projet)
                },
                results: {
                    totalCost: bpResults.prix_revient,
                    sellingPrice: {
                        withFees: bpResults.prix_vente_fai,
                        withoutFees: bpResults.prix_vente_hfa
                    },
                    profitability: {
                        grossMargin: bpResults.marge_brute,
                        netMargin: bpResults.marge_nette,
                        roi: bpResults.rentabilite,
                        irr: bpResults.tri
                    },
                    timeline: {
                        purchaseDate: getString(inputsBusinessPlan.date_achat),
                        saleDate: bpResults.date_vente,
                        duration: getNumber(inputsBusinessPlan.duree_projet)
                    }
                },
                financing: financement,
                quarterlyDetails: trimestreDetails
            },
            pdfConfig: safeParseJson(project.pdfConfig, {})
        };
        // Expose explicitement les totaux trimestriels à la racine pour le mapping PDF
        const bp = resultsBusinessPlan;
        return Object.assign(Object.assign({}, pdfData), { total_jours: (_a = bp.total_jours) !== null && _a !== void 0 ? _a : 0, total_credit_foncier_utilise: (_b = bp.total_credit_foncier_utilise) !== null && _b !== void 0 ? _b : 0, total_fonds_propres_utilise: (_c = bp.total_fonds_propres_utilise) !== null && _c !== void 0 ? _c : 0, total_credit_accompagnement_utilise: (_d = bp.total_credit_accompagnement_utilise) !== null && _d !== void 0 ? _d : 0, total_interets_foncier: (_e = bp.total_interets_foncier) !== null && _e !== void 0 ? _e : 0, total_interets_accompagnement: (_f = bp.total_interets_accompagnement) !== null && _f !== void 0 ? _f : 0, total_commission_accompagnement: (_g = bp.total_commission_accompagnement) !== null && _g !== void 0 ? _g : 0, total_cout_financier_trimestre: (_h = bp.total_cout_financier_trimestre) !== null && _h !== void 0 ? _h : 0 });
    }
    catch (error) {
        console.error('Erreur lors de l\'extraction des données:', error);
        return null;
    }
}
exports.default = extractPdfVariables;
