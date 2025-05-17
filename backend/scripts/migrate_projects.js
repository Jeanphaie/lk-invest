const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function migrate() {
  const filePath = path.join(__dirname, 'exports', 'projects.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const projects = JSON.parse(raw);

  for (const oldProject of projects) {
    try {
      // 1. Construire inputsGeneral avec les infos générales
      const inputsGeneral = {
        projectTitle: oldProject.projectTitle,
        adresseBien: oldProject.adresseBien,
        lienAnnonce: oldProject.lienAnnonce,
        latitude: oldProject.latitude,
        longitude: oldProject.longitude,
        ...(oldProject.inputsGeneral || {})
      };

      // 2. Nettoyer les autres champs JSON
      const clean = (obj) => (obj && typeof obj === 'object' ? JSON.parse(JSON.stringify(obj)) : undefined);

      // 3. Préparer le nouvel objet Project
      const newProject = await prisma.project.create({
        data: {
          projectTitle: oldProject.projectTitle || '',
          createdAt: oldProject.createdAt ? new Date(oldProject.createdAt) : undefined,
          updatedAt: oldProject.updatedAt ? new Date(oldProject.updatedAt) : undefined,
          inputsGeneral,
          inputsDescriptionBien: clean(oldProject.inputsDescriptionBien),
          resultsDescriptionBien: clean(oldProject.resultsDescriptionBien),
          inputsBusinessPlan: clean(oldProject.inputsBusinessPlan),
          resultsBusinessPlan: clean(oldProject.resultsBusinessPlan),
          inputsDvf: clean(oldProject.inputsDvf),
          resultsDvfMetadata: clean(oldProject.resultsDvf?.dvfResults),
          photos: clean({
            photosBefore: oldProject.photosBefore,
            photos3d: oldProject.photos3d,
            photosDuring: oldProject.photosDuring,
            photosAfter: oldProject.photosAfter,
            selectedBeforePhotosForPdf: oldProject.selectedBeforePhotosForPdf,
            selected3dPhotosForPdf: oldProject.selected3dPhotosForPdf,
            coverPhoto: oldProject.coverPhoto
          }),
          pdfConfig: clean(oldProject.pdfConfig),
          inputsRenovationBien: null,
          resultsRenovationBien: null
        }
      });
      const projectId = newProject.id;
      console.log(`🆔 Projet créé : ${projectId} (${oldProject.projectTitle})`);

      // 4. Déporter les transactions DVF (dvfProperties)
      if (Array.isArray(oldProject.resultsDvf?.dvfProperties)) {
        for (const tx of oldProject.resultsDvf.dvfProperties) {
          await prisma.dvfTransaction.create({
            data: {
              projectId,
              data: tx
            }
          });
          console.log(`  → Transaction DVF insérée pour ${oldProject.projectTitle}`);
        }
      }

      // 5. Déporter les séries temporelles (trendSeries)
      if (Array.isArray(oldProject.resultsDvf?.trendSeries)) {
        for (const serie of oldProject.resultsDvf.trendSeries) {
          await prisma.dvfSeries.create({
            data: {
              projectId,
              type: 'trend',
              data: serie
            }
          });
          console.log(`  → Série DVF (trend) insérée pour ${oldProject.projectTitle}`);
        }
      }

      // 6. Déporter la distribution/scatter si présente
      if (Array.isArray(oldProject.resultsDvf?.distributionSeries)) {
        for (const dist of oldProject.resultsDvf.distributionSeries) {
          await prisma.dvfDistribution.create({
            data: {
              projectId,
              data: dist
            }
          });
          console.log(`  → Distribution DVF (distributionSeries) insérée pour ${oldProject.projectTitle}`);
        }
      }
      if (Array.isArray(oldProject.resultsDvf?.scatterSeries)) {
        for (const dist of oldProject.resultsDvf.scatterSeries) {
          await prisma.dvfDistribution.create({
            data: {
              projectId,
              data: dist
            }
          });
          console.log(`  → Distribution DVF (scatterSeries) insérée pour ${oldProject.projectTitle}`);
        }
      }

      // (Optionnel) : autres séries ou distributions/scatter à ignorer pour l'instant

      console.log(`✅ Projet migré : ${oldProject.projectTitle || projectId}`);
    } catch (e) {
      console.error('❌ Erreur migration projet', oldProject.projectTitle, e);
    }
  }
  await prisma.$disconnect();
}

migrate(); 