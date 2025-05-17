const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportProjects() {
  try {
    // Récupérer tous les projets
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        projectTitle: true,
        adresseBien: true,
        lienAnnonce: true,
        latitude: true,
        longitude: true,
        description: true,
        inputsGeneral: true,
        inputsDescriptionBien: true,
        resultsDescriptionBien: true,
        inputsBusinessPlan: true,
        resultsBusinessPlan: true,
        inputsDvf: true,
        resultsDvf: true,
        photosBefore: true,
        photos3d: true,
        photosDuring: true,
        photosAfter: true,
        selectedBeforePhotosForPdf: true,
        selected3dPhotosForPdf: true,
        pdfConfig: true,
        coverPhoto: true,
        generatedPdfPath: true,
        lastPdfGeneration: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Créer le dossier exports s'il n'existe pas
    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir);
    }

    // Sauvegarder dans un fichier JSON
    const exportPath = path.join(exportDir, 'projects.json');
    fs.writeFileSync(exportPath, JSON.stringify(projects, null, 2));

    console.log(`✅ Export réussi : ${exportPath}`);
    console.log(`📊 ${projects.length} projets exportés`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'export:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter l'export
exportProjects(); 