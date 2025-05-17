import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Table, Form, Card, Row, Col, Spinner, Alert, Accordion } from 'react-bootstrap';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, AreaChart, Area, LineChart, Line, ReferenceLine, Legend, Treemap } from 'recharts';
import { Project } from '../../../../shared/types/project';
import { BusinessPlanInputs, BusinessPlanInputsSchema, DEFAULT_VALUES, DEFAULT_INPUTS } from '../../../../shared/types/businessPlanInputs';
import { BusinessPlanResults, BusinessPlanResultsSchema } from '../../../../shared/types/businessPlanResults';
import styles from '../../styles/modules/tabs/bpTab.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { TooltipProps } from 'recharts';

interface BusinessPlanTabProps {
  project: Project;
  onUpdate: (updates: { inputsBusinessPlan?: BusinessPlanInputs; resultsBusinessPlan?: BusinessPlanResults }) => Promise<void>;
}

interface FinancementError {
  message: string;
  details: {
    besoin_acquisition: number;
    financement_disponible: number;
    manquant: number;
  };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://163.172.32.45:3001';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

interface AnimatedCellProps {
  id: string;
  value: number | undefined;
  format: (value: number) => string;
}

// Utilitaire debounce
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Utilitaire pour parser les nombres (accepte virgule ou point, renvoie 0 si NaN)
function parseInputNumber(value: string | number): number {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// Utilitaire pour l'affichage des champs numériques dans les inputs
function safeNumberInputValue(val: any) {
  return (val === undefined || val === null || Number.isNaN(val)) ? '' : val;
}

const MondrianTooltip = (prixFai: number) => ({ active, payload }: TooltipProps<any, any>) => {
  if (active && payload && payload.length && prixFai > 0) {
    const item = payload[0].payload;
    const pct = Math.round((item.value / prixFai) * 1000) / 10;
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.5em 1em', color: '#1a3557', fontWeight: 600 }}>
        {item.name} : {item.value.toLocaleString('fr-FR')} €<br />
        <span style={{ color: '#64748b', fontWeight: 400 }}>{pct}%</span>
      </div>
    );
  }
  return null;
};

// Composant content personnalisé pour Treemap
const MondrianBlock = (props: any): JSX.Element => {
  const { x, y, width, height, name, payload } = props;
  const color = payload?.color || '#8884d8';
  const fontSize = Math.max(12, Math.min(width, height) / 7);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} stroke="#fff" />
      {width > 40 && height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight={700}
          fill="#fff"
          stroke="#000"
          strokeWidth={0.8}
          style={{ paintOrder: 'stroke', filter: 'drop-shadow(0 1px 2px #0008)' }}
        >
          {name}
        </text>
      )}
    </g>
  );
};

// Composant pour afficher chaque bloc du Treemap avec valeur et %
const MondrianTreemapBlock = (dataTotal: number) => (props: any) => {
  const { x, y, width, height, name, value } = props;
  const pct = Math.round((value / dataTotal) * 1000) / 10;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="#8884d8" stroke="#fff" />
      {width > 60 && height > 30 && (
        <>
          <text x={x + 8} y={y + 22} fontSize={13} fill="#fff" opacity="0.85" fontWeight={600}>{name}</text>
          <text x={x + 8} y={y + 38} fontSize={11} fill="#fff" opacity="0.7">{Math.round(value / 1000)} k€  ({pct}%)</text>
        </>
      )}
      {width > 40 && height > 18 && width <= 60 && (
        <text x={x + 6} y={y + 18} fontSize={11} fill="#fff" opacity="0.7">{Math.round(value / 1000)}k€</text>
      )}
    </g>
  );
};

// Avant le composant BusinessPlanTab :

// Bloc Treemap pour FAI
const MondrianTreemapBlockFAI: React.FC<any> = (props) => {
  const { x, y, width, height, name, value, root } = props;
  const total = Array.isArray(root?.children) ? root.children.reduce((sum: number, d: any) => sum + (d.value || 0), 0) : 1;
  const pct = Math.round((value / total) * 1000) / 10;

  // Taille de police dynamique
  let labelFontSize = Math.max(13, Math.min(24, width * 0.13, height * 0.35));
  let valueFontSize = Math.max(8, Math.min(15, width * 0.07, height * 0.15));
  let pctFontSize = Math.max(9, valueFontSize - 2);

  // Découpe le titre en lignes si trop long
  let lines: string[] = [];
  if (typeof name === 'string') {
    const words = name.split(' ');
    let current = '';
    for (let i = 0; i < words.length; i++) {
      if ((current + ' ' + words[i]).trim().length > 12) {
        if (current) lines.push(current.trim());
        current = words[i];
      } else {
        current += ' ' + words[i];
      }
    }
    if (current) lines.push(current.trim());
  } else {
    lines = [name];
  }
  if (width < 100 && lines.some(l => l.length > 12)) {
    lines = (typeof name === 'string') ? name.split(' ') : [name];
  }

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="#8884d8" stroke="#fff" />
      {/* Label (nom) */}
      {width > 40 && height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (lines.length - 1) * (labelFontSize / 2)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={labelFontSize}
          fontWeight={400}
          fill="#fff"
          style={{ pointerEvents: 'none' }}
        >
          {lines.map((line, idx) => (
            <tspan x={x + width / 2} dy={idx === 0 ? 0 : labelFontSize} key={idx}>{line}</tspan>
          ))}
        </text>
      )}
      {/* Montant + % en bas à droite */}
      {width > 30 && height > 18 && (
        <text
          x={x + width - 8}
          y={y + height - 10}
          textAnchor="end"
          fontSize={valueFontSize}
          fontWeight={100}
          fill={props.color || "#fff"}
          fontStyle="italic"
          style={{ pointerEvents: 'none' }}
        >
          {Math.round(value / 1000)} k€
          <tspan
            fontSize={pctFontSize}
            fontWeight={100}
            fill={props.color || "#fff"}
            fontStyle="italic"
            dx="0.3em"
          >
            ({pct}%)
          </tspan>
        </text>
      )}
    </g>
  );
};

// Bloc Treemap pour Financement
const MondrianTreemapBlockFin: React.FC<any> = (props) => {
  const { x, y, width, height, name, value, root } = props;
  const total = Array.isArray(root?.children) ? root.children.reduce((sum: number, d: any) => sum + (d.value || 0), 0) : 1;
  const pct = Math.round((value / total) * 1000) / 10;

  // Taille de police dynamique
  let labelFontSize = Math.max(13, Math.min(24, width * 0.13, height * 0.35));
  let valueFontSize = Math.max(7, Math.min(15, width * 0.09, height * 0.18));
  let pctFontSize = Math.max(9, valueFontSize - 2);

  let lines: string[] = [];
  if (typeof name === 'string') {
    const words = name.split(' ');
    let current = '';
    for (let i = 0; i < words.length; i++) {
      if ((current + ' ' + words[i]).trim().length > 12) {
        if (current) lines.push(current.trim());
        current = words[i];
      } else {
        current += ' ' + words[i];
      }
    }
    if (current) lines.push(current.trim());
  } else {
    lines = [name];
  }
  if (width < 100 && lines.some(l => l.length > 12)) {
    lines = (typeof name === 'string') ? name.split(' ') : [name];
  }

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="#8884d8" stroke="#fff" />
      {width > 40 && height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (lines.length - 1) * (labelFontSize / 2)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={labelFontSize}
          fontWeight={400}
          fill="#fff"
          style={{ pointerEvents: 'none' }}
        >
          {lines.map((line, idx) => (
            <tspan x={x + width / 2} dy={idx === 0 ? 0 : labelFontSize} key={idx}>{line}</tspan>
          ))}
        </text>
      )}
      {width > 30 && height > 18 && (
        <text
          x={x + width - 8}
          y={y + height - 10}
          textAnchor="end"
          fontSize={valueFontSize}
          fontWeight={100}
          fill={props.color || "#fff"}
          fontStyle="italic"
          style={{ pointerEvents: 'none' }}
        >
          {Math.round(value / 1000)} k€
          <tspan
            fontSize={pctFontSize}
            fontWeight={100}
            fill={props.color || "#fff"}
            fontStyle="italic"
            dx="0.3em"
          >
            ({pct}%)
          </tspan>
        </text>
      )}
    </g>
  );
};

