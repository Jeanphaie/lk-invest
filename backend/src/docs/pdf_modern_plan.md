# Plan du PDF Moderne LK Invest

## 1. Structure Générale
- Format A4
- Police principale: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto
- Couleurs principales: 
  - Bleu LK: #0a6c9d
  - Or: #bfa77a
  - Gris clair: #f8fafc
  - Texte: #2d3748

## 2. Sections du PDF

### 2.1 Page de Couverture
- Logo LK Invest
- Titre du projet
- Sous-titre (optionnel)
- Image de couverture
- KPIs principaux:
  - Prix d'achat
  - Prix de revient
  - Prix de vente
  - Marge nette
  - Rentabilité

### 2.2 Description du Bien
- Caractéristiques principales:
  - Surface carrez
  - Surface terrasse
  - Coefficient de pondération
  - Surface pondérée
- Description générale
- Photos avant/après
- Plans 3D

### 2.3 Valorisation DVF
- Prix benchmark
- Graphique d'évolution des prix
- Tableau des transactions comparables
- Distribution des prix
- KPIs:
  - Prix moyen du quartier
  - Prix premium
  - Nombre de transactions

### 2.4 Business Plan
- Synthèse financière:
  - Tableau des coûts
  - Tableau des revenus
  - Marge brute
  - Marge nette
  - Rentabilité
  - ROI
- Graphiques:
  - Évolution des prix (achat/revient/vente)
  - Répartition des coûts
  - Timeline du projet

### 2.5 Hypothèses de Vente
- Prix de vente FAI/HFA
- Frais d'agence
- Prix net
- Comparaison avec le benchmark
- Graphique comparatif

### 2.6 Détail Financier
- Acquisition:
  - Prix d'achat
  - Frais de notaire
  - Frais d'agence
- Travaux:
  - Coût travaux/m²
  - Détail des postes
  - Aléas
- Financement:
  - Crédit foncier
  - Fonds propres
  - Taux d'intérêt
  - Coût du crédit

## 3. Mapping des Données

### 3.1 Données Générales
```typescript
{
  project_title: string;
  adresse: string;
  latitude: number;
  longitude: number;
}
```

### 3.2 Description Bien
```typescript
{
  surface_carrez_apres_travaux: number;
  surface_terrasse_apres_travaux: number;
  coef_ponderation: number;
  surface_ponderee_apres_travaux: number;
  description_general: string;
}
```

### 3.3 DVF
```typescript
{
  prix_m2_benchmark: number;
  dvf_sel_final_avg: number;
  dvf_premium_final_avg: number;
  total_arrondissement_transactions: number;
  selection_cleaned_transactions: number;
  total_premium_transactions: number;
}
```

### 3.4 Business Plan
```typescript
{
  prix_achat: number;
  frais_notaire_percent: number;
  frais_agence_achat_percent: number;
  frais_agence_vente_percent: number;
  cout_travaux_m2: number;
  financement_credit_foncier_amount: number;
  financement_fonds_propres_amount: number;
  financement_taux_credit_percent: number;
  resultsBusinessPlan: {
    couts_totaux: {
      total: number;
    };
    prix_vente: {
      prix_vente_fai: number;
      prix_vente_hfa: number;
      frais_agence_vente: number;
      prix_vente_net: number;
    };
    resultats: {
      marge_brute: number;
      marge_nette: number;
      rentabilite: number;
      roi_annuel: number;
    };
    prix_m2: {
      prix_achat_pondere_m2: number;
      prix_revient_pondere_m2: number;
      prix_vente_pondere_m2: number;
      prix_achat_carrez_m2: number;
      prix_revient_carrez_m2: number;
      prix_vente_carrez_m2: number;
    };
  };
}
```

## 4. Templates HTML

### 4.1 Structure des Templates
- Chaque section aura son propre template HTML
- Utilisation de Handlebars pour le rendu dynamique
- CSS inline pour la compatibilité Puppeteer
- Classes CSS réutilisables

### 4.2 Composants Communs
- En-tête de section
- Cartes KPI
- Tableaux de données
- Graphiques
- Grilles de mise en page

## 5. Graphiques

### 5.1 Types de Graphiques
- Évolution des prix (ligne)
- Distribution des prix (barres)
- Comparatif achat/revient/vente (barres)
- Répartition des coûts (camembert)

### 5.2 Bibliothèque
- QuickChart.js pour la génération
- Format PNG pour la compatibilité
- Taille optimisée pour A4

## 6. Optimisations

### 6.1 Performance
- Minimisation du CSS
- Optimisation des images
- Réduction des requêtes HTTP

### 6.2 Compatibilité
- Support des sauts de page
- Gestion des marges
- Adaptation mobile/desktop

## 7. Prochaines Étapes
1. Création des templates HTML pour chaque section
2. Implémentation du CSS commun
3. Intégration des graphiques
4. Tests de génération
5. Optimisations finales 