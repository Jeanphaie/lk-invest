import { Photos, Photo, PlansStructure, PlanPhoto } from '../../../shared/types/photos';

/**
 * Service de migration pour convertir les plans existants vers la nouvelle structure
 */
export class PlansMigrationService {
  /**
   * Convertit un tableau de photos plans en structure organisée
   * Si les photos n'ont pas de métadonnées planType/floor, elles sont classées comme "before" par défaut
   */
  static migratePlansToStructured(plans: Photo[]): PlansStructure {
    const structured: PlansStructure = {
      before: {
        floor1: [],
        floor2: []
      },
      after: {
        floor1: [],
        floor2: []
      }
    };

    for (const plan of plans) {
      const planPhoto: PlanPhoto = {
        ...plan,
        planType: (plan as any).planType || 'before', // Par défaut "before" si non spécifié
        floor: (plan as any).floor || 1, // Par défaut étage 1
        floorLabel: (plan as any).floorLabel || this.getFloorLabel((plan as any).floor || 1)
      };

      const planType = planPhoto.planType || 'before';
      const floor = planPhoto.floor || 1;

      if (planType === 'before') {
        if (floor === 1) {
          structured.before!.floor1!.push(planPhoto);
        } else if (floor === 2) {
          structured.before!.floor2!.push(planPhoto);
        }
      } else if (planType === 'after') {
        if (floor === 1) {
          structured.after!.floor1!.push(planPhoto);
        } else if (floor === 2) {
          structured.after!.floor2!.push(planPhoto);
        }
      }
    }

    // Nettoyer les tableaux vides optionnels
    if (structured.before?.floor1?.length === 0) delete structured.before.floor1;
    if (structured.before?.floor2?.length === 0) delete structured.before.floor2;
    if (structured.after?.floor1?.length === 0) delete structured.after.floor1;
    if (structured.after?.floor2?.length === 0) delete structured.after.floor2;
    if (Object.keys(structured.before || {}).length === 0) delete structured.before;
    if (Object.keys(structured.after || {}).length === 0) delete structured.after;

    return structured;
  }

  /**
   * Convertit la structure organisée en tableau plat (pour rétrocompatibilité)
   */
  static flattenStructuredPlans(plansStructured?: PlansStructure): Photo[] {
    if (!plansStructured) return [];

    const allPlans: Photo[] = [];

    // Plans avant
    if (plansStructured.before) {
      if (plansStructured.before.floor1) {
        allPlans.push(...plansStructured.before.floor1.map(p => this.stripPlanMetadata(p)));
      }
      if (plansStructured.before.floor2) {
        allPlans.push(...plansStructured.before.floor2.map(p => this.stripPlanMetadata(p)));
      }
    }

    // Plans après
    if (plansStructured.after) {
      if (plansStructured.after.floor1) {
        allPlans.push(...plansStructured.after.floor1.map(p => this.stripPlanMetadata(p)));
      }
      if (plansStructured.after.floor2) {
        allPlans.push(...plansStructured.after.floor2.map(p => this.stripPlanMetadata(p)));
      }
    }

    return allPlans;
  }

  /**
   * Retire les métadonnées spécifiques aux plans pour obtenir un Photo standard
   */
  private static stripPlanMetadata(planPhoto: PlanPhoto): Photo {
    const { planType, floor, floorLabel, ...photo } = planPhoto;
    return photo;
  }

  /**
   * Obtient le label d'affichage pour un étage
   */
  static getFloorLabel(floor: number): string {
    switch (floor) {
      case 1:
        return 'RDC / 1er étage';
      case 2:
        return '2ème étage';
      default:
        return `Étage ${floor}`;
    }
  }

  /**
   * Fusionne les plans existants (plans) avec la structure organisée (plansStructured)
   * Priorité à plansStructured si les deux existent
   */
  static mergePlansData(photos: Photos): PlansStructure | undefined {
    // Si plansStructured existe, l'utiliser
    if (photos.plansStructured) {
      return photos.plansStructured;
    }

    // Sinon, migrer depuis plans
    if (photos.plans && photos.plans.length > 0) {
      return this.migratePlansToStructured(photos.plans);
    }

    return undefined;
  }

  /**
   * Synchronise plansStructured avec plans pour maintenir la compatibilité
   */
  static syncPlansData(photos: Photos): Photos {
    const merged = this.mergePlansData(photos);
    
    if (merged) {
      // Mettre à jour plansStructured
      photos.plansStructured = merged;
      
      // Optionnel : mettre à jour plans pour rétrocompatibilité
      // (on peut choisir de ne pas le faire pour éviter les doublons)
      // photos.plans = this.flattenStructuredPlans(merged);
    }

    return photos;
  }

  /**
   * Obtient tous les plans d'un type donné (before/after) et d'un étage donné
   */
  static getPlansByTypeAndFloor(
    plansStructured: PlansStructure | undefined,
    planType: 'before' | 'after',
    floor: 1 | 2
  ): PlanPhoto[] {
    if (!plansStructured) return [];

    const typePlans = planType === 'before' ? plansStructured.before : plansStructured.after;
    if (!typePlans) return [];

    const floorPlans = floor === 1 ? typePlans.floor1 : typePlans.floor2;
    return floorPlans || [];
  }

  /**
   * Obtient tous les IDs de plans sélectionnés pour le PDF depuis la structure organisée
   */
  static getSelectedPlansIds(plansStructured?: PlansStructure): number[] {
    if (!plansStructured) return [];

    const allPlans: PlanPhoto[] = [];
    
    if (plansStructured.before) {
      if (plansStructured.before.floor1) allPlans.push(...plansStructured.before.floor1);
      if (plansStructured.before.floor2) allPlans.push(...plansStructured.before.floor2);
    }
    
    if (plansStructured.after) {
      if (plansStructured.after.floor1) allPlans.push(...plansStructured.after.floor1);
      if (plansStructured.after.floor2) allPlans.push(...plansStructured.after.floor2);
    }

    return allPlans.filter(p => p.selectedForPdf).map(p => p.id);
  }
}


