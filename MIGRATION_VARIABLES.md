# Migration des noms de variables Business Plan

## Variables d'entrée (Inputs)

| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `frais_notaire` | `frais_notaire_percent` | Pourcentage des frais de notaire | Pourcentage |
| `frais_agence` | `frais_agence_achat_percent` | Pourcentage des frais d'agence d'achat | Pourcentage |
| `frais_agence_vente` | `frais_agence_vente_percent` | Pourcentage des frais d'agence de vente | Pourcentage |
| `frais_dossier` | `frais_dossier_amount` | Montant des frais de dossier | Montant € |
| `cout_travaux` | `cout_travaux_m2` | Coût des travaux au m² | Montant €/m² |
| `salaire_maitrise` | `cout_maitrise_oeuvre_percent` | Pourcentage des frais de maîtrise d'œuvre | Pourcentage |
| `alea_travaux` | `cout_alea_percent` | Pourcentage d'aléa sur les travaux | Pourcentage |
| `amenagement_terrasse` | `cout_terrasse_input_amount` | Montant des travaux de terrasse | Montant € |
| `demolition` | `cout_demolition_input_amount` | Montant des travaux de démolition | Montant € |
| `honoraires_techniques` | `cout_honoraires_tech_input_amount` | Montant des honoraires techniques | Montant € |
| `prorata_foncier` | `cout_prorata_foncier_input_amount` | Montant du prorata foncier | Montant € |
| `diagnostics` | `cout_diagnostics_input_amount` | Montant des diagnostics | Montant € |
| `mobilier` | `cout_mobilier_input_amount` | Montant du mobilier | Montant € |
| `credit_foncier` | `financement_credit_foncier_amount` | Montant du crédit foncier | Montant € |
| `fonds_propres` | `financement_fonds_propres_amount` | Montant des fonds propres | Montant € |
| `credit_accompagnement_total` | `financement_credit_accompagnement_amount` | Montant du crédit accompagnement | Montant € |
| `taux_credit` | `financement_taux_credit_percent` | Taux du crédit | Pourcentage |
| `commission_rate` | `financement_commission_percent` | Taux de commission | Pourcentage |

## Variables de résultats (Results)

### Bloc Frais
| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `frais.frais_notaire` | `frais.frais_notaire_output_amount` | Montant des frais de notaire | Montant € |
| `frais.frais_agence` | `frais.frais_agence_achat_output_amount` | Montant des frais d'agence d'achat | Montant € |
| `frais.frais_agence_vente` | `frais.frais_agence_vente_output_amount` | Montant des frais d'agence de vente | Montant € |
| `frais.frais_dossier` | `frais.frais_dossier_output_amount` | Montant des frais de dossier | Montant € |
| `frais.total` | `frais.total_frais` | Total des frais | Montant € |

### Bloc Coûts Acquisition
| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `couts_acquisition.prix_achat` | `couts_acquisition.prix_achat` | Prix d'achat | Montant € |
| `couts_acquisition.frais_notaire` | `couts_acquisition.frais_notaire_output_amount` | Frais de notaire | Montant € |
| `couts_acquisition.frais_agence` | `couts_acquisition.frais_agence_achat_output_amount` | Frais d'agence d'achat | Montant € |
| `couts_acquisition.total` | `couts_acquisition.total_acquisition` | Total des coûts d'acquisition | Montant € |

### Bloc Coûts Travaux
| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `couts_travaux.cout_travaux_total` | `couts_travaux.total_output_amount` | Montant total des travaux | Montant € |
| `couts_travaux.cout_maitrise_oeuvre` | `couts_travaux.maitrise_oeuvre_output_amount` | Montant de la maîtrise d'œuvre | Montant € |
| `couts_travaux.cout_aleas` | `couts_travaux.alea_output_amount` | Montant des aléas | Montant € |
| `couts_travaux.cout_amenagement_terrasse` | `couts_travaux.terrasse_output_amount` | Montant des travaux de terrasse | Montant € |
| `couts_travaux.cout_mobilier` | `couts_travaux.mobilier_output_amount` | Montant du mobilier | Montant € |
| `couts_travaux.cout_demolition` | `couts_travaux.demolition_output_amount` | Montant de la démolition | Montant € |
| `couts_travaux.cout_honoraires_techniques` | `couts_travaux.honoraires_tech_output_amount` | Montant des honoraires techniques | Montant € |
| `couts_travaux.total` | `couts_travaux.total_travaux` | Total des coûts de travaux | Montant € |

### Bloc Coûts Divers
| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `couts_divers.honoraires_tech` | `couts_divers.honoraires_tech_output_amount` | Montant des honoraires techniques | Montant € |
| `couts_divers.prorata_foncier` | `couts_divers.prorata_foncier_output_amount` | Montant du prorata foncier | Montant € |
| `couts_divers.diagnostics` | `couts_divers.diagnostics_output_amount` | Montant des diagnostics | Montant € |
| `couts_divers.total` | `couts_divers.total_divers` | Total des coûts divers | Montant € |

### Bloc Financement
#### Montants Alloués
| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `financement.credit_foncier` | `financement.montants.credit_foncier_output_amount` | Montant du crédit foncier alloué | Montant € |
| `financement.fonds_propres` | `financement.montants.fonds_propres_output_amount` | Montant des fonds propres alloués | Montant € |
| `financement.credit_accompagnement` | `financement.montants.credit_accompagnement_output_amount` | Montant du crédit accompagnement alloué | Montant € |
| `financement.total` | `financement.montants.total_montants_alloues` | Total des montants alloués | Montant € |

#### Montants Utilisés
| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `financement.credit_foncier_utilise` | `financement.montants_utilises.credit_foncier_output_amount` | Montant du crédit foncier utilisé | Montant € |
| `financement.fonds_propres_utilise` | `financement.montants_utilises.fonds_propres_output_amount` | Montant des fonds propres utilisés | Montant € |
| `financement.credit_accompagnement_utilise` | `financement.montants_utilises.credit_accompagnement_output_amount` | Montant du crédit accompagnement utilisé | Montant € |
| `financement.total_utilise` | `financement.montants_utilises.total_montants_utilises` | Total des montants utilisés | Montant € |

#### Coûts Financiers
| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `financement.interets_pret` | `financement.couts.interets_pret_output_amount` | Montant des intérêts du prêt | Montant € |
| `financement.commission_accompagnement` | `financement.couts.commission_accompagnement_output_amount` | Montant de la commission d'accompagnement | Montant € |
| `financement.frais_dossier` | `financement.couts.frais_dossier_output_amount` | Montant des frais de dossier | Montant € |
| `financement.total_couts` | `financement.couts.total_couts_financiers` | Total des coûts financiers | Montant € |

#### Mensualités
| Ancien nom | Nouveau nom | Description | Type |
|------------|-------------|-------------|------|
| `financement.mensualite_credit_foncier` | `financement.mensualites.credit_foncier_output_amount` | Mensualité du crédit foncier | Montant € |
| `financement.mensualite_credit_accompagnement` | `financement.mensualites.credit_accompagnement_output_amount` | Mensualité du crédit accompagnement | Montant € |
| `financement.total_mensualites` | `financement.mensualites.total_mensualites` | Total des mensualités | Montant € |

## Règles de nommage

1. Pour les pourcentages : suffixe `_percent`
2. Pour les montants en entrée : suffixe `_input_amount`
3. Pour les montants en sortie : suffixe `_output_amount`
4. Pour les coûts au m² : suffixe `_m2`
5. Préfixes par catégorie :
   - `frais_` : pour les frais
   - `cout_` : pour les coûts
   - `financement_` : pour le financement
6. Noms explicites pour les totaux :
   - `total_acquisition` : total des coûts d'acquisition
   - `total_travaux` : total des coûts de travaux
   - `total_divers` : total des coûts divers
   - `total_frais` : total des frais
   - `total_montants_alloues` : total des montants alloués
   - `total_montants_utilises` : total des montants utilisés
   - `total_couts_financiers` : total des coûts financiers
   - `total_mensualites` : total des mensualités

## Fichiers à modifier

1. `shared/types/businessPlanInputs.ts`
2. `shared/types/businessPlanResults.ts`
3. `backend/src/services/pdfMappingService.ts`
4. `frontend/src/components/project-sections/BusinessPlanTab.tsx`
5. Templates Handlebars
6. Tests unitaires 