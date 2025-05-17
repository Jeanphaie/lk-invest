# Plan de migration pour la rationalisation de la gestion des données (Front/Back)

## 1. Centralisation des schémas de données

- Créer un dossier partagé `/shared/types/` à la racine du projet.
- Pour chaque tab (Business Plan, Description Bien, DVF, PDF, etc.), créer un fichier TypeScript (ex: `businessPlan.ts`).
- Définir le schéma de données avec Zod (ou autre lib de validation) dans chaque fichier.

Exemple :
```typescript
// shared/types/businessPlan.ts
import { z } from "zod";

export const BusinessPlanInputsSchema = z.object({
  prix_achat: z.number(),
  frais_notaire: z.number(),
  frais_agence_vente: z.number(),
  // ... autres champs
});
export type BusinessPlanInputs = z.infer<typeof BusinessPlanInputsSchema>;
```

## 2. Utilisation des schémas dans le backend

- Installer Zod côté backend : `npm install zod`
- Importer et utiliser les schémas pour valider les requêtes entrantes, typer les services, valider avant insertion en base.

Exemple :
```typescript
import { BusinessPlanInputsSchema } from '../../../shared/types/businessPlan';
const parsed = BusinessPlanInputsSchema.parse(req.body.inputsBusinessPlan);
```

## 3. Utilisation des schémas/types dans le frontend

- Installer Zod côté frontend : `npm install zod`
- Importer les types pour typer les états React, valider les formulaires, typer les props des composants.

Exemple :
```typescript
import { BusinessPlanInputs } from 'shared/types/businessPlan';
const [inputs, setInputs] = useState<BusinessPlanInputs>(...);
```

## 4. Synchronisation des types entre front et back

- Si monorepo : utiliser `/shared/types/` directement.
- Si deux repos : publier `/shared/types/` en package npm privé/public et l'ajouter comme dépendance.

## 5. Migration progressive des composants et services

- Pour chaque tab :
  1. Remplacer les types locaux par les types partagés
  2. Remplacer la validation manuelle par la validation via le schéma partagé
  3. Adapter les services pour utiliser les types partagés
  4. Adapter les contrôleurs backend pour valider les données reçues avec le schéma
- Tester chaque tab indépendamment avant de passer au suivant

## 6. Gestion de la base de données

- Continuer à stocker les données en JSON pour la flexibilité
- Toujours valider les données avec le schéma partagé avant insertion/mise à jour
- (Option avancée) : migrer certains champs critiques en colonnes SQL si besoin

## 7. Documentation et tests

- Générer automatiquement la documentation des schémas (Zod permet de générer des docs)
- Ajouter des tests unitaires pour la validation des schémas
- Documenter la structure de chaque tab dans un README du dossier `/shared/types/`

## 8. Ajout ou modification d'un champ

1. Modifier le schéma partagé dans `/shared/types/`
2. Adapter le formulaire frontend (si besoin)
3. Adapter le service backend (si besoin)
4. Les types sont mis à jour automatiquement partout

## 9. Exemple d'arborescence finale

```
/shared/types/
  businessPlan.ts
  descriptionBien.ts
  dvf.ts
  pdfConfig.ts
/backend/
  controllers/
  services/
  ...
/frontend/
  components/project-sections/
  hooks/
  services/
  ...
```

## 10. Sécurité et évolutivité

- Un seul schéma source de vérité pour chaque bloc de données
- Validation stricte partout (front et back)
- Ajout/suppression/déplacement de champs ultra simple
- Réutilisation des types pour le PDF, l'UI, l'API, etc.

---

**Résumé des étapes à suivre :**
1. Créer `/shared/types/` et y définir tous les schémas de données (un fichier par tab)
2. Adapter le backend pour utiliser ces schémas pour la validation et le typage
3. Adapter le frontend pour utiliser ces types pour les formulaires et l'état
4. Tester chaque tab indépendamment
5. Documenter la structure et la procédure

---

**Ce fichier est la feuille de route de migration.**
Garde-le à jour à chaque étape importante du projet !

# MIGRATION PLAN: Harmonisation du traitement des outliers dans les statistiques DVF

## Contexte

Lors de l'analyse et de la génération des statistiques DVF (Demande de Valeur Foncière) dans l'application LKI, des incohérences ont été constatées entre les différents calculs de moyennes et séries temporelles, notamment entre la sélection (zone autour du bien) et l'arrondissement/premium. Ces incohérences provenaient du fait que l'exclusion des outliers n'était appliquée que sur la sélection, et pas sur les autres agrégats (arrondissement, premium, séries annuelles, distributions).

