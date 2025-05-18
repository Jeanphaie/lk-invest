# Structure du PDF Moderne

## 1. Page de Couverture (cover_page_modern.html)
- Logo LK Invest
- Titre du projet
- Sous-titre (optionnel)
- Image de couverture
- KPIs principaux :
  - Prix d'achat
  - Prix de revient
  - Prix de vente
  - Marge nette et rentabilité

## 2. Résumé (synthese_modern.html)
- KPIs en grille (4 colonnes) :
  - Prix d'achat (FAI)
  - Prix de revient (travaux inclus)
  - Prix de vente (FAI)
  - Rentabilité fonds propres
- Tableau des hypothèses de vente
- Graphiques comparatifs :
  - Achat/Revient/Vente
  - Benchmark DVF

## 3. Description du Bien (property_description_modern.html)
- Caractéristiques principales :
  - Surface totale
  - Coefficient de pondération
  - Prix d'achat
  - Prix au m²
- Impacts sur la valorisation :
  - Liste des paramètres et leur impact
  - Description détaillée
- Description générale du bien

## 4. Analyse DVF (dvf_valuation_modern.html)
- Prix moyens :
  - Prix moyen sélection
  - Prix moyen arrondissement
  - Prix moyen premium
- Statistiques :
  - Nombre de transactions (sélection/arrondissement/premium)
- Seuils d'outliers :
  - Seuil inférieur
  - Seuil supérieur
  - Moyenne arrondissement
- Analyse détaillée

## 5. Hypothèses de Vente (hypotheses_vente_modern.html)
- Synthèse :
  - Prix de vente FAI/HFA
  - Frais d'agence
  - Prix de vente net
  - Prix/m² (pondéré/carrez)
  - Benchmark
- Principales hypothèses :
  - Surface pondérée/carrez
  - Pondération terrasse
  - Durée de détention
- Graphique comparatif des prix

## 6. Synthèse Financière (financial_data_modern.html)
- Acquisition :
  - Prix d'achat
  - Frais de notaire
  - Frais d'agence
  - Total acquisition
  - Prix m² (pondéré/carrez)
- Travaux :
  - Coût travaux/m²
  - Total travaux
  - Détail des coûts (terrasse, mobilier, etc.)
- Financement :
  - Crédit foncier
  - Fonds propres
  - Taux d'intérêt
  - Coût du crédit
- Frais divers :
  - Honoraires techniques
  - Prorata foncier
  - Diagnostics
- Résultats :
  - Marge brute
  - Marge nette
  - Rentabilité
  - ROI annuel
  - Durée du projet
- Détail par période (trimestre)
- Graphique d'évolution des prix

## Mapping des Données

### Données Générales
- `project_title`: Titre du projet
- `adresse`: Adresse du bien
- `latitude`/`longitude`: Coordonnées
- `pdf_config`: Configuration du PDF

### Description du Bien
- `inputsDescriptionBien`: Données d'entrée
- `resultsDescriptionBien`: 
  - `surface_totale`
  - `coef_ponderation`
  - `impacts`: Liste des impacts

### Analyse DVF
- `inputsDvf`: Paramètres de recherche
- `resultsDvfMetadata`:
  - `sel_final_avg`: Prix moyen sélection
  - `arr_final_avg`: Prix moyen arrondissement
  - `premium_final_avg`: Prix moyen premium
  - `selection_total_count`: Nombre de transactions
  - `outlier_lower_bound`/`outlier_upper_bound`

### Business Plan
- `inputsBusinessPlan`:
  - `prix_achat`
  - `surface_carrez_apres_travaux`
  - `surface_terrasse_apres_travaux`
  - `surface_ponderee_apres_travaux`
  - Paramètres financiers
- `resultsBusinessPlan`:
  - `resultats`: Marges et rentabilité
  - `prix_m2`: Prix au m²
  - `couts_acquisition`: Coûts d'acquisition
  - `couts_travaux`: Coûts des travaux
  - `financement`: Détails du financement
  - `trimestre_details`: Détail par période

## Mapping Détaillé des Données

