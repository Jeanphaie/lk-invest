"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const photo_service_1 = require("../services/photo.service");
const router = express_1.default.Router();
const photoService = new photo_service_1.PhotoService();
// Configuration de multer pour le stockage des fichiers
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const projectId = parseInt(req.params.projectId, 10);
        const category = req.params.category;
        const dir = path_1.default.join('/data/lki/uploads', projectId.toString(), category);
        fs_1.default.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path_1.default.extname(file.originalname));
    }
});
// Configuration des types de fichiers acceptés
const fileFilter = (req, file, cb) => {
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
    }
    else {
        cb(new Error('Type de fichier non supporté'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max
    }
});
// Get selected photos for PDF
router.get('/:projectId/selected-for-pdf', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const selectedPhotos = await photoService.getSelectedPhotosForPdf(projectId);
        console.log('Selected photos from service:', selectedPhotos);
        // Renvoyer la structure attendue par le frontend
        res.json({
            success: true,
            selectedPhotos: {
                before: selectedPhotos.before,
                '3d': selectedPhotos['3d']
            }
        });
    }
    catch (error) {
        console.error('Error getting selected photos:', error);
        if (error instanceof Error && error.message === 'Project not found') {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.status(500).json({ error: 'Error getting selected photos' });
    }
});
// Upload photo
router.post('/:projectId/:category', upload.single('photo'), async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const category = req.params.category;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Stocker le chemin relatif dans la base de données
        const photoPath = `/uploads/${projectId}/${category}/${file.filename}`;
        // Ajouter la photo au projet
        await photoService.addPhoto(projectId, category, photoPath);
        res.json({ success: true, path: photoPath });
    }
    catch (error) {
        console.error('Error uploading photo:', error);
        if (error instanceof Error && error.message === 'Project not found') {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.status(500).json({ error: 'Error uploading photo' });
    }
});
// Upload multiple photos
router.post('/:projectId/:category/multiple', upload.array('photos', 10), async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const category = req.params.category;
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const photoPaths = files.map(file => `/uploads/${projectId}/${category}/${file.filename}`);
        // Ajouter les photos au projet
        for (const photoPath of photoPaths) {
            await photoService.addPhoto(projectId, category, photoPath);
        }
        res.json({
            success: true,
            paths: photoPaths,
            count: photoPaths.length
        });
    }
    catch (error) {
        console.error('Error uploading photos:', error);
        if (error instanceof Error && error.message === 'Project not found') {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.status(500).json({ error: 'Error uploading photos' });
    }
});
// GET /api/photos/project/:projectId - Récupère toutes les photos d'un projet
router.get('/project/:projectId', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const photos = await photoService.getProjectPhotos(projectId);
        res.json(photos);
    }
    catch (error) {
        console.error('Error fetching photos:', error);
        if (error instanceof Error && error.message === 'Project not found') {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.status(500).json({ error: 'Error loading photos' });
    }
});
// Supprimer une photo
router.delete('/:projectId/:category', async (req, res) => {
    try {
        console.log('Delete request received:', Object.assign(Object.assign({}, req.params), { body: req.body }));
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const category = req.params.category;
        const { photoPath } = req.body;
        if (!photoPath) {
            return res.status(400).json({ error: 'Photo path is required' });
        }
        console.log('Fetching photos for category:', category);
        // Récupérer les photos actuelles pour vérifier que la photo existe
        const photos = await photoService.getCategoryPhotos(projectId, category);
        console.log('Current photos:', photos);
        if (!photos.includes(photoPath)) {
            return res.status(400).json({ error: 'Photo not found in database' });
        }
        // Supprimer le fichier physique
        console.log('Photo path from DB:', photoPath);
        // Le chemin dans la base de données est /uploads/... mais le fichier est dans /data/lki/uploads/...
        const absolutePath = path_1.default.join('/data/lki', photoPath.replace('/uploads/', 'uploads/'));
        console.log('Attempting to delete file at absolute path:', absolutePath);
        console.log('Does file exist?', fs_1.default.existsSync(absolutePath));
        try {
            // Vérifier si le fichier existe avec le chemin absolu
            if (fs_1.default.existsSync(absolutePath)) {
                fs_1.default.unlinkSync(absolutePath);
                console.log('File deleted successfully:', absolutePath);
            }
            else {
                console.log('File not found at path:', absolutePath);
            }
            // Supprimer la photo de la base de données
            await photoService.removePhotoByPath(projectId, category, photoPath);
            console.log('Database record updated successfully');
            res.json({ success: true });
        }
        catch (error) {
            console.error('Error during file deletion:', error);
            res.status(500).json({ error: 'Error deleting file' });
        }
    }
    catch (error) {
        console.error('Error deleting photo:', error);
        if (error instanceof Error && error.message === 'Project not found') {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.status(500).json({ error: 'Error deleting photo' });
    }
});
// Lister les photos d'une catégorie
router.get('/:projectId/:category', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const category = req.params.category;
        const photos = await photoService.getCategoryPhotos(projectId, category);
        res.json({ photos });
    }
    catch (error) {
        console.error('Error listing photos:', error);
        if (error instanceof Error && error.message === 'Project not found') {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.status(500).json({ error: 'Error listing photos' });
    }
});
// Toggle photo selection for PDF
router.post('/:projectId/:category/toggle-pdf', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const category = req.params.category;
        const { photoPath, selected } = req.body;
        if (!photoPath || typeof selected !== 'boolean') {
            return res.status(400).json({ error: 'Photo path and selected boolean are required' });
        }
        await photoService.togglePhotoForPdf(projectId, photoPath, selected, // true = ajoute, false = retire
        category);
        res.json({ success: true });
    }
    catch (error) {
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
// Route temporaire pour la migration des chemins
router.post('/migrate-paths', async (req, res) => {
    try {
        await photoService.updateAllPhotoPaths();
        res.json({ success: true, message: 'Migration des chemins terminée' });
    }
    catch (error) {
        console.error('Error during path migration:', error);
        res.status(500).json({ error: 'Erreur lors de la migration des chemins' });
    }
});
// Download photo
router.get('/:projectId/:category/download', async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'Invalid project ID' });
        }
        const category = req.params.category;
        const { filename } = req.query;
        if (!filename || typeof filename !== 'string') {
            return res.status(400).json({ error: 'Filename is required' });
        }
        const filePath = path_1.default.join('/data/lki/uploads', projectId.toString(), category, filename);
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        // Obtenir le type MIME du fichier
        const ext = path_1.default.extname(filename).toLowerCase();
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
        res.setHeader('Content-Length', fs_1.default.statSync(filePath).size);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        // Envoyer le fichier
        const fileStream = fs_1.default.createReadStream(filePath);
        fileStream.pipe(res);
    }
    catch (error) {
        console.error('Error downloading photo:', error);
        res.status(500).json({ error: 'Error downloading photo' });
    }
});
exports.default = router;