## Problèmes rencontrés

### 1. Incohérence des moyennes et distributions
- **Constat** : Les moyennes et distributions affichées pour l'arrondissement et le premium incluaient des valeurs aberrantes (outliers), alors que la sélection les excluait.
- **Conséquence** :
  - Les valeurs de référence (moyenne, médiane, bornes) différaient selon l'onglet ou la zone, rendant la comparaison peu fiable.
  - Les utilisateurs ne pouvaient pas reproduire les résultats de l'app dans Excel ou d'autres outils, car la logique d'exclusion n'était pas documentée ni homogène.

### 2. Calculs différents entre frontend et backend
- **Constat** :
  - Le backend utilisait une moyenne pondérée par la surface pour l'arrondissement, mais sans exclure les outliers.
  - Le frontend affichait les résultats du backend, mais la logique d'affichage pouvait prêter à confusion (plus de transactions affichées côté arrondissement que côté sélection, etc.).
- **Conséquence** :
  - Difficulté à vérifier les calculs et à expliquer les écarts aux utilisateurs.

### 3. Séries annuelles et distributions non filtrées
- **Constat** : Les séries annuelles (moyennes par an) et les distributions (histogrammes) pour l'arrondissement et le premium incluaient aussi les outliers.
- **Conséquence** :
  - Les tendances et analyses étaient biaisées par des transactions extrêmes.

## Solutions apportées

### 1. Harmonisation de la logique d'exclusion des outliers
- **Changement** :
  - La logique d'exclusion des outliers (bornes calculées à partir de la moyenne pondérée de l'arrondissement, avec un pourcentage et un coefficient) est désormais appliquée à **tous** les calculs :
    - Moyenne arrondissement
    - Moyenne premium
    - Séries annuelles arrondissement/premium
    - Distributions arrondissement/premium
- **Effet** :
  - Les statistiques sont désormais cohérentes entre la sélection, l'arrondissement et le premium.
  - Les résultats sont reproductibles dans Excel ou d'autres outils en appliquant la même logique de filtrage.

### 2. Maintien de la compatibilité API/frontend
- **Changement** :
  - Les noms de variables et la structure des objets retournés par l'API n'ont pas changé.
  - Le frontend n'a pas besoin d'être modifié pour s'adapter à cette nouvelle logique.

### 3. Documentation de la logique de filtrage
- **Règle** :
  - Les bornes d'outliers sont calculées comme suit :
    - **Borne basse** = moyenne pondérée arrondissement × (1 - pourcentage)
    - **Borne haute** = moyenne pondérée arrondissement × (1 + pourcentage × coefficient)
    - Par défaut : pourcentage = 65%, coefficient = 3
  - Toute transaction dont le prix/m² est en dehors de ces bornes est exclue des calculs.

## Points d'attention pour les prochains onglets/tabs

- **Vérifier systématiquement** que la logique d'exclusion des outliers est appliquée de façon homogène à tous les agrégats et séries statistiques.
- **Documenter** dans le code et dans les specs produit la logique de filtrage appliquée.
- **Prévoir des tests de cohérence** (ex : reproduction des résultats dans Excel) pour chaque nouvel onglet ou statistique ajoutée.
- **Informer les utilisateurs** de la logique de filtrage appliquée, pour éviter toute confusion lors de l'analyse des résultats.

## Historique des modifications
- [x] Correction appliquée sur le backend DVF : exclusion des outliers sur arrondissement, premium, séries annuelles et distributions.
- [ ] À appliquer sur les autres modules/statistiques si besoin.

## Problèmes de typage et synchronisation Front/Back

### 1. Incohérences de nommage entre Front et Back
- **Problème** : Les noms de champs différaient entre le frontend et le backend
  - Frontend : `vue`, `etage`, `ascenseur`, `exterieur`, `adresse`, `etat`
  - Backend : `view`, `floor`, `elevator`, `outdoor`, `address`, `condition`
- **Solution** :
  - Création d'un mapping explicite dans le frontend (`paramKeyMap`)
  - Standardisation des noms dans les schémas partagés
  - Utilisation de constantes pour les valeurs possibles

### 2. Problèmes de validation Zod
- **Problème** : Les schémas Zod dans `/shared/types/` n'étaient pas strictement respectés
  - Validation manquante sur certains champs
  - Types optionnels vs requis mal définis
- **Solution** :
  - Définition stricte des schémas avec Zod
  - Validation systématique côté backend
  - Gestion explicite des erreurs de validation

