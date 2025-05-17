const fs = require('fs');
const path = require('path');

const projectId = 5;
const uploadsDir = path.join(__dirname, 'uploads', String(projectId));
const categories = ['before', 'during', 'after', '3d'];

function getPhotos(category) {
  const dir = path.join(uploadsDir, category);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png|JPG|PNG)$/i.test(f))
    .map((file, idx) => ({
      id: Date.now() + idx,
      url: `/uploads/${projectId}/${category}/${file}`,
      category,
      selectedForPdf: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
}

const photos = {
  before: getPhotos('before'),
  during: getPhotos('during'),
  after: getPhotos('after'),
  '3d': getPhotos('3d'),
  selectedBeforePhotosForPdf: [],
  selected3dPhotosForPdf: [],
  coverPhoto: `/uploads/${projectId}/cover_LKI.png` // ou choisis la photo que tu veux
};

console.log('Objet à coller dans Prisma Studio (champ JSON) :\n');
console.log(JSON.stringify(photos, null, 2));
console.log('\n---\n');
console.log('String à coller dans un champ TEXT (stringifié) :\n');
console.log(JSON.stringify(JSON.stringify(photos)));
