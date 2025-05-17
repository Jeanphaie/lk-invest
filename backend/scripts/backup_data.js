const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupData() {
  try {
    console.log('Début de la sauvegarde des données...');

    // Créer le dossier de sauvegarde s'il n'existe pas
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    // Sauvegarder les projets
    const projects = await prisma.project.findMany();

    // Sauvegarder les données DVF
    const dvfData = await prisma.dVF.findMany();

    // Créer un timestamp pour le nom du fichier
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup_${timestamp}.json`);

    // Sauvegarder les données dans un fichier JSON
    const backupData = {
      timestamp: new Date().toISOString(),
      projects,
      dvfData
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`Sauvegarde terminée dans ${backupFile}`);

    // Créer un script de restauration
    const restoreScript = path.join(backupDir, `restore_${timestamp}.js`);
    const restoreScriptContent = `
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreData() {
  try {
    const backupFile = path.join(__dirname, 'backup_${timestamp}.json');
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    console.log('Début de la restauration des données...');

    // Restaurer les projets
    for (const project of backupData.projects) {
      await prisma.project.create({
        data: {
          ...project,
          id: undefined // Laisser Prisma générer un nouvel ID
        }
      });
    }

    // Restaurer les données DVF
    for (const dvf of backupData.dvfData) {
      await prisma.dVF.create({
        data: {
          ...dvf,
          id: undefined
        }
      });
    }

    console.log('Restauration terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de la restauration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreData();
`;

    fs.writeFileSync(restoreScript, restoreScriptContent);
    console.log(`Script de restauration créé: ${restoreScript}`);

  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backupData(); 