### 1. Page de Couverture (cover_page_modern.html)
```typescript
// Données de base
project_title: pdfData.project_title
sous_titre_projet: pdfData.pdf_config?.dynamic_fields?.sous_titre_projet
logo_path: pdfData.logo_path
cover_image_path: pdfData.cover_image_path

// Contacts
contact1_nom: pdfData.pdf_config?.dynamic_fields?.contact1_nom
contact1_email: pdfData.pdf_config?.dynamic_fields?.contact1_email
contact1_tel: pdfData.pdf_config?.dynamic_fields?.contact1_tel
contact2_nom: pdfData.pdf_config?.dynamic_fields?.contact2_nom
contact2_email: pdfData.pdf_config?.dynamic_fields?.contact2_email
contact2_tel: pdfData.pdf_config?.dynamic_fields?.contact2_tel

// KPIs
prix_achat: pdfData.inputsBusinessPlan?.prix_achat
couts_totaux: pdfData.resultsBusinessPlan?.couts_totaux?.total
prix_vente_fai: pdfData.resultsBusinessPlan?.prix_vente?.prix_vente_fai
marge_nette: pdfData.resultsBusinessPlan?.resultats?.marge_nette
rentabilite: pdfData.resultsBusinessPlan?.resultats?.rentabilite
```

### 2. Résumé (synthese_modern.html)
```typescript
// KPIs
prix_achat: pdfData.inputsBusinessPlan?.prix_achat
couts_totaux: pdfData.resultsBusinessPlan?.couts_totaux?.total
prix_vente_fai: pdfData.resultsBusinessPlan?.prix_vente?.prix_vente_fai
rdt_fonds_propres: pdfData.resultsBusinessPlan?.resultats?.rdt_fonds_propres

// Tableau des prix m²
tableau_prix_m2: pdfData.resultsBusinessPlan?.prix_m2?.tableau_prix_m2

// Graphiques
bar_chart_url: // Généré dynamiquement avec QuickChart
dvf_chart_url: // Généré dynamiquement avec QuickChart
```

### 3. Description du Bien (property_description_modern.html)
```typescript
// Caractéristiques
surface_habitable: pdfData.resultsDescriptionBien?.surface_habitable
surface_terrain: pdfData.resultsDescriptionBien?.surface_terrain
nombre_pieces: pdfData.resultsDescriptionBien?.nombre_pieces
annee_construction: pdfData.resultsDescriptionBien?.annee_construction
adresse: pdfData.adresse
ville: pdfData.resultsDescriptionBien?.ville
code_postal: pdfData.resultsDescriptionBien?.code_postal
departement: pdfData.resultsDescriptionBien?.departement

// Prix et surfaces
prix_achat: pdfData.inputsBusinessPlan?.prix_achat
prix_m2: pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_pondere_m2
coefficient: pdfData.inputsGeneral?.ponderation_terrasse

// Images et description
images: pdfData.selectedBeforePhotosForPdf
description: pdfData.pdf_config?.dynamic_fields?.description_general
```

### 4. Analyse DVF (dvf_valuation_modern.html)
```typescript
// Prix moyens
dvf_prix_m2: pdfData.resultsDvfMetadata?.sel_final_avg
dvf_prix_total: pdfData.resultsDvfMetadata?.sel_final_avg * pdfData.inputsBusinessPlan?.surface_ponderee_apres_travaux
dvf_ecart_prix: // Calculé: ((prix_achat_pondere_m2 - sel_final_avg) / sel_final_avg) * 100

// Transactions
dvf_transactions: pdfData.resultsDvfMetadata?.transactions
dvf_analysis: pdfData.pdf_config?.dynamic_fields?.description_general
```

### 5. Hypothèses de Vente (hypotheses_vente_modern.html)
```typescript
// Synthèse
prix_vente_fai: pdfData.resultsBusinessPlan?.prix_vente?.prix_vente_fai
prix_vente_hfa: pdfData.resultsBusinessPlan?.prix_vente?.prix_vente_hfa
frais_agence_vente: pdfData.resultsBusinessPlan?.prix_vente?.frais_agence_vente
prix_vente_net: pdfData.resultsBusinessPlan?.prix_vente?.prix_vente_net
prix_m2_vente_pondere: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_pondere_m2
prix_m2_vente_carrez: pdfData.resultsBusinessPlan?.prix_m2?.prix_vente_carrez_m2
prix_m2_benchmark: pdfData.resultsBusinessPlan?.benchmark?.prix_m2_benchmark

// Hypothèses
surface_ponderee: pdfData.inputsBusinessPlan?.surface_ponderee_apres_travaux
surface_carrez: pdfData.inputsBusinessPlan?.surface_carrez_apres_travaux
coef_ponderation: pdfData.inputsGeneral?.ponderation_terrasse
duree_projet: pdfData.resultsBusinessPlan?.duree_projet
```

### 6. Synthèse Financière (financial_data_modern.html)
```typescript
// Acquisition
prix_achat: pdfData.inputsBusinessPlan?.prix_achat
frais_notaire: pdfData.resultsBusinessPlan?.couts_acquisition?.frais_notaire
frais_agence_achat: pdfData.resultsBusinessPlan?.couts_acquisition?.frais_agence_achat
total_acquisition: pdfData.resultsBusinessPlan?.couts_acquisition?.total

// Travaux
cout_travaux_m2: pdfData.inputsBusinessPlan?.cout_travaux_m2
total_travaux: pdfData.resultsBusinessPlan?.couts_travaux?.total
detail_travaux: pdfData.resultsBusinessPlan?.couts_travaux

// Financement
credit_foncier: pdfData.inputsBusinessPlan?.financement_credit_foncier_amount
fonds_propres: pdfData.inputsBusinessPlan?.financement_fonds_propres_amount
taux_interet: pdfData.inputsBusinessPlan?.financement_taux_credit_percent
cout_credit: pdfData.resultsBusinessPlan?.financement?.cout_credit

// Résultats
marge_brute: pdfData.resultsBusinessPlan?.resultats?.marge_brute
marge_nette: pdfData.resultsBusinessPlan?.resultats?.marge_nette
rentabilite: pdfData.resultsBusinessPlan?.resultats?.rentabilite
roi_annuel: pdfData.resultsBusinessPlan?.resultats?.roi_annuel

// Détail par période
trimestre_details: pdfData.resultsBusinessPlan?.trimestre_details
```

## Récupération et Traitement des Données DVF

### 1. Récupération des Données Brutes
```typescript
// Récupération depuis le projet
const dvfTransactions: any[] = (project.dvfTransactions || []) as any[];
const trendSeries: any[] = (project.dvfSeries || []) as any[];
const distributionSeries = (project.dvfDistributions || [])
  .map((d, i) => {
    const entry: any = d;
    const obj = entry && entry.data ? entry.data : entry;
    if (!obj || (!obj.bin && !obj.prixM2)) {
      console.warn(`[PDF][DEBUG] dvfDistributions[${i}] ignorée car data invalide:`, JSON.stringify(entry));
      return null;
    }
    let prixM2 = obj.prixM2;
    if (obj.bin && typeof obj.bin === 'string') {
      const [minStr, maxStr] = obj.bin.split('-');
      const min = parseFloat(minStr.replace('k', '000'));
      const max = parseFloat(maxStr.replace('k', '000'));
      prixM2 = (min + max) / 2;
    }
    return {
      ...obj,
      prixM2,
      nombreTransactions: obj.count ?? obj.nombreTransactions ?? 0
    };
  })
  .filter(Boolean);
```

### 2. Construction des Tableaux

#### Tableau des Transactions
```typescript
function buildDvfTableHtml(transactions: any[] = []): string {
  if (!Array.isArray(transactions)) return '';
  const formatKCurrency = (value: number, decimals = 0) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return (Math.round(value / 1000 * Math.pow(10, decimals)) / Math.pow(10, decimals))
      .toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  // Tri décroissant par date
  const sorted = [...transactions].sort((a, b) => (b.date_mutation || '').localeCompare(a.date_mutation || ''));
  return sorted.slice(0, 30).map((prop) => `
    <tr class="${prop.is_outlier ? 'outlier-row' : ''}">
      <td class="col-date">${prop.date_mutation || 'N/A'}</td>
      <td class="col-adresse">${prop.voie || 'Inconnu'}</td>
      <td class="col-cp">${prop.code_postal || 'N/A'}</td>
      <td class="col-valeur">${formatKCurrency(prop.valeur_fonciere, 0)}</td>
      <td class="col-pieces">${prop.nombre_pieces_principales ?? 'N/A'}</td>
      <td class="col-surface">${prop.surface_reelle_bati ? Math.round(prop.surface_reelle_bati) : 'N/A'}</td>
      <td class="col-prixm2">${formatKCurrency(prop.prix_m2, 2)}</td>
    </tr>
  `).join('\n');
}
```

#### Tableau des Tendances
```typescript
function buildTrendTableHtml(trendSeries: any[] = []): string {
  if (!Array.isArray(trendSeries)) return '';
  const formatKCurrency = (value: number, decimals = 2) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return (Math.round(value / 1000 * Math.pow(10, decimals)) / Math.pow(10, decimals))
      .toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };
  return trendSeries.map(trend => `
    <tr>
      <td>${trend.year || ''}</td>
      <td>${formatKCurrency(trend.selection_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.selection_count || 0})</span></td>
      <td>${formatKCurrency(trend.arrondissement_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.arrondissement_count || 0})</span></td>
      <td>${formatKCurrency(trend.premium_avg, 2)} k€<br/><span style="color:#888;font-size:0.95em;">(${trend.premium_count || 0})</span></td>
    </tr>
  `).join('\n');
}
```

### 3. Génération des Graphiques

#### Graphique des Tendances
```typescript
function buildTrendChartUrl(trendSeries: any[] = []): string {
  if (!Array.isArray(trendSeries) || !trendSeries.length) return '';
  const chart = new QuickChart();
  chart.setConfig({
    type: 'line',
    data: {
      labels: trendSeries.map(t => t.year),
      datasets: [
        {
          label: 'Sélection',
          data: trendSeries.map(t => t.selection_avg / 1000),
          borderColor: '#5C4033',
          fill: false,
        },
        {
          label: 'Arrondissement',
          data: trendSeries.map(t => t.arrondissement_avg / 1000),
          borderColor: '#bfa77a',
          fill: false,
        },
        {
          label: 'Premium (Top 10%)',
          data: trendSeries.map(t => t.premium_avg / 1000),
          borderColor: '#c97c2b',
          fill: false,
        },
      ],
    },
    options: {
      plugins: { title: { display: true, text: 'Évolution des prix/m² (2019-2024)' } },
      scales: {
        y: { title: { display: true, text: 'Prix (k€)' } },
        x: { title: { display: true, text: 'Année' } }
      }
    }
  });
  chart.setWidth(600).setHeight(300).setBackgroundColor('transparent');
  return chart.getUrl();
}
```

#### Graphique de Distribution
```typescript
function buildDistributionChartUrl(distributionSeries: any[] = []): string {
  if (!Array.isArray(distributionSeries) || !distributionSeries.length) return '';
  const labels = distributionSeries.map(d => d.bin ?? (typeof d.prixM2 === 'number' ? `${d.prixM2}` : ''));
  const data = distributionSeries.map(d => d.count ?? d.nombreTransactions ?? 0);

  const chart = new QuickChart();
  chart.setConfig({
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Nombre de transactions',
          data,
          backgroundColor: '#bfa77a',
        },
      ],
    },
    options: {
      plugins: { title: { display: true, text: 'Nombre de transactions par groupe de prix' } },
      scales: {
        y: { title: { display: true, text: 'Nombre de transactions' } },
        x: { title: { display: true, text: 'Prix/m² (k€)' } }
      }
    }
  });
  chart.setWidth(600).setHeight(300).setBackgroundColor('transparent');
  return chart.getUrl();
}
```

### 4. Utilisation dans les Templates

Les données et graphiques générés sont ensuite passés au template via l'objet `valuationLkData` :

```typescript
const valuationLkData = {
  ...pdfData,
  dvf_prix_m2: pdfData.resultsDvfMetadata?.sel_final_avg,
  dvf_prix_total: pdfData.resultsDvfMetadata?.sel_final_avg ? 
    pdfData.resultsDvfMetadata.sel_final_avg * (pdfData.inputsBusinessPlan?.surface_ponderee_apres_travaux || 0) : 0,
  dvf_ecart_prix: pdfData.resultsDvfMetadata?.sel_final_avg ? 
    ((pdfData.resultsBusinessPlan?.prix_m2?.prix_achat_pondere_m2 || 0) - pdfData.resultsDvfMetadata.sel_final_avg) / pdfData.resultsDvfMetadata.sel_final_avg * 100 : 0,
  dvf_transactions: dvfTransactions,
  dvf_series: trendSeries,
  dvf_distributions: distributionSeries,
  dvf_table_html: buildDvfTableHtml(dvfTransactions),
  trend_table_html: buildTrendTableHtml(trendSeries),
  trend_chart_url: buildTrendChartUrl(trendSeries),
  distribution_chart_url: buildDistributionChartUrl(distributionSeries),
  dvf_analysis: pdfData.pdf_config?.dynamic_fields?.description_general,
  ...(pdfData.pdf_config?.dynamic_fields || {})
};
```

### 5. Notes sur le Traitement des Données

1. **Validation des Données**
   - Vérification de l'existence des données avant traitement
   - Gestion des cas où les données sont dans un sous-objet `data`
   - Filtrage des entrées invalides

2. **Formatage des Valeurs**
   - Conversion des montants en k€ avec le bon nombre de décimales
   - Formatage des dates et des adresses
   - Gestion des valeurs manquantes (N/A)

3. **Génération des Graphiques**
   - Utilisation de QuickChart pour la génération
   - Configuration des couleurs et styles
   - Gestion des échelles et des titres

4. **Optimisation des Performances**
   - Limitation à 30 transactions dans le tableau
   - Tri des données avant affichage
   - Mise en cache des URLs de graphiques

## Notes Techniques
- Utilisation de Handlebars pour le templating
- CSS moderne avec variables pour les couleurs
- Support des graphiques via QuickChart
- Gestion des images en base64
- Compatibilité Puppeteer
- Mise en page responsive
- Gestion des sauts de page 