### 3. Gestion des valeurs par défaut
- **Problème** : Valeurs par défaut différentes entre front et back
  - Frontend : valeurs hardcodées dans les composants
  - Backend : valeurs définies dans les services
- **Solution** :
  - Définition des valeurs par défaut dans les schémas partagés
  - Utilisation de ces valeurs dans les deux côtés

### 4. Problèmes de typage TypeScript
- **Problème** : Types incomplets ou incorrects
  - Certains champs manquants dans les interfaces
  - Types trop permissifs (`any`)
- **Solution** :
  - Définition complète des types dans `/shared/types/`
  - Utilisation de `z.infer<typeof Schema>` pour la cohérence
  - Éviction de `any` au maximum

### 5. Synchronisation des mises à jour
- **Problème** : Mises à jour asynchrones entre front et back
  - État local React non synchronisé avec le backend
  - Données manquantes après certaines opérations
- **Solution** :
  - Utilisation de `useEffect` pour la synchronisation
  - Refetch des données après les mises à jour
  - Gestion explicite des états de chargement

## Bonnes pratiques à suivre

1. **Nommage** :
   - Utiliser des noms cohérents entre front et back
   - Documenter les mappings si nécessaire
   - Éviter les traductions implicites

2. **Validation** :
   - Toujours valider avec Zod côté backend
   - Utiliser les mêmes schémas partout
   - Gérer explicitement les erreurs de validation

3. **Types** :
   - Définir tous les types dans `/shared/types/`
   - Éviter les types locaux
   - Utiliser `z.infer` pour la cohérence

4. **Valeurs par défaut** :
   - Définir dans les schémas partagés
   - Utiliser les mêmes valeurs partout
   - Documenter les choix

5. **Synchronisation** :
   - Gérer explicitement les états de chargement
   - Refetch après les mises à jour
   - Utiliser des hooks personnalisés si nécessaire

## Exemple de correction (Description Bien)

```typescript
// shared/types/descriptionBien.ts
export const DescriptionBienInputsSchema = z.object({
  vue: z.string(),
  etage: z.string(),
  ascenseur: z.string(),
  exterieur: z.string(),
  adresse: z.string(),
  etat: z.string(),
  nombre_pieces: z.number().min(1),
});

// Mapping explicite dans le frontend
const paramKeyMap: Record<string, string> = {
  'Vue': 'vue',
  'Étage': 'etage',
  'Ascenseur': 'ascenseur',
  'Extérieur': 'exterieur',
  'Adresse': 'adresse',
  'État': 'etat',
};

// Validation stricte dans le backend
const validatedData = FullDescriptionBienSchema.parse(req.body);
```

## Historique des modifications
- [x] Correction appliquée sur le backend DVF : exclusion des outliers
- [x] Correction des problèmes de typage dans la route description de bien
- [ ] À appliquer sur les autres modules/statistiques

---

**Ce document doit être mis à jour à chaque évolution de la logique de filtrage ou d'agrégation des données DVF.**

# STRATÉGIE DE RATIONALISATION DES TYPES, DU TYPE PROJECT ET DE LA STRUCTURE BDD

## Objectif
Garantir une cohérence parfaite entre :
- Les types partagés (`shared/types/`)
- Le type `Project` (frontend)
- La structure de la base de données (BDD)

## Principes
1. **Source de vérité unique** : Tous les types métiers (inputs, results, configs, etc.) sont définis dans `shared/types/` avec Zod et exportés en TypeScript.
2. **Réutilisation systématique** : Le type `Project` du frontend assemble uniquement les types partagés, sans redéfinition locale.
3. **Stockage direct** : Le backend valide les objets reçus avec Zod et les stocke "tels quels" dans la BDD (champ JSON), sans mapping manuel.
4. **Synchronisation stricte** : Toute évolution d'un type partagé implique une mise à jour du schéma BDD (migration) et du type Project.
5. **Validation partout** : Zod est utilisé pour valider les données à chaque entrée/sortie (API, BDD, etc.).

## Flux de données idéal
- **Frontend** : Utilise les types partagés pour le typage et la validation, envoie les objets au backend.
- **Backend** : Valide avec Zod, stocke l'objet validé dans la BDD (champ JSON), relit et revalide avant de renvoyer au front.
- **BDD** : Stocke les objets complexes dans des champs JSON qui matchent exactement les types partagés.

## Checklist de migration
- [ ] Définir tous les types métiers dans `shared/types/`
- [ ] Assembler le type Project uniquement à partir des types partagés
- [ ] Valider systématiquement avec Zod côté backend
- [ ] Stocker les objets validés tels quels dans la BDD (champ JSON)
- [ ] Synchroniser toute évolution de type avec une migration BDD
- [ ] Écrire des tests d'intégration pour valider la cohérence front/back/BDD
- [ ] Documenter la structure et la méthodologie dans ce fichier

