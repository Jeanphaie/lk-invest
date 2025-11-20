import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OpenAI } from 'openai';
import { PhotoService } from '../services/photo.service';
import { Photos, Photo, PhotosSchema, PlanPhoto } from '../../../shared/types/photos';
import { PlansMigrationService } from '../services/plansMigration.service';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);

function createOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return new OpenAI({ apiKey });
}

const router: Router = express.Router();
const photoService = new PhotoService();
const prisma = new PrismaClient();

// Fonction pour convertir un PDF en image PNG en utilisant pdftoppm directement
async function convertPdfToImage(pdfPath: string, outputImagePath: string): Promise<boolean> {
  try {
    // Utiliser pdftoppm directement (plus fiable que pdf-poppler)
    // pdftoppm -png -f 1 -l 1 input.pdf output_prefix
    const outputDir = path.dirname(outputImagePath);
    const outputPrefix = path.basename(outputImagePath, path.extname(outputImagePath));
    const tempOutputPath = path.join(outputDir, `${outputPrefix}-1.png`);
    
    try {
      // Convertir la première page du PDF en PNG
      const command = `pdftoppm -png -f 1 -l 1 "${pdfPath}" "${path.join(outputDir, outputPrefix)}"`;
      
      const { stdout, stderr } = await execAsync(command);
      
      // Vérifier que le fichier a été créé
      if (fs.existsSync(tempOutputPath)) {
        // Renommer le fichier généré pour remplacer le PDF
        fs.renameSync(tempOutputPath, outputImagePath);
        // Supprimer le PDF original
        fs.unlinkSync(pdfPath);
        return true;
      } else {
        // Vérifier s'il y a d'autres fichiers générés
        const files = fs.readdirSync(outputDir);
        const generatedFiles = files.filter(f => f.startsWith(outputPrefix) && f.endsWith('.png'));
        if (generatedFiles.length > 0) {
          const firstFile = path.join(outputDir, generatedFiles[0]);
          fs.renameSync(firstFile, outputImagePath);
          fs.unlinkSync(pdfPath);
          return true;
        }
        return false;
      }
    } catch (popplerError: any) {
      console.error('[PDF Convert] Erreur avec pdftoppm:', popplerError.message);
      return false;
    }
  } catch (error) {
    console.error('[PDF Convert] Erreur lors de la conversion PDF:', error);
    return false;
  }
}

// Fonction pour redimensionner et harmoniser les images de plans
async function resizePlanImage(filePath: string): Promise<string> {
  try {
    // Attendre un peu pour s'assurer que le fichier est complètement écrit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Vérifier que le fichier existe
    if (!fs.existsSync(filePath)) {
      console.error(`[Resize] Fichier non trouvé: ${filePath}`);
      return filePath; // Retourner le chemin original
    }
    
    const metadata = await sharp(filePath).metadata();
    if (!metadata.width || !metadata.height) {
      return filePath;
    }

    // Taille maximale standardisée pour les plans (format paysage optimisé pour PDF)
    // Les plans sont souvent en format paysage, donc on privilégie la largeur
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1080;
    
    // Si l'image est déjà dans les limites, ne pas la redimensionner
    if (metadata.width <= MAX_WIDTH && metadata.height <= MAX_HEIGHT) {
      return filePath;
    }
    
    // Calculer les nouvelles dimensions en gardant les proportions
    const ratio = Math.min(MAX_WIDTH / metadata.width, MAX_HEIGHT / metadata.height);
    const targetWidth = Math.round(metadata.width * ratio);
    const targetHeight = Math.round(metadata.height * ratio);
    
    // Créer un fichier temporaire pour le redimensionnement
    const tempPath = filePath + '.resized';
    const format = metadata.format || 'png';
    
    // Redimensionner avec sharp en gardant le format original
    let sharpInstance = sharp(filePath)
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    
    // Appliquer les options selon le format
    if (format === 'jpeg' || format === 'jpg') {
      sharpInstance = sharpInstance.jpeg({ quality: 90, mozjpeg: true });
    } else if (format === 'png') {
      sharpInstance = sharpInstance.png({ quality: 90, compressionLevel: 6 });
    } else if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: 90 });
    }
    // Pour les autres formats, sharp utilisera le format par défaut
    
    await sharpInstance.toFile(tempPath);
    
    // Vérifier que le fichier temporaire a été créé
    if (!fs.existsSync(tempPath)) {
      console.error('[Resize] Le fichier redimensionné n\'a pas été créé');
      return filePath;
    }
    
    // Remplacer le fichier original par le redimensionné
    fs.unlinkSync(filePath);
    fs.renameSync(tempPath, filePath);
    
    return filePath;
  } catch (error) {
    console.error('[Resize] Erreur lors du redimensionnement:', error);
    // En cas d'erreur, garder le fichier original
    const tempPath = filePath + '.resized';
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    return filePath;
  }
}

// Configuration de multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = parseInt(req.params.projectId, 10);
    // Pour les routes structurées, utiliser 'plans' comme catégorie
    const category = req.path.includes('/upload-structured') ? 'plans' : req.params.category;
    const dir = path.join('/data/lki/uploads', projectId.toString(), String(category));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// Configuration des types de fichiers acceptés
const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'application/pdf'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 30MB max
  }
});

