const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Vérification de la base de données...\n');

    // Vérifier les projets
    const projectCount = await prisma.project.count();
    console.log(`Nombre total de projets: ${projectCount}`);

    const projects = await prisma.project.findMany({
      select: {
        id: true,
        projectTitle: true,
        selectedBeforePhotosForPdf: true,
        selected3dPhotosForPdf: true,
        generatedPdfPath: true,
        lastPdfGeneration: true
      }
    });

    console.log('\nDétails des projets:');
    projects.forEach(project => {
      console.log(`\nProjet #${project.id} - ${project.projectTitle}`);
      console.log('- Photos before sélectionnées:', project.selectedBeforePhotosForPdf || 'aucune');
      console.log('- Photos 3D sélectionnées:', project.selected3dPhotosForPdf || 'aucune');
      console.log('- PDF généré:', project.generatedPdfPath || 'aucun');
      console.log('- Dernière génération:', project.lastPdfGeneration || 'jamais');
    });

    // Vérifier les données DVF
    const dvfCount = await prisma.dVF.count();
    console.log(`\nNombre total d'entrées DVF: ${dvfCount}`);

    // Vérifier la structure de la table Project
    const projectTableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Project'
      ORDER BY ordinal_position;
    `;

    console.log('\nStructure de la table Project:');
    projectTableInfo.forEach(column => {
      console.log(`- ${column.column_name}: ${column.data_type} (${column.is_nullable === 'YES' ? 'nullable' : 'required'})`);
    });

  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase(); 