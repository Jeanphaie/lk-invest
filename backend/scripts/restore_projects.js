const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const projects = JSON.parse(fs.readFileSync('backup_projects.json', 'utf-8'));
  for (const old of projects) {
    // Crée le champ photos à partir des anciens champs
    const photos = {
      before: old.photosBefore || [],
      after: old.photosAfter || [],
      '3d': old.photos3d || [],
      during: old.photosDuring || [],
      cover: old.coverPhoto || undefined,
      selectedBeforePhotosForPdf: old.selectedBeforePhotosForPdf || [],
      selected3dPhotosForPdf: old.selected3dPhotosForPdf || [],
    };
    // Crée le nouvel objet projet sans les anciens champs photos
    const {
      photosBefore, photos3d, photosDuring, photosAfter,
      coverPhoto, selectedBeforePhotosForPdf, selected3dPhotosForPdf,
      ...rest
    } = old;
    const newProject = {
      ...rest,
      photos,
    };
    // Insère ou met à jour le projet
    await prisma.project.upsert({
      where: { id: old.id },
      update: newProject,
      create: newProject,
    });
  }
  console.log('Restore done');
}

main().finally(() => prisma.$disconnect()); 