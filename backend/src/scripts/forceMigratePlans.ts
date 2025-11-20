import { PrismaClient } from '@prisma/client';
import { PhotosSchema } from '../../../shared/types/photos';
import { PlansMigrationService } from '../services/plansMigration.service';

const prisma = new PrismaClient();

async function forceMigratePlans(projectId?: number) {
  try {
    const where = projectId ? { project_id: projectId } : {};
    
    const projects = await prisma.project.findMany({
      where,
      select: {
        project_id: true,
        photos: true
      }
    });

    console.log(`Found ${projects.length} project(s) to check`);

    for (const project of projects) {
      if (!project.photos) {
        console.log(`Project ${project.project_id}: No photos, skipping`);
        continue;
      }

      const photos = project.photos as any;
      
      // Vérifier si des plans existent et si plansStructured n'existe pas
      if (photos.plans && photos.plans.length > 0 && !photos.plansStructured) {
        console.log(`Project ${project.project_id}: Migrating ${photos.plans.length} plan(s)`);
        
        // Valider avec le schéma
        const parsed = PhotosSchema.safeParse(photos);
        if (!parsed.success) {
          console.error(`Project ${project.project_id}: Invalid photos data:`, parsed.error.message);
          continue;
        }

        // Migrer
        const syncedPhotos = PlansMigrationService.syncPlansData(parsed.data);
        
        if (syncedPhotos.plansStructured) {
          // Sauvegarder
          const validated = PhotosSchema.safeParse(syncedPhotos);
          if (validated.success) {
            await prisma.project.update({
              where: { project_id: project.project_id },
              data: { photos: validated.data as any }
            });
            console.log(`Project ${project.project_id}: Migration successful`);
          } else {
            console.error(`Project ${project.project_id}: Validation failed after migration:`, validated.error.message);
          }
        } else {
          console.log(`Project ${project.project_id}: No plansStructured created (maybe no plans?)`);
        }
      } else if (photos.plansStructured) {
        console.log(`Project ${project.project_id}: Already has plansStructured, skipping`);
      } else {
        console.log(`Project ${project.project_id}: No plans to migrate`);
      }
    }

    console.log('Migration completed');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const projectId = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
forceMigratePlans(projectId);


