import { PrismaClient } from '@prisma/client';
import { Photos, PhotosSchema } from '../../../shared/types/photos';
import { PlansMigrationService } from '../services/plansMigration.service';

const prisma = new PrismaClient();

/**
 * Script de migration pour convertir tous les plans existants vers plansStructured
 * Usage: npx ts-node backend/src/scripts/migratePlans.ts [projectId]
 */
async function migratePlans(projectId?: number) {
  try {
    const where = projectId ? { project_id: projectId } : {};
    
    const projects = await prisma.project.findMany({
      where,
      select: { project_id: true, photos: true }
    });

    console.log(`Migration de ${projects.length} projet(s)...`);

    for (const project of projects) {
      if (!project.photos) continue;

      let photos = project.photos;
      if (typeof photos === 'string') {
        try {
          photos = JSON.parse(photos);
        } catch {
          console.error(`[${project.project_id}] Erreur parsing photos JSON`);
          continue;
        }
      }

      const parsed = PhotosSchema.safeParse(photos);
      if (!parsed.success) {
        console.error(`[${project.project_id}] Photos invalides:`, parsed.error.message);
        continue;
      }

      const photosData = parsed.data;

      // Vérifier si migration nécessaire
      if (photosData.plansStructured) {
        console.log(`[${project.project_id}] plansStructured existe déjà, skip`);
        continue;
      }

      if (!photosData.plans || photosData.plans.length === 0) {
        console.log(`[${project.project_id}] Aucun plan à migrer`);
        continue;
      }

      console.log(`[${project.project_id}] Migration de ${photosData.plans.length} plan(s)...`);

      // Migration
      const syncedPhotos = PlansMigrationService.syncPlansData(photosData);

      if (syncedPhotos.plansStructured) {
        // Validation
        const validated = PhotosSchema.safeParse(syncedPhotos);
        if (!validated.success) {
          console.error(`[${project.project_id}] Erreur validation après migration:`, validated.error.message);
          continue;
        }

        // Sauvegarde
        await prisma.project.update({
          where: { project_id: project.project_id },
          data: { photos: validated.data as any }
        });

        console.log(`[${project.project_id}] ✓ Migration réussie`);
      } else {
        console.log(`[${project.project_id}] Aucune structure créée`);
      }
    }

    console.log('Migration terminée !');
  } catch (error) {
    console.error('Erreur lors de la migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
const projectIdArg = process.argv[2];
const projectId = projectIdArg ? parseInt(projectIdArg, 10) : undefined;

if (projectIdArg && isNaN(projectId!)) {
  console.error('Project ID invalide');
  process.exit(1);
}

migratePlans(projectId).catch(console.error);


