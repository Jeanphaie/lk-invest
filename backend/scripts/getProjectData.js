const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function extractPDFVariables(projectTitle) {
  try {
    const project = await prisma.project.findFirst({
      where: {
        projectTitle: projectTitle
      }
    });

    if (!project) {
      console.log('Projet non trouvé');
      return;
    }

    // Extraction et organisation des données pour le PDF
    const pdfData = {
      // Page de couverture
      cover: {
        address: project.adresseBien,
        coverPhoto: project.coverPhoto,
        projectTitle: project.projectTitle
      },

      // Description du bien
      property: {
        // Données de base
        ...project.inputsGeneral,
        
        // Description détaillée
        description: {
          ...project.inputsDescriptionBien,
          ...project.resultsDescriptionBien
        }
      },

      // Analyse du marché (DVF)
      marketAnalysis: {
        inputs: project.inputsDvf,
        results: {
          ...project.resultsDvf,
          transactions: project.resultsDvf?.transactions || [],
          statistics: {
            averagePrice: project.resultsDvf?.averagePrice,
            medianPrice: project.resultsDvf?.medianPrice,
            priceRange: project.resultsDvf?.priceRange,
            distribution: project.resultsDvf?.distributionSeries || []
          }
        }
      },

      // Business Plan
      businessPlan: {
        inputs: {
          ...project.inputsBusinessPlan
        },
        results: {
          ...project.resultsBusinessPlan
        }
      },

      // Photos
      photos: {
        before: project.photosBefore,
        during: project.photosDuring,
        after: project.photosAfter,
        threeDimensions: project.photos3d
      },

      // Configuration PDF
      pdfConfig: project.pdfConfig || {}
    };

    // Afficher les données organisées
    console.log('\n=== VARIABLES PDF ORGANISÉES ===\n');
    
    console.log('\n1. PAGE DE COUVERTURE');
    console.log(JSON.stringify(pdfData.cover, null, 2));
    
    console.log('\n2. DESCRIPTION DU BIEN');
    console.log(JSON.stringify(pdfData.property, null, 2));
    
    console.log('\n3. ANALYSE DU MARCHÉ');
    console.log(JSON.stringify(pdfData.marketAnalysis, null, 2));
    
    console.log('\n4. BUSINESS PLAN');
    console.log(JSON.stringify(pdfData.businessPlan, null, 2));
    
    console.log('\n5. PHOTOS');
    console.log(JSON.stringify(pdfData.photos, null, 2));
    
    console.log('\n6. CONFIGURATION PDF');
    console.log(JSON.stringify(pdfData.pdfConfig, null, 2));

    return pdfData;
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Test avec le projet Damremont2
extractPDFVariables('Damremont2'); 