## Exemple de structure
```ts
// shared/types/business-plan.ts
export const BusinessPlanInputsSchema = z.object({
  prix_achat: z.number(),
  surface_carrez_apres_travaux: z.number(),
  // ...
});
export type BusinessPlanInputs = z.infer<typeof BusinessPlanInputsSchema>;

// frontend/src/types/project.ts
import { BusinessPlanInputs, BusinessPlanResults } from '../../../shared/types/business-plan';
export interface Project {
  inputsBusinessPlan?: BusinessPlanInputs;
  resultsBusinessPlan?: BusinessPlanResults;
  // ...
}

// backend/src/services/project.service.ts
const validatedInputs = BusinessPlanInputsSchema.parse(req.body.inputsBusinessPlan);
await prisma.project.update({
  where: { id: ... },
  data: { inputsBusinessPlan: validatedInputs }
});
```

## Points d'attention
- Pas de mapping manuel entre les types : tout doit être typé et validé à partir de la même source.
- Pas de champs "orphelins" dans la BDD qui ne sont pas dans les types partagés.
- Toute évolution d'un champ dans le type partagé doit être répercutée dans la BDD et le front.

---

**Cette stratégie doit être suivie pour toute évolution future afin de garantir la robustesse, la maintenabilité et la cohérence de l'application.**

# MIGRATION PLAN

## Migration Front Office : Alignement avec les types partagés et validation Zod

### Objectif
Garantir que le front office (frontend) soit parfaitement aligné avec la nouvelle organisation des types partagés (`shared/types/`) et la validation Zod, en cohérence avec le backend et la base de données (schéma Prisma).

---

### Plan d'action

#### 1. Centralisation des imports de types et schémas
- Tous les types utilisés dans le frontend doivent être importés exclusivement depuis `shared/types/` (et non redéclarés localement).
- Les schémas Zod (pour validation côté front) doivent aussi être importés depuis `shared/types/`.

#### 2. Validation stricte des payloads envoyés
- Avant chaque appel API (POST, PATCH, PUT), valider les données utilisateur avec le schéma Zod correspondant.
- En cas d'erreur de validation, afficher un message d'erreur UX-friendly et ne pas envoyer la requête.

#### 3. Validation stricte des résultats reçus
- Après chaque appel API, valider la réponse du backend avec le schéma Zod correspondant.
- Si la validation échoue, afficher une erreur claire et ne pas mettre à jour l'état local.

#### 4. Typage strict des états et props
- Les états React (`useState`, `useReducer`, etc.) et les props de composants doivent utiliser les types partagés (`shared/types/`).
- Aucun usage de `any` ou de typage implicite.

#### 5. Synchronisation des noms de champs
- Les noms de champs dans les payloads et les résultats doivent correspondre exactement à ceux attendus par le backend et définis dans les types partagés (snake_case, etc.).
- Si un mapping est nécessaire (ex : camelCase → snake_case), il doit être centralisé et documenté.

#### 6. Suppression des types locaux obsolètes
- Supprimer tous les anciens fichiers de types locaux dans le frontend (`src/types/`), s'ils existent encore.
- Vérifier que tous les imports pointent bien vers `shared/types/`.

---

### Étapes concrètes à réaliser

1. **Lister les fichiers React concernés** (ex : `ProjectDetailView.tsx`, `BusinessPlanTab.tsx`, `PdfReport.tsx`, etc.).
2. **Corriger les imports, la validation, et le typage** dans chaque fichier, du plus général au plus spécifique.
3. **Tester chaque flux** (création, édition, calcul, génération PDF, etc.) pour s'assurer que tout est validé et typé strictement.

---

**Ce plan sert de référence pour toutes les étapes de migration frontend.**

---

#### Prochaine étape

On commence par le fichier le plus général :
- `/data/lki/frontend/src/components/ProjectDetailView.tsx`

On appliquera ce plan à chaque composant, en progressant vers les composants plus spécifiques. 

# Plan de Migration Business Plan

## 1. Formules à Corriger

### Prix HFA
```typescript
// Ancienne formule (incorrecte)
const prix_hfa = prix_fai * (1 + (inputs.frais_agence_vente || 0) / 100);

// Nouvelle formule (correcte)
const prix_hfa = prix_fai / (1 + (inputs.frais_agence_vente || 0) / 100);
```

## 2. Synthèse des Coûts