// Schémas Zod pour les payloads d'entrée
const TogglePdfPayloadSchema = z.object({
  photoPath: z.string().min(1),
  selected: z.boolean(),
});
const DeletePhotoPayloadSchema = z.object({
  photoPath: z.string().min(1),
});
const ProjectIdParamSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
});
const CategoryParamSchema = z.object({
  category: z.enum(['before', '3d', 'during', 'after', 'plans']),
});
const DownloadQuerySchema = z.object({
  filename: z.string().min(1),
});

// Upload multiple photos
router.post('/:projectId/:category/multiple', upload.array('photos', 40), async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const category = req.params.category as keyof Photos;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const photoPaths = files.map(file => 
      `/uploads/${projectId}/${category}/${file.filename}`
    );

    // Récupérer l'état courant UNE SEULE FOIS
    const project = await prisma.project.findUnique({ where: { project_id: projectId } });
    let photos = project?.photos;
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos); } catch { photos = {}; }
    }
    if (!photos || typeof photos !== 'object') {
      photos = {};
    }
    // Préserver TOUS les champs existants, y compris plansStructured et les descriptions/prompts
    photos = {
      before: (photos as any).before || [],
      '3d': (photos as any)['3d'] || [],
      during: (photos as any).during || [],
      after: (photos as any).after || [],
      plans: (photos as any).plans || [],
      plansStructured: (photos as any).plansStructured || undefined, // PRÉSERVER la structure des plans
      selectedBeforePhotosForPdf: (photos as any).selectedBeforePhotosForPdf || [],
      selected3dPhotosForPdf: (photos as any).selected3dPhotosForPdf || [],
      selectedPlansPhotosForPdf: (photos as any).selectedPlansPhotosForPdf || [],
      selectedDuringPhotosForPdf: (photos as any).selectedDuringPhotosForPdf || [],
      selectedAfterPhotosForPdf: (photos as any).selectedAfterPhotosForPdf || [],
      coverPhoto: (photos as any).coverPhoto || undefined,
      floor1Description: (photos as any).floor1Description || undefined, // PRÉSERVER les descriptions
      floor2Description: (photos as any).floor2Description || undefined,
      floor1Prompt: (photos as any).floor1Prompt || undefined, // PRÉSERVER les prompts
      floor2Prompt: (photos as any).floor2Prompt || undefined,
    };

    // Ajouter toutes les photos à la catégorie d'un coup
    if (!Array.isArray(photos[category])) photos[category] = [];
    for (const photoPath of photoPaths) {
      const photo: Photo = {
        id: Date.now() + Math.floor(Math.random() * 1000000),
        url: photoPath,
        category: String(category),
        selectedForPdf: false,
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      photos[category].push(photo);
    }

    // S'assurer que tous les champs sont préservés (même s'ils sont undefined)
    const photosToSave = {
      ...photos,
      floor1Description: photos.floor1Description || undefined,
      floor2Description: photos.floor2Description || undefined,
      floor1Prompt: photos.floor1Prompt || undefined,
      floor2Prompt: photos.floor2Prompt || undefined,
      plansStructured: photos.plansStructured || undefined
    };

    // Validation stricte
    const parsed = PhotosSchema.safeParse(photosToSave);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });

    res.json({ 
      success: true, 
      paths: photoPaths,
      count: photoPaths.length
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    if (error instanceof Error && error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: 'Error uploading photos' });
  }
});

// Upload photo
router.post('/:projectId/:category', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const category = req.params.category as keyof Photos;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Stocker le chemin relatif dans la base de données
    const photoPath = `/uploads/${projectId}/${category}/${file.filename}`;

    // Ajouter la photo au projet
    const photo: Photo = {
      id: Date.now(),
      url: photoPath,
      category: String(category),
      selectedForPdf: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await photoService.addPhotoToCategory(projectId, category, photo);

    res.json({ success: true, path: photoPath });
  } catch (error) {
    console.error('Error uploading photo:', error);
    if (error instanceof Error && error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: 'Error uploading photo' });
  }
});

// Get selected photos for PDF
router.get('/project/:projectId/selected-for-pdf', async (req: Request, res: Response) => {
  
  const paramsParsed = ProjectIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    console.error('Validation error:', paramsParsed.error);
    return res.status(400).json({ error: 'Invalid projectId', details: paramsParsed.error.errors });
  }

  try {
    const projectId = parseInt(req.params.projectId, 10);
    
    
    if (isNaN(projectId)) {
      console.error('Invalid project ID:', req.params.projectId);
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    
    const selectedPhotos = await photoService.getSelectedPhotosForPdf(projectId);
    
    
    const apiResponse = { 
      success: true, 
      selectedPhotos: {
        before: selectedPhotos.selectedBeforePhotosForPdf,
        '3d': selectedPhotos.selected3dPhotosForPdf,
        plans: selectedPhotos.selectedPlansPhotosForPdf,
        during: selectedPhotos.selectedDuringPhotosForPdf,
        after: selectedPhotos.selectedAfterPhotosForPdf
      }
    };
    
    
    res.json(apiResponse);
  } catch (error) {
    console.error('Error getting selected photos:', error);
    if (error instanceof Error && error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: 'Error getting selected photos' });
  }
});

