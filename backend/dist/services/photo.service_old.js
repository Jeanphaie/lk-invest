"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoService = void 0;
const client_1 = require("@prisma/client");
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
    getPhotosArray(field) {
        if (!field)
            return [];
        if (typeof field === 'string') {
            try {
                const parsed = JSON.parse(field);
                return Array.isArray(parsed) ? parsed : [];
            }
            catch (_a) {
                return [];
            }
        }
        if (Array.isArray(field)) {
            return field.map(item => String(item));
        }
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
    async togglePhotoForPdf(projectId, category, photoPath) {
        const selectedField = categoryToSelectedField[category];
        if (!selectedField) {
            throw new Error('Cette catégorie ne peut pas être sélectionnée pour le PDF');
        }
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        const currentSelectedPhotos = this.getPhotosArray(project[selectedField]);
        const isSelected = currentSelectedPhotos.includes(photoPath);
        const updatedSelectedPhotos = isSelected
            ? currentSelectedPhotos.filter(p => p !== photoPath)
            : [...currentSelectedPhotos, photoPath];
        return prisma.project.update({
            where: { id: projectId },
            data: { [selectedField]: JSON.stringify(updatedSelectedPhotos) }
        });
    }
    async getSelectedPhotosForPdf(projectId) {
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });
        if (!project) {
            throw new Error('Project not found');
        }
        return {
            before: this.getPhotosArray(project.selectedBeforePhotosForPdf),
            '3d': this.getPhotosArray(project.selected3dPhotosForPdf)
        };
    }
}
exports.PhotoService = PhotoService;
