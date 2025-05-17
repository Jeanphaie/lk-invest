const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Extrait et organise toutes les variables nécessaires pour le PDF
 * @param {string} projectTitle - Titre du projet
 * @returns {Object} Variables organisées pour le PDF
 */
async function extractPdfVariables(projectTitle) {
  try {
    const project = await prisma.project.findFirst({
      where: { projectTitle }
    });

    if (!project) {
      throw new Error(`Projet ${projectTitle} non trouvé`);
    }

    // Extraction des données JSON
    const inputsGeneral = project.inputsGeneral || {};
    const inputsDescriptionBien = project.inputsDescriptionBien || {};
    const resultsDescriptionBien = project.resultsDescriptionBien || {};
    const inputsBusinessPlan = project.inputsBusinessPlan || {};
    const resultsBusinessPlan = project.resultsBusinessPlan || {};
    const resultsDvf = project.resultsDvf || {};

    // Organisation des variables pour le PDF
    const pdfVariables = {
      // 1. Page de couverture
      cover: {
        title: project.projectTitle,
        address: project.adresseBien,
        photo: project.coverPhoto,
        coordinates: {
          latitude: project.latitude,
          longitude: project.longitude
        }
      },

      // 2. Description du bien
      property: {
        // Caractéristiques générales
        general: {
          surface: inputsGeneral.superficie,
          rooms: inputsDescriptionBien.rooms,
          floor: inputsDescriptionBien.floor,
          buildingType: inputsDescriptionBien.buildingType,
          view: inputsDescriptionBien.vue,
          condition: inputsDescriptionBien.condition,
          features: inputsDescriptionBien.features || []
        },
        
        // Description détaillée
        description: {
          ...inputsDescriptionBien,
          ...resultsDescriptionBien
        }
      },

      // 3. Analyse du marché (DVF)
      market: {
        // Statistiques générales
        statistics: {
          averagePrice: resultsDvf.averagePrice,
          medianPrice: resultsDvf.medianPrice,
          priceRange: resultsDvf.priceRange,
          transactionCount: resultsDvf.transactions?.length || 0
        },

        // Distribution des prix
        distribution: resultsDvf.distributionSeries || [],

        // Transactions similaires
        comparables: resultsDvf.transactions || [],

        // Graphiques
        charts: {
          scatter: resultsDvf.scatterSeries || [],
          distribution: resultsDvf.distributionSeries || []
        }
      },

      // 4. Business Plan
      businessPlan: {
        // Données d'entrée
        inputs: {
          purchasePrice: inputsBusinessPlan.prix_achat,
          notaryFees: inputsBusinessPlan.frais_notaire,
          agencyFees: inputsBusinessPlan.frais_agence,
          worksCost: inputsBusinessPlan.cout_travaux,
          contingency: inputsBusinessPlan.alea_travaux,
          furniture: inputsBusinessPlan.mobilier,
          technicalFees: inputsBusinessPlan.honoraires_techniques,
          propertyTax: inputsBusinessPlan.prorata_foncier,
          diagnostics: inputsBusinessPlan.diagnostics,
          demolition: inputsBusinessPlan.demolition,
          terraceWork: inputsBusinessPlan.amenagement_terrasse
        },

        // Résultats financiers
        results: {
          totalCost: resultsBusinessPlan.resultats?.prix_revient,
          sellingPrice: {
            withFees: resultsBusinessPlan.resultats?.prix_fai,
            withoutFees: resultsBusinessPlan.resultats?.prix_hfa
          },
          profitability: {
            grossMargin: resultsBusinessPlan.resultats?.marge_brute,
            netMargin: resultsBusinessPlan.resultats?.marge_nette,
            roi: resultsBusinessPlan.resultats?.rentabilite,
            irr: resultsBusinessPlan.resultats?.tri
          },
          timeline: {
            purchaseDate: inputsBusinessPlan.date_achat,
            saleDate: resultsBusinessPlan.resultats?.date_vente,
            duration: inputsBusinessPlan.duree_projet
          }
        },

        // Financement
        financing: resultsBusinessPlan.financement || {},

        // Détails trimestriels
        quarterlyDetails: resultsBusinessPlan.trimestre_details || []
      },

      // 5. Photos
      photos: {
        before: project.photosBefore,
        during: project.photosDuring,
        after: project.photosAfter,
        threeDimensions: project.photos3d
      },

      // 6. Configuration PDF personnalisée
      pdfConfig: project.pdfConfig || {}
    };

    return pdfVariables;
  } catch (error) {
    console.error('Erreur lors de l\'extraction des variables:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Export de la fonction
module.exports = extractPdfVariables;

// Si exécuté directement, tester avec Damremont2
if (require.main === module) {
  (async () => {
    try {
      const variables = await extractPdfVariables('Damremont2');
      console.log(JSON.stringify(variables, null, 2));
    } catch (error) {
      console.error(error);
    }
  })();
} 