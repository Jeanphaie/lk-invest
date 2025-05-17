import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PhotoService } from '../services/photo.service';
import { Photos, Photo, PhotosSchema } from '../../../shared/types/photos';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const router: Router = express.Router();
const photoService = new PhotoService();
const prisma = new PrismaClient();

// Configuration de multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const projectId = parseInt(req.params.projectId, 10);
    const category = req.params.category;
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
  category: z.enum(['before', '3d', 'during', 'after']),
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
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    let photos = project?.photos;
    if (typeof photos === 'string') {
      try { photos = JSON.parse(photos); } catch { photos = {}; }
    }
    if (!photos || typeof photos !== 'object') {
      photos = {};
    }
    photos = {
      before: (photos as any).before || [],
      '3d': (photos as any)['3d'] || [],
      during: (photos as any).during || [],
      after: (photos as any).after || [],
      selectedBeforePhotosForPdf: (photos as any).selectedBeforePhotosForPdf || [],
      selected3dPhotosForPdf: (photos as any).selected3dPhotosForPdf || [],
      coverPhoto: (photos as any).coverPhoto || undefined,
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

    // Validation stricte
    const parsed = PhotosSchema.safeParse(photos);
    if (!parsed.success) {
      throw new Error('Invalid photos data: ' + parsed.error.message);
    }
    await prisma.project.update({
      where: { id: projectId },
      data: { photos: parsed.data }
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
        '3d': selectedPhotos.selected3dPhotosForPdf
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

    // Patch: fetch project and robustly parse photos field
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    let photos = project?.photos;
    if (typeof photos === 'string') {
      try {
        photos = JSON.parse(photos);
      } catch {
        photos = {
          before: [],
          during: [],
          after: [],
          '3d': [],
          selectedBeforePhotosForPdf: [],
          selected3dPhotosForPdf: [],
          coverPhoto: undefined
        };
      }
    }
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
    const pdfType = category === 'before' ? 'selectedBeforePhotosForPdf' : 'selected3dPhotosForPdf';
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
      '.webm': 'video/webm'
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
          console.log('[BACK][DELETE][FILE] File deleted successfully:', absolutePath);
      } else {
          console.log('[BACK][DELETE][FILE] File not found at path:', absolutePath);
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
    const { selectedBeforePhotosForPdf, selected3dPhotosForPdf } = req.body;
    console.log('[BACK][PDF][ROUTE][BODY]', req.body);
    if (Array.isArray(selectedBeforePhotosForPdf)) {
      await photoService.setSelectedPhotosForPdf(projectId, 'selectedBeforePhotosForPdf', selectedBeforePhotosForPdf);
      console.log('[BACK][PDF][ROUTE][SET] selectedBeforePhotosForPdf', selectedBeforePhotosForPdf);
      return res.json({ success: true });
    } else if (Array.isArray(selected3dPhotosForPdf)) {
      await photoService.setSelectedPhotosForPdf(projectId, 'selected3dPhotosForPdf', selected3dPhotosForPdf);
      console.log('[BACK][PDF][ROUTE][SET] selected3dPhotosForPdf', selected3dPhotosForPdf);
      return res.json({ success: true });
      } else {
      return res.status(400).json({ error: 'Payload must contain selectedBeforePhotosForPdf or selected3dPhotosForPdf as array' });
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

    if (typeof selected !== 'boolean' || !['selectedBeforePhotosForPdf', 'selected3dPhotosForPdf'].includes(type)) {
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

export default router; 