// GET /api/photos/project/:projectId - Récupère toutes les photos d'un projet
router.get('/project/:projectId', async (req: Request, res: Response) => {
  const paramsParsed = ProjectIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({ error: 'Invalid projectId', details: paramsParsed.error.errors });
  }
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Récupérer directement depuis Prisma (sans passer par le service pour éviter les boucles)
    const project = await prisma.project.findUnique({ where: { project_id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    let photos = project.photos;
    if (typeof photos === 'string') {
      try {
        photos = JSON.parse(photos);
      } catch {
        photos = {
          before: [],
          during: [],
          after: [],
          '3d': [],
          plans: [],
          selectedBeforePhotosForPdf: [],
          selected3dPhotosForPdf: [],
          selectedPlansPhotosForPdf: [],
          selectedDuringPhotosForPdf: [],
          selectedAfterPhotosForPdf: [],
          coverPhoto: undefined
        };
      }
    }
    // Retourner directement les données (PhotosSchema.passthrough() préserve tous les champs)
    res.json(photos);
  } catch (error) {
    console.error('Error fetching photos:', error);
    if (error instanceof Error && error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: 'Error loading photos' });
  }
});

// Récupérer toutes les photos d'un projet
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const photos = await photoService.getProjectPhotos(projectId);
    res.json(photos);
  } catch (error) {
    console.error('Error getting project photos:', error);
    res.status(500).json({ error: 'Failed to get project photos' });
  }
});

// Récupérer les photos d'une catégorie
router.get('/:projectId/:category', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const category = req.params.category as keyof Photos;
    const photos = await photoService.getCategoryPhotos(projectId, category);
    res.json(photos);
  } catch (error) {
    console.error('Error getting category photos:', error);
    res.status(500).json({ error: 'Failed to get category photos' });
  }
});

// Toggle photo selection for PDF
router.post('/:projectId/:category/toggle-pdf', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const category = req.params.category as keyof Photos;
    // Validation Zod du body
    const parsed = TogglePdfPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
    }
    const { photoPath, selected } = parsed.data;

    const photos = await photoService.getCategoryPhotos(projectId, category);
    const photo = photos.find((p: Photo) => p.url === photoPath);
    if (!photo) {
      return res.status(400).json({ error: 'Photo not found in database' });
    }
    // On déduit le type pour togglePhotoForPdf
    let pdfType: 'selectedBeforePhotosForPdf' | 'selected3dPhotosForPdf' | 'selectedPlansPhotosForPdf' | 'selectedDuringPhotosForPdf' | 'selectedAfterPhotosForPdf';
    if (category === 'before') pdfType = 'selectedBeforePhotosForPdf';
    else if (category === '3d') pdfType = 'selected3dPhotosForPdf';
    else if (category === 'plans') pdfType = 'selectedPlansPhotosForPdf';
    else if (category === 'during') pdfType = 'selectedDuringPhotosForPdf';
    else if (category === 'after') pdfType = 'selectedAfterPhotosForPdf';
    else return res.status(400).json({ error: 'Invalid category for PDF selection' });
    await photoService.togglePhotoForPdf(
      projectId,
      photo.id,
      selected,
      pdfType
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling photo selection:', error);
    if (error instanceof Error) {
      if (error.message === 'Project not found') {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (error.message === 'Cette catégorie ne peut pas être sélectionnée pour le PDF') {
        return res.status(400).json({ error: error.message });
      }
    }
    res.status(500).json({ error: 'Error toggling photo selection' });
  }
});

// View photo/file (inline, for preview)
router.get('/:projectId/:category/view', async (req: Request, res: Response) => {
  const paramsParsed = ProjectIdParamSchema.safeParse(req.params);
  const catParsed = CategoryParamSchema.safeParse(req.params);
  const queryParsed = DownloadQuerySchema.safeParse(req.query);
  if (!paramsParsed.success || !catParsed.success || !queryParsed.success) {
    return res.status(400).json({ error: 'Invalid params or query', details: [paramsParsed.error?.errors, catParsed.error?.errors, queryParsed.error?.errors] });
  }
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const category = req.params.category as keyof Photos;
    const { filename } = req.query;
    
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const filePath = path.join('/data/lki/uploads', projectId.toString(), String(category), filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Obtenir le type MIME du fichier
    const ext = path.extname(filename).toLowerCase();
    const mimeType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf'
    }[ext] || 'application/octet-stream';

    // Configurer les en-têtes pour l'affichage inline (pour preview)
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Envoyer le fichier
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error viewing file:', error);
    res.status(500).json({ error: 'Error viewing file' });
  }
});

// Download photo
router.get('/:projectId/:category/download', async (req: Request, res: Response) => {
  const paramsParsed = ProjectIdParamSchema.safeParse(req.params);
  const catParsed = CategoryParamSchema.safeParse(req.params);
  const queryParsed = DownloadQuerySchema.safeParse(req.query);
  if (!paramsParsed.success || !catParsed.success || !queryParsed.success) {
    return res.status(400).json({ error: 'Invalid params or query', details: [paramsParsed.error?.errors, catParsed.error?.errors, queryParsed.error?.errors] });
  }
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const category = req.params.category as keyof Photos;
    const { filename } = req.query;
    
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const filePath = path.join('/data/lki/uploads', projectId.toString(), String(category), filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Obtenir le type MIME du fichier
    const ext = path.extname(filename).toLowerCase();
    const mimeType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf'
    }[ext] || 'application/octet-stream';

    // Configurer les en-têtes pour forcer le téléchargement
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');
    
    // Envoyer le fichier
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading photo:', error);
    res.status(500).json({ error: 'Error downloading photo' });
  }
});

// Supprimer une photo
router.delete('/:projectId/:category', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const category = req.params.category as keyof Photos;
    // Validation Zod du body
    const parsed = DeletePhotoPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
    }
    const { photoPath } = parsed.data;
    
    // Récupérer les photos actuelles pour vérifier que la photo existe
    const photos = await photoService.getCategoryPhotos(projectId, category);
    const photoIndex = photos.findIndex((p: Photo) => p.url === photoPath);
    if (photoIndex === -1) {
      return res.status(400).json({ error: 'Photo not found in database' });
    }

    // Supprimer la photo de la base de données et récupérer l'objet supprimé
    const { deletedPhoto } = await photoService.removePhoto(projectId, category, photoIndex);

    // Supprimer le fichier physique si possible
    if (deletedPhoto && deletedPhoto.url) {
      const absolutePath = path.join('/data/lki', deletedPhoto.url.replace('/uploads/', 'uploads/'));
    try {
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
      } catch (error) {
        console.error('[BACK][DELETE][FILE] Error during file deletion:', error);
        // Continue, don't throw
      }
    }
      
      res.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    if (error instanceof Error && error.message === 'Project not found') {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(500).json({ error: 'Error deleting photo' });
  }
});

// Ajout ou correction de la route POST /project/:projectId/selected-for-pdf
router.post('/project/:projectId/selected-for-pdf', async (req: Request, res: Response) => {
  const paramsParsed = ProjectIdParamSchema.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({ error: 'Invalid projectId', details: paramsParsed.error.errors });
  }
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    const { selectedBeforePhotosForPdf, selected3dPhotosForPdf, selectedPlansPhotosForPdf, selectedDuringPhotosForPdf, selectedAfterPhotosForPdf } = req.body;
    
    // Normaliser les IDs pour s'assurer qu'ils sont des nombres
    const normalizeIds = (ids: any[]): number[] => {
      return ids.map(id => typeof id === 'string' ? parseInt(id, 10) : Number(id)).filter(id => !isNaN(id));
    };
    
    if (Array.isArray(selectedBeforePhotosForPdf)) {
      const normalizedIds = normalizeIds(selectedBeforePhotosForPdf);
      await photoService.setSelectedPhotosForPdf(projectId, 'selectedBeforePhotosForPdf', normalizedIds);
      return res.json({ success: true });
    } else if (Array.isArray(selected3dPhotosForPdf)) {
      const normalizedIds = normalizeIds(selected3dPhotosForPdf);
      await photoService.setSelectedPhotosForPdf(projectId, 'selected3dPhotosForPdf', normalizedIds);
      return res.json({ success: true });
    } else if (Array.isArray(selectedPlansPhotosForPdf)) {
      const normalizedIds = normalizeIds(selectedPlansPhotosForPdf);
      await photoService.setSelectedPhotosForPdf(projectId, 'selectedPlansPhotosForPdf', normalizedIds);
      return res.json({ success: true });
    } else if (Array.isArray(selectedDuringPhotosForPdf)) {
      const normalizedIds = normalizeIds(selectedDuringPhotosForPdf);
      await photoService.setSelectedPhotosForPdf(projectId, 'selectedDuringPhotosForPdf', normalizedIds);
      return res.json({ success: true });
    } else if (Array.isArray(selectedAfterPhotosForPdf)) {
      const normalizedIds = normalizeIds(selectedAfterPhotosForPdf);
      await photoService.setSelectedPhotosForPdf(projectId, 'selectedAfterPhotosForPdf', normalizedIds);
      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: 'Payload must contain selectedBeforePhotosForPdf, selected3dPhotosForPdf, selectedPlansPhotosForPdf, selectedDuringPhotosForPdf or selectedAfterPhotosForPdf as array' });
    }
  } catch (error) {
    console.error('Error updating selected photos for PDF:', error);
    res.status(500).json({ error: 'Error updating selected photos for PDF' });
  }
});

// Sélectionner/désélectionner une photo pour le PDF
router.patch('/:projectId/pdf/:photoId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const photoId = parseInt(req.params.photoId, 10);
    const { selected, type } = req.body;

    if (typeof selected !== 'boolean' || ![
      'selectedBeforePhotosForPdf',
      'selected3dPhotosForPdf',
      'selectedPlansPhotosForPdf',
      'selectedDuringPhotosForPdf',
      'selectedAfterPhotosForPdf'
    ].includes(type)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    await photoService.togglePhotoForPdf(projectId, photoId, selected, type);
    const photos = await photoService.getProjectPhotos(projectId);
    res.json(photos);
  } catch (error) {
    console.error('Error toggling photo for PDF:', error);
    res.status(500).json({ error: 'Failed to toggle photo for PDF' });
  }
});

// Mettre à jour la photo de couverture
router.patch('/:projectId/cover', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const { photoUrl } = req.body;

    if (typeof photoUrl !== 'string' && photoUrl !== undefined) {
      return res.status(400).json({ error: 'Invalid photoUrl' });
    }

    const photos = await photoService.updateCoverPhoto(projectId, photoUrl);
    res.json(photos);
  } catch (error) {
    console.error('Error updating cover photo:', error);
    res.status(500).json({ error: 'Failed to update cover photo' });
  }
});

