"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoService = void 0;
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
const categoryToField = {
    before: 'photosBefore',
    '3d': 'photos3d',
    during: 'photosDuring',
    after: 'photosAfter'
};
const categoryToSelectedField = {
    before: 'selectedBeforePhotosForPdf',
    '3d': 'selected3dPhotosForPdf',
    during: null,
    after: null
};
class PhotoService {
    isStringArray(value) {
        return Array.isArray(value) && value.every(item => typeof item === 'string');
    }
    getPhotosArray(value) {
        console.log('\n=== getPhotosArray START ===');
        console.log('Input value type:', typeof value);
        console.log('Input value:', value);
        if (!value) {
            console.log('No value, returning empty array');
            return [];
        }
        if (typeof value === 'string') {
            console.log('Value is string, attempting to parse JSON');
            try {
                const parsed = JSON.parse(value);
                console.log('Successfully parsed JSON:', parsed);
                if (Array.isArray(parsed)) {
                    const result = parsed.map(String);
                    console.log('Converted to string array:', result);
                    return result;
                }
                console.log('Parsed value is not an array, returning empty array');
                return [];
            }
            catch (error) {
                console.log('Failed to parse JSON:', error);
                return [];
            }
        }
        if (Array.isArray(value)) {
            console.log('Value is already an array');
            const result = value.map(String);
            console.log('Converted to string array:', result);
            return result;
        }
        console.log('Value is neither string nor array, returning empty array');
        console.log('=== getPhotosArray END ===\n');
        return [];
    }
    createPhotoUpdate(field, photos) {
        return {
            [field]: photos
        };
    }
    async addPhoto(projectId, category, photoPath) {
        const field = categoryToField[category];
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        const currentPhotos = this.getPhotosArray(project[field]);
        const updateData = this.createPhotoUpdate(field, [...currentPhotos, photoPath]);
        return prisma.project.update({
            where: { id: projectId },
            data: updateData
        });
    }
    async removePhoto(projectId, category, index) {
        const field = categoryToField[category];
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        const currentPhotos = this.getPhotosArray(project[field]);
        if (index < 0 || index >= currentPhotos.length) {
            throw new Error('Invalid photo index');
        }
        // Récupérer le chemin relatif de la base de données
        const relativePhotoPath = currentPhotos[index];
        // Convertir le chemin relatif en chemin absolu
        const absolutePhotoPath = relativePhotoPath.replace('/uploads', '/data/lki/uploads');
        console.log('Tentative de suppression du fichier :', absolutePhotoPath);
        // Supprimer le fichier physique avec le chemin absolu
        if (fs_1.default.existsSync(absolutePhotoPath)) {
            try {
                fs_1.default.unlinkSync(absolutePhotoPath);
                console.log('Fichier supprimé avec succès :', absolutePhotoPath);
            }
            catch (error) {
                console.error('Erreur lors de la suppression du fichier :', error);
                throw new Error('Erreur lors de la suppression du fichier');
            }
        }
        else {
            console.log('Fichier non trouvé :', absolutePhotoPath);
        }
        const updatedPhotos = currentPhotos.filter((_, i) => i !== index);
        const updateData = this.createPhotoUpdate(field, updatedPhotos);
        return prisma.project.update({
            where: { id: projectId },
            data: updateData
        });
    }
    async getProjectPhotos(projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        return {
            before: this.getPhotosArray(project.photosBefore),
            '3d': this.getPhotosArray(project.photos3d),
            during: this.getPhotosArray(project.photosDuring),
            after: this.getPhotosArray(project.photosAfter)
        };
    }
    async getCategoryPhotos(projectId, category) {
        const field = categoryToField[category];
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        return this.getPhotosArray(project[field]);
    }
    async togglePhotoForPdf(projectId, photoPath, selected, type) {
        var _a;
        console.log('=== togglePhotoForPdf START ===');
        console.log('ProjectId:', projectId);
        console.log('PhotoPath:', photoPath);
        console.log('Selected:', selected);
        console.log('Type:', type);
        if (selected !== true && selected !== false) {
            throw new Error('Invalid selected value');
        }
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        // Normaliser le chemin de la photo
        const normalizedPath = photoPath.startsWith('/uploads/') ? photoPath : `/uploads/${photoPath}`;
        console.log('Normalized path:', normalizedPath);
        const field = type === 'before' ? 'selectedBeforePhotosForPdf' : 'selected3dPhotosForPdf';
        const currentPhotos = this.getPhotosArray(project[field]);
        console.log('Current photos (avant modif):', currentPhotos);
        console.log('Type de currentPhotos:', typeof currentPhotos, Array.isArray(currentPhotos));
        let updatedPhotos;
        if (selected) {
            // Vérifier si la photo n'est pas déjà sélectionnée
            if (!currentPhotos.includes(normalizedPath)) {
                updatedPhotos = [...currentPhotos, normalizedPath];
            }
            else {
                updatedPhotos = currentPhotos;
            }
        }
        else {
            updatedPhotos = currentPhotos.filter(path => path !== normalizedPath);
        }
        console.log('Updated photos (après modif):', updatedPhotos);
        const updateResult = await prisma.project.update({
            where: { id: projectId },
            data: {
                [field]: updatedPhotos
            }
        });
        console.log('Résultat update Prisma:', updateResult[field]);
        // Vérification post-update
        const updatedField = ((_a = updateResult[field]) !== null && _a !== void 0 ? _a : []);
        if (selected && !updatedField.includes(normalizedPath)) {
            console.error('ERREUR: La photo aurait dû être ajoutée mais ne l\'est pas dans la BDD!');
        }
        if (!selected && updatedField.includes(normalizedPath)) {
            console.error('ERREUR: La photo aurait dû être retirée mais est toujours présente dans la BDD!');
        }
        console.log('=== End togglePhotoForPdf ===');
    }
    async getSelectedPhotosForPdf(projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        const parsePhotos = (value) => {
            if (!value)
                return [];
            try {
                const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                return Array.isArray(parsed) ? parsed.map(item => String(item)) : [];
            }
            catch (error) {
                console.error('Error parsing photos:', error);
                return [];
            }
        };
        return {
            before: parsePhotos(project.selectedBeforePhotosForPdf),
            '3d': parsePhotos(project.selected3dPhotosForPdf)
        };
    }
    // Méthode pour mettre à jour les chemins des photos
    async updateAllPhotoPaths() {
        const projects = await prisma.project.findMany();
        for (const project of projects) {
            const updateData = {};
            // Met à jour les chemins pour chaque catégorie
            for (const [category, field] of Object.entries(categoryToField)) {
                const dir = path_1.default.join('/data/lki/uploads', String(project.id), category);
                let updatedPhotos;
                if (fs_1.default.existsSync(dir)) {
                    updatedPhotos = fs_1.default.readdirSync(dir)
                        .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
                        .map(f => `/uploads/${project.id}/${category}/${f}`);
                    updateData[field] = updatedPhotos;
                    console.log(`[updateAllPhotoPaths] Projet ${project.id} - ${field} mis à jour avec ${updatedPhotos.length} fichiers.`);
                }
                else {
                    // Si le dossier n'existe pas, NE PAS écraser la valeur existante
                    updatedPhotos = this.getPhotosArray(project[field]);
                    updateData[field] = updatedPhotos;
                    console.warn(`[updateAllPhotoPaths] Projet ${project.id} - ${field} NON mis à jour (dossier manquant), ancienne valeur conservée (${updatedPhotos.length} fichiers).`);
                }
            }
            // Met à jour les chemins pour les photos sélectionnées pour le PDF
            const beforeSelected = this.getPhotosArray(project.selectedBeforePhotosForPdf);
            const threeDSelected = this.getPhotosArray(project.selected3dPhotosForPdf);
            updateData.selectedBeforePhotosForPdf = beforeSelected.map(path => path.replace('/data/lki/uploads', '/uploads'));
            updateData.selected3dPhotosForPdf = threeDSelected.map(path => path.replace('/data/lki/uploads', '/uploads'));
            // Met à jour la photo de couverture si elle existe
            if (project.coverPhoto) {
                updateData.coverPhoto = project.coverPhoto.replace('/data/lki/uploads', '/uploads');
            }
            // Applique les mises à jour
            await prisma.project.update({
                where: { id: project.id },
                data: updateData
            });
        }
    }
    async removePhotoByPath(projectId, category, photoPath) {
        const field = categoryToField[category];
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        const currentPhotos = this.getPhotosArray(project[field]);
        const updatedPhotos = currentPhotos.filter(p => p !== photoPath);
        const updateData = this.createPhotoUpdate(field, updatedPhotos);
        return prisma.project.update({
            where: { id: projectId },
            data: updateData
        });
    }
}
exports.PhotoService = PhotoService;
