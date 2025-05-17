const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function migrateDvfTransactions() {
  try {
    // Lire le fichier JSON des projets
    const exportPath = path.join(__dirname, 'exports', 'projects.json');
    if (!fs.existsSync(exportPath)) {
      throw new Error('Fichier projects.json non trouvé dans le dossier exports');
    }

    const projects = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

    // Pour chaque projet
    for (const project of projects) {
      if (project.resultsDvf?.dvfProperties) {
        // Extraire les transactions
        const transactions = project.resultsDvf.dvfProperties;
        
        // Créer les métadonnées (tout sauf les transactions)
        const metadata = {
          ...project.resultsDvf,
          dvfProperties: undefined // On retire les transactions
        };

        // Mettre à jour le projet avec les métadonnées
        await prisma.project.update({
          where: { id: project.id },
          data: {
            resultsDvfMetadata: metadata,
            dvfTransactions: {
              create: transactions.map(transaction => ({
                data: transaction
              }))
            }
          }
        });

        console.log(`✅ Projet ${project.id} migré : ${transactions.length} transactions`);
      }
    }

    console.log('✅ Migration terminée');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la migration
migrateDvfTransactions(); 