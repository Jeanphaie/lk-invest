// Script de restauration du champ photos d'un projet à partir des fichiers présents sur le disque
// Usage : node scripts/restore_photos_from_files.js <projectId>

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const categories = ['before', 'during', 'after', '3d'];

function getPhotos(projectId, uploadsDir, category) {
  const dir = path.join(uploadsDir, category);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png|JPG|PNG)$/i.test(f))
    .map((file, idx) => ({
      id: Date.now() + idx,
      url: `/uploads/${projectId}/${category}/${file}`,
      category,
      selectedForPdf: false,
      order: idx,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
}

async function restorePhotos(projectId) {
  const uploadsDir = path.join(__dirname, '..', 'uploads', String(projectId));
  const photos = {
    before: getPhotos(projectId, uploadsDir, 'before'),
    during: getPhotos(projectId, uploadsDir, 'during'),
    after: getPhotos(projectId, uploadsDir, 'after'),
    '3d': getPhotos(projectId, uploadsDir, '3d'),
    selectedBeforePhotosForPdf: [],
    selected3dPhotosForPdf: [],
    coverPhoto: undefined
  };

  // Choisir la première photo du dossier before comme coverPhoto si dispo
  if (photos.before.length > 0) {
    photos.coverPhoto = photos.before[0].url;
  } else if (photos.after.length > 0) {
    photos.coverPhoto = photos.after[0].url;
  } else if (photos.during.length > 0) {
    photos.coverPhoto = photos.during[0].url;
  } else if (photos['3d'].length > 0) {
    photos.coverPhoto = photos['3d'][0].url;
  }

  // Affiche l'objet prêt à coller dans Prisma Studio (champ JSON)
  console.log('Objet à coller dans Prisma Studio (champ JSON) :\n');
  console.log(JSON.stringify(photos, null, 2));
  console.log('\n---\n');
  console.log('String à coller dans un champ TEXT (stringifié) :\n');
  console.log(JSON.stringify(JSON.stringify(photos)));

  // Met à jour le champ photos dans la BDD (champ unique, stringifié)
  await prisma.project.update({
    where: { id: Number(projectId) },
    data: { photos: JSON.stringify(photos) }
  });

  console.log('Champ photos restauré pour le projet', projectId);
  process.exit(0);
}

const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: node scripts/restore_photos_from_files.js <projectId>');
  process.exit(1);
}
restorePhotos(projectId);