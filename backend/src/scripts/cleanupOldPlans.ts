import { PrismaClient } from '@prisma/client';
import { PhotosSchema } from '../../../shared/types/photos';
import { PlansMigrationService } from '../services/plansMigration.service';

const prisma = new PrismaClient();

/**
 * Script pour nettoyer l'ancien format plans après migration vers plansStructured
 * Vérifie que tous les plans sont bien dans plansStructured avant de supprimer plans
 */
async function cleanupOldPlans(projectId?: number, dryRun: boolean = true) {
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
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log('⚠️  LIVE MODE - Changes will be saved to database\n');
    }

    let cleanedCount = 0;
    let errorCount = 0;

    for (const project of projects) {
      if (!project.photos) {
        console.log(`Project ${project.project_id}: No photos, skipping`);
        continue;
      }

      const photos = project.photos as any;
      
      // Vérifier que plansStructured existe et contient tous les plans
      if (photos.plans && photos.plans.length > 0) {
        if (!photos.plansStructured) {
          console.log(`❌ Project ${project.project_id}: Has plans but no plansStructured - MIGRATION NEEDED`);
          errorCount++;
          continue;
        }

        // Compter les plans dans plansStructured
        const structuredPlans: any[] = [];
        if (photos.plansStructured.before) {
          if (photos.plansStructured.before.floor1) structuredPlans.push(...photos.plansStructured.before.floor1);
          if (photos.plansStructured.before.floor2) structuredPlans.push(...photos.plansStructured.before.floor2);
        }
        if (photos.plansStructured.after) {
          if (photos.plansStructured.after.floor1) structuredPlans.push(...photos.plansStructured.after.floor1);
          if (photos.plansStructured.after.floor2) structuredPlans.push(...photos.plansStructured.after.floor2);
        }

        const oldPlansCount = photos.plans.length;
        const structuredPlansCount = structuredPlans.length;

        // Vérifier que tous les IDs de plans sont dans plansStructured
        const oldPlanIds = new Set(photos.plans.map((p: any) => p.id));
        const structuredPlanIds = new Set(structuredPlans.map((p: any) => p.id));
        
        const missingIds = [...oldPlanIds].filter(id => !structuredPlanIds.has(id));
        
        if (missingIds.length > 0) {
          console.log(`❌ Project ${project.project_id}: Some plans are missing in plansStructured:`, missingIds);
          errorCount++;
          continue;
        }

        if (oldPlansCount === structuredPlansCount) {
          console.log(`✅ Project ${project.project_id}: All ${oldPlansCount} plans are in plansStructured - Safe to clean`);
          
          if (!dryRun) {
            // Supprimer plans
            photos.plans = [];
            
            // Valider
            const parsed = PhotosSchema.safeParse(photos);
            if (!parsed.success) {
              console.error(`❌ Project ${project.project_id}: Validation failed:`, parsed.error.message);
              errorCount++;
              continue;
            }

            // Sauvegarder
            await prisma.project.update({
              where: { project_id: project.project_id },
              data: { photos: parsed.data as any }
            });
            
            console.log(`   ✓ Cleaned up ${oldPlansCount} plans from old format`);
          } else {
            console.log(`   → Would clean up ${oldPlansCount} plans from old format`);
          }
          
          cleanedCount++;
        } else {
          console.log(`⚠️  Project ${project.project_id}: Count mismatch (old: ${oldPlansCount}, structured: ${structuredPlansCount}) - Skipping`);
          errorCount++;
        }
      } else if (photos.plansStructured) {
        console.log(`✅ Project ${project.project_id}: Already clean (no plans, has plansStructured)`);
      } else {
        console.log(`ℹ️  Project ${project.project_id}: No plans at all`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`✅ Projects cleaned: ${cleanedCount}`);
    console.log(`❌ Projects with errors: ${errorCount}`);
    if (dryRun) {
      console.log(`\n💡 Run with --live to apply changes`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse arguments
const args = process.argv.slice(2);
const projectId = args.find(arg => !isNaN(parseInt(arg, 10))) ? parseInt(args.find(arg => !isNaN(parseInt(arg, 10)))!, 10) : undefined;
const dryRun = !args.includes('--live');

if (dryRun) {
  console.log('🔍 Running in DRY RUN mode (no changes will be made)');
  console.log('   Use --live flag to apply changes\n');
}

cleanupOldPlans(projectId, dryRun);