const BusinessPlanTab: React.FC<BusinessPlanTabProps> = ({ project, onUpdate }) => {
  // Accordéon contrôlé (doit être AVANT tout return conditionnel)
  const [isAccordionOpen, setIsAccordionOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const persisted = window.localStorage.getItem('bpTabAccordionOpen');
      return persisted === null ? true : persisted === 'true';
    }
    return true;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bpTabAccordionOpen', isAccordionOpen ? 'true' : 'false');
    }
  }, [isAccordionOpen]);

  const [inputs, setInputs] = useState<BusinessPlanInputs>(() => {
    if (project.inputsBusinessPlan) {
      const bp = project.inputsBusinessPlan;
      return {
        ...DEFAULT_VALUES,
        ...bp,
        prix_achat: Number(bp.prix_achat ?? DEFAULT_VALUES.prix_achat),
        frais_notaire_percent: Number(bp.frais_notaire_percent ?? DEFAULT_VALUES.frais_notaire_percent),
        frais_agence_achat_percent: Number(bp.frais_agence_achat_percent ?? DEFAULT_VALUES.frais_agence_achat_percent),
        frais_agence_vente_percent: Number(bp.frais_agence_vente_percent ?? DEFAULT_VALUES.frais_agence_vente_percent),
        frais_dossier_amount: Number(bp.frais_dossier_amount ?? DEFAULT_VALUES.frais_dossier_amount),
        cout_travaux_m2: Number(bp.cout_travaux_m2 ?? DEFAULT_VALUES.cout_travaux_m2),
        cout_maitrise_oeuvre_percent: Number(bp.cout_maitrise_oeuvre_percent ?? DEFAULT_VALUES.cout_maitrise_oeuvre_percent),
        cout_alea_percent: Number(bp.cout_alea_percent ?? DEFAULT_VALUES.cout_alea_percent),
        cout_terrasse_input_amount: Number(bp.cout_terrasse_input_amount ?? DEFAULT_VALUES.cout_terrasse_input_amount),
        cout_demolition_input_amount: Number(bp.cout_demolition_input_amount ?? DEFAULT_VALUES.cout_demolition_input_amount),
        cout_honoraires_tech_input_amount: Number(bp.cout_honoraires_tech_input_amount ?? DEFAULT_VALUES.cout_honoraires_tech_input_amount),
        cout_prorata_foncier_input_amount: Number(bp.cout_prorata_foncier_input_amount ?? DEFAULT_VALUES.cout_prorata_foncier_input_amount),
        cout_diagnostics_input_amount: Number(bp.cout_diagnostics_input_amount ?? DEFAULT_VALUES.cout_diagnostics_input_amount),
        cout_mobilier_input_amount: Number(bp.cout_mobilier_input_amount ?? DEFAULT_VALUES.cout_mobilier_input_amount),
        financement_credit_foncier_amount: Number(bp.financement_credit_foncier_amount ?? DEFAULT_VALUES.financement_credit_foncier_amount),
        financement_fonds_propres_amount: Number(bp.financement_fonds_propres_amount ?? DEFAULT_VALUES.financement_fonds_propres_amount),
        financement_credit_accompagnement_amount: Number(bp.financement_credit_accompagnement_amount ?? DEFAULT_VALUES.financement_credit_accompagnement_amount),
        financement_taux_credit_percent: Number(bp.financement_taux_credit_percent ?? DEFAULT_VALUES.financement_taux_credit_percent),
        financement_commission_percent: Number(bp.financement_commission_percent ?? DEFAULT_VALUES.financement_commission_percent),
        duree_projet: Number(bp.duree_projet ?? DEFAULT_VALUES.duree_projet),
        prix_vente_reel_pondere_m2: Number(bp.prix_vente_reel_pondere_m2 ?? DEFAULT_VALUES.prix_vente_reel_pondere_m2),
        surface_carrez_apres_travaux: Number(bp.surface_carrez_apres_travaux ?? DEFAULT_VALUES.surface_carrez_apres_travaux),
        surface_terrasse_apres_travaux: Number(bp.surface_terrasse_apres_travaux ?? DEFAULT_VALUES.surface_terrasse_apres_travaux),
        surface_ponderee_apres_travaux: Number(bp.surface_ponderee_apres_travaux ?? DEFAULT_VALUES.surface_ponderee_apres_travaux),
        date_achat: bp.date_achat ?? DEFAULT_VALUES.date_achat,
        date_vente: bp.date_vente ?? DEFAULT_VALUES.date_vente,
      };
    }
    return DEFAULT_VALUES as BusinessPlanInputs;
  });

  const [results, setResults] = useState<BusinessPlanResults | null>(() => {
    if (project.resultsBusinessPlan) {
      return {
        ...project.resultsBusinessPlan,
        resultats: project.resultsBusinessPlan?.resultats ?? {},
        prix_m2: project.resultsBusinessPlan?.prix_m2 ?? {},
        financement: project.resultsBusinessPlan?.financement ?? {},
        trimestre_details: project.resultsBusinessPlan?.trimestre_details ?? []
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financementError, setFinancementError] = useState<FinancementError | null>(null);
  const [financementSuffisant, setFinancementSuffisant] = useState<boolean | null>(null);

  const [superficie, setSuperficie] = useState(project.inputsGeneral?.superficie ?? 0);
  const [superficieTerrasse, setSuperficieTerrasse] = useState(project.inputsGeneral?.superficie_terrasse ?? 0);
  const [ponderationTerrasse, setPonderationTerrasse] = useState(project.inputsGeneral?.ponderation_terrasse ?? 0.3);
  const [surfaceTotalePonderee, setSurfaceTotalePonderee] = useState(
    (project.inputsGeneral?.superficie ?? 0) +
    ((project.inputsGeneral?.superficie_terrasse ?? 0) * (project.inputsGeneral?.ponderation_terrasse ?? 0))
  );

  // Ajouter un état local pour la saisie texte du prix de vente réel
  const [prixVenteReelInput, setPrixVenteReelInput] = useState<string>(
    inputs.prix_vente_reel_pondere_m2 !== undefined && inputs.prix_vente_reel_pondere_m2 !== null
      ? Math.round(inputs.prix_vente_reel_pondere_m2).toLocaleString('fr-FR', { maximumFractionDigits: 0 })
      : ''
  );

  const [isCalculating, setIsCalculating] = useState(false);
  const [updatedCells, setUpdatedCells] = useState<Set<string>>(new Set());
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const lastInputsRef = useRef(inputs);

  // Debounced calcul
  const debouncedTrigger = useCallback(
    debounce((updatedInputs: BusinessPlanInputs) => {
      triggerBusinessPlanCalculation(updatedInputs);
    }, 400),
    []
  );

  useEffect(() => {
    setSuperficie(project.inputsGeneral?.superficie ?? 0);
    setSuperficieTerrasse(project.inputsGeneral?.superficie_terrasse ?? 0);
    setPonderationTerrasse(project.inputsGeneral?.ponderation_terrasse ?? 0.3);
  }, [project.inputsGeneral]);

  // Synchroniser l'état local si le projet change
  useEffect(() => {
    setPrixVenteReelInput(
      inputs.prix_vente_reel_pondere_m2 !== undefined && inputs.prix_vente_reel_pondere_m2 !== null
        ? Math.round(inputs.prix_vente_reel_pondere_m2).toLocaleString('fr-FR', { maximumFractionDigits: 0 })
        : ''
    );
  }, [inputs.prix_vente_reel_pondere_m2]);

  // Ajout pour la surface totale pondérée et le coef_ponderation
  const coefPonderation = project.resultsDescriptionBien?.coef_ponderation ?? 1;
  const benchmark = project.resultsDvfMetadata?.sel_final_avg ?? 0;

  // Fonction pour calculer la date de vente
  const calculateEndDate = (startDate: string, duration: number): string => {
    try {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return new Date().toISOString().split('T')[0];
      }
      const end = new Date(start);
      end.setDate(start.getDate() + duration);
      return end.toISOString().split('T')[0];
    } catch (error) {
      console.error('Erreur lors du calcul de la date de vente:', error);
      return new Date().toISOString().split('T')[0];
    }
  };

  // Validation des résultats
  const validateResults = (data: unknown): { valid: boolean; errors?: Array<{ path: string; message: string }>; data?: BusinessPlanResults } => {
    console.log('validateResults - Données reçues:', JSON.stringify(data, null, 2));

    // Créer une copie profonde des données pour éviter de modifier l'original
    const processedData = data ? JSON.parse(JSON.stringify(data)) : data;
    console.log('validateResults - Données copiées:', JSON.stringify(processedData, null, 2));

    // Convertir les trimestres en nombres si nécessaire
    if (processedData && typeof processedData === 'object' && 'trimestre_details' in processedData) {
      const details = processedData.trimestre_details;
      console.log('validateResults - Détails des trimestres avant conversion:', JSON.stringify(details, null, 2));

      if (Array.isArray(details)) {
        processedData.trimestre_details = details.map(detail => {
          console.log('validateResults - Détail avant conversion:', JSON.stringify(detail, null, 2));
          const converted = {
            ...detail,
            trimestre: typeof detail.trimestre === 'string' ? parseInt(detail.trimestre, 10) : detail.trimestre
          };
          console.log('validateResults - Détail après conversion:', JSON.stringify(converted, null, 2));
          return converted;
        });
      }
    }

    console.log('validateResults - Données avant validation:', JSON.stringify(processedData, null, 2));
    const result = BusinessPlanResultsSchema.safeParse(processedData);

    if (!result.success) {
      console.error('validateResults - Erreurs de validation:', JSON.stringify(result.error.errors, null, 2));
      const errors = result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      return { valid: false, errors };
    }

    console.log('validateResults - Validation réussie:', JSON.stringify(result.data, null, 2));
    return { valid: true, data: result.data };
  };

  // Nouvelle fonction pour déclencher le calcul avec les inputs à jour
  const triggerBusinessPlanCalculation = async (updatedInputs: BusinessPlanInputs) => {
    try {
      setIsCalculating(true);
      setUpdatedCells(new Set());
      setInputErrors({});

      const response = await fetch(`${API_BASE_URL}/api/business-plan/${project.id}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedInputs),
      });

      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); } catch { errorData = {}; }
        setError(errorData.details || errorData.error || 'Erreur lors du calcul du business plan');
        if (errorData.details && Array.isArray(errorData.details)) {
          // Erreurs Zod
          const fieldErrors: Record<string, string> = {};
          errorData.details.forEach((err: any) => {
            if (err.path && err.path.length) fieldErrors[err.path[0]] = err.message;
          });
          setInputErrors(fieldErrors);
        }
        return;
      }

      const data = await response.json();
      setResults(data);
      await onUpdate({ resultsBusinessPlan: data });
      setError(null);

      // Animation des cellules
      const allCellIds = [
        'prix_revient', 'marge_brute', 'commission', 'marge_nette', 'rentabilite', 'cash_flow_mensuel', 'tri',
        'prix_m2', 'prix_m2_terrasse', 'prix_revient_m2', 'prix_revient_m2_carrez', 'prix_m2_vente', 'prix_m2_carrez_vente',
      ];
      setUpdatedCells(new Set(allCellIds));
      setTimeout(() => setUpdatedCells(new Set()), 2000);
    } catch (error) {
      setError('Erreur lors du calcul du business plan');
    } finally {
      setIsCalculating(false);
    }
  };

  // Handler principal avec debounce
  const handleInputChange = (field: string, value: number | string) => {
    // Si le champ est numérique, on parse correctement
    const numericFields = [
      'prix_affiche', 'prix_achat', 'frais_notaire_percent', 'frais_agence_achat_percent', 'frais_agence_vente_percent', 'frais_dossier_amount',
      'cout_travaux_m2', 'cout_maitrise_oeuvre_percent', 'cout_alea_percent', 'cout_terrasse_input_amount', 'cout_demolition_input_amount', 'cout_honoraires_tech_input_amount',
      'cout_prorata_foncier_input_amount', 'cout_diagnostics_input_amount', 'cout_mobilier_input_amount',
      'financement_credit_foncier_amount', 'financement_fonds_propres_amount', 'financement_credit_accompagnement_amount', 'financement_taux_credit_percent', 'financement_commission_percent',
      'duree_projet', 'prix_vente_reel_pondere_m2', 'surface_carrez_apres_travaux', 'surface_terrasse_apres_travaux', 'surface_ponderee_apres_travaux'
    ];
    let parsedValue = value;
    if (numericFields.includes(field)) {
      parsedValue = parseInputNumber(value);
    }
    setInputs(prev => {
      const updated = { ...prev, [field]: parsedValue };
      lastInputsRef.current = updated;
      debouncedTrigger(updated);
      return updated;
    });
  };

  // Calcul immédiat sur blur
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    triggerBusinessPlanCalculation({ ...inputs, [name]: e.target.value });
  };

  useEffect(() => {
    if (project.resultsBusinessPlan) {
      setResults(project.resultsBusinessPlan);
    }
  }, [project.resultsBusinessPlan]);

  // Format k€ sans décimales
  const formatK = (v: number) => (v ? Math.round(v / 1000).toLocaleString('fr-FR') + ' k€' : '0 k€');
  const formatPercent = (v: number) => (v ? v.toFixed(1) + ' %' : '0 %');
  const formatEur = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

  // Correction : utiliser repartition_couts pour la synthèse des coûts
  const totalAcquisition = results?.couts_acquisition?.total_acquisition ?? 0;
  const totalTravaux = results?.couts_travaux?.total_travaux ?? 0;
  const totalFinancement = results?.financement?.montants?.total_montants_alloues ?? 0;
  const totalDivers = results?.couts_divers?.total_divers ?? 0;
  const totalCout = results?.couts_total ?? 0;

  // Correction : détails trimestriels avec les nouveaux champs
  const financementData = results?.trimestre_details?.map(detail => ({
    name: detail.trimestre,
    'Crédit foncier utilisé': detail.credit_foncier_utilise || 0,
    'Fonds propres utilisés': detail.fonds_propres_utilise || 0,
    'Crédit accompagnement utilisé': detail.credit_accompagnement_utilise || 0,
    'Intérêts foncier': detail.interets_foncier || 0,
    'Intérêts accompagnement': detail.interets_accompagnement || 0,
    'Commission': detail.commission_accompagnement || 0,
    'Coût financier': detail.cout_financier_trimestre || 0,
  })) || [];

  const totalJours = results?.trimestre_details?.reduce((sum, t) => sum + (t.jours || 0), 0) || 0;
  const totalInteretsFoncier = results?.trimestre_details?.reduce((sum, t) => sum + (t.interets_foncier ?? 0), 0) || 0;
  const totalInteretsAccompagnement = results?.trimestre_details?.reduce((sum, t) => sum + (t.interets_accompagnement ?? 0), 0) || 0;
  const totalCommission = results?.trimestre_details?.reduce((sum, t) => sum + (t.commission_accompagnement ?? 0), 0) || 0;
  const totalCoutFinancier = results?.trimestre_details?.reduce((sum, t) => sum + (t.cout_financier_trimestre || 0), 0) || 0;

  const creditUsedVariations = results?.trimestre_details?.map((detail, idx, arr) => {
    if (idx === 0) return detail.credit_foncier_utilise || 0;
    return (detail.credit_foncier_utilise || 0) - (arr[idx - 1].credit_foncier_utilise || 0);
  }) || [];
  const totalCreditUsed = creditUsedVariations.reduce((sum, v) => sum + v, 0);

  // Correction : utiliser reclassement pour la synthèse des coûts
  // const totalAcquisition = results?.reclassement?.frais_acquisition ?? 0;
  // const totalTravaux = results?.reclassement?.frais_travaux ?? 0;
  // const totalFinancement = results?.reclassement?.frais_financiers ?? 0;
  // const totalDivers = results?.reclassement?.frais_divers ?? 0;
  // const totalSynthese = results?.reclassement?.total ?? 0;
  // const repartitionData = results?.reclassement?.prorata ? [ ... ] : [];

  // Correction : utiliser resultats.prix_revient pour le prix de revient partout
  // Correction : forcer le fallback à 0 dans les totaux du tableau par trimestre
  const formatK1 = (v: number) => (v ? (v / 1000).toFixed(1).replace('.', ',') + ' k€' : '0 k€');

  // Validation des inputs
  const validateInputs = (data: unknown): { valid: boolean; errors?: Array<{ path: string; message: string }>; data?: BusinessPlanInputs } => {
    const result = BusinessPlanInputsSchema.safeParse(data);
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

  // Mise à jour des états lors des changements
  const handleSuperficieChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setSuperficie(value);
    setSurfaceTotalePonderee(value + (superficieTerrasse * ponderationTerrasse));
    await handleInputChange('surface_carrez_apres_travaux', value);
  };

  const handleSuperficieTerrasseChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setSuperficieTerrasse(value);
    setSurfaceTotalePonderee(superficie + (value * ponderationTerrasse));
    await handleInputChange('surface_terrasse_apres_travaux', value);
  };

  const handlePonderationTerrasseChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setPonderationTerrasse(value);
    setSurfaceTotalePonderee(superficie + (superficieTerrasse * value));
    // Pas besoin de lancer le calcul ici car la pondération n'affecte pas directement le business plan
  };

  // Calcul du prix de vente au m²
  const prixVenteM2 = results?.prix_m2?.prix_vente_pondere_m2 ?? 0;
  const prixVenteCarrezM2 = results?.prix_m2?.prix_vente_carrez_m2 ?? 0;
  const prixVenteReelM2 = inputs.prix_vente_reel_pondere_m2 ?? 0;
  const prixVenteReelCarrezM2 =
    (inputs.surface_carrez_apres_travaux ?? 0) > 0
      ? (inputs.prix_vente_reel_pondere_m2 ?? 0) *
      ((inputs.surface_carrez_apres_travaux ?? superficie) + (inputs.surface_terrasse_apres_travaux ?? superficieTerrasse) * ponderationTerrasse) /
      (inputs.surface_carrez_apres_travaux ?? 1)
      : 0;

  const prixVenteM2Theorique = benchmark * coefPonderation;

  // Gestion du champ prix_vente_reel_pondere_m2 (input contrôlé et cohérent)
  async function handlePrixVenteReelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setPrixVenteReelInput(value);

    // Convertir la valeur en nombre
    const numericValue = parseFloat(value.replace(/[^\d,-]/g, '').replace(',', '.'));
    if (!isNaN(numericValue)) {
      await handleInputChange('prix_vente_reel_pondere_m2', numericValue);
    }
  }

  async function handlePrixVenteReelBlur() {
    // 1. Sauvegarder l'input dans le projet
    await onUpdate({ inputsBusinessPlan: { ...inputs, prix_vente_reel_pondere_m2: inputs.prix_vente_reel_pondere_m2 } });
    // 2. Déclencher le recalcul du business plan (déjà fait dans handleInputBlur normalement)
    // Pour garantir la cohérence, on peut rappeler handleInputBlur sur ce champ
    // (simulateur d'un blur classique)
    const fakeEvent = { target: { name: 'prix_vente_reel_pondere_m2' } } as React.FocusEvent<HTMLInputElement>;
    await handleInputBlur(fakeEvent);
  }

  // Composant pour une cellule avec animation
  const AnimatedCell = ({ id, value, format }: AnimatedCellProps) => {
    const isUpdated = updatedCells.has(id);
    const calculating = isCalculating;

    return (
      <motion.td
        className={`${styles.resultCell} ${isUpdated ? styles.updated : ''} ${calculating ? styles.calculating : ''}`}
        initial={false}
        animate={{
          backgroundColor: isUpdated ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
          scale: isUpdated ? 1.02 : 1,
        }}
        transition={{
          duration: 0.3,
          ease: 'easeInOut',
        }}
      >
        {value !== undefined ? format(value) : '-'}
      </motion.td>
    );
  };

  // Avant le return du composant, calcule la valeur de la surface pondérée après travaux :
  const surfaceCarrez = inputs.surface_carrez_apres_travaux !== undefined && inputs.surface_carrez_apres_travaux !== null ? inputs.surface_carrez_apres_travaux : superficie;
  const surfaceTerrasse = inputs.surface_terrasse_apres_travaux !== undefined && inputs.surface_terrasse_apres_travaux !== null ? inputs.surface_terrasse_apres_travaux : superficieTerrasse;
  const surfacePondereeValue = surfaceCarrez + (surfaceTerrasse * ponderationTerrasse);

  useEffect(() => {
    console.log('BusinessPlanTab mounted');
    return () => console.log('BusinessPlanTab unmounted');
  }, []);

  if (isCalculating) {
    return <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(255,255,255,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 600 }}>Calcul en cours...</div>
    </div>;
  }

  // Dans le composant BusinessPlanTab, avant le return, ajouter :
  const prixFaiData = [
    {
      name: 'Agence',
      value: results?.resultats?.prix_hfa ? (results.resultats.prix_hfa * (inputs.frais_agence_vente_percent / 100)) : 0,
      color: '#FF8042' // orange vif
    },
    {
      name: 'Marge nette',
      value: results?.resultats?.marge_nette ?? 0,
      color: '#4ECDC4' // vert turquoise
    },
    {
      name: 'Banque',
      value: results?.financement?.couts?.total_couts_financiers ?? 0,
      color: '#3B82F6' // bleu
    },
    {
      name: 'Gestion',
      value: results?.couts_divers?.total_divers ?? 0,
      color: '#FBBF24' // jaune
    },
    {
      name: 'Travaux',
      value: results?.couts_travaux?.total_travaux ?? 0,
      color: '#F87171' // rouge clair
    },
    {
      name: "Achat",
      value: results?.couts_acquisition?.total_acquisition ?? 0,
      color: '#22D3EE' // bleu clair
    }
  ];

  // Données pour le 2e Mondrian (financement)
  const totalCreditFoncier = results?.trimestre_details?.reduce((sum, t) => sum + (t.credit_foncier_utilise ?? 0), 0) || 0;
  const totalFondsPropres = results?.trimestre_details?.reduce((sum, t) => sum + (t.fonds_propres_utilise ?? 0), 0) || 0;
  const totalCreditAccompagnement = results?.trimestre_details?.reduce((sum, t) => sum + (t.credit_accompagnement_utilise ?? 0), 0) || 0;
  const prixFaiFin = results?.resultats?.prix_fai ?? 1;
  const prixFaiDataFin = [
    {
      name: 'Agence',
      value: results?.resultats?.prix_hfa ? (results.resultats.prix_hfa * (inputs.frais_agence_vente_percent / 100)) : 0,
      color: '#FF8042' // orange vif
    },
    {
      name: 'Marge nette',
      value: results?.resultats?.marge_nette ?? 0,
      color: '#4ECDC4' // vert turquoise
    },
    {
      name: 'Crédit foncier',
      value: totalCreditFoncier,
      color: '#3B82F6' // bleu
    },
    {
      name: 'Fonds propres',
      value: totalFondsPropres,
      color: '#22D3EE' // bleu clair
    },
    {
      name: 'Crédit accompagnement',
      value: totalCreditAccompagnement,
      color: '#FBBF24' // jaune
    }
  ];


  return (
    <div className={styles['bp-tab-main-grid']}>
      {/* Accordéon des inputs contrôlé */}
      <Accordion className={styles['bp-tab-inputs-accordion']} activeKey={isAccordionOpen ? '0' : undefined}>
        <Accordion.Item eventKey="0">
          <Accordion.Header onClick={() => setIsAccordionOpen(open => !open)}>
            <span className={styles['bp-tab-inputs-header']}>Paramètres du business plan</span>
          </Accordion.Header>
          <Accordion.Body>
            <div className={styles['bp-tab-inputs-grid']}>
              {/* Acquisition */}
              <div className={styles['bp-tab-inputs-section']}>
                <h5>Acquisition</h5>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Prix affiché (€)</Form.Label>
                    <Form.Control type="number" name="prix_affiche" value={safeNumberInputValue(inputs.prix_affiche)} onChange={e => handleInputChange('prix_affiche', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['prix_affiche']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['prix_affiche']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Prix d'achat (€)</Form.Label>
                    <Form.Control type="number" name="prix_achat" value={safeNumberInputValue(inputs.prix_achat)} onChange={e => handleInputChange('prix_achat', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['prix_achat']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['prix_achat']}</Form.Control.Feedback>
                  </Form.Group>
                </div>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Frais notaire (%)</Form.Label>
                    <Form.Control type="number" name="frais_notaire_percent" value={safeNumberInputValue(inputs.frais_notaire_percent)} onChange={e => handleInputChange('frais_notaire_percent', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['frais_notaire_percent']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['frais_notaire_percent']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Frais agence achat (%)</Form.Label>
                    <Form.Control type="number" name="frais_agence_achat_percent" value={safeNumberInputValue(inputs.frais_agence_achat_percent)} onChange={e => handleInputChange('frais_agence_achat_percent', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['frais_agence_achat_percent']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['frais_agence_achat_percent']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Frais agence vente (%)</Form.Label>
                    <Form.Control type="number" name="frais_agence_vente_percent" value={safeNumberInputValue(inputs.frais_agence_vente_percent)} onChange={e => handleInputChange('frais_agence_vente_percent', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['frais_agence_vente_percent']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['frais_agence_vente_percent']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Frais dossier (€)</Form.Label>
                    <Form.Control type="number" name="frais_dossier_amount" value={safeNumberInputValue(inputs.frais_dossier_amount)} onChange={e => handleInputChange('frais_dossier_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['frais_dossier_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['frais_dossier_amount']}</Form.Control.Feedback>
                  </Form.Group>
                </div>
              </div>

              {/* Travaux */}
              <div className={styles['bp-tab-inputs-section']}>
                <h5>Travaux</h5>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Coût travaux (€/m²)</Form.Label>
                    <Form.Control type="number" name="cout_travaux_m2" value={safeNumberInputValue(inputs.cout_travaux_m2)} onChange={e => handleInputChange('cout_travaux_m2', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_travaux_m2']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_travaux_m2']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Maîtrise d'œuvre (%)</Form.Label>
                    <Form.Control type="number" name="cout_maitrise_oeuvre_percent" value={safeNumberInputValue(inputs.cout_maitrise_oeuvre_percent)} onChange={e => handleInputChange('cout_maitrise_oeuvre_percent', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_maitrise_oeuvre_percent']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_maitrise_oeuvre_percent']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Aléa travaux (%)</Form.Label>
                    <Form.Control type="number" name="cout_alea_percent" value={safeNumberInputValue(inputs.cout_alea_percent)} onChange={e => handleInputChange('cout_alea_percent', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_alea_percent']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_alea_percent']}</Form.Control.Feedback>
                  </Form.Group>
                </div>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Terrasse (€)</Form.Label>
                    <Form.Control type="number" name="cout_terrasse_input_amount" value={safeNumberInputValue(inputs.cout_terrasse_input_amount)} onChange={e => handleInputChange('cout_terrasse_input_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_terrasse_input_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_terrasse_input_amount']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Démolition (€)</Form.Label>
                    <Form.Control type="number" name="cout_demolition_input_amount" value={safeNumberInputValue(inputs.cout_demolition_input_amount)} onChange={e => handleInputChange('cout_demolition_input_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_demolition_input_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_demolition_input_amount']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Honoraires techniques (€)</Form.Label>
                    <Form.Control type="number" name="cout_honoraires_tech_input_amount" value={safeNumberInputValue(inputs.cout_honoraires_tech_input_amount)} onChange={e => handleInputChange('cout_honoraires_tech_input_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_honoraires_tech_input_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_honoraires_tech_input_amount']}</Form.Control.Feedback>
                  </Form.Group>
                </div>
              </div>

              {/* Divers */}
              <div className={styles['bp-tab-inputs-section']}>
                <h5>Divers</h5>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Prorata foncier (€)</Form.Label>
                    <Form.Control type="number" name="cout_prorata_foncier_input_amount" value={safeNumberInputValue(inputs.cout_prorata_foncier_input_amount)} onChange={e => handleInputChange('cout_prorata_foncier_input_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_prorata_foncier_input_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_prorata_foncier_input_amount']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Diagnostics (€)</Form.Label>
                    <Form.Control type="number" name="cout_diagnostics_input_amount" value={safeNumberInputValue(inputs.cout_diagnostics_input_amount)} onChange={e => handleInputChange('cout_diagnostics_input_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_diagnostics_input_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_diagnostics_input_amount']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Mobilier (€)</Form.Label>
                    <Form.Control type="number" name="cout_mobilier_input_amount" value={safeNumberInputValue(inputs.cout_mobilier_input_amount)} onChange={e => handleInputChange('cout_mobilier_input_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['cout_mobilier_input_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['cout_mobilier_input_amount']}</Form.Control.Feedback>
                  </Form.Group>
                </div>
              </div>

              {/* Financement */}
              <div className={styles['bp-tab-inputs-section']}>
                <h5>Financement</h5>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Crédit foncier (€)</Form.Label>
                    <Form.Control type="number" name="financement_credit_foncier_amount" value={safeNumberInputValue(inputs.financement_credit_foncier_amount)} onChange={e => handleInputChange('financement_credit_foncier_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['financement_credit_foncier_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['financement_credit_foncier_amount']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Fonds propres (€)</Form.Label>
                    <Form.Control type="number" name="financement_fonds_propres_amount" value={safeNumberInputValue(inputs.financement_fonds_propres_amount)} onChange={e => handleInputChange('financement_fonds_propres_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['financement_fonds_propres_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['financement_fonds_propres_amount']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Crédit accompagnement (€)</Form.Label>
                    <Form.Control type="number" name="financement_credit_accompagnement_amount" value={safeNumberInputValue(inputs.financement_credit_accompagnement_amount)} onChange={e => handleInputChange('financement_credit_accompagnement_amount', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['financement_credit_accompagnement_amount']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['financement_credit_accompagnement_amount']}</Form.Control.Feedback>
                  </Form.Group>
                </div>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Taux crédit (%)</Form.Label>
                    <Form.Control type="number" name="financement_taux_credit_percent" value={safeNumberInputValue(inputs.financement_taux_credit_percent)} onChange={e => handleInputChange('financement_taux_credit_percent', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['financement_taux_credit_percent']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['financement_taux_credit_percent']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Commission (%)</Form.Label>
                    <Form.Control type="number" name="financement_commission_percent" value={safeNumberInputValue(inputs.financement_commission_percent)} onChange={e => handleInputChange('financement_commission_percent', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['financement_commission_percent']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['financement_commission_percent']}</Form.Control.Feedback>
                  </Form.Group>
                </div>
              </div>

              {/* Surfaces après travaux */}
              <div className={styles['bp-tab-inputs-section']}>
                <h5>Surfaces après travaux</h5>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Carrez (m²)</Form.Label>
                    <Form.Control type="number" name="surface_carrez_apres_travaux" value={safeNumberInputValue(surfaceCarrez)} onChange={e => handleInputChange('surface_carrez_apres_travaux', e.target.value)} onBlur={handleInputBlur} min={superficie} isInvalid={!!inputErrors['surface_carrez_apres_travaux']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['surface_carrez_apres_travaux']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Terrasse (m²)</Form.Label>
                    <Form.Control type="number" name="surface_terrasse_apres_travaux" value={safeNumberInputValue(surfaceTerrasse)} onChange={e => handleInputChange('surface_terrasse_apres_travaux', e.target.value)} onBlur={handleInputBlur} min={superficieTerrasse} isInvalid={!!inputErrors['surface_terrasse_apres_travaux']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['surface_terrasse_apres_travaux']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Pondérée (m²)</Form.Label>
                    <Form.Control type="number" name="surface_ponderee_apres_travaux" value={safeNumberInputValue(surfacePondereeValue)} readOnly plaintext />
                  </Form.Group>
                </div>
              </div>

              {/* Calendrier */}
              <div className={styles['bp-tab-inputs-section']}>
                <h5>Calendrier</h5>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Date d'achat</Form.Label>
                    <Form.Control type="date" name="date_achat" value={inputs.date_achat} onChange={e => handleInputChange('date_achat', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['date_achat']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['date_achat']}</Form.Control.Feedback>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Durée (jours)</Form.Label>
                    <Form.Control type="number" name="duree_projet" value={safeNumberInputValue(inputs.duree_projet)} onChange={e => handleInputChange('duree_projet', parseInt(e.target.value))} onBlur={handleInputBlur} isInvalid={!!inputErrors['duree_projet']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['duree_projet']}</Form.Control.Feedback>
                  </Form.Group>
                  <div className={styles['bp-tab-calendar-date']}>
                    Date de vente : <span>{inputs.date_vente}</span>
                  </div>
                </div>
              </div>

              {/* Prix de vente */}
              <div className={styles['bp-tab-inputs-section']}>
                <h5>Prix de vente</h5>
                <div className={styles['bp-tab-inputs-row']}>
                  <Form.Group>
                    <Form.Label>Prix vente réel pondéré (€/m²)</Form.Label>
                    <Form.Control type="number" name="prix_vente_reel_pondere_m2" value={safeNumberInputValue(inputs.prix_vente_reel_pondere_m2)} onChange={e => handleInputChange('prix_vente_reel_pondere_m2', e.target.value)} onBlur={handleInputBlur} isInvalid={!!inputErrors['prix_vente_reel_pondere_m2']} />
                    <Form.Control.Feedback type="invalid">{inputErrors['prix_vente_reel_pondere_m2']}</Form.Control.Feedback>
                  </Form.Group>
                </div>
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      {/* KPI Cards */}
      <div className={styles['bp-tab-kpi-row']} style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* Carte 1 */}
        <div className={styles['bp-tab-kpi-card'] + ' kpi-pimp'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 22, color: '#0a6c9d' }}>💸</span>
            <span className={styles['bp-tab-kpi-card-label']}>Prix de revient</span>
          </div>
          <div className={styles['bp-tab-kpi-card-value']}>{formatK(results?.resultats?.prix_revient ?? 0)}</div>
        </div>
        {/* Carte 2 */}
        <div className={styles['bp-tab-kpi-card'] + ' kpi-pimp'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 22, color: '#22c55e' }}>💰</span>
            <span className={styles['bp-tab-kpi-card-label']}>Marge nette</span>
          </div>
          <div className={styles['bp-tab-kpi-card-value']}>{formatK(results?.resultats?.marge_nette ?? 0)}</div>
        </div>
        {/* Carte 3 */}
        <div className={styles['bp-tab-kpi-card'] + ' kpi-pimp'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 22, color: '#0ea5e9' }}>📊</span>
            <span className={styles['bp-tab-kpi-card-label']}>Rentabilité</span>
          </div>
          <div className={styles['bp-tab-kpi-card-value']}>{formatPercent(results?.resultats?.rentabilite ?? 0)}</div>
        </div>
        {/* Carte 4 */}
        <div className={styles['bp-tab-kpi-card'] + ' kpi-pimp'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 22, color: '#f59e42' }}>📈</span>
            <span className={styles['bp-tab-kpi-card-label']}>Rendement fond propres</span>
          </div>
          <div className={styles['bp-tab-kpi-card-value']}>{formatPercent((results?.resultats?.marge_nette ?? 0) / (totalFondsPropres || 1) * 100)}</div>
        </div>

      </div>


      {/* Section Hypothèses acquisition + vente + graph en 2 colonnes */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: '2.5rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {/* Colonne gauche : Acquisition + Vente */}
        <div style={{ flex: 1, minWidth: 340, display: 'flex', flexDirection: 'column', gap: '2.2rem' }}>
          {/* Bloc Hypothèses d'acquisition */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
              <span style={{ fontSize: '2rem', color: '#0a6c9d', background: '#e0f7fa', borderRadius: '50%', padding: '0.3em 0.5em' }}>🏠</span>
              <h2 style={{ fontWeight: 800, fontSize: '2rem', margin: 0, color: '#1a3557' }}>Hypothèses d'acquisition</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', marginBottom: '1.2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Prix FAI</div>
                <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#0a6c9d', letterSpacing: '-1px', lineHeight: 1 }}>
                  {(Math.round((inputs?.prix_achat ?? 0) / 1000)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}<span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#64748b' }}> k€</span>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Frais notaire</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e42' }}>{inputs.frais_notaire_percent} %</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Prix total</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1a3557' }}>
                  {(Math.round((results?.couts_acquisition?.total_acquisition ?? 0) / 1000)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#64748b' }}>k€</span>
                </div>
              </div>
            </div>
          </div>
          {/* Bloc Hypothèses de vente */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
              <span style={{ fontSize: '2rem', color: '#f59e42', background: '#fff7ed', borderRadius: '50%', padding: '0.3em 0.5em' }}>🏷️</span>
              <h2 style={{ fontWeight: 800, fontSize: '2rem', margin: 0, color: '#1a3557' }}>Hypothèses de vente</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', marginBottom: '1.2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Prix FAI</div>
                <div style={{ fontSize: '2.3rem', fontWeight: 900, color: '#0a6c9d', letterSpacing: '-1px', lineHeight: 1 }}>
                  {(Math.round((results?.resultats?.prix_fai ?? 0) / 1000)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#64748b' }}>k€</span>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Frais agence</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e42' }}>{inputs.frais_agence_vente_percent} %</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', color: '#64748b' }}>Prix HFA</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1a3557' }}>
                  {(Math.round((results?.resultats?.prix_hfa ?? 0) / 1000)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#64748b' }}>k€</span>
                </div>
              </div>

            </div>
          </div>

          {/* Bloc Prix de revient (option 2) */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
              <span style={{ fontSize: '2rem', color: '#0a6c9d', background: '#e0f7fa', borderRadius: '50%', padding: '0.3em 0.5em' }}>💰</span>
              <h2 style={{ fontWeight: 800, fontSize: '2rem', margin: 0, color: '#1a3557' }}>Prix de revient</h2>
            </div>
            <div style={{ fontSize: '2.7rem', fontWeight: 900, color: '#0a6c9d', letterSpacing: '-1px', lineHeight: 1, textAlign: 'center', marginBottom: '0.5rem' }}>
              {formatK(results?.resultats?.prix_revient ?? 0)}
            </div>
            <div style={{ fontSize: '1.1rem', color: '#64748b', textAlign: 'center', marginBottom: '1.2rem' }}>Total du projet</div>
            {/* Barres de progression par catégorie */}
            <div style={{ marginBottom: '1.2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {results?.synthese_couts?.map((item, idx) => {
                const total = results?.synthese_couts_total || 1;
                const pct = Math.round((item.montant / total) * 100);
                const colors = ['#0a6c9d', '#f59e42', '#64748b', '#b0c4de'];
                return (
                  <div key={item.categorie} style={{ display: 'flex', alignItems: 'center', marginBottom: 10, minHeight: 30 }}>
                    <div style={{ width: 110, fontWeight: 600, color: '#1a3557', fontSize: '1rem' }}>{item.categorie}</div>
                    <div style={{ flex: '0 0 220px', maxWidth: 220, minWidth: 80, margin: '0 0.7rem', background: '#f1f5f9', borderRadius: 6, height: 22, position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: pct + '%', height: '100%', background: colors[idx % colors.length], borderRadius: 6, transition: 'width 0.5s' }}></div>
                    </div>
                    <div style={{ width: 70, textAlign: 'right', color: '#0a6c9d', fontWeight: 700, fontSize: '1.08rem', whiteSpace: 'nowrap' }}>{formatK(item.montant)}
                      <span style={{ fontSize: '0.95em', fontStyle: 'italic', color: '#64748b', marginLeft: 4 }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Synthèse financement */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ background: '#e0f7fa', color: '#0a6c9d', borderRadius: 8, padding: '0.6rem 1.1rem', fontWeight: 700, fontSize: '1.05rem', minWidth: 90, textAlign: 'center' }}>
                Foncier<br /><span style={{ fontWeight: 800, fontSize: '1.2rem' }}>{formatK(totalCreditFoncier)}</span>
              </div>
              <div style={{ background: '#f0f7ff', color: '#1a3557', borderRadius: 8, padding: '0.6rem 1.1rem', fontWeight: 700, fontSize: '1.05rem', minWidth: 90, textAlign: 'center' }}>
                FP<br /><span style={{ fontWeight: 800, fontSize: '1.2rem' }}>{formatK(totalFondsPropres)}</span>
              </div>
              <div style={{ background: '#fff7ed', color: '#f59e42', borderRadius: 8, padding: '0.6rem 1.1rem', fontWeight: 700, fontSize: '1.05rem', minWidth: 90, textAlign: 'center' }}>
                Acc.<br /><span style={{ fontWeight: 800, fontSize: '1.2rem' }}>{formatK(totalCreditAccompagnement)}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Colonne droite : Graph + tableau + Détail trimestres compact */}
        <div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', gap: '2.2rem' }}>
          <div className={styles['bp-tab-vente-graph']}>
            {/* Phrase support des hypothèses */}
            <div
              style={{
                width: '100%',
                margin: '0 0 0 0',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: '#334155',
                background: 'rgba(248,250,252,0.7)',
                borderRadius: '10px',
                padding: '1rem 1.5rem',
                textAlign: 'left'
              }}
            >
              Autour de ce bien, le prix moyen des transactions historiques est de <b>{Math.round(benchmark).toLocaleString('fr-FR')} €</b> ; ce bien refait à neuf bénéficie d'une pondération de <b>{coefPonderation}</b> due à ses prestations intrinsèques et donc d'un prix de vente théorique de <b>{Math.round(prixVenteM2Theorique).toLocaleString('fr-FR')} €</b>. Nous estimons une revente à <b>{inputs.prix_vente_reel_pondere_m2 ? Math.round(inputs.prix_vente_reel_pondere_m2).toLocaleString('fr-FR') : '-'} €</b>.
            </div>
            <div style={{ fontWeight: 600, color: '#1a3557', fontSize: '1.05rem', marginBottom: '0.7rem' }}>Comparatif prix au m²</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={[
                  {
                    type: 'Pondéré',
                    Achat: results?.prix_m2?.prix_achat_pondere_m2 ?? 0,
                    Revient: results?.prix_m2?.prix_revient_pondere_m2 ?? 0,
                    Vente: results?.prix_m2?.prix_vente_pondere_m2 ?? 0,
                  },
                  {
                    type: 'Carrez',
                    Achat: results?.prix_m2?.prix_achat_carrez_m2 ?? 0,
                    Revient: results?.prix_m2?.prix_revient_carrez_m2 ?? 0,
                    Vente: results?.prix_m2?.prix_vente_carrez_m2 ?? 0,
                  },
                ]}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                barCategoryGap={"30%"}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" tick={{ fontSize: 13, fontWeight: 600, fill: '#64748b' }} />
                <YAxis tickFormatter={v => Math.round(v / 100) / 10 + ' k€'} tick={{ fontSize: 12 }} domain={['dataMin-1000', 'dataMax+1000']} />
                <Tooltip formatter={v => formatK1(Number(v))} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar dataKey="Achat" fill="#b0c4de" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Revient" fill="#0a6c9d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Vente" fill="#f59e42" radius={[4, 4, 0, 0]} />
                {/* Ligne pointillée pour le prix de vente théorique */}
                <ReferenceLine y={prixVenteM2Theorique} stroke="#1a3557" strokeDasharray="6 3" label={{ value: 'Théorique', position: 'right', fill: '#1a3557', fontSize: 13, fontWeight: 700, dy: -10 }} />
              </BarChart>
            </ResponsiveContainer>
            {/* Tableau compact sous le chart */}
            <table className={styles['bp-tab-vente-table-compact']}>
              <thead>
                <tr>
                  <th></th>
                  <th>Pondéré</th>
                  <th>Carrez</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Achat</td>
                  <td>{formatK1(results?.prix_m2?.prix_achat_pondere_m2 ?? 0)}</td>
                  <td>{formatK1(results?.prix_m2?.prix_achat_carrez_m2 ?? 0)}</td>
                </tr>
                <tr>
                  <td>Revient</td>
                  <td>{formatK1(results?.prix_m2?.prix_revient_pondere_m2 ?? 0)}</td>
                  <td>{formatK1(results?.prix_m2?.prix_revient_carrez_m2 ?? 0)}</td>
                </tr>
                <tr>
                  <td>Vente</td>
                  <td>{formatK1(results?.prix_m2?.prix_vente_pondere_m2 ?? 0)}</td>
                  <td>{formatK1(results?.prix_m2?.prix_vente_carrez_m2 ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Bloc Détail trimestres compact */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1.5rem', marginTop: '1.5rem' }}>
            <div style={{ fontWeight: 700, color: '#1a3557', fontSize: '1.25rem', marginBottom: '1.1rem' }}>Détails par trimestre</div>
            {/* Encart synthèse style phrase, même style que le bloc hypothèses */}
            <div
              style={{
                width: '100%',
                margin: '0 0 0 0',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: '#334155',
                background: 'rgba(248,250,252,0.7)',
                borderRadius: '10px',
                padding: '1rem 1.5rem',
                textAlign: 'left'
              }}
            >
              {`Le coût des travaux est estimé à ${Number(inputs.cout_travaux_m2).toLocaleString('fr-FR')} € par m² pour une surface Carrez après travaux de ${Number(inputs.surface_carrez_apres_travaux).toLocaleString('fr-FR')} m². Le financement repose sur un taux d'intérêt de ${Number(inputs.financement_taux_credit_percent).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % et une commission de ${Number(inputs.financement_commission_percent).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %. Le crédit total mis à disposition s'élève à ${Number(inputs.financement_credit_foncier_amount).toLocaleString('fr-FR')} € pour le foncier et ${Number(inputs.financement_credit_accompagnement_amount).toLocaleString('fr-FR')} € pour l'accompagnement.`}
            </div>
            <div>
              <table style={{ width: '100%', fontSize: '0.97rem', borderCollapse: 'collapse', minWidth: 0 }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ padding: '0.3rem 0.5rem', textAlign: 'center', color: '#64748b', fontWeight: 700, background: '#f8fafc' }}>Trim. (j)</th>
                    <th colSpan={3} style={{ padding: '0.3rem 0.5rem', textAlign: 'center', color: '#0a6c9d', fontWeight: 700, background: '#f0f7ff' }}>Utilisé</th>
                    <th colSpan={3} style={{ padding: '0.3rem 0.5rem', textAlign: 'center', color: '#f59e42', fontWeight: 700, background: '#fff7ed' }}>Coût</th>
                  </tr>
                  <tr>
                    <th style={{ padding: '0.2rem 0.5rem', textAlign: 'center', color: '#0a6c9d', fontWeight: 600, background: '#f0f7ff' }}>Fonc.</th>
                    <th style={{ padding: '0.2rem 0.5rem', textAlign: 'center', color: '#0a6c9d', fontWeight: 600, background: '#f0f7ff' }}>FP</th>
                    <th style={{ padding: '0.2rem 0.5rem', textAlign: 'center', color: '#0a6c9d', fontWeight: 600, background: '#f0f7ff' }}>Acc.</th>
                    <th style={{ padding: '0.2rem 0.5rem', textAlign: 'center', color: '#f59e42', fontWeight: 600, background: '#fff7ed' }}>Int. fonc.</th>
                    <th style={{ padding: '0.2rem 0.5rem', textAlign: 'center', color: '#f59e42', fontWeight: 600, background: '#fff7ed' }}>Int. acc.</th>
                    <th style={{ padding: '0.2rem 0.5rem', textAlign: 'center', color: '#f59e42', fontWeight: 600, background: '#fff7ed' }}>Comm.</th>
                  </tr>
                </thead>
                <tbody>
                  {results?.trimestre_details?.map((t, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : '#fff' }}>
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'center', color: '#1a3557', fontWeight: 600 }}>
                        {t.trimestre} ({t.jours}j)
                      </td>
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#0a6c9d', fontWeight: 700 }}>{Math.round((t.credit_foncier_utilise ?? 0) / 1000).toLocaleString('fr-FR')}</td>
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#0a6c9d', fontWeight: 700 }}>{Math.round((t.fonds_propres_utilise ?? 0) / 1000).toLocaleString('fr-FR')}</td>
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#0a6c9d', fontWeight: 700 }}>{Math.round((t.credit_accompagnement_utilise ?? 0) / 1000).toLocaleString('fr-FR')}</td>
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#f59e42', fontWeight: 700 }}>{((t.interets_foncier ?? 0) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</td>
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#f59e42', fontWeight: 700 }}>{((t.interets_accompagnement ?? 0) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</td>
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#f59e42', fontWeight: 700 }}>{((t.commission_accompagnement ?? 0) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                  {/* Ligne total */}
                  <tr style={{ background: '#e0f7fa' }}>
                    <td style={{ padding: '0.2rem 0.5rem', textAlign: 'center', color: '#1a3557', fontWeight: 800 }}>Total ({totalJours}j)</td>
                    <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#0a6c9d', fontWeight: 800 }}>{Math.round(totalCreditFoncier / 1000).toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#0a6c9d', fontWeight: 800 }}>{Math.round(totalFondsPropres / 1000).toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#0a6c9d', fontWeight: 800 }}>{Math.round(totalCreditAccompagnement / 1000).toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#f59e42', fontWeight: 800 }}>{(totalInteretsFoncier / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</td>
                    <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#f59e42', fontWeight: 800 }}>{(totalInteretsAccompagnement / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</td>
                    <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', color: '#f59e42', fontWeight: 800 }}>{(totalCommission / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Après le bloc Hypothèses de vente, ajouter : */}
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
        {/* Colonne 1 : Mondrian classique */}
        <div style={{ flex: 1, minWidth: 320, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1.5rem' }}>
          {/* Restaure le titre ici */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
            <span style={{ fontSize: '2rem', color: prixFaiData[0].color, background: '#e0f7fa', borderRadius: '50%', padding: '0.3em 0.5em' }}>📊</span>
            <h2 style={{ fontWeight: 800, fontSize: '2rem', margin: 0, color: '#1a3557' }}>Décomposition du prix FAI</h2>
          </div>
          <div style={{ height: 400, width: '100%' }}>
            <ResponsiveContainer>
              <Treemap
                data={prixFaiData}
                dataKey="value"
                nameKey="name"
                stroke="#fff"
                type="flat"
                content={((props: any) => <MondrianTreemapBlockFAI {...props} />) as unknown as React.ReactElement}
              >
                <Tooltip content={MondrianTooltip(results?.resultats?.prix_fai ?? 1)} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Colonne 2 : Mondrian financement */}
        <div style={{ flex: 1, minWidth: 320, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '1.5rem' }}>
          {/* Restaure le titre ici */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
            <span style={{ fontSize: '2rem', color: prixFaiDataFin[2].color, background: '#e0f7fa', borderRadius: '50%', padding: '0.3em 0.5em' }}>🏦</span>
            <h2 style={{ fontWeight: 800, fontSize: '2rem', margin: 0, color: '#1a3557' }}>Répartition financement FAI</h2>
          </div>
          <div style={{ height: 400, width: '100%' }}>
            <ResponsiveContainer>
              <Treemap
                data={prixFaiDataFin}
                dataKey="value"
                nameKey="name"
                stroke="#fff"
                type="flat"

                content={((props: any) => <MondrianTreemapBlockFin {...props} />) as unknown as React.ReactElement}
              >
                <Tooltip content={MondrianTooltip(prixFaiFin)} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      {/* Tableaux de synthèse */}
      <div className={styles['bp-tab-syntheses-row']}>
        <div className={styles['bp-tab-table-section']}>
          <h4>Synthèse des coûts</h4>
          <Table size="sm" bordered className={styles['bp-tab-table']}>
            <thead>
              <tr><th>Catégorie</th><th>Montant</th></tr>
            </thead>
            <tbody>
              {results?.synthese_couts?.map((item, idx) => (
                <tr key={item.categorie}>
                  <td>{item.categorie}</td>
                  <td>{formatK(item.montant)}</td>
                </tr>
              ))}
              <tr className={styles['bp-tab-table-total']}>
                <td>Total</td>
                <td>{formatK(results?.synthese_couts_total ?? 0)}</td>
              </tr>
            </tbody>
          </Table>
        </div>

        <div className={styles['bp-tab-table-section']}>
          <h4>Synthèse du financement</h4>
          <Table size="sm" bordered className={styles['bp-tab-table']}>
            <thead>
              <tr><th>Type</th><th>Montant</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Crédit foncier</td>
                <td>{formatK(totalCreditFoncier)}</td>
              </tr>
              <tr>
                <td>Fonds propres</td>
                <td>{formatK(totalFondsPropres)}</td>
              </tr>
              <tr>
                <td>Crédit accompagnement</td>
                <td>{formatK(totalCreditAccompagnement)}</td>
              </tr>
              <tr className={styles['bp-tab-table-total']}>
                <td>Total</td>
                <td>{formatK(totalCreditFoncier + totalFondsPropres + totalCreditAccompagnement)}</td>
              </tr>
            </tbody>
          </Table>
        </div>
      </div>





    </div>
  );
}

export default BusinessPlanTab; 