// Upload de plans structurés avec métadonnées (planType, floor)
router.post('/:projectId/plans/upload-structured', upload.array('photos', 40), async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { planType, floor } = req.body;
    if (!planType || !['before', 'after'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid planType. Must be "before" or "after"' });
    }
    if (!floor || !['1', '2'].includes(floor)) {
      return res.status(400).json({ error: 'Invalid floor. Must be "1" or "2"' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const floorNum = parseInt(floor, 10) as 1 | 2;
    // S'assurer que le répertoire existe
    const plansDir = path.join('/data/lki/uploads', projectId.toString(), 'plans');
    fs.mkdirSync(plansDir, { recursive: true });
    
    // Traiter chaque fichier : convertir les PDFs en images, redimensionner toutes les images
    const processedFiles: string[] = [];
    for (const file of files) {
      const filePath = path.join(plansDir, file.filename);
      const isImage = file.mimetype.startsWith('image/');
      const isPdf = file.mimetype === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf');
      
      let finalFilePath = filePath;
      let finalUrl = `/uploads/${projectId}/plans/${file.filename}`;
      
      if (isPdf) {
        // Convertir le PDF en image PNG
        const imagePath = filePath.replace(/\.pdf$/i, '.png');
        const converted = await convertPdfToImage(filePath, imagePath);
        if (converted) {
          finalFilePath = imagePath;
          finalUrl = `/uploads/${projectId}/plans/${path.basename(imagePath)}`;
        }
      }
      
      // Redimensionner toutes les images (y compris celles converties depuis PDF)
      if (isImage || (isPdf && fs.existsSync(finalFilePath))) {
        const resizedPath = await resizePlanImage(finalFilePath);
        if (resizedPath !== finalFilePath) {
          // Le nom de fichier a peut-être changé (extension)
          finalUrl = `/uploads/${projectId}/plans/${path.basename(resizedPath)}`;
        }
      }
      
      processedFiles.push(finalUrl);
    }
    
    const photoPaths = processedFiles;

    // Récupérer les photos actuelles
    const project = await prisma.project.findUnique({ where: { project_id: projectId } });
    let photos = project?.photos as Photos | null;
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos); } catch { photos = null; }
    }
    if (!photos || typeof photos !== 'object') {
      photos = {
        before: [],
        plans: [],
        during: [],
        after: [],
        '3d': [],
        selectedBeforePhotosForPdf: [],
        selected3dPhotosForPdf: [],
        selectedPlansPhotosForPdf: [],
        selectedDuringPhotosForPdf: [],
        selectedAfterPhotosForPdf: [],
        coverPhoto: undefined,
        plansStructured: undefined,
        floor1Description: undefined,
        floor2Description: undefined,
        floor1Prompt: undefined,
        floor2Prompt: undefined
      };
    } else {
      // PRÉSERVER tous les champs existants
      photos = {
        ...photos,
        before: (photos as any).before || [],
        plans: (photos as any).plans || [],
        during: (photos as any).during || [],
        after: (photos as any).after || [],
        '3d': (photos as any)['3d'] || [],
        selectedBeforePhotosForPdf: (photos as any).selectedBeforePhotosForPdf || [],
        selected3dPhotosForPdf: (photos as any).selected3dPhotosForPdf || [],
        selectedPlansPhotosForPdf: (photos as any).selectedPlansPhotosForPdf || [],
        selectedDuringPhotosForPdf: (photos as any).selectedDuringPhotosForPdf || [],
        selectedAfterPhotosForPdf: (photos as any).selectedAfterPhotosForPdf || [],
        coverPhoto: (photos as any).coverPhoto || undefined,
        plansStructured: (photos as any).plansStructured || undefined,
        floor1Description: (photos as any).floor1Description || undefined,
        floor2Description: (photos as any).floor2Description || undefined,
        floor1Prompt: (photos as any).floor1Prompt || undefined,
        floor2Prompt: (photos as any).floor2Prompt || undefined
      };
    }

    // Initialiser plansStructured si nécessaire
    if (!photos.plansStructured) {
      photos.plansStructured = PlansMigrationService.mergePlansData(photos) || {
        before: { floor1: [], floor2: [] },
        after: { floor1: [], floor2: [] }
      };
    }

    // Créer les nouveaux plans avec métadonnées
    // Récupérer tous les IDs existants depuis plansStructured ET plans pour avoir le vrai maxId
    const allExistingIds: number[] = [];
    if (photos.plans && photos.plans.length > 0) {
      allExistingIds.push(...photos.plans.map(p => p.id));
    }
    if (photos.plansStructured) {
      const getAllPlanIds = (plans: any[] | undefined) => {
        if (!plans) return [];
        return plans.map(p => p.id);
      };
      if (photos.plansStructured.before) {
        allExistingIds.push(...getAllPlanIds(photos.plansStructured.before.floor1));
        allExistingIds.push(...getAllPlanIds(photos.plansStructured.before.floor2));
      }
      if (photos.plansStructured.after) {
        allExistingIds.push(...getAllPlanIds(photos.plansStructured.after.floor1));
        allExistingIds.push(...getAllPlanIds(photos.plansStructured.after.floor2));
      }
    }
    const maxId = allExistingIds.length > 0 ? Math.max(...allExistingIds) : 0;
    // Utiliser les URLs finales (qui peuvent être .png si converties depuis PDF)
    const newPlans: PlanPhoto[] = processedFiles.map((url, index) => ({
      id: maxId + index + 1,
      url,
      category: 'plans',
      selectedForPdf: false,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      planType: planType as 'before' | 'after',
      floor: floorNum,
      floorLabel: PlansMigrationService.getFloorLabel(floorNum)
    }));

    // Ajouter les nouveaux plans à la structure
    const floorKey = `floor${floorNum}` as 'floor1' | 'floor2';
    if (planType === 'before') {
      if (!photos.plansStructured.before) {
        photos.plansStructured.before = { floor1: [], floor2: [] };
      }
      if (!photos.plansStructured.before[floorKey]) {
        photos.plansStructured.before[floorKey] = [];
      }
      photos.plansStructured.before[floorKey]!.push(...newPlans);
    } else {
      if (!photos.plansStructured.after) {
        photos.plansStructured.after = { floor1: [], floor2: [] };
      }
      if (!photos.plansStructured.after[floorKey]) {
        photos.plansStructured.after[floorKey] = [];
      }
      photos.plansStructured.after[floorKey]!.push(...newPlans);
    }

    // Ajouter aussi à plans pour rétrocompatibilité
    photos.plans = [...(photos.plans || []), ...newPlans.map(p => {
      const { planType, floor, floorLabel, ...photo } = p;
      return photo;
    })];

    // S'assurer que tous les champs sont préservés (même s'ils sont undefined)
    const photosToSave = {
      ...photos,
      floor1Description: photos.floor1Description || undefined,
      floor2Description: photos.floor2Description || undefined,
      floor1Prompt: photos.floor1Prompt || undefined,
      floor2Prompt: photos.floor2Prompt || undefined,
      plansStructured: photos.plansStructured || undefined
    };

    // Validation et sauvegarde
    const parsed = PhotosSchema.safeParse(photosToSave);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid photos data', details: parsed.error.errors });
    }

    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });

    const updatedPhotos = await photoService.getProjectPhotos(projectId);
    res.json(updatedPhotos);
  } catch (error) {
    console.error('Error uploading structured plans:', error);
    res.status(500).json({ error: 'Failed to upload plans' });
  }
});

