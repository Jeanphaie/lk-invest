"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoController = exports.downloadPhoto = exports.listPhotos = exports.deletePhoto = exports.uploadPhoto = void 0;
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
const categoryToField = {
    before: 'photosBefore',
    '3d': 'photos3d',
    during: 'photosDuring',
    after: 'photosAfter',
};
const uploadPhoto = async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide.' });
        }
        const category = req.params.category;
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'Aucun fichier envoyé.' });
        const field = categoryToField[category];
        if (!field)
            return res.status(400).json({ error: 'Catégorie invalide.' });
        // Chemin relatif à stocker
        const photoPath = `/data/lki/uploads/${projectId}/${category}/${file.filename}`;
        // Récupérer le projet
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project)
            return res.status(404).json({ error: 'Projet non trouvé.' });
        const currentPhotos = JSON.parse(project[field] || '[]');
        currentPhotos.push(photoPath);
        await prisma.project.update({
            where: { id: projectId },
            data: { [field]: JSON.stringify(currentPhotos) }
        });
        res.json({ success: true, path: photoPath });
    }
    catch (e) {
        console.error('Erreur upload photo:', e);
        res.status(500).json({ error: 'Erreur upload photo.' });
    }
};
exports.uploadPhoto = uploadPhoto;
const deletePhoto = async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide.' });
        }
        const category = req.params.category;
        const { photoPath } = req.body;
        if (!photoPath) {
            return res.status(400).json({ error: 'Chemin de la photo requis.' });
        }
        const field = categoryToField[category];
        if (!field)
            return res.status(400).json({ error: 'Catégorie invalide.' });
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project)
            return res.status(404).json({ error: 'Projet non trouvé.' });
        const currentPhotos = JSON.parse(project[field] || '[]');
        // Vérifier que la photo existe dans la liste
        if (!currentPhotos.includes(photoPath)) {
            return res.status(404).json({ error: 'Photo non trouvée dans la base de données.' });
        }
        // Filtrer la photo à supprimer
        const updatedPhotos = currentPhotos.filter((p) => p !== photoPath);
        // Mettre à jour la base de données
        await prisma.project.update({
            where: { id: projectId },
            data: { [field]: JSON.stringify(updatedPhotos) }
        });
        // Convertir le chemin relatif en chemin absolu
        const absolutePath = path_1.default.join('/data/lki', photoPath.replace('/uploads/', 'uploads/'));
        // Essayer de supprimer le fichier physique s'il existe
        if (fs_1.default.existsSync(absolutePath)) {
            fs_1.default.unlinkSync(absolutePath);
            console.log(`Fichier supprimé avec succès: ${absolutePath}`);
        }
        else {
            console.warn(`Fichier non trouvé physiquement mais référence supprimée de la BDD: ${absolutePath}`);
        }
        res.json({ success: true });
    }
    catch (e) {
        console.error('Erreur suppression photo:', e);
        res.status(500).json({ error: 'Erreur suppression photo.' });
    }
};
exports.deletePhoto = deletePhoto;
const listPhotos = async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide.' });
        }
        const category = req.params.category;
        const field = categoryToField[category];
        if (!field)
            return res.status(400).json({ error: 'Catégorie invalide.' });
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project)
            return res.status(404).json({ error: 'Projet non trouvé.' });
        const photos = JSON.parse(project[field] || '[]');
        res.json({ photos });
    }
    catch (e) {
        console.error('Erreur listing photos:', e);
        res.status(500).json({ error: 'Erreur listing photos.' });
    }
};
exports.listPhotos = listPhotos;
const downloadPhoto = async (req, res) => {
    try {
        const projectId = parseInt(req.params.projectId, 10);
        if (isNaN(projectId)) {
            return res.status(400).json({ error: 'ID de projet invalide.' });
        }
        const category = req.params.category;
        const { filename } = req.query;
        if (!filename || typeof filename !== 'string') {
            return res.status(400).json({ error: 'Nom de fichier requis.' });
        }
        const filePath = path_1.default.join('/data/lki/uploads', projectId.toString(), category, filename);
        if (!fs_1.default.existsSync(filePath))
            return res.status(404).json({ error: 'Fichier non trouvé.' });
        res.download(filePath);
    }
    catch (e) {
        console.error('Erreur téléchargement photo:', e);
        res.status(500).json({ error: 'Erreur téléchargement photo.' });
    }
};
exports.downloadPhoto = downloadPhoto;
class PhotoController {
    async uploadPhotos(req, res) {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            if (isNaN(projectId)) {
                return res.status(400).json({ error: 'Invalid project ID' });
            }
            const field = req.params.field;
            const photos = req.body.photos;
            if (!photos || !Array.isArray(photos)) {
                return res.status(400).json({ error: 'Photos array is required' });
            }
            // Vérifier que le projet existe
            const project = await prisma.project.findUnique({
                where: { id: projectId }
            });
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            // Mettre à jour le projet avec les nouvelles photos
            await prisma.project.update({
                where: { id: projectId },
                data: { [field]: JSON.stringify(photos) }
            });
            res.json({ message: 'Photos uploaded successfully' });
        }
        catch (error) {
            console.error('Error uploading photos:', error);
            res.status(500).json({ error: 'Error uploading photos' });
        }
    }
    async updatePhotos(req, res) {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            if (isNaN(projectId)) {
                return res.status(400).json({ error: 'Invalid project ID' });
            }
            const field = req.params.field;
            const photos = req.body.photos;
            // Vérifier que le projet existe
            const project = await prisma.project.findUnique({
                where: { id: projectId }
            });
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            await prisma.project.update({
                where: { id: projectId },
                data: { [field]: JSON.stringify(photos) }
            });
            res.json({ message: 'Photos updated successfully' });
        }
        catch (error) {
            console.error('Error updating photos:', error);
            res.status(500).json({ error: 'Error updating photos' });
        }
    }
    async deletePhoto(req, res) {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            if (isNaN(projectId)) {
                return res.status(400).json({ error: 'Invalid project ID' });
            }
            const field = req.params.field;
            const index = parseInt(req.params.index, 10);
            // Vérifier que le projet existe
            const project = await prisma.project.findUnique({
                where: { id: projectId }
            });
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            // Récupérer le tableau de photos actuel
            const currentPhotos = JSON.parse(project[field] || '[]');
            if (!Array.isArray(currentPhotos)) {
                return res.status(400).json({ error: 'Invalid photo field' });
            }
            // Supprimer la photo à l'index spécifié
            const updatedPhotos = currentPhotos.filter((_, i) => i !== index);
            // Mettre à jour le projet
            await prisma.project.update({
                where: { id: projectId },
                data: { [field]: JSON.stringify(updatedPhotos) }
            });
            res.json({ message: 'Photo deleted successfully' });
        }
        catch (error) {
            console.error('Error deleting photo:', error);
            res.status(500).json({ error: 'Error deleting photo' });
        }
    }
}
exports.PhotoController = PhotoController;
