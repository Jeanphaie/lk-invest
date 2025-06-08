# LKI - Analyse Immobilière & Business Plan

Application web pour l'analyse des transactions immobilières (DVF), la génération de business plan et la création de rapports PDF.

## 📋 Table des matières
- [Description](#-description)
- [Fonctionnalités principales](#-fonctionnalités-principales)
- [Prérequis](#-prérequis)
- [Installation & Configuration](#-installation--configuration)
- [Structure du projet](#-structure-du-projet)
- [Fonctionnalités détaillées](#-fonctionnalités-détaillées)
- [API & Endpoints](#-api--endpoints)
- [Déploiement & Production](#-déploiement--production)
- [Maintenance & Sauvegarde](#-maintenance--sauvegarde)
- [Sécurité](#-sécurité)
- [Tests & Qualité](#-tests--qualité)
- [Contribution](#-contribution)
- [FAQ & Dépannage](#-faq--dépannage)
- [Glossaire](#-glossaire)
- [Changelog](#-changelog)
- [🔄 Migration & Refactoring (2024)](#-migration--refactoring-2024)
- [Architecture des Types et Flux de Données](#-architecture-des-types-et-flux-de-données)
- [🛑 Pièges courants et retours d'expérience (2024)](#-pièges-courants-et-retours-d'expérience-2024)

## 🚀 Description

LKI est une application complète pour l'analyse et la gestion de projets immobiliers. Elle permet de :
- Analyser les transactions immobilières (DVF) autour d'un bien
- Générer des business plans détaillés
- Créer des rapports PDF professionnels
- Gérer une base de projets immobiliers
- Générer des descriptions de quartier avec l'IA

## 🛠️ Prérequis
- Node.js >= 18
- npm >= 8
- PostgreSQL >= 13
- Google Maps API Key
- OpenAI API Key (pour la génération de descriptions de quartier)

## ⚙️ Installation & Configuration

1. **Cloner le dépôt**
   ```bash
   git clone <url-du-repo>
   cd <nom-du-repo>
   ```

2. **Installer les dépendances**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   cd ../shared && npm install
   ```

3. **Configurer les variables d'environnement**
   - Copier `.env.example` en `.env` dans `backend/` et `frontend/`
   - Renseigner les variables (DB, API keys, etc.)

**Backend** (`backend/.env`) :
```env
DATABASE_URL="postgresql://postgres:new_secure_password_2025@163.172.32.45:5432/lki_db"
JWT_SECRET="your-secret-key"
PORT=3001
NODE_ENV=development
BASE_PDF_IMAGE_URL=http://localhost:3001
OPENAI_API_KEY="your-openai-api-key"
```

**Frontend** (`frontend/.env.local`) :
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY='your-google-maps-api-key'
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> ⚠️ **Ne jamais committer ces fichiers dans le dépôt !**

4. **Base de données**
   ```bash
   createdb lki_db
   psql -d lki_db -f backend/scripts/dvf_functions.sql
   ```

5. **Lancer Prisma Studio**
   ```bash
   cd backend
   npx prisma studio
   ```
   Accès : [http://localhost:5555](http://localhost:5555)

## 🏁 Lancement

1. **Démarrer PostgreSQL**
   ```bash
   sudo systemctl start postgresql
   ```

2. **Backend**
   ```bash
   cd backend
   npm run dev
   # ou en production : npm run build && npm start
   ```

3. **Frontend**
   ```bash
   cd frontend
   npm run dev
   # ou en production : npm run build && npm start
   ```

4. **Accéder à l'application**
   - [http://localhost:3000](http://localhost:3000)

## 🖥️ Fonctionnalités principales

### Description du bien
- Saisie des caractéristiques générales (surface, terrasse, etc.)
- Paramètres qualitatifs (vue, étage, ascenseur, etc.)
- Calcul automatique du coefficient de pondération
- Visualisation des impacts sur la valeur
- Persistance des données entre les onglets
- Génération automatique de description de quartier avec l'IA

### Analyse DVF
- Recherche de transactions immobilières dans un rayon
- Visualisation sur carte Google Maps interactive
- Statistiques détaillées (prix/m², médianes, etc.)
- Gestion des outliers
- Persistance des données DVF (transactions, séries, distributions)
- Filtrage des transactions par rayon
- Affichage du cercle de recherche sur la carte
- Analyse des transactions premium (top 10%)

### Business Plan
- Saisie et édition des données financières
- Calcul automatique (prix de revient, marge, TRI, cash-flow)
- Visualisation des résultats et tableaux de synthèse
- Enregistrement des inputs et résultats

### Rapports PDF
- Génération de rapports personnalisés
- Sélection des sections à inclure
- Intégration des photos
- Personnalisation du style

### Gestion des photos
- Upload par catégorie (before, 3d, during, after)
- Sélection pour le PDF
- Organisation et visualisation
- Gestion des fichiers

## 🔄 Dernières améliorations (2024)

### Persistance des données
- Sauvegarde automatique des données DVF en base
- Tables dédiées pour les transactions, séries et distributions
- Chargement initial des données depuis la base
- Évite les re-fetch inutiles lors des changements d'onglet
- Optimisation des requêtes SQL avec des fonctions dédiées

### Interface utilisateur
- Nouvelle interface pour la description du bien
- Visualisation des impacts sur la valeur
- Carte Google Maps interactive
- Affichage du rayon de recherche DVF
- Navigation fluide entre les onglets
- Intégration de Material-UI v7
- Support de Tailwind CSS
- Animations avec Framer Motion

### Validation et robustesse
- Validation Zod côté frontend et backend
- Gestion des erreurs améliorée
- Types TypeScript stricts
- Protection contre les données manquantes
- Gestion des erreurs API avec React Query

### Performance
- Optimisation des requêtes DVF
- Mise en cache des données
- Chargement progressif des composants
- Réduction des appels API
- Utilisation de Zustand pour la gestion d'état
- Optimisation des rendus avec React Query

## 🗂️ Structure du projet

```
<repo-root>/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Logique métier
│   │   ├── routes/        # Endpoints API
│   │   ├── services/      # Services métiers
│   │   ├── types/         # Types TypeScript
│   │   ├── utils/         # Utilitaires
│   │   ├── templates/     # Templates PDF
│   │   └── config/        # Configuration
│   ├── prisma/            # Schéma DB
│   ├── scripts/           # Scripts SQL
│   └── dist/              # Code compilé
├── frontend/
│   ├── src/
│   │   ├── components/    # Composants React
│   │   ├── pages/        # Pages Next.js
│   │   ├── services/     # Services front
│   │   ├── hooks/        # Hooks React
│   │   ├── context/      # Context React
│   │   ├── store/        # État global (Zustand)
│   │   └── styles/       # Styles CSS/Tailwind
│   ├── public/           # Assets statiques
│   └── .next/            # Build Next.js
├── shared/               # Types et utilitaires partagés
└── uploads/              # Photos et fichiers
```

## 🔗 API & Endpoints

### Projets
- `GET /api/projects` : Liste tous les projets
- `GET /api/project/:id` : Détails d'un projet
- `POST /api/project` : Créer un projet
- `PUT /api/project/:id` : Mettre à jour un projet
- `DELETE /api/project/:id` : Supprimer un projet

### Business Plan
- `PUT /api/business-plan/:projectId` : Mise à jour des inputs
- `POST /api/business-plan/:projectId/calculate` : Calcul
- `GET /api/business-plan/:projectId` : Récupération

### DVF (Analyse des transactions immobilières)
- `POST /api/dvf/:projectId/analyse` : **Route unifiée** pour toutes les analyses DVF
  - Retourne en une seule requête :
    - Les statistiques globales (moyennes, bornes, premium, outliers)
    - La liste des transactions filtrées
    - Les séries temporelles (évolution annuelle)
    - La distribution des prix (histogramme)
    - Le scatter plot (dispersion prix/surface)
    - Les transactions premium (top 10%)

### Quartier
- `POST /api/dvf/:id/generate-quartier-description` : Génération de description de quartier avec l'IA

### PDF
- `GET /api/pdf/:projectId` : Génération
- `GET /api/pdf/:projectId/config` : Configuration
- `PUT /api/pdf/:projectId/config` : Mise à jour config

### Photos
- `POST /api/photos/:projectId/:category` : Upload
- `POST /api/photos/:projectId/toggle-pdf` : Sélection PDF
- `DELETE /api/photos/:projectId/:category/:index` : Suppression

## 🏭 Déploiement & Production

### Recommandations
- Reverse proxy (Nginx/Caddy)
- SSL obligatoire (Let's Encrypt)
- Monitoring (UptimeRobot, Grafana)
- Logs (pm2, journalctl)

### Configuration du serveur
  ```bash
sudo apt update
sudo apt install nginx postgresql nodejs npm
# Configurer Nginx pour proxy_pass sur le frontend et backend
```

### Déploiement
```bash
# Backend
cd backend
npm install --production
npm run build
pm2 start dist/app.js --name "lki-backend"

# Frontend
cd frontend
npm install --production
npm run build
pm2 start npm --name "lki-frontend" -- start
```

### Scripts utiles
```bash
# Migration Prisma
npx prisma migrate dev

# Générer client Prisma
npx prisma generate

# Backup DB
pg_dump lki_db > backup/lki_db_$(date +%Y%m%d).sql

# Restaurer DB
psql lki_db < backup/lki_db_YYYYMMDD.sql
```

## 💾 Maintenance & Sauvegarde

### Sauvegarde du projet
```bash
# Dossier de travail
tar czvf /home/jeanphaie/backup/backup_lki_$(date +%Y%m%d_%H%M%S).tar.gz /data/lki

# Base de données
pg_dump lki_db > backup/lki_db_$(date +%Y%m%d).sql
```

### Restauration
```bash
# Dossier de travail
tar xzvf backup/backup_lki_YYYYMMDD_HHMMSS.tar.gz -C /

# Base de données
psql lki_db < backup/lki_db_YYYYMMDD.sql
```

### Automatisation des sauvegardes
```bash
crontab -e
# Ajouter la ligne suivante pour une sauvegarde quotidienne à 2h du matin
0 2 * * * /chemin/vers/backup_script.sh
```

## 🛡️ Sécurité

### Bonnes pratiques
- Variables d'environnement pour les secrets
- Pas de commit de données sensibles
- Accès SSH sécurisé (firewall, fail2ban)
- Mises à jour régulières des dépendances
- Limiter les droits d'accès aux dossiers sensibles (`uploads/`, `backups/`, etc.)

### Monitoring
- Surveillance des logs
- Alertes de sécurité
- Backups automatiques
- Tests de restauration

## 🧪 Tests & Qualité

### Tests
- **Backend** : tests unitaires avec Jest/Mocha
- **Frontend** : tests unitaires avec React Testing Library/Jest
- **Linting** : ESLint + Prettier
- **CI/CD** : GitHub Actions (workflow à configurer)

## 🧑‍💻 Contribution

### Processus
1. Fork du projet
2. Branche dédiée
3. Tests et documentation
4. Pull Request

### Conventions
- Snake_case pour les champs
- Tests pour les nouvelles fonctionnalités
- Documentation à jour
- Code review obligatoire

### Standards de code
- Utiliser TypeScript strict
- Suivre les conventions de nommage (camelCase pour JS/TS, snake_case pour SQL)
- Documenter les nouvelles fonctionnalités
- Ajouter des tests unitaires

## ❓ FAQ & Dépannage

### Problèmes courants
- **Cohérence coût/financement** : Vérifier `businessPlanController.ts`
- **Erreur de build** : Relancer `npm install`
- **API Google Maps** : Vérifier clé et quotas
- **Erreur de connexion à la base de données**
  ```bash
  sudo systemctl status postgresql
  sudo journalctl -u postgresql
  ```
- **Problèmes de PDF**
  ```bash
  chmod -R 755 /data/lki/uploads
  df -h
  ```

### Support
- Issues GitHub
- Documentation technique
- Tests de non-régression

## 📚 Pour aller plus loin

### Améliorations futures
- Tests end-to-end (Cypress/Playwright)
- Script de seed pour tests/démo
- Script de purge/clean
- Monitoring avancé
- CI/CD automatisé

### Roadmap
1. **Court terme**
   - Amélioration des performances DVF
   - Optimisation de la génération PDF
   - Ajout de graphiques interactifs
   - Export des données en Excel

2. **Moyen terme**
   - Application mobile
   - API publique
   - Intégration de nouvelles sources de données
   - Système de notifications

3. **Long terme**
   - IA pour l'analyse de marché
   - Marketplace de projets
   - Collaboration en temps réel
   - Intégration blockchain

## 📖 Glossaire

### Termes techniques
- **DVF** : Demande de Valeur Foncière, base de données des transactions immobilières
- **TRI** : Taux de Rentabilité Interne
- **FAI** : Frais d'Agence Inclus
- **HFA** : Hors Frais d'Agence
- **Prisma** : ORM pour la base de données
- **PM2** : Process Manager pour Node.js

### Termes métier
- **Prix de revient** : Coût total du projet (acquisition + travaux + frais)
- **Marge brute** : Différence entre prix de vente et prix de revient
- **Cash-flow** : Flux de trésorerie mensuel
- **Outliers** : Valeurs aberrantes dans les statistiques DVF

## 📝 Changelog

### v1.0.0 (2024-03-20)
- 🎉 Version initiale
- ✨ Business Plan complet
- 🗺️ Intégration DVF
- 📄 Génération PDF
- 📸 Gestion des photos

### v0.9.0 (2024-02-15)
- 🚧 Version beta
- 📊 Calculs financiers
- 🏗️ Structure de base
- 🔍 Recherche DVF

## 🔧 Développement

### Commandes utiles
```bash
# Lancer les tests
npm run test

# Lancer le linter
npm run lint

# Vérifier les types
npm run type-check

# Build en production
npm run build

# Développement
npm run dev
```

### Workflow Git
1. Créer une branche depuis `main`
   ```bash
   git checkout -b feature/nouvelle-fonctionnalite
   ```
2. Développer et commiter
   ```bash
   git add .
   git commit -m "feat: ajout nouvelle fonctionnalité"
   ```
3. Pousser et créer une PR
   ```bash
   git push origin feature/nouvelle-fonctionnalite
   ```

### Conventions de commit
- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `style:` Formatage
- `refactor:` Refactoring
- `test:` Tests
- `chore:` Maintenance

## 🤝 Support & Communauté

### Ressources
- [Documentation API](https://api.lki.fr/docs)
- [Guide d'utilisation](https://docs.lki.fr)
- [Forum communautaire](https://community.lki.fr)
- [Blog technique](https://blog.lki.fr)

### Contribuer
- [Guide de contribution](CONTRIBUTING.md)
- [Code de conduite](CODE_OF_CONDUCT.md)
- [Template de PR](.github/PULL_REQUEST_TEMPLATE.md)
- [Template d'issue](.github/ISSUE_TEMPLATE.md)

## 👤 Contact
- [Ton Nom] — [ton.email@exemple.com]
- [Site web](https://lki.fr)
- [Twitter](https://twitter.com/lki)
- [LinkedIn](https://linkedin.com/company/lki)

## 📄 Licence
MIT (ou à préciser)

---

<div align="center">
  <sub>Built with ❤️ by the LKI team</sub>
</div>

## 🔄 Migration & Refactoring (2024)

### Type System Migration

#### Overview
- Centralized all TypeScript + Zod types in `shared/types/`
- Removed duplicate type definitions from frontend and backend
- Enforced strict type safety across the entire application
- Aligned database schema with shared types

#### Key Changes

1. **Shared Types Structure**
   ```
   shared/types/
   ├── project.ts         # Main Project type and subtypes
   ├── business-plan.ts   # Business plan inputs and results
   ├── descriptionBien.ts # Property description
   ├── dvf.ts            # DVF analysis types
   ├── photo.ts          # Photo management
   └── pdf.ts            # PDF generation
   ```

2. **Database Schema Updates**
   - Moved general info into `inputsGeneral` (JSON)
   - Kept `resultsDvfMetadata` in Project table
   - Moved large DVF data to dedicated tables
   - Made `projectTitle` standalone column
   - Using auto-incremented integer as primary key

3. **Service Layer Refactoring**
   - Centralized all project data access in `ProjectService`
   - Removed direct Prisma access from routes
   - Added strict validation using shared Zod schemas
   - Normalized data structure (null → undefined)
   - Added default values for all fields

4. **Route Updates**
   - Removed obsolete fields (photosBefore, coverPhoto, etc.)
   - Replaced `z.any()` with proper Zod schemas
   - Centralized data normalization
   - Added proper error handling
   - Enforced type safety in all endpoints

5. **Frontend Integration**
   - Removed local type definitions
   - Updated all components to use shared types
   - Added proper type checking for API responses
   - Improved error handling and validation

### Migration Process

1. **Type Definition**
   ```typescript
   // Example of shared type definition
   export const ProjectSchema = z.object({
     id: z.number(),
     projectTitle: z.string(),
     inputsGeneral: InputsGeneralSchema,
     // ... other fields
   });
   ```

2. **Service Implementation**
   ```typescript
   // Example of service method
   async getProjectById(id: number): Promise<Project> {
     const project = await prisma.project.findUnique({...});
     return this.validateAndMapProject(project);
   }
   ```

3. **Route Handler**
   ```typescript
   // Example of route handler
   router.put('/:id', async (req, res) => {
     const updates = ProjectUpdateSchema.parse(req.body);
     const project = await projectService.updateProject(id, updates);
     res.json(project);
   });
   ```

### Testing & Validation

1. **Integration Tests**
   ```typescript
   describe('Project Service', () => {
     it('should validate project data', async () => {
       const project = await projectService.getProjectById(1);
       expect(ProjectSchema.safeParse(project).success).toBe(true);
     });
   });
   ```

2. **Type Checking**
   - Added `tsc --noEmit` to CI pipeline
   - Enforced strict mode in TypeScript config
   - Added runtime validation with Zod

### Best Practices

1. **Type Safety**
   - Always use shared types for API requests/responses
   - Validate all data at boundaries
   - Use Zod for runtime validation
   - Avoid type assertions

2. **Data Access**
   - Use ProjectService for all data operations
   - Validate data before saving
   - Normalize data structure
   - Handle errors properly

3. **Code Organization**
   - Keep types in shared folder
   - Use proper imports
   - Document complex types
   - Follow naming conventions

### Future Improvements

1. **Planned Updates**
   - Add more comprehensive tests
   - Improve error messages
   - Add data migration tools
   - Enhance type documentation

2. **Monitoring**
   - Add type coverage metrics
   - Track validation errors
   - Monitor performance impact
   - Log type-related issues

### Migration Checklist

- [x] Centralize all types
- [x] Update database schema
- [x] Refactor services
- [x] Update routes
- [x] Update frontend
- [x] Add validation
- [x] Add tests
- [x] Update documentation

### Related Documentation

- See `TABS.md` for detailed documentation of each tab
- See `MIGRATION_PLAN.md` for the complete migration plan
- See `API.md` for updated API documentation

## 📚 Architecture des Types et Flux de Données

### 📚 Structure des Types

#### 1. Base de Données (Prisma)
```typescript
// schema.prisma
model Project {
  id                    Int      @id @default(autoincrement())
  projectTitle         String
  inputsGeneral        Json?    // Stocké en JSON dans la BDD
  inputsDescriptionBien Json?
  resultsDescriptionBien Json?
  inputsBusinessPlan   Json?
  resultsBusinessPlan  Json?
  inputsDvf           Json?
  resultsDvfMetadata  Json?
  photos              Json?
  pdfConfig           Json?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

#### 2. Types Partagés (`shared/types/`)
Les types partagés définissent la structure des objets JSON stockés en base de données.

```typescript
// shared/types/dvf.ts
export const DvfPropertySchema = z.object({
    id: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    // ...
});

export type DvfProperty = z.infer<typeof DvfPropertySchema>;
```

### 🔄 Flux de Données

#### 1. Frontend → Backend
```typescript
// frontend/src/components/project-sections/DvfAnalysis.tsx
const fetchDvfData = async () => {
    // 1. Envoi des données au backend
    const response = await fetch(`/api/dvf/${project.id}/analyse`, {
        method: 'POST',
        body: JSON.stringify(requestData)
    });
    
    // 2. Validation des données reçues
    const validatedData = DvfAnalyseResponseSchema.parse(rawData);
}
```

#### 2. Backend → Base de Données
```typescript
// backend/src/services/project.service.ts
async getProjectById(id: number): Promise<Project | null> {
    // 1. Récupération des données brutes
    const project = await prisma.project.findUnique({
        where: { id },
        select: {
            id: true,
            inputsGeneral: true,
            // ...
        }
    });

    // 2. Validation et transformation
    return {
        id: project.id,
        inputsGeneral: this.validateJson<InputsGeneral>(project.inputsGeneral),
        // ...
    };
}
```

### 📝 Guide d'Utilisation

#### 1. Ajouter un Nouveau Champ
1. Vérifier dans `shared/types/` si le type existe
2. Si non, créer le type avec sa documentation :
```typescript
// shared/types/nouveau-type.ts
export const NouveauTypeSchema = z.object({
    champ1: z.number(),
    champ2: z.string(),
    // ...
});

export type NouveauType = z.infer<typeof NouveauTypeSchema>;

/**
 * Documentation du type
 * @param champ1 - Description du champ1
 * @param champ2 - Description du champ2
 */
```

#### 2. Modifier un Champ Existant
1. Localiser le type dans `shared/types/`
2. Modifier le schéma Zod et le type TypeScript
3. Mettre à jour la documentation
4. Vérifier les impacts sur le frontend et le backend

#### 3. Validation des Données
```typescript
// Validation avec Zod
const result = MonSchema.safeParse(data);
if (!result.success) {
    console.error('Erreurs de validation:', result.error.errors);
    return;
}
const validatedData = result.data;
```

### 🏗️ Structure des Dossiers

```
project/
├── shared/
│   └── types/           # Types partagés
│       ├── project.ts   # Types du projet
│       ├── dvf.ts       # Types DVF
│       └── ...
├── frontend/
│   └── src/
│       └── components/  # Composants React
└── backend/
    └── src/
        └── services/    # Services backend
```

### 🔍 Bonnes Pratiques

1. **Centralisation des Types**
   - Tous les types partagés doivent être dans `shared/types/`
   - Éviter la duplication des types
   - Utiliser des types dérivés quand possible

2. **Validation**
   - Valider les données à chaque étape (frontend → backend → BDD)
   - Utiliser Zod pour la validation
   - Gérer proprement les erreurs de validation

3. **Documentation**
   - Documenter chaque type avec des commentaires JSDoc
   - Expliquer les contraintes métier
   - Donner des exemples d'utilisation

4. **Typage Strict**
   - Éviter `any` et `unknown`
   - Utiliser des types précis
   - Lever des erreurs de compilation plutôt que des erreurs runtime

### 🚀 Exemple Complet

#### 1. Définition du Type
```typescript
// shared/types/dvf.ts
export const DvfPropertySchema = z.object({
    id: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    prix: z.number(),
    surface: z.number(),
    prix_m2: z.number(),
    date_mutation: z.string(),
    adresse: z.string(),
    code_postal: z.string(),
    ville: z.string(),
    type: z.string(),
    is_outlier: z.boolean(),
});

export type DvfProperty = z.infer<typeof DvfPropertySchema>;
```

#### 2. Utilisation dans le Frontend
```typescript
// frontend/src/components/DvfTab.tsx
import { DvfProperty } from '../../../../shared/types/dvf';

interface Props {
    properties: DvfProperty[];
}

const DvfTab: React.FC<Props> = ({ properties }) => {
    // TypeScript connaît la structure de properties
    return (
        <div>
            {properties.map(prop => (
                <div key={prop.id}>
                    {prop.adresse} - {prop.prix_m2}€/m²
                </div>
            ))}
        </div>
    );
};
```

#### 3. Utilisation dans le Backend
```typescript
// backend/src/services/dvf.service.ts
import { DvfPropertySchema } from '../../../../shared/types/dvf';

async function validateAndSaveProperty(data: unknown): Promise<DvfProperty> {
    const result = DvfPropertySchema.safeParse(data);
    if (!result.success) {
        throw new Error('Données invalides');
    }
    return result.data;
}
```

### ⚠️ Points d'Attention

1. **Cohérence des Types**
   - Maintenir la cohérence entre frontend et backend
   - Éviter les divergences de structure
   - Documenter les changements

2. **Performance**
   - Éviter les validations inutiles
   - Optimiser les schémas Zod
   - Mettre en cache les validations fréquentes

3. **Sécurité**
   - Valider toutes les entrées utilisateur
   - Sanitizer les données sensibles
   - Gérer les erreurs proprement

### 🔧 Outils Recommandés

1. **VS Code Extensions**
   - TypeScript
   - Zod
   - Prisma

2. **Linting**
   - ESLint
   - TypeScript ESLint
   - Prettier

3. **Documentation**
   - JSDoc
   - TypeDoc
   - Markdown

### 📚 Ressources

- [Documentation Zod](https://zod.dev/)
- [Documentation Prisma](https://www.prisma.io/docs)
- [Documentation TypeScript](https://www.typescriptlang.org/docs/)

# Structure des Types Partagés (LKI)

## 📦 Principe

- **1 fichier = 1 champ JSON** (ou 1 bloc métier de la BDD)
- **Pas de factorisation ni d'abstraction inutile**
- **Chaque fichier contient un schéma Zod et un type TypeScript strictement aligné sur la structure validée**
- **Le type `Project` centralise tous les imports et sous-champs**

## 📁 Arborescence

```
shared/types/
├── businessPlanInputs.ts
├── businessPlanResults.ts
├── descriptionBienInputs.ts
├── descriptionBienResults.ts
├── dvfDistribution.ts
├── dvfScatter.ts
├── dvfSeries.ts
├── dvfTransaction.ts
├── inputsDvf.ts
├── inputsGeneral.ts
├── inputsRenovationBien.ts
├── pdf.ts
├── photos.ts
├── project.ts
├── resultsDvfMetadata.ts
├── resultsRenovationBien.ts
```

## 🧩 Exemple de fichier (inputsGeneral)
```ts
import { z } from 'zod';

export const InputsGeneralSchema = z.object({
  projectTitle: z.string(),
  superficie: z.number(),
  superficie_terrasse: z.number(),
  ponderation_terrasse: z.number(),
  description_quartier: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type InputsGeneral = z.infer<typeof InputsGeneralSchema>;
```

## 🏗️ Type Project central
```ts
import { z } from 'zod';
import { InputsGeneralSchema } from './inputsGeneral';
import { InputsDvfSchema } from './inputsDvf';
import { ResultsDvfMetadataSchema } from './resultsDvfMetadata';
import { BusinessPlanInputsSchema } from './businessPlanInputs';
import { BusinessPlanResultsSchema } from './businessPlanResults';
import { PdfConfigSchema } from './pdf';
import { PhotosSchema } from './photos';
import { InputsRenovationBienSchema } from './inputsRenovationBien';
import { ResultsRenovationBienSchema } from './resultsRenovationBien';
import { DescriptionBienInputsSchema } from './descriptionBienInputs';
import { DescriptionBienResultsSchema } from './descriptionBienResults';
import { DvfTransactionSchema } from './dvfTransaction';
import { DvfSeriesSchema } from './dvfSeries';
import { DvfDistributionSchema } from './dvfDistribution';
import { DvfScatterSchema } from './dvfScatter';

export const ProjectSchema = z.object({
  id: z.number(),
  projectTitle: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  inputsGeneral: InputsGeneralSchema,
  inputsDvf: InputsDvfSchema.optional(),
  resultsDvfMetadata: ResultsDvfMetadataSchema.optional(),
  inputsBusinessPlan: BusinessPlanInputsSchema.optional(),
  resultsBusinessPlan: BusinessPlanResultsSchema.optional(),
  pdfConfig: PdfConfigSchema.optional(),
  photos: PhotosSchema.optional(),
  inputsRenovationBien: InputsRenovationBienSchema.optional(),
  resultsRenovationBien: ResultsRenovationBienSchema.optional(),
  inputsDescriptionBien: DescriptionBienInputsSchema.optional(),
  resultsDescriptionBien: DescriptionBienResultsSchema.optional(),
  dvfTransactions: z.array(DvfTransactionSchema).optional(),
  dvfSeries: z.array(DvfSeriesSchema).optional(),
  dvfDistributions: z.array(DvfDistributionSchema).optional(),
  dvfScatters: z.array(DvfScatterSchema).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
```

## 🚦 Utilisation
- **Importer le type ou le schéma dont vous avez besoin**
- **Valider les données avec le schéma Zod**
- **Utiliser le type pour le typage statique partout (front et back)**

## 🛡️ Avantages
- Plus de duplication ni d'ambiguïté
- Structure claire, évolutive, et documentée
- Validation et typage stricts, centralisés
- Facile à compléter ou à faire évoluer

---

**Pour toute évolution :**
1. Ajouter/modifier le fichier du champ concerné
2. Mettre à jour le schéma Project si besoin
3. Utiliser/importer le type partout (front, back, tests)

## 🛑 Pièges courants et retours d'expérience (2024)

### Problème rencontré : persistance des inputs (ex : onglet Rénovation)
- **Symptôme** : une valeur modifiée côté front (ex : surface après travaux) est immédiatement écrasée par l'ancienne valeur de la BDD après sauvegarde ou changement d'onglet.
- **Cause** : le backend (route PUT /api/projects/:id) ne mergeait pas explicitement le champ `inputsRenovationBien` (ou tout autre sous-objet ajouté après coup). Résultat : toute modification envoyée par le front était ignorée lors de la sauvegarde.
- **Diagnostic** :
  - Le front envoyait bien la bonne valeur (vérifiable avec des logs dans les handlers front)
  - Le backend renvoyait toujours l'ancienne valeur (logs backend sur le body reçu et la data mergée)
- **Correction** :
  - Ajouter explicitement le merge de chaque sous-objet (inputsRenovationBien, resultsRenovationBien, etc.) dans la route PUT backend, comme pour les autres champs.
  - Ajouter des logs backend pour tracer le body reçu, la donnée validée, la data mergée avant update.
  - Toujours tester le roundtrip complet : front → backend → BDD → front.

### Bonnes pratiques pour éviter ces bugs
- **À chaque ajout d'un nouveau champ ou d'un nouvel onglet** :
  - Vérifier que le champ est bien inclus dans le schéma de validation Zod côté backend ET dans le merge de la route PUT/PATCH.
  - Logger systématiquement le body reçu et la data mergée lors des updates.
  - Tester la persistance réelle : modifier une valeur côté front, changer d'onglet, revenir, et vérifier que la valeur reste bien celle saisie.
- **Pour les flux complexes (plusieurs états locaux)** :
  - Toujours synchroniser l'état local avec la prop reçue du parent, sauf si l'utilisateur édite (optimistic UI).
  - Ne jamais faire de setState sur l'état "BDD" dans les handlers front (seul le parent doit gérer la synchro après update).
- **En cas de bug de persistance** :
  - Ajouter des logs côté front ET backend pour suivre la valeur à chaque étape.
  - Vérifier la logique de merge dans la route backend.

### Exemple de merge correct dans la route PUT backend
```js
const data = {
  ...
  inputsRenovationBien: validatedData.inputsRenovationBien
    ? { ...existingProject.inputsRenovationBien, ...validatedData.inputsRenovationBien }
    : existingProject.inputsRenovationBien,
  // idem pour tous les sous-objets
};
```

**En suivant ces conseils, on évite 90% des bugs de persistance et de synchro front/back sur les nouveaux onglets ou champs !**