// Supprimer un plan structuré
router.delete('/:projectId/plans/delete-structured', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { photoId, planType, floor } = req.body;
    if (!photoId || typeof photoId !== 'number') {
      return res.status(400).json({ error: 'Invalid photoId' });
    }
    if (!planType || !['before', 'after'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid planType' });
    }
    if (!floor || ![1, 2].includes(floor)) {
      return res.status(400).json({ error: 'Invalid floor' });
    }

    // Récupérer les photos
    const photos = await photoService.getProjectPhotos(projectId);
    
    if (!photos.plansStructured) {
      return res.status(404).json({ error: 'No structured plans found' });
    }

    const floorKey = `floor${floor}` as 'floor1' | 'floor2';
    const typePlans = planType === 'before' ? photos.plansStructured.before : photos.plansStructured.after;
    
    if (!typePlans || !typePlans[floorKey]) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Trouver et supprimer le plan
    const planIndex = typePlans[floorKey]!.findIndex(p => p.id === photoId);
    if (planIndex === -1) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const planToDelete = typePlans[floorKey]![planIndex];
    
    // Supprimer le fichier physique
    try {
      const filePath = path.join('/data/lki', planToDelete.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
    }

    // Supprimer de la structure
    typePlans[floorKey] = typePlans[floorKey]!.filter(p => p.id !== photoId);

    // Supprimer aussi de plans pour rétrocompatibilité
    if (photos.plans) {
      photos.plans = photos.plans.filter(p => p.id !== photoId);
    }

    // Supprimer de selectedPlansPhotosForPdf si présent
    if (photos.selectedPlansPhotosForPdf) {
      photos.selectedPlansPhotosForPdf = photos.selectedPlansPhotosForPdf.filter(id => id !== photoId);
    }

    // S'assurer que tous les champs sont préservés (même s'ils sont undefined)
    const photosToSave = {
      ...photos,
      floor1Description: photos.floor1Description || undefined,
      floor2Description: photos.floor2Description || undefined,
      floor1Prompt: photos.floor1Prompt || undefined,
      floor2Prompt: photos.floor2Prompt || undefined,
      plansStructured: photos.plansStructured || undefined
    };

    // Validation et sauvegarde
    const parsed = PhotosSchema.safeParse(photosToSave);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid photos data', details: parsed.error.errors });
    }

    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });

    const updatedPhotos = await photoService.getProjectPhotos(projectId);
    res.json(updatedPhotos);
  } catch (error) {
    console.error('Error deleting structured plan:', error);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// Sauvegarder les descriptions des niveaux
router.post('/:projectId/plans/description', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { floor1Description, floor2Description, floor1Prompt, floor2Prompt } = req.body;

    // Récupérer le projet
    const project = await prisma.project.findUnique({
      where: { project_id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Récupérer les photos actuelles et PRÉSERVER tous les champs
    let photosRaw = project.photos as Photos | null;
    if (typeof photosRaw === 'string') {
      try { photosRaw = JSON.parse(photosRaw); } catch { photosRaw = null; }
    }
    let photos: Photos = photosRaw || {
      before: [],
      plans: [],
      '3d': [],
      during: [],
      after: [],
      selectedBeforePhotosForPdf: [],
      selected3dPhotosForPdf: [],
      selectedPlansPhotosForPdf: [],
      selectedDuringPhotosForPdf: [],
      selectedAfterPhotosForPdf: []
    };
    // PRÉSERVER tous les champs existants
    if (photosRaw) {
      photos = {
        ...photosRaw,
        before: photosRaw.before || [],
        plans: photosRaw.plans || [],
        '3d': photosRaw['3d'] || [],
        during: photosRaw.during || [],
        after: photosRaw.after || [],
        selectedBeforePhotosForPdf: photosRaw.selectedBeforePhotosForPdf || [],
        selected3dPhotosForPdf: photosRaw.selected3dPhotosForPdf || [],
        selectedPlansPhotosForPdf: photosRaw.selectedPlansPhotosForPdf || [],
        selectedDuringPhotosForPdf: photosRaw.selectedDuringPhotosForPdf || [],
        selectedAfterPhotosForPdf: photosRaw.selectedAfterPhotosForPdf || [],
        plansStructured: photosRaw.plansStructured || undefined,
        floor1Description: photosRaw.floor1Description || undefined,
        floor2Description: photosRaw.floor2Description || undefined,
        floor1Prompt: photosRaw.floor1Prompt || undefined,
        floor2Prompt: photosRaw.floor2Prompt || undefined
      };
    }

    // Mettre à jour les descriptions et prompts
    if (floor1Description !== undefined) {
      photos.floor1Description = floor1Description || undefined;
    }
    if (floor2Description !== undefined) {
      photos.floor2Description = floor2Description || undefined;
    }
    if (floor1Prompt !== undefined) {
      photos.floor1Prompt = floor1Prompt || undefined;
    }
    if (floor2Prompt !== undefined) {
      photos.floor2Prompt = floor2Prompt || undefined;
    }

    // Validation
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid photos data', details: parsed.error.errors });
    }

    // Sauvegarder
    await prisma.project.update({
      where: { project_id: projectId },
      data: { photos: parsed.data as any }
    });

    const updatedPhotos = await photoService.getProjectPhotos(projectId);
    res.json(updatedPhotos);
  } catch (error) {
    console.error('Error saving floor descriptions:', error);
    res.status(500).json({ error: 'Failed to save floor descriptions' });
  }
});

// Fonction pour convertir une image en base64 (gère aussi les PDFs en les convertissant en images)
async function imageToBase64(imagePath: string): Promise<string | null> {
  try {
    if (!fs.existsSync(imagePath)) {
      return null;
    }
    
    const ext = path.extname(imagePath).toLowerCase();
    let finalImagePath = imagePath;
    
    // Si c'est un PDF, le convertir en PNG d'abord
    if (ext === '.pdf') {
      const pngPath = imagePath.replace(/\.pdf$/i, '.png');
      
      // Vérifier si une version PNG existe déjà
      if (fs.existsSync(pngPath)) {
        finalImagePath = pngPath;
      } else {
        // Convertir le PDF en PNG
        const converted = await convertPdfToImage(imagePath, pngPath);
        if (converted && fs.existsSync(pngPath)) {
          finalImagePath = pngPath;
        } else {
          console.error(`[OpenAI][PLANS] Impossible de convertir le PDF en image: ${imagePath}`);
          return null;
        }
      }
    }
    
    const imageBuffer = fs.readFileSync(finalImagePath);
    const base64 = imageBuffer.toString('base64');
    // Déterminer le type MIME
    const finalExt = path.extname(finalImagePath).toLowerCase();
    const mimeType = finalExt === '.png' ? 'image/png' : finalExt === '.jpg' || finalExt === '.jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`[OpenAI][PLANS] Erreur lors de la conversion de l'image en base64:`, error);
    return null;
  }
}

// Générer une description de niveau avec OpenAI (avec analyse des plans si disponibles)
router.post('/:projectId/plans/generate-description', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const { prompt, floor } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      console.error('[OpenAI][PLANS] Prompt manquant ou invalide');
      return res.status(400).json({ error: 'Prompt requis' });
    }
    if (!floor || (floor !== 1 && floor !== 2)) {
      console.error('[OpenAI][PLANS] Floor invalide:', floor);
      return res.status(400).json({ error: 'Floor doit être 1 ou 2' });
    }

    const openai = createOpenAIClient();
    if (!openai) {
      return res.status(503).json({ error: 'Service indisponible: clé OpenAI absente' });
    }

    // Récupérer les plans avant/après pour l'étage concerné
    const project = await prisma.project.findUnique({ where: { project_id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    let photos = project.photos as Photos | null;
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos); } catch { photos = null; }
    }

    const plansStructure = photos ? PlansMigrationService.mergePlansData(photos) : null;
    const floorKey = floor === 1 ? 'floor1' : 'floor2';
    
    // Récupérer les plans avant et après pour cet étage
    const beforePlans = plansStructure?.before?.[floorKey] || [];
    const afterPlans = plansStructure?.after?.[floorKey] || [];

    // Convertir les images en base64 (prendre le premier plan de chaque type)
    const BASE_IMAGE_URL = process.env.BASE_PDF_IMAGE_URL || 'http://163.172.32.45:3001';
    const uploadsDir = '/data/lki/uploads';
    
    let beforeImageBase64: string | null = null;
    let afterImageBase64: string | null = null;

    if (beforePlans.length > 0) {
      const beforePlan = beforePlans[0];
      const beforePath = beforePlan.url.startsWith('/uploads/') 
        ? path.join(uploadsDir, beforePlan.url.replace('/uploads/', ''))
        : path.join(uploadsDir, String(projectId), 'plans', path.basename(beforePlan.url));
      beforeImageBase64 = await imageToBase64(beforePath);
    }

    if (afterPlans.length > 0) {
      const afterPlan = afterPlans[0];
      const afterPath = afterPlan.url.startsWith('/uploads/') 
        ? path.join(uploadsDir, afterPlan.url.replace('/uploads/', ''))
        : path.join(uploadsDir, String(projectId), 'plans', path.basename(afterPlan.url));
      afterImageBase64 = await imageToBase64(afterPath);
    }

    const floorLabel = floor === 1 ? '1er niveau' : '2ème niveau';
    const systemPrompt = `Tu es un expert en rénovation immobilière. Tu rédiges des descriptions professionnelles et détaillées des travaux de rénovation pour des biens immobiliers. Les descriptions doivent être claires, précises et mettre en avant les améliorations apportées.`;

    // Prompt de base fixe pour motiver le financement bancaire
    const basePrompt = `Projet de rénovation à destination d'un banquier pour motiver le financement. Garde un ton professionnel et précis et reste dans un format de 100 mots.`;
    
    // Construire le message avec ou sans images
    const messages: any[] = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    const userMessage: any = {
      role: "user",
      content: []
    };

    // Ajouter les images si disponibles
    if (beforeImageBase64 && afterImageBase64) {
      userMessage.content.push(
        {
          type: "text",
          text: `Analyse ces deux plans d'architecture pour le ${floorLabel}:\n\n1. Le premier plan montre l'état AVANT les travaux\n2. Le second plan montre l'état APRÈS les travaux\n\nIdentifie les principales modifications : agencement des pièces, création/suppression de cloisons, déplacement d'éléments (escalier, cuisine, etc.), ajout d'espaces, amélioration de la circulation.\n\nEnsuite, rédige une description professionnelle qui combine :\n- Les observations visuelles des plans\n- Le prompt suivant : "${basePrompt}\n\nDétails spécifiques pour le ${floorLabel}:\n${prompt}"\n\nCONTRAINTE STRICTE : La description doit contenir EXACTEMENT 100 mots maximum. Compte tes mots et arrête-toi à 100 mots. Sois concis, professionnel et mets en avant la valeur ajoutée des travaux. Ne dépasse JAMAIS 100 mots.`
        },
        {
          type: "image_url",
          image_url: { url: beforeImageBase64 }
        },
        {
          type: "image_url",
          image_url: { url: afterImageBase64 }
        }
      );
      messages.push(userMessage);
      
      // Utiliser GPT-4o qui supporte les images
      // max_tokens ajusté pour correspondre à environ 100 mots (≈ 150 tokens en français)
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 150, // Limite stricte pour forcer 100 mots max
        temperature: 0.7,
      });

      const description = completion.choices[0]?.message?.content;

      if (!description) {
        throw new Error('Pas de réponse de l\'API OpenAI');
      }

      res.json({ description: description.trim() });
    } else {
      // Fallback : utiliser uniquement le texte si pas d'images
      const fullUserPrompt = `${basePrompt}\n\nDétails spécifiques pour le ${floorLabel}:\n${prompt}\n\nCONTRAINTE STRICTE : La description doit contenir EXACTEMENT 100 mots maximum. Compte tes mots et arrête-toi à 100 mots. Ne dépasse JAMAIS 100 mots.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: fullUserPrompt
          }
        ],
        max_tokens: 150, // Limite stricte pour forcer 100 mots max
        temperature: 0.7,
      });

      const description = completion.choices[0]?.message?.content;

      if (!description) {
        throw new Error('Pas de réponse de l\'API OpenAI');
      }

      res.json({ description: description.trim() });
    }
  } catch (error) {
    console.error('[OpenAI][PLANS] Erreur lors de la génération de la description:', error);
    if (error instanceof Error) {
      console.error('[OpenAI][PLANS] Message d\'erreur:', error.message);
      console.error('[OpenAI][PLANS] Stack:', error.stack);
    }
    res.status(500).json({ 
      error: 'Erreur lors de la génération de la description',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    });
  }
});

// Endpoint pour forcer la migration des plans existants vers plansStructured
router.post('/:projectId/plans/migrate', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const photos = await photoService.getProjectPhotos(projectId);
    
    // La migration est déjà faite automatiquement dans getProjectPhotos
    // Mais on force la sauvegarde si nécessaire
    if (photos.plansStructured && photos.plans && photos.plans.length > 0) {
      const syncedPhotos = PlansMigrationService.syncPlansData(photos);
      const parsed = PhotosSchema.safeParse(syncedPhotos);
      
      if (parsed.success) {
        await prisma.project.update({
          where: { project_id: projectId },
          data: { photos: parsed.data as any }
        });
        
        const updatedPhotos = await photoService.getProjectPhotos(projectId);
        return res.json({ 
          success: true, 
          message: 'Migration réussie',
          photos: updatedPhotos 
        });
      }
    }

    const updatedPhotos = await photoService.getProjectPhotos(projectId);
    res.json({ 
      success: true, 
      message: 'Plans déjà migrés ou aucun plan à migrer',
      photos: updatedPhotos 
    });
  } catch (error) {
    console.error('Error migrating plans:', error);
    res.status(500).json({ error: 'Failed to migrate plans' });
  }
});

export default router; 