### Structure des coûts d'acquisition
```typescript
couts_acquisition: {
  prix_achat: prix_achat,
  prix_hfa: prix_hfa,
  frais_notaire: frais_notaire,
  frais_agence_vente: frais_agence_vente,
  frais_dossier: frais_dossier,
  prorata_foncier: prorata_foncier,
  diagnostics: diagnostics,
  mobilier: mobilier,
  total: total_acquisition
}
```

### Structure des coûts de travaux
```typescript
couts_travaux: {
  cout_travaux_total: cout_travaux_total,
  cout_maitrise_oeuvre: cout_maitrise_oeuvre,
  cout_aleas: cout_aleas,
  cout_amenagement_terrasse: cout_amenagement_terrasse,
  cout_mobilier: mobilier,
  cout_demolition: cout_demolition,
  cout_honoraires_techniques: honoraires_techniques,
  total: total_travaux
}
```

### Calculs des totaux
```typescript
const total_acquisition = prix_achat + frais_notaire + frais_agence + frais_dossier + prorata_foncier + diagnostics + mobilier;
const total_travaux = cout_travaux_total + cout_maitrise_oeuvre + cout_aleas + cout_amenagement_terrasse + mobilier + cout_demolition + honoraires_techniques;
const total_divers = honoraires_techniques + prorata_foncier + diagnostics;
```

## 3. Détails par Trimestre

### Structure d'un trimestre
```typescript
interface Trimestre {
  trimestre: number;
  jours: number;
  start_date: string;
  end_date: string;
  couts: {
    acquisition: {
      prix_hfa: number;
      frais_notaire: number;
      frais_agence_achat: number;
      frais_dossier: number;
      prorata_foncier: number;
      diagnostics: number;
      mobilier: number;
      total: number;
    };
    travaux: {
      cout_travaux: number;
      salaire_maitrise: number;
      alea_travaux: number;
      amenagement_terrasse: number;
      demolition: number;
      honoraires_techniques: number;
      total: number;
    };
    divers: {
      total: number;
    };
    financement: {
      credit_foncier: number;
      fonds_propres: number;
      credit_accompagnement_total: number;
      total: number;
    };
  };
  credit_foncier_utilise: number;
  fonds_propres_utilise: number;
  credit_accompagnement_utilise: number;
  interets_foncier: number;
  interets_accompagnement: number;
  commission_accompagnement: number;
  cout_financier_trimestre: number;
}
```

### Logique de calcul des trimestres
```typescript
// Initialisation
const trimestre_details = [];
const dateAchat = new Date(inputs.date_achat);
const dateVente = new Date(inputs.date_vente);
const nbTrimestres = Math.ceil(duree_projet / 90);

// Boucle sur les trimestres
for (let i = 0; i < nbTrimestres; i++) {
  // Calcul des dates
  const dateDebut = new Date(dateAchat);
  dateDebut.setDate(dateDebut.getDate() + i * 90);
  
  const dateFin = new Date(dateDebut);
  dateFin.setDate(dateFin.getDate() + 90);
  
  if (i === nbTrimestres - 1) {
    dateFin.setTime(dateVente.getTime());
  }

  const jours = Math.ceil((dateFin.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24));

  // Calcul des coûts pour ce trimestre
  const couts = {
    acquisition: {
      prix_hfa: i === 0 ? prix_hfa : 0,
      frais_notaire: i === 0 ? frais_notaire : 0,
      frais_agence_achat: i === 0 ? frais_agence : 0,
      frais_dossier: i === 0 ? frais_dossier : 0,
      prorata_foncier: i === 0 ? prorata_foncier : 0,
      diagnostics: i === 0 ? diagnostics : 0,
      mobilier: i === 0 ? mobilier : 0,
      total: 0
    },
    travaux: {
      cout_travaux: cout_travaux_total / nbTrimestres,
      salaire_maitrise: cout_maitrise_oeuvre / nbTrimestres,
      alea_travaux: cout_aleas / nbTrimestres,
      amenagement_terrasse: cout_amenagement_terrasse / nbTrimestres,
      demolition: cout_demolition / nbTrimestres,
      honoraires_techniques: (cout_travaux_total * (honoraires_techniques / 100)) / nbTrimestres,
      total: 0
    },
    divers: {
      total: 0
    },
    financement: {
      credit_foncier: inputs.credit_foncier || 0,
      fonds_propres: inputs.fonds_propres || 0,
      credit_accompagnement_total: inputs.credit_accompagnement_total || 0,
      total: 0
    }
  };

  // Calcul des totaux pour ce trimestre
  couts.acquisition.total = Object.values(couts.acquisition)
    .filter(v => typeof v === 'number')
    .reduce((sum, val) => sum + val, 0);

  couts.travaux.total = Object.values(couts.travaux)
    .filter(v => typeof v === 'number')
    .reduce((sum, val) => sum + val, 0);

  couts.financement.total = Object.values(couts.financement)
    .filter(v => typeof v === 'number')
    .reduce((sum, val) => sum + val, 0);

  // Calcul des intérêts et commissions
  const tauxMensuel = (inputs.taux_credit || 0) / 12 / 100;
  const interets_foncier = couts.financement.credit_foncier * tauxMensuel * 3;
  const interets_accompagnement = couts.financement.credit_accompagnement_total * tauxMensuel * 3;
  const commission_accompagnement = couts.financement.credit_accompagnement_total * (inputs.commission_rate || 0) / 4;

  const cout_financier_trimestre = interets_foncier + interets_accompagnement + commission_accompagnement;

  // Ajout du trimestre
  trimestre_details.push({
    trimestre: i + 1,
    jours,
    start_date: dateDebut.toISOString().split('T')[0],
    end_date: dateFin.toISOString().split('T')[0],
    couts,
    credit_foncier_utilise: couts.financement.credit_foncier,
    fonds_propres_utilise: couts.financement.fonds_propres,
    credit_accompagnement_utilise: couts.financement.credit_accompagnement_total,
    interets_foncier,
    interets_accompagnement,
    commission_accompagnement,
    cout_financier_trimestre
  });
}
```

## 4. Points d'Attention

1. **Prix HFA** : Utiliser la division et non la multiplication
2. **Coûts d'acquisition** : S'assurer que tous les champs sont présents dans l'objet
3. **Trimestres** : 
   - Les coûts d'acquisition sont uniquement au premier trimestre
   - Les coûts de travaux sont répartis sur tous les trimestres
   - Les intérêts sont calculés sur 3 mois par trimestre
   - La commission est calculée sur 1/4 de l'année

## 5. Validation

Tous les calculs doivent être validés par le schéma Zod `BusinessPlanResultsSchema` avant d'être retournés au frontend. 

# ARCHIVE – ANCIEN CODE MÉTIER BUSINESS PLAN

> Ce code est la référence métier extraite des prints écran de l'ancienne version. Toute évolution doit être comparée à cette base pour garantir la cohérence métier.

```typescript
// Nettoyage et préparation des entrées
const surface = validatedInputs.surface_carrez_apres_travaux || 0;
const surface_terrasse = validatedInputs.surface_terrasse_apres_travaux || 0;
const ponderation_terrasse = validatedInputs.prorata_foncier;
const surface_totale = surface;
const surface_carrez_apres_travaux = validatedInputs.surface_carrez_apres_travaux || surface;
const surface_terrasse_apres_travaux = validatedInputs.surface_terrasse_apres_travaux || surface_terrasse;
const surface_ponderee_apres_travaux = surface_carrez_apres_travaux + surface_terrasse_apres_travaux * ponderation_terrasse;

const prix_achat = validatedInputs.prix_achat;
const prix_affiche = validatedInputs.prix_affiche;
const duree_projet = validatedInputs.duree_projet;

// Variables de suivi (financement)
let credit_foncier_restant = credit_foncier;
let fonds_propres_restant = fonds_propres;
let credit_accomp_restant = credit_accompagnement;
let encours_foncier = 0;
let encours_accompagnement = 0;
let encours_fonds_propres = 0;
let credit_foncier_utilise_total = 0;
let fonds_propres_utilise_total = 0;
let credit_accomp_utilise_total = 0;
let commission_total = 0;
let interets_foncier_a_payer = 0;
let interets_accompagnement_a_payer = 0;
let commission_a_payer = 0;
let total_interets_foncier = 0;
let total_interets_accompagnement = 0;
let total_commission = 0;

// Répartition des coûts par trimestre
const travaux_par_trimestre = total_travaux / nb_trimestres;
const honoraires_techniques_par_trimestre = honoraires_techniques / nb_trimestres;
const prorata_foncier_par_trimestre = prorata_foncier / nb_trimestres;
const diagnostics_par_trimestre = diagnostics / nb_trimestres;

// Calcul du prix de vente FAI et HFA
const prix_vente_reel_pondere_m2 = validatedInputs.prix_vente_reel_pondere_m2;
const prix_vente_fai = prix_vente_reel_pondere_m2 * surface_ponderee_apres_travaux;
const prix_vente_hfa = prix_vente_fai / (1 + (frais_agence_vente / 100));

// Génération des trimestres
const trimestres = [];
let current_year = date_achat.getFullYear();
while (new Date(current_year, 0, 1) <= date_vente) {
  for (let q = 1; q <= 4; q++) {
    const t_start = new Date(current_year, (q-1)*3, 1);
    const t_end = q < 4 ? new Date(current_year, q*3, 0) : new Date(current_year, 11, 31);
    if (t_start > date_vente) break;
    if (t_end < date_achat) continue;
    const trimestre_start = t_start > date_achat ? t_start : date_achat;
    const trimestre_end = t_end < date_vente ? t_end : date_vente;
    const jours = Math.floor((trimestre_end.getTime() - trimestre_start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    trimestres.push({
      trimestre: `T${q} ${current_year}`,
      jours,
      start_date: trimestre_start.toISOString().split('T')[0],
      end_date: trimestre_end.toISOString().split('T')[0],
    });
  }
  current_year++;
}

// Calcul des détails trimestriels
const trimestre_details = [];
for (let i = 0; i < nb_trimestres; i++) {
  const trimestre = trimestres[i];
  const jours = trimestre.jours;

  // 1. Paiement des intérêts et commission générés le trimestre précédent
  let interets_foncier_payes = 0;
  let interets_accompagnement_payes = 0;
  let commission_payee = 0;
  let fp_foncier = 0, fp_fonds = 0, fp_accomp = 0;
  let fa_foncier = 0, fa_fonds = 0, fa_accomp = 0;
  let fc_foncier = 0, fc_fonds = 0, fc_accomp = 0;
  if (i > 0) {
    let res = financer(interets_foncier_a_payer);
    fp_foncier = res.foncier; fp_fonds = res.fonds; fp_accomp = res.accomp;
    interets_foncier_payes = interets_foncier_a_payer;
    res = financer(interets_accompagnement_a_payer);
    fa_foncier = res.foncier; fa_fonds = res.fonds; fa_accomp = res.accomp;
    interets_accompagnement_payes = interets_accompagnement_a_payer;
    res = financer(commission_a_payer);
    fc_foncier = res.foncier; fc_fonds = res.fonds; fc_accomp = res.accomp;
    commission_payee = commission_a_payer;
  }

  // 2. Calcul du coût du trimestre (hors intérêts et commission)
  let commission_trimestre = (credit_foncier + credit_accompagnement) * (commission_rate / 100) * (jours / 365);
  let cout_trimestre = 0;
  if (i === 0) {
    cout_trimestre = prix_achat + frais_notaire + frais_agence + frais_dossier +
      honoraires_techniques_par_trimestre + prorata_foncier_par_trimestre +
      diagnostics_par_trimestre + travaux_par_trimestre;
  } else {
    cout_trimestre = travaux_par_trimestre + honoraires_techniques_par_trimestre +
      prorata_foncier_par_trimestre + diagnostics_par_trimestre;
  }

  // 3. Financement du coût du trimestre (ordre foncier > fonds propres > accompagnement)
  const res_cout = financer(cout_trimestre);
  const foncier_utilise_trimestre = res_cout.foncier;
  const fonds_utilise_trimestre = res_cout.fonds;
  const accomp_utilise_trimestre = res_cout.accomp;

  // 4. Calcul des intérêts générés sur l'encours à la fin du trimestre (à payer au trimestre suivant)
  const interets_foncier_genere = encours_foncier * (taux_credit / 100) * (jours / 365);
  const interets_accompagnement_genere = encours_accompagnement * (taux_credit / 100) * (jours / 365);

  // 5. Report des intérêts et commission à payer au trimestre suivant
  interets_foncier_a_payer = interets_foncier_genere;
  interets_accompagnement_a_payer = interets_accompagnement_genere;
  commission_a_payer = commission_trimestre;

  // 6. Stockage dans trimestre_details (on affiche ce qui est payé ce trimestre)
  trimestre_details.push({
    trimestre: trimestre.trimestre,
    jours,
    start_date: trimestre.start_date,
    end_date: trimestre.end_date,
    credit_foncier_utilise: foncier_utilise_trimestre + fp_foncier + fa_foncier + fc_foncier,
    fonds_propres_utilise: fonds_utilise_trimestre + fp_fonds + fa_fonds + fc_fonds,
    credit_accompagnement_utilise: accomp_utilise_trimestre + fp_accomp + fa_accomp + fc_accomp,
    interets_foncier: interets_foncier_payes,
    interets_accompagnement: interets_accompagnement_payes,
    commission_accompagnement: commission_payee,
    cout_financier_trimestre: interets_foncier_payes + interets_accompagnement_payes + commission_payee
  });
}

// Calcul des totaux par catégorie (hors financement)
const total_acquisition = prix_achat + frais_notaire + frais_agence;
const total_travaux = cout_travaux_total + cout_maitrise_oeuvre + cout_aleas +
  cout_amenagement_terrasse + mobilier + cout_demolition;
const total_divers = honoraires_techniques + prorata_foncier + diagnostics;

// Calcul du prix de revient et des marges
const prix_revient = total_acquisition + total_travaux + total_divers + total_couts_financiers;
const marge_brute = prix_vente_fai - prix_revient;
const marge_nette = prix_vente_hfa - prix_revient;
const rentabilite = (marge_nette / prix_revient) * 100;

// Calcul des pourcentages de répartition des coûts
const total_cout = prix_revient;
const pourcentage_acquisition = (total_acquisition / total_cout) * 100;
const pourcentage_travaux = (total_travaux / total_cout) * 100;
const pourcentage_divers = (total_divers / total_cout) * 100;

// Calcul des prix au m²
const prix_achat_pondere_m2 = prix_achat / surface_ponderee_apres_travaux;
const prix_achat_carrez_m2 = prix_achat / surface_carrez_apres_travaux;
const prix_revient_pondere_m2 = prix_revient / surface_ponderee_apres_travaux;
const prix_revient_carrez_m2 = prix_revient / surface_carrez_apres_travaux;
const prix_vente_pondere_m2 = prix_vente_reel_pondere_m2;
const prix_vente_carrez_m2 = prix_vente_reel_pondere_m2;

// Fonction utilitaire de financement
function financer(montant) {
  let foncier = 0, fonds = 0, accomp = 0;
  if (credit_foncier_restant > 0) {
    foncier = Math.min(montant, credit_foncier_restant);
    credit_foncier_restant -= foncier;
    encours_foncier += foncier;
    credit_foncier_utilise_total += foncier;
    montant -= foncier;
  }
  if (montant > 0 && fonds_propres_restant > 0) {
    fonds = Math.min(montant, fonds_propres_restant);
    fonds_propres_restant -= fonds;
    encours_fonds_propres += fonds;
    fonds_propres_utilise_total += fonds;
    montant -= fonds;
  }
  if (montant > 0 && credit_accomp_restant > 0) {
    accomp = Math.min(montant, credit_accomp_restant);
    credit_accomp_restant -= accomp;
    encours_accompagnement += accomp;
    credit_accomp_utilise_total += accomp;
    montant -= accomp;
  }
  return { foncier, fonds, accomp };
}
``` 

# [MAJ 2024-06] Migration PDF : centralisation, mapping et génération

## Objectif
- Centraliser la génération des données PDF via un service unique (`PdfMappingService`) utilisant les schémas Zod partagés.
- Garantir que le backend est la seule source de vérité pour les données et calculs PDF : le frontend ne fait qu'afficher ou transmettre la config.

## Ce qui a été fait
- **Mapping unique** : Toute la donnée PDF est générée via `PdfMappingService.mapProjectToPdfData(project, config)` qui applique strictement les schémas partagés (`shared/types/pdf.ts`).
- **Validation stricte** : Toute config PDF reçue est validée avec Zod avant traitement.
- **Templates Handlebars** : Les templates HTML utilisent uniquement les propriétés du mapping, sans logique métier locale.
- **Helpers Handlebars** : Uniquement pour le formatage (monétaire, pourcentage, etc.), jamais pour des calculs métiers.
- **Génération du PDF** : Réalisée côté backend avec Puppeteer, en injectant le HTML généré à partir des templates et des données validées.
- **Debug** : Le HTML intermédiaire est sauvegardé pour faciliter le debug.

## Points d'attention
- **Aucun calcul métier dans le frontend ou dans les templates**.
- **Toute évolution de la structure PDF** doit passer par :
  1. Mise à jour du schéma partagé dans `/shared/types/`
  2. Adaptation du mapping dans `PdfMappingService`
  3. Ajustement éventuel des templates HTML
- **Synchronisation stricte** entre types, mapping, et templates.

## Prochaines étapes
- Vérifier l'affichage de chaque champ dans le PDF (surtout les nouveaux ou modifiés).
- Documenter toute évolution du mapping ou des templates dans ce plan.
- Continuer à tester la génération PDF après chaque évolution majeure.

---

**À jour au 2024-06-XX – Migration PDF centralisée et conforme à la stratégie de synchronisation des types.** 