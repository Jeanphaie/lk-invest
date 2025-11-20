import { PrismaClient } from '@prisma/client';
import { PhotosSchema } from '../../../shared/types/photos';
import { PlansMigrationService } from '../services/plansMigration.service';

const prisma = new PrismaClient();

/**
 * Script complet pour migrer tous les projets vers plansStructured et nettoyer l'ancien format
 * 1. Migre plans vers plansStructured si nécessaire
 * 2. Vérifie que tous les plans sont dans plansStructured
 * 3. Supprime l'ancien format plans
 */
async function migrateAndCleanupAllPlans(dryRun: boolean = true) {
  try {
    const projects = await prisma.project.findMany({
      select: {
        project_id: true,
        photos: true
      },
      orderBy: {
        project_id: 'asc'
      }
    });

    console.log(`Found ${projects.length} project(s) to process`);
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log('⚠️  LIVE MODE - Changes will be saved to database\n');
    }

    let migratedCount = 0;
    let cleanedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const project of projects) {
      if (!project.photos) {
        console.log(`ℹ️  Project ${project.project_id}: No photos, skipping`);
        skippedCount++;
        continue;
      }

      const photos = project.photos as any;
      let needsUpdate = false;
      let updatedPhotos = { ...photos };

      try {
        // Étape 1: Migrer vers plansStructured si nécessaire
        if (photos.plans && photos.plans.length > 0 && !photos.plansStructured) {
          console.log(`📦 Project ${project.project_id}: Migrating ${photos.plans.length} plan(s) to plansStructured...`);
          
          // Valider avec le schéma
          const parsed = PhotosSchema.safeParse(photos);
          if (!parsed.success) {
            console.error(`❌ Project ${project.project_id}: Invalid photos data:`, parsed.error.message);
            errorCount++;
            continue;
          }

          // Migrer
          const syncedPhotos = PlansMigrationService.syncPlansData(parsed.data);
          
          if (syncedPhotos.plansStructured) {
            updatedPhotos = syncedPhotos;
            needsUpdate = true;
            console.log(`   ✓ Migration successful`);
            migratedCount++;
          } else {
            console.log(`   ⚠️  No plansStructured created (unexpected)`);
            errorCount++;
            continue;
          }
        }

        // Étape 2: Vérifier que tous les plans sont dans plansStructured avant de nettoyer
        if (updatedPhotos.plans && updatedPhotos.plans.length > 0) {
          if (!updatedPhotos.plansStructured) {
            console.log(`❌ Project ${project.project_id}: Has plans but no plansStructured after migration - SKIPPING CLEANUP`);
            errorCount++;
            continue;
          }

          // Compter les plans dans plansStructured
          const structuredPlans: any[] = [];
          if (updatedPhotos.plansStructured.before) {
            if (updatedPhotos.plansStructured.before.floor1) structuredPlans.push(...updatedPhotos.plansStructured.before.floor1);
            if (updatedPhotos.plansStructured.before.floor2) structuredPlans.push(...updatedPhotos.plansStructured.before.floor2);
          }
          if (updatedPhotos.plansStructured.after) {
            if (updatedPhotos.plansStructured.after.floor1) structuredPlans.push(...updatedPhotos.plansStructured.after.floor1);
            if (updatedPhotos.plansStructured.after.floor2) structuredPlans.push(...updatedPhotos.plansStructured.after.floor2);
          }

          const oldPlansCount = updatedPhotos.plans.length;
          const structuredPlansCount = structuredPlans.length;

          // Vérifier que tous les IDs de plans sont dans plansStructured
          const oldPlanIds = new Set(updatedPhotos.plans.map((p: any) => p.id));
          const structuredPlanIds = new Set(structuredPlans.map((p: any) => p.id));
          
          const missingIds = [...oldPlanIds].filter(id => !structuredPlanIds.has(id));
          
          if (missingIds.length > 0) {
            console.log(`❌ Project ${project.project_id}: Some plans are missing in plansStructured:`, missingIds);
            errorCount++;
            continue;
          }

          if (oldPlansCount === structuredPlansCount) {
            console.log(`🧹 Project ${project.project_id}: Cleaning up ${oldPlansCount} plans from old format...`);
            updatedPhotos.plans = [];
            needsUpdate = true;
            cleanedCount++;
          } else {
            console.log(`⚠️  Project ${project.project_id}: Count mismatch (old: ${oldPlansCount}, structured: ${structuredPlansCount}) - Skipping cleanup`);
            errorCount++;
            continue;
          }
        } else if (updatedPhotos.plansStructured) {
          // Pas de plans à nettoyer, mais plansStructured existe (déjà propre)
          console.log(`✅ Project ${project.project_id}: Already clean (no plans, has plansStructured)`);
          skippedCount++;
          continue;
        } else {
          // Pas de plans du tout
          console.log(`ℹ️  Project ${project.project_id}: No plans at all`);
          skippedCount++;
          continue;
        }

        // Étape 3: Sauvegarder si nécessaire
        if (needsUpdate && !dryRun) {
          // Valider avant sauvegarde
          const finalParsed = PhotosSchema.safeParse(updatedPhotos);
          if (!finalParsed.success) {
            console.error(`❌ Project ${project.project_id}: Validation failed before save:`, finalParsed.error.message);
            errorCount++;
            continue;
          }

          // Sauvegarder
          await prisma.project.update({
            where: { project_id: project.project_id },
            data: { photos: finalParsed.data as any }
          });
          
          console.log(`   ✓ Saved to database`);
        } else if (needsUpdate && dryRun) {
          console.log(`   → Would save to database`);
        }

      } catch (error) {
        console.error(`❌ Project ${project.project_id}: Error:`, error instanceof Error ? error.message : error);
        errorCount++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`📦 Projects migrated: ${migratedCount}`);
    console.log(`🧹 Projects cleaned: ${cleanedCount}`);
    console.log(`⏭️  Projects skipped: ${skippedCount}`);
    console.log(`❌ Projects with errors: ${errorCount}`);
    console.log(`📊 Total processed: ${projects.length}`);
    
    if (dryRun) {
      console.log(`\n💡 Run with --live to apply changes`);
    } else {
      console.log(`\n✅ All changes have been applied!`);
    }
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--live');

async function main() {
  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (no changes will be made)');
    console.log('   Use --live flag to apply changes\n');
  } else {
    console.log('⚠️  Running in LIVE mode - Changes will be saved!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    
    // Attendre 5 secondes pour permettre l'annulation
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Starting migration...\n');
  }

  await migrateAndCleanupAllPlans(dryRun);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

