const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importProjects() {
  try {
    // Lire le fichier JSON
    const exportPath = path.join(__dirname, 'exports', 'projects.json');
    if (!fs.existsSync(exportPath)) {
      throw new Error('Fichier projects.json non trouvé dans le dossier exports');
    }

    const projects = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

    // Supprimer tous les projets existants
    await prisma.project.deleteMany({});

    // Réimporter les projets
    for (const project of projects) {
      await prisma.project.create({
        data: {
          ...project,
          // Réinitialiser les timestamps
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }
      });
    }

    console.log(`✅ Import réussi : ${projects.length} projets importés`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'import:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter l'import
importProjects(); 