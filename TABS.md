# 📑 Documentation des onglets LKI

Ce document détaille le fonctionnement, les conventions et les structures de données de chaque onglet principal de l'application LKI.

## 📋 Table des matières
- [Business Plan Tab](#business-plan-tab)
- [DVF Tab](#dvf-tab)
- [PDF Tab](#pdf-tab)
- [Photos Tab](#photos-tab)
- [Conventions globales](#conventions-globales)
- [🏠 Description du bien Tab](#description-du-bien-tab)
- [🏗️ Rénovation Tab](#renovation-tab)

## Business Plan Tab

L'onglet **Business Plan** permet de modéliser, simuler et analyser la rentabilité d'un projet immobilier. Il centralise la saisie des hypothèses, le calcul automatique des indicateurs financiers, la visualisation des résultats et la gestion des validations côté frontend et backend.

### Fonctionnalités principales
- **Saisie structurée des hypothèses** :
  - Prix d'achat, frais de notaire, frais d'agence, coûts travaux, honoraires, financement, calendrier, etc.
  - Gestion des pourcentages (saisie directe en % pour les frais, taux, etc.)
  - Saisie des surfaces, pondérations, et hypothèses de vente
- **Calculs automatiques** :
  - Prix de revient, marge brute et nette, rentabilité, TRI, cash-flow, ROI
  - Calcul du prix de vente théorique (prix benchmark × pondération)
  - Calculs trimestriels détaillés (financement, intérêts, commissions, etc.)
  - Synthèse des coûts et du financement
- **Visualisation** :
  - Tableaux de synthèse (coûts, financement, prix au m², détails par trimestre)
  - Graphiques (répartition, évolution, KPIs)
  - Affichage dynamique des résultats et des erreurs
- **Validation et typage** :
  - Validation stricte des entrées et des résultats avec Zod (types partagés)
  - Gestion des erreurs de validation et de calcul (retour utilisateur clair)
- **Persistance et synchronisation** :
  - Sauvegarde automatique des hypothèses et résultats dans la base de données
  - Rechargement automatique des données à l'ouverture de l'onglet
- **Gestion des cas limites** :
  - Contrôle des financements insuffisants
  - Gestion des valeurs manquantes ou incohérentes
  - Affichage d'erreurs explicites en cas de problème

### Typage et validation (front & back)
- **Types partagés** dans `shared/types/business-plan.ts` :
  - `BusinessPlanInputs` : toutes les hypothèses saisies (nombres, dates, pourcentages, montants)
  - `BusinessPlanResults` : structure complète des résultats calculés (synthèse, détails, KPIs)
  - `BusinessPlanInputsSchema` et `BusinessPlanResultsSchema` : validation Zod stricte (min, max, formats, required)
  - Types utilitaires pour les sous-objets (trimestres, répartition, etc.)
- **Backend** :
  - Validation des entrées avec Zod dès la réception de la requête
  - Validation des résultats avant envoi
  - Typage explicite des routes Express (`Request<{}, {}, BusinessPlanInputs>`, `Response<BusinessPlanResults>`, etc.)
  - Gestion typée des erreurs (structure d'erreur dédiée)
- **Frontend** :
  - Validation des inputs avant envoi (Zod)
  - Validation de la réponse du backend (Zod)
  - Utilisation stricte des types partagés pour tous les états et props
  - Gestion typée des erreurs et des états de chargement

### Interactions front/back
- **API** :
  - Route POST `/api/business-plan/:id/calculate` : reçoit un `BusinessPlanInputs`, retourne un `BusinessPlanResults` ou une erreur typée
  - Les données sont toujours validées côté back et front
  - Les erreurs de validation ou de calcul sont renvoyées avec un message explicite
- **Synchronisation** :
  - Les hypothèses et résultats sont persistés côté base de données et rechargés automatiquement
  - Les modifications côté utilisateur sont immédiatement sauvegardées et recalculées

### Bonnes pratiques et conseils
- **Centraliser les types et schémas dans le dossier partagé** pour garantir la cohérence
- **Valider systématiquement** toutes les données entrantes et sortantes avec Zod
- **Toujours manipuler les pourcentages comme des valeurs utilisateur** (ex : 2,5 pour 2,5 %)
- **Gérer explicitement les erreurs** côté front et back pour une UX robuste
- **Prévoir des valeurs par défaut** pour tous les champs (évite les NaN et undefined)
- **Documenter les cas limites** (financement insuffisant, incohérences, etc.)

### Cas limites gérés
- Financement insuffisant (alerte et détails)
- Valeurs manquantes ou incohérentes (validation bloquante)
- Erreurs de calcul ou de communication avec l'API (affichage clair)

### Conseils d'utilisation
- Vérifier la cohérence des hypothèses avant de lancer un calcul
- Utiliser les graphiques et tableaux pour analyser la rentabilité et les risques
- Corriger les erreurs signalées avant de poursuivre
- Utiliser la sauvegarde automatique pour ne rien perdre lors des changements d'onglet

---

**Cet onglet est conçu pour garantir la fiabilité, la robustesse et la transparence des calculs financiers, tout en offrant une expérience utilisateur fluide et sécurisée.**

### Structure de l'interface

1. **Inputs Généraux**
   - Prix d'achat et prix affiché
   - Dates d'achat et de vente
   - Durée du projet
   - Taux de commission

2. **Coûts d'Acquisition**
   - Prix d'achat
   - Frais de notaire
   - Frais d'agence
   - Frais de dossier

3. **Coûts des Travaux**
   - Coût total des travaux
   - Maîtrise d'œuvre
   - Aléas
   - Aménagement terrasse
   - Mobilier
   - Démolition
   - Honoraires techniques

4. **Financement**
   - Crédit foncier
   - Fonds propres
   - Crédit d'accompagnement
   - Taux d'intérêt
   - Mensualités

5. **Résultats**
   - Prix de revient
   - Marge brute et nette
   - TRI
   - Cash-flow mensuel
   - Prix FAI et HFA
   - Prix au m²

### Structure des données

#### Inputs (`BusinessPlanInputs`)
```ts
interface BusinessPlanInputs {
  prix_achat: number;              // Prix d'achat du bien
  prix_affiche: number;            // Prix affiché au client
  frais_notaire: number;           // Frais de notaire
  frais_agence: number;            // Frais d'agence d'achat
  frais_agence_vente: number;      // Frais d'agence de vente
  frais_dossier: number;           // Frais de dossier
  cout_travaux: number;            // Coût total des travaux
  salaire_maitrise: number;        // Maîtrise d'œuvre
  alea_travaux: number;            // Aléas des travaux
  amenagement_terrasse: number;    // Aménagement terrasse
  demolition: number;              // Démolition
  honoraires_techniques: number;   // Honoraires techniques
  prorata_foncier: number;         // Prorata foncier
  diagnostics: number;             // Diagnostics
  mobilier: number;                // Mobilier
  credit_foncier: number;          // Montant du crédit foncier
  fonds_propres: number;           // Fonds propres
  credit_accompagnement_total: number; // Crédit d'accompagnement
  taux_credit: number;             // Taux du crédit
  commission_rate: number;         // Taux de commission
  date_achat: string;              // Date d'achat
  date_vente: string;              // Date de vente
  duree_projet: number;            // Durée du projet en mois
}
```

#### Outputs (`BusinessPlanResults`)
```ts
interface BusinessPlanResults {
  resultats: {
    prix_revient: number;          // Prix de revient total
    marge_brute: number;           // Marge brute
    commission: number;            // Commission
    marge_nette: number;          // Marge nette
    rentabilite: number;          // Rentabilité
    cash_flow_mensuel: number;    // Cash-flow mensuel
    tri: number;                  // TRI
    date_vente: string;           // Date de vente
    prix_fai: number;             // Prix FAI
    prix_hfa: number;             // Prix HFA
  };
  prix_m2: {
    prix_m2: number;              // Prix au m²
    prix_m2_terrasse: number;     // Prix au m² terrasse
    prix_revient_m2: number;      // Prix de revient au m²
    prix_revient_m2_carrez: number; // Prix de revient au m² Carrez
    prix_m2_vente: number;        // Prix de vente au m²
    prix_m2_carrez_vente: number; // Prix de vente au m² Carrez
  };
  prorata: {
    acquisition: number;          // Prorata acquisition
    travaux: number;              // Prorata travaux
    financement: number;          // Prorata financement
    frais_divers: number;         // Prorata frais divers
  };
  couts_acquisition: {
    prix_achat: number;           // Prix d'achat
    frais_notaire: number;        // Frais de notaire
    frais_agence: number;         // Frais d'agence
    frais_dossier: number;        // Frais de dossier
    total: number;                // Total acquisition
  };
  couts_travaux: {
    cout_travaux_total: number;   // Coût total des travaux
    cout_maitrise_oeuvre: number; // Coût maîtrise d'œuvre
    cout_aleas: number;           // Coût aléas
    cout_amenagement_terrasse: number; // Coût aménagement terrasse
    cout_mobilier: number;        // Coût mobilier
    cout_demolition: number;      // Coût démolition
    cout_honoraires_techniques: number; // Coût honoraires techniques
    total: number;                // Total travaux
  };
  financement: {
    credit_foncier: number;       // Crédit foncier
    fonds_propres: number;        // Fonds propres
    credit_accompagnement: number; // Crédit d'accompagnement
    mensualite_credit_foncier: number; // Mensualité crédit foncier
    mensualite_credit_accompagnement: number; // Mensualité crédit accompagnement
    total_mensualites: number;    // Total mensualités
    interets_pret: number;        // Intérêts du prêt
    commission_accompagnement: number; // Commission accompagnement
    total_financement: number;    // Total financement
    total_interets: number;       // Total intérêts
    total_commission: number;     // Total commission
  };
  frais: {
    frais_notaire: number;        // Frais de notaire
    frais_agence: number;         // Frais d'agence
    frais_agence_vente: number;   // Frais d'agence de vente
    frais_dossier: number;        // Frais de dossier
    total: number;                // Total frais
  };
  trimestre_details: Array<{
    trimestre: number;            // Numéro du trimestre
    jours: number;                // Nombre de jours
    start_date: string;           // Date de début
    end_date: string;             // Date de fin
    credit_foncier_utilise: number; // Crédit foncier utilisé
    fonds_propres_utilise: number; // Fonds propres utilisés
    credit_accompagnement_utilise: number; // Crédit accompagnement utilisé
    interets_foncier: number;     // Intérêts crédit foncier
    interets_accompagnement: number; // Intérêts crédit accompagnement
    commission_accompagnement: number; // Commission accompagnement
  }>;
}
```

### Typage partagé et validation Zod

#### Schémas de validation

```ts
// shared/types/business-plan.ts

import { z } from 'zod';

// Constantes pour les valeurs par défaut
export const DEFAULT_VALUES = {
  taux_credit: 3.5,
  commission_rate: 5,
  duree_projet: 12,
  alea_travaux: 10,
  prorata_foncier: 0.3
} as const;

// Schéma pour les inputs
export const BusinessPlanInputsSchema = z.object({
  // Prix et frais
  prix_achat: z.number().min(0, "Le prix d'achat doit être positif"),
  prix_affiche: z.number().min(0, "Le prix affiché doit être positif"),
  frais_notaire: z.number().min(0, "Les frais de notaire doivent être positifs"),
  frais_agence: z.number().min(0, "Les frais d'agence doivent être positifs"),
  frais_agence_vente: z.number().min(0, "Les frais d'agence de vente doivent être positifs"),
  frais_dossier: z.number().min(0, "Les frais de dossier doivent être positifs"),

  // Travaux
  cout_travaux: z.number().min(0, "Le coût des travaux doit être positif"),
  salaire_maitrise: z.number().min(0, "Le salaire de maîtrise doit être positif"),
  alea_travaux: z.number().min(0).max(100, "Les aléas doivent être entre 0 et 100%")
    .default(DEFAULT_VALUES.alea_travaux),
  amenagement_terrasse: z.number().min(0, "L'aménagement terrasse doit être positif"),
  demolition: z.number().min(0, "La démolition doit être positive"),
  honoraires_techniques: z.number().min(0, "Les honoraires techniques doivent être positifs"),

  // Prorata et diagnostics
  prorata_foncier: z.number().min(0).max(1, "Le prorata foncier doit être entre 0 et 1")
    .default(DEFAULT_VALUES.prorata_foncier),
  diagnostics: z.number().min(0, "Les diagnostics doivent être positifs"),
  mobilier: z.number().min(0, "Le mobilier doit être positif"),

  // Financement
  credit_foncier: z.number().min(0, "Le crédit foncier doit être positif"),
  fonds_propres: z.number().min(0, "Les fonds propres doivent être positifs"),
  credit_accompagnement_total: z.number().min(0, "Le crédit d'accompagnement doit être positif"),
  taux_credit: z.number().min(0).max(100, "Le taux de crédit doit être entre 0 et 100")
    .default(DEFAULT_VALUES.taux_credit),
  commission_rate: z.number().min(0).max(100, "Le taux de commission doit être entre 0 et 100")
    .default(DEFAULT_VALUES.commission_rate),

  // Dates et durée
  date_achat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  date_vente: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  duree_projet: z.number().int().min(1, "La durée du projet doit être d'au moins 1 mois")
    .default(DEFAULT_VALUES.duree_projet)
}).refine(data => {
  const dateAchat = new Date(data.date_achat);
  const dateVente = new Date(data.date_vente);
  return dateVente > dateAchat;
}, {
  message: "La date de vente doit être postérieure à la date d'achat"
}).refine(data => {
  const totalFinancement = data.credit_foncier + data.fonds_propres + data.credit_accompagnement_total;
  return totalFinancement >= data.prix_achat;
}, {
  message: "Le total du financement doit couvrir au moins le prix d'achat"
});

// Schéma pour les résultats
export const BusinessPlanResultsSchema = z.object({
  resultats: z.object({
    prix_revient: z.number().min(0),
    marge_brute: z.number(),
    commission: z.number().min(0),
    marge_nette: z.number(),
    rentabilite: z.number(),
    cash_flow_mensuel: z.number(),
    tri: z.number(),
    date_vente: z.string(),
    prix_fai: z.number().min(0),
    prix_hfa: z.number().min(0)
  }),
  prix_m2: z.object({
    prix_m2: z.number().min(0),
    prix_m2_terrasse: z.number().min(0),
    prix_revient_m2: z.number().min(0),
    prix_revient_m2_carrez: z.number().min(0),
    prix_m2_vente: z.number().min(0),
    prix_m2_carrez_vente: z.number().min(0)
  }),
  prorata: z.object({
    acquisition: z.number().min(0).max(1),
    travaux: z.number().min(0).max(1),
    financement: z.number().min(0).max(1),
    frais_divers: z.number().min(0).max(1)
  }).refine(data => {
    const total = data.acquisition + data.travaux + data.financement + data.frais_divers;
    return Math.abs(total - 1) < 0.001; // Tolérance pour les erreurs d'arrondi
  }, {
    message: "La somme des proratas doit être égale à 1"
  }),
  couts_acquisition: z.object({
    prix_achat: z.number().min(0),
    frais_notaire: z.number().min(0),
    frais_agence: z.number().min(0),
    frais_dossier: z.number().min(0),
    total: z.number().min(0)
  }).refine(data => {
    return data.total === data.prix_achat + data.frais_notaire + data.frais_agence + data.frais_dossier;
  }, {
    message: "Le total des coûts d'acquisition est incorrect"
  }),
  couts_travaux: z.object({
    cout_travaux_total: z.number().min(0),
    cout_maitrise_oeuvre: z.number().min(0),
    cout_aleas: z.number().min(0),
    cout_amenagement_terrasse: z.number().min(0),
    cout_mobilier: z.number().min(0),
    cout_demolition: z.number().min(0),
    cout_honoraires_techniques: z.number().min(0),
    total: z.number().min(0)
  }).refine(data => {
    return data.total === data.cout_travaux_total + data.cout_maitrise_oeuvre + 
           data.cout_aleas + data.cout_amenagement_terrasse + data.cout_mobilier + 
           data.cout_demolition + data.cout_honoraires_techniques;
  }, {
    message: "Le total des coûts de travaux est incorrect"
  }),
  financement: z.object({
    credit_foncier: z.number().min(0),
    fonds_propres: z.number().min(0),
    credit_accompagnement: z.number().min(0),
    mensualite_credit_foncier: z.number().min(0),
    mensualite_credit_accompagnement: z.number().min(0),
    total_mensualites: z.number().min(0),
    interets_pret: z.number().min(0),
    commission_accompagnement: z.number().min(0),
    total_financement: z.number().min(0),
    total_interets: z.number().min(0),
    total_commission: z.number().min(0)
  }).refine(data => {
    return data.total_mensualites === data.mensualite_credit_foncier + data.mensualite_credit_accompagnement;
  }, {
    message: "Le total des mensualités est incorrect"
  }),
  frais: z.object({
    frais_notaire: z.number().min(0),
    frais_agence: z.number().min(0),
    frais_agence_vente: z.number().min(0),
    frais_dossier: z.number().min(0),
    total: z.number().min(0)
  }).refine(data => {
    return data.total === data.frais_notaire + data.frais_agence + 
           data.frais_agence_vente + data.frais_dossier;
  }, {
    message: "Le total des frais est incorrect"
  }),
  trimestre_details: z.array(z.object({
    trimestre: z.number().int().min(1),
    jours: z.number().int().min(1).max(92),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    credit_foncier_utilise: z.number().min(0),
    fonds_propres_utilise: z.number().min(0),
    credit_accompagnement_utilise: z.number().min(0),
    interets_foncier: z.number().min(0),
    interets_accompagnement: z.number().min(0),
    commission_accompagnement: z.number().min(0)
  }))
});

// Types dérivés des schémas
export type BusinessPlanInputs = z.infer<typeof BusinessPlanInputsSchema>;
export type BusinessPlanResults = z.infer<typeof BusinessPlanResultsSchema>;

// Types utilitaires
export type TrimestreDetail = z.infer<typeof BusinessPlanResultsSchema>['trimestre_details'][number];
export type Resultats = z.infer<typeof BusinessPlanResultsSchema>['resultats'];
export type PrixM2 = z.infer<typeof BusinessPlanResultsSchema>['prix_m2'];
export type Prorata = z.infer<typeof BusinessPlanResultsSchema>['prorata'];
export type CoutsAcquisition = z.infer<typeof BusinessPlanResultsSchema>['couts_acquisition'];
export type CoutsTravaux = z.infer<typeof BusinessPlanResultsSchema>['couts_travaux'];
export type Financement = z.infer<typeof BusinessPlanResultsSchema>['financement'];
export type Frais = z.infer<typeof BusinessPlanResultsSchema>['frais'];
```

#### Utilisation dans le frontend

```ts
// frontend/src/components/project-sections/BusinessPlanTab.tsx

import { 
  BusinessPlanInputsSchema, 
  BusinessPlanResultsSchema,
  BusinessPlanInputs,
  BusinessPlanResults,
  DEFAULT_VALUES
} from '../../../../shared/types/business-plan';

// Validation des inputs avec gestion d'erreurs détaillée
const validateInputs = (inputs: unknown) => {
  const result = BusinessPlanInputsSchema.safeParse(inputs);
  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }));
    console.error('Erreurs de validation des inputs:', errors);
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
};

// Validation des résultats avec gestion d'erreurs détaillée
const validateResults = (results: unknown) => {
  const result = BusinessPlanResultsSchema.safeParse(results);
  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }));
    console.error('Erreurs de validation des résultats:', errors);
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
};

// Exemple d'utilisation dans un composant
const BusinessPlanTab = () => {
  const [inputs, setInputs] = useState<BusinessPlanInputs>({
    ...DEFAULT_VALUES,
    prix_achat: 0,
    prix_affiche: 0,
    frais_notaire: 0,
    frais_agence: 0,
    frais_agence_vente: 0,
    frais_dossier: 0,
    cout_travaux: 0,
    salaire_maitrise: 0,
    amenagement_terrasse: 0,
    demolition: 0,
    honoraires_techniques: 0,
    diagnostics: 0,
    mobilier: 0,
    credit_foncier: 0,
    fonds_propres: 0,
    credit_accompagnement_total: 0,
    date_achat: new Date().toISOString().split('T')[0],
    date_vente: new Date().toISOString().split('T')[0]
  });

  const [results, setResults] = useState<BusinessPlanResults | null>(null);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);

  const handleSubmit = async () => {
    const validation = validateInputs(inputs);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      const response = await fetch('/api/business-plan/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data)
      });
      
      const resultsData = await response.json();
      const resultsValidation = validateResults(resultsData);
      
      if (!resultsValidation.valid) {
        setErrors(resultsValidation.errors);
        return;
      }

      setResults(resultsValidation.data);
      setErrors([]);
    } catch (error) {
      console.error('Erreur lors du calcul:', error);
      setErrors([{ path: 'global', message: 'Erreur lors du calcul du business plan' }]);
    }
  };

  return (
    <div>
      {/* Affichage des erreurs */}
      {errors.length > 0 && (
        <div className="errors">
          {errors.map((error, index) => (
            <div key={index} className="error">
              {error.path !== 'global' ? `${error.path}: ` : ''}{error.message}
            </div>
          ))}
        </div>
      )}
      
      {/* Formulaire et résultats */}
      {/* ... */}
    </div>
  );
};
```

#### Utilisation dans le backend

```ts
// backend/src/routes/business-plan.routes.ts

import { 
  BusinessPlanInputsSchema, 
  BusinessPlanResultsSchema,
  BusinessPlanInputs,
  BusinessPlanResults
} from '../../../shared/types/business-plan';
import { z } from 'zod';

router.post('/calculate', async (req, res) => {
  try {
    // Validation des inputs
    const inputs = BusinessPlanInputsSchema.parse(req.body);
    
    // Calcul des résultats
    const results = await calculateBusinessPlan(inputs);
    
    // Validation des résultats
    const validatedResults = BusinessPlanResultsSchema.parse(results);
    
    res.json(validatedResults);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        error: 'Données invalides', 
        details: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      });
    } else {
      console.error('Erreur serveur:', error);
      res.status(500).json({ 
        error: 'Erreur serveur',
        message: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    }
  }
});
```

### Points d'attention

1. **Validation des données**
   - Validation stricte des inputs et résultats
   - Messages d'erreur clairs et en français
   - Gestion des erreurs détaillée avec chemins d'accès

2. **Cohérence des types**
   - Types dérivés des schémas Zod
   - Types utilitaires pour les sous-objets
   - Éviction complète de `any`

3. **Valeurs par défaut**
   - Définition centralisée dans `DEFAULT_VALUES`
   - Utilisation cohérente dans le frontend
   - Documentation des choix

4. **Validation métier**
   - Vérification des totaux et sommes
   - Validation des dates et durées
   - Contraintes sur les pourcentages et ratios

5. **Performance**
   - Validation optimisée des schémas complexes
   - Gestion efficace des erreurs
   - Typage strict pour éviter les erreurs runtime

### Processus métier

1. **Saisie des données**
   - L'utilisateur saisit ou modifie les inputs dans le formulaire
   - Validation en temps réel des champs
   - Calcul automatique des montants dérivés

2. **Enregistrement**
   - Sauvegarde des inputs via `PUT /api/business-plan/:projectId`
   - Validation des données côté backend
   - Stockage dans la base de données

3. **Calcul du business plan**
   - Déclenchement du calcul via `POST /api/business-plan/:projectId/calculate`
   - Calcul des différents ratios et indicateurs
   - Génération du suivi trimestriel

4. **Affichage des résultats**
   - Mise à jour de l'interface avec les nouveaux résultats
   - Affichage des tableaux de synthèse
   - Visualisation des graphiques et indicateurs

### API Endpoints

#### Mise à jour des inputs
- **PUT** `/api/business-plan/:projectId`
  - Paramètres : BusinessPlanInputs
  - Retourne : projet mis à jour

#### Calcul du business plan
- **POST** `/api/business-plan/:projectId/calculate`
  - Paramètres : aucun
  - Retourne : BusinessPlanResults

### Bonnes pratiques

1. **Validation des données**
   - Vérifier la cohérence des inputs avant envoi
   - Valider les montants et les dates
   - Gérer les cas particuliers (travaux nuls, etc.)

2. **Calculs**
   - Centraliser les calculs côté backend
   - Utiliser des fonctions dédiées pour chaque type de calcul
   - Documenter les formules utilisées

3. **Interface utilisateur**
   - Afficher les erreurs de validation clairement
   - Mettre en évidence les indicateurs clés
   - Permettre l'export des données

4. **Performance**
   - Optimiser les calculs lourds
   - Mettre en cache les résultats fréquents
   - Limiter les appels API

### Astuces d'utilisation

1. **Optimisation des coûts**
   - Ajuster les frais de notaire selon le type de bien
   - Optimiser le montant des fonds propres
   - Négocier les taux de commission

2. **Analyse de rentabilité**
   - Surveiller le TRI et le cash-flow
   - Comparer les prix au m²
   - Analyser le suivi trimestriel

3. **Gestion des risques**
   - Prévoir des aléas suffisants
   - Anticiper les variations de taux
   - Planifier les délais de vente

### Checklist pour évolution/migration future
- [ ] Ajouter toute nouvelle catégorie dans le type partagé `PhotoCategory`
- [ ] Mettre à jour les schémas Zod côté front et back
- [ ] Vérifier l'ordre des routes Express lors de l'ajout de nouveaux endpoints
- [ ] Documenter toute modification dans ce fichier et dans le MIGRATION_PLAN.md
- [ ] Tester la cohérence front/back (types, validation, structure des réponses)

---

**Remarque** :  
Pour toute évolution, suivre la méthodologie :  
1. Définir/mettre à jour le type partagé dans `shared/types/photo.ts`
2. Adapter les schémas Zod
3. Mettre à jour les routes et services backend
4. Adapter le frontend (états, accès, validation)
5. Documenter ici et dans le plan de migration

## Conventions globales

### Nommage
- **Snake_case** partout (front, back, BDD)
- Types centralisés dans `src/types/`
- Endpoints REST documentés
- Scripts SQL dans `backend/scripts/`

### Structure
- Composants React dans `frontend/src/components/`
- Contrôleurs dans `backend/src/controllers/`
- Services dans `backend/src/services/`
- Assets statiques dans `frontend/public/`

### Évolution
- Ajouter les nouveaux champs en snake_case
- Migrer les anciens objets si nécessaire
- Documenter les modifications
- Maintenir la cohérence front/back

---

**Pour toute évolution :**
1. Ajouter les nouveaux champs en snake_case
2. Mettre à jour les types et validations
3. Migrer les données existantes
4. Documenter les changements
5. Tester la cohérence

# 🏠 Description du bien Tab

### Fonctionnalités
- Saisie et édition des caractéristiques qualitatives et quantitatives du bien immobilier.
- Calcul automatique du **coefficient de pondération** (coef) et de ses impacts, centralisé côté backend.
- Affichage dynamique et détaillé :
  - Coefficient global (cercle coloré)
  - Tableau des impacts : chaque paramètre (vue, étage, ascenseur, extérieur, adresse, état, nombre de pièces) affiche son impact individuel sur le coefficient, avec code couleur.
- Calcul et affichage de la **surface totale pondérée** (surface + terrasse × ratio).
- Synchronisation en temps réel avec le backend : toute modification d'un paramètre déclenche le recalcul et la sauvegarde.

### Structure des données

#### Inputs (`FullDescriptionBien`)
```ts
{
  inputsGeneral: {
    superficie: number;              // Surface principale (m²)
    superficie_terrasse: number;     // Surface terrasse (m²)
    ponderation_terrasse: number;    // Ratio de pondération terrasse (ex: 0.3)
    description_quartier?: string;   // Description du quartier (optionnel)
    surface_totale?: number;         // Calculé automatiquement
  },
  inputsDescriptionBien: {
    vue: string;                     // Qualité de la vue
    etage: string;                   // Étage
    ascenseur: string;               // Présence d'ascenseur
    exterieur: string;               // Surface extérieure
    adresse: string;                 // Qualité de l'adresse
    etat: string;                    // État du bien
    nombre_pieces: number;           // Nombre de pièces
  }
}
```

#### Outputs (`DescriptionBienResults`)
```ts
{
  coef_ponderation: number; // Coefficient global pondéré
  surface_totale: number;   // Surface totale pondérée (calculée)
  impacts: Array<{
    parameter: string;      // Nom du paramètre (ex: 'Vue', 'Étage', ...)
    value: string;          // Valeur sélectionnée
    impact: number;         // Impact sur le coef
    description: string;    // Description de l'impact
  }>
}
```

### Processus métier
1. L'utilisateur saisit ou modifie une caractéristique (surface, étage, etc.)
2. À chaque modification, le front :
   - Envoie les données au backend via PATCH `/api/property/:id/property-description` (ou `/api/projects/:id/general-inputs` pour les inputs généraux).
   - Le backend recalcule la surface totale pondérée et le coefficient, puis renvoie le projet mis à jour.
3. Le front met à jour l'affichage :
   - Coefficient global (cercle)
   - Tableau des impacts (un par paramètre, code couleur)
   - Surface totale pondérée

### Bonnes pratiques
- **Centraliser tous les calculs** (surface, coef, impacts) côté backend pour garantir la cohérence métier.
- **Synchroniser l'état local** avec la réponse backend après chaque modification.
- **Respecter la correspondance des noms de paramètres** entre backend (français, accentués) et frontend (mapping dans le code).
- **Afficher les impacts de tous les paramètres**, y compris le nombre de pièces.
- **Utiliser le code couleur** : vert (>0), rouge (<0), neutre (=0).

# 🏗️ Rénovation Tab

### Fonctionnalités
- Saisie et édition des caractéristiques post-travaux du bien immobilier
- Gestion du calendrier des travaux
- Upload et visualisation des plans de rénovation
- Upload et visualisation des explications 3D
- Calcul automatique de la surface pondérée après travaux
- Calcul automatique de la date de fin des travaux

### Structure des données

#### Inputs (`RenovationBienInputs`)
```ts
{
  // Surfaces et nombre de pièces
  superficie_apres: number;           // Surface intérieure après travaux (m²)
  superficie_exterieur_apres: number; // Surface extérieure après travaux (m²)
  nombre_pieces_apres: number;        // Nombre de pièces après travaux

  // Calendrier
  date_debut: string;                 // Date de début des travaux (YYYY-MM-DD)
  duree_mois: number;                 // Durée des travaux en mois

  // Plans et explications
  plan_renovation?: string;           // URL du plan de rénovation (optionnel)
  explication_3d?: string;            // URL de l'explication 3D (optionnel)
}
```

#### Outputs (`RenovationBienResults`)
```ts
{
  surface_ponderee_apres: number;     // Surface pondérée après travaux (m²)
  date_fin: string;                   // Date de fin des travaux (YYYY-MM-DD)
}
```

### Processus métier
1. L'utilisateur saisit ou modifie une caractéristique (surface, date, etc.)
2. À chaque modification, le front :
   - Envoie les données au backend via PATCH `/api/property/:id/renovation`
   - Le backend recalcule la surface pondérée et la date de fin
   - Le backend renvoie le projet mis à jour
3. Le front met à jour l'affichage :
   - Surface pondérée après travaux
   - Date de fin des travaux
   - Plans et explications 3D

### Bonnes pratiques
- **Centraliser tous les calculs** (surface, dates) côté backend
- **Synchroniser l'état local** avec la réponse backend après chaque modification
- **Valider les dates** (format, cohérence)
- **Gérer les uploads** de plans et explications 3D de manière sécurisée
- **Afficher les erreurs** de validation clairement

### API Endpoints

#### Mise à jour des inputs
- **PATCH** `/api/property/:id/renovation`
  - Paramètres : RenovationBienInputs
  - Retourne : projet mis à jour

#### Upload de fichiers
- **POST** `/api/property/:id/renovation/plan`
  - Upload du plan de rénovation
- **POST** `/api/property/:id/renovation/3d`
  - Upload de l'explication 3D
