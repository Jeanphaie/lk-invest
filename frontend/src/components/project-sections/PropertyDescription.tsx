"use client";

import { useState, useEffect, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { Project } from '../../../../shared/types/project';
import { useAppStore } from '@/store/appStore';
import styles from '../../styles/components/PropertyDescription.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { InputsGeneral } from '../../../../shared/types/generalInputs';
import { DescriptionBienInputs, DescriptionBienInputsSchema, VueEnum, EtageEnum, AscenseurEnum, ExterieurEnum, AdresseEnum, EtatEnum } from '../../../../shared/types/descriptionBienInputs';
import { DescriptionBienResultsSchema } from '../../../../shared/types/descriptionBienResults';
import { Spinner } from 'react-bootstrap';
import { z } from 'zod';
import { FullDescriptionBien, FullDescriptionBienSchema } from '../../../../shared/types/descriptionBien_old';


interface PropertyDescriptionProps {
  project: Project;
  handleUpdateProject: (data: Partial<Project>) => void;
}

interface CoefficientImpact {
  parameter: string;
  value: string;
  impact: number;
  description: string;
}

const paramImages = {
  view: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=2000',
  floor: 'https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&q=80&w=2000',
  elevator: 'https://images.unsplash.com/photo-1604848698030-c434ba08ece1?auto=format&fit=crop&q=80&w=2000',
  outdoor: 'https://images.unsplash.com/photo-1628744876497-eb30460be9f6?auto=format&fit=crop&q=80&w=2000',
  address: 'https://images.unsplash.com/photo-1460472178825-e5240623afd5?auto=format&fit=crop&q=80&w=2000',
  condition: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=2000',
};

const paramColors = {
  view: 'from-blue-500 to-blue-600',
  floor: 'from-emerald-500 to-emerald-600',
  elevator: 'from-violet-500 to-violet-600',
  outdoor: 'from-amber-500 to-amber-600',
  address: 'from-rose-500 to-rose-600',
  condition: 'from-cyan-500 to-cyan-600',
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Palette de couleurs par paramètre
const paramColor = {
  view:    '#2563eb', // bleu
  floor:   '#059669', // vert
  elevator:'#a21caf', // violet
  outdoor: '#ea580c', // orange
  address: '#e11d48', // rose
  condition:'#0891b2', // cyan
};

// Fonction utilitaire pour interpoler la couleur du cercle coef
function coefColor(val: number) {
  if (val <= 0.5) return '#ef4444'; // rouge
  if (val >= 1.5) return '#2563eb'; // bleu
  if (val === 1) return '#64748b'; // neutre
  // Interpolation linéaire
  if (val < 1) {
    // rouge -> neutre
    const t = (val - 0.5) / 0.5;
    // #ef4444 -> #64748b
    return `rgb(${Math.round(239 + (100-239)*t)},${Math.round(68 + (71-68)*t)},${Math.round(68 + (123-68)*t)})`;
  } else {
    // neutre -> bleu
    const t = (val - 1) / 0.5;
    // #64748b -> #2563eb
    return `rgb(${Math.round(100 + (37-100)*t)},${Math.round(71 + (99-71)*t)},${Math.round(139 + (235-139)*t)})`;
  }
}

// Fonction utilitaire pour afficher l'impact de chaque option (affichage uniquement)
const getImpactForOption = (param: string, option: string, ascenseurValue: string) => {
  if (param === 'vue') {
    return { 'Exceptional': 0.20, 'Good': 0.10, 'Average': 0.00, 'Poor': -0.20 }[option] || 0;
  }
  if (param === 'etage') {
    if (option === 'High (≥ 5th)') return ascenseurValue === 'Yes' ? 0.05 : -0.20;
    if (option === 'Mid (2nd-4th)') return ascenseurValue === 'Yes' ? 0.00 : -0.10;
    if (option === 'Low (1st)') return -0.05;
    if (option === 'Ground Floor') return -0.10;
    return 0;
  }
  if (param === 'ascenseur') {
    return 0;
  }
  if (param === 'exterieur') {
    return { 'Large (≥ 50 m²)': 0.10, 'Medium (20-49 m²)': 0.03, 'Small (5-19 m²)': 0.00, 'None (< 5 m²)': 0.00 }[option] || 0;
  }
  if (param === 'adresse') {
    return { 'Highly Sought-After': 0.10, 'Moderately Sought-After': 0.05, 'Standard': 0.00 }[option] || 0;
  }
  if (param === 'etat') {
    return { 'Renovated by Architect': 0.10, 'Simply Renovated': 0.05, 'Good Condition': 0.00, 'Needs Refreshing': -0.05, 'Needs Renovation': -0.10 }[option] || 0;
  }
  if (param === 'nombre_pieces') {
    const n = Number(option);
    return n < 3 ? -0.02 : 0.00;
  }
  return 0;
};

// Mapping pour relier les noms backend des paramètres aux clés du state
const paramBackendToKey: Record<string, string> = {
  'Vue': 'vue',
  'vue': 'vue',
  'Étage': 'etage',
  'Etage': 'etage',
  'etage': 'etage',
  'Ascenseur': 'ascenseur',
  'ascenseur': 'ascenseur',
  'Extérieur': 'exterieur',
  'Exterieur': 'exterieur',
  'exterieur': 'exterieur',
  'Adresse': 'adresse',
  'adresse': 'adresse',
  'État': 'etat',
  'Etat': 'etat',
  'etat': 'etat',
  'Pièces': 'nombre_pieces',
  'Nombre de pièces': 'nombre_pieces',
  'nombre_pieces': 'nombre_pieces',
};

export default function PropertyDescription({ project, handleUpdateProject }: PropertyDescriptionProps) {
  const { setView } = useAppStore();
  
  if (!project || !project.id) {
    return (
      <div className="skeleton-loader">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-input" />
        <div className="skeleton skeleton-input" />
      </div>
    );
  }
  
  // Initialisation stricte de l'état local
  const [inputsGeneral, setInputsGeneral] = useState<InputsGeneral>({
    superficie: project.inputsGeneral?.superficie ?? 0,
    superficie_terrasse: project.inputsGeneral?.superficie_terrasse ?? 0,
    ponderation_terrasse: project.inputsGeneral?.ponderation_terrasse ?? 0.3,
    description_quartier: project.inputsGeneral?.description_quartier ?? '',
    latitude: project.inputsGeneral?.latitude,
    longitude: project.inputsGeneral?.longitude,
  });

  const [inputsDescriptionBien, setInputsDescriptionBien] = useState<DescriptionBienInputs>({
    vue: project.inputsDescriptionBien?.vue ?? 'Exceptional',
    etage: project.inputsDescriptionBien?.etage ?? 'Ground Floor',
    ascenseur: project.inputsDescriptionBien?.ascenseur ?? 'Yes',
    exterieur: project.inputsDescriptionBien?.exterieur ?? 'None (< 5 m²)',
    adresse: project.inputsDescriptionBien?.adresse ?? 'Standard',
    etat: project.inputsDescriptionBien?.etat ?? 'Good Condition',
    nombre_pieces: project.inputsDescriptionBien?.nombre_pieces ?? 1,
  });

  const [coefficientImpacts, setCoefficientImpacts] = useState<CoefficientImpact[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [coefficientValue, setCoefficientValue] = useState<number | undefined>(
    project.resultsDescriptionBien?.coef_ponderation
  );

  // Définition des options pour chaque paramètre
  const paramOptions = {
    vue: Object.entries(VueEnum.enum),
    etage: Object.entries(EtageEnum.enum),
    ascenseur: Object.entries(AscenseurEnum.enum),
    exterieur: Object.entries(ExterieurEnum.enum),
    adresse: Object.entries(AdresseEnum.enum),
    etat: Object.entries(EtatEnum.enum),
  } as const;

  // Gestion des changements d'inputs généraux
  const handleGeneralChange = (field: keyof InputsGeneral, value: any) => {
    setInputsGeneral((prev: InputsGeneral) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Déclenche le calcul de surface totale pondérée lors du onBlur
  const handleGeneralBlur = async () => {
    try {
      // Validation Zod du payload avant envoi
      const generalPayload: any = {
        superficie: inputsGeneral.superficie,
        superficie_terrasse: inputsGeneral.superficie_terrasse,
        ponderation_terrasse: inputsGeneral.ponderation_terrasse,
        latitude: inputsGeneral.latitude,
        longitude: inputsGeneral.longitude,
        adresseBien: project.inputsGeneral?.adresseBien,
      };
      if (inputsGeneral.description_quartier && inputsGeneral.description_quartier.trim() !== '') {
        generalPayload.description_quartier = inputsGeneral.description_quartier;
      }
      // Schéma local pour la validation (voir backend)
      const generalInputsSchema = z.object({
        superficie: z.number().min(0, 'La surface doit être positive').optional(),
        superficie_terrasse: z.number().min(0, 'La surface de la terrasse doit être positive').optional(),
        ponderation_terrasse: z.number().min(0, 'La pondération de la terrasse doit être positive').optional(),
        description_quartier: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        adresseBien: z.string().optional(),
      });
      const parseResult = generalInputsSchema.safeParse(generalPayload);
      if (!parseResult.success) {
        console.error('Erreur de validation:', parseResult.error.errors);
        return;
      }
      const response = await axios.patch(
        `${API_BASE_URL}/api/property/${project.id}/general-inputs`,
        generalPayload
      );
      handleUpdateProject(response.data);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  };

  // Adapter handleDescriptionChange pour utiliser directement les valeurs
  const handleDescriptionChange = async (field: keyof DescriptionBienInputs, value: string | number) => {
    // Mise à jour de l'état local
    setInputsDescriptionBien(prev => ({
      ...prev,
      [field]: field === 'nombre_pieces' ? Number(value) : value
    }));

    // Déclencher immédiatement le calcul
    try {
      setIsCalculating(true);
      const newInputs = {
        ...inputsDescriptionBien,
        [field]: field === 'nombre_pieces' ? Number(value) : value
      };
      
      const parseResult = DescriptionBienInputsSchema.safeParse(newInputs);
      if (!parseResult.success) {
        console.error('Erreur de validation:', parseResult.error.errors);
        return;
      }

      const response = await axios.patch(
        `${API_BASE_URL}/api/property/${project.id}/property-description`,
        newInputs
      );

      if (response.data.resultsDescriptionBien) {
        setCoefficientValue(response.data.resultsDescriptionBien.coef_ponderation);
        setCoefficientImpacts(response.data.resultsDescriptionBien.impacts);
      }

      handleUpdateProject(response.data);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Nouvelle fonction pour gérer le onBlur des champs de description (gardée pour compatibilité)
  const handleDescriptionBlur = async () => {
    try {
      setIsCalculating(true);
      const descPayload = { ...inputsDescriptionBien };
      const parseResult = DescriptionBienInputsSchema.safeParse(descPayload);
      if (!parseResult.success) {
        console.error('Erreur de validation:', parseResult.error.errors);
        return;
      }

      const response = await axios.patch(
        `${API_BASE_URL}/api/property/${project.id}/property-description`,
        descPayload
      );

      if (response.data.resultsDescriptionBien) {
        setCoefficientValue(response.data.resultsDescriptionBien.coef_ponderation);
        setCoefficientImpacts(response.data.resultsDescriptionBien.impacts);
      }

      handleUpdateProject(response.data);
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (project.resultsDescriptionBien) {
      setCoefficientValue(project.resultsDescriptionBien.coef_ponderation);
      setCoefficientImpacts(project.resultsDescriptionBien.impacts ?? []);
    }
  }, [project.resultsDescriptionBien]);

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.grid}>
        {/* Colonne de gauche : Caractéristiques générales */}
        <motion.div 
          className="col-span-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div 
            className={styles.card}
            style={{ padding: '2rem 1.5rem', background: '#f8fafc', boxShadow: '0 2px 16px 0 #e0e7ef', borderRadius: '1.2rem' }}
          >
            <h2 style={{ fontSize: '1.35em', color: '#2563eb', fontWeight: 800, textShadow: '0 2px 8px #2563eb22', marginBottom: '1.5rem', letterSpacing: '-0.01em' }}>Caractéristiques générales</h2>
            <div className={styles['input-cards-grid']} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
              <div className={styles['input-mini-card']} style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 6px 0 #e0e7ef', padding: '1.1rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5em' }}>📏</span>
                <div style={{ flex: 1 }}>
                  <label className={styles.inputLabel} style={{ fontWeight: 600, color: '#1a3557' }}>Surface (m²)</label>
                <input
                  type="number"
                    value={inputsGeneral.superficie}
                    onChange={(e) => handleGeneralChange('superficie', parseFloat(e.target.value) || 0)}
                    onBlur={handleGeneralBlur}
                    className={styles.input}
                    style={{ borderRadius: '0.7rem', border: '1.5px solid #cbd5e1', marginTop: '0.2em', fontWeight: 500 }}
                  />
                </div>
              </div>
              <div className={styles['input-mini-card']} style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 6px 0 #e0e7ef', padding: '1.1rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5em' }}>🌿</span>
                <div style={{ flex: 1 }}>
                  <label className={styles.inputLabel} style={{ fontWeight: 600, color: '#1a3557' }}>Surface Terrasse (m²)</label>
                <input
                  type="number"
                    value={inputsGeneral.superficie_terrasse}
                    onChange={(e) => handleGeneralChange('superficie_terrasse', parseFloat(e.target.value) || 0)}
                    onBlur={handleGeneralBlur}
                    className={styles.input}
                    style={{ borderRadius: '0.7rem', border: '1.5px solid #cbd5e1', marginTop: '0.2em', fontWeight: 500 }}
                  />
                </div>
              </div>
              <div className={styles['input-mini-card']} style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 6px 0 #e0e7ef', padding: '1.1rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5em' }}>⚖️</span>
                <div style={{ flex: 1 }}>
                  <label className={styles.inputLabel} style={{ fontWeight: 600, color: '#1a3557' }}>Ratio Terrasse</label>
                <input
                  type="number"
                  step="0.1"
                    value={inputsGeneral.ponderation_terrasse}
                    onChange={(e) => handleGeneralChange('ponderation_terrasse', parseFloat(e.target.value) || 0)}
                    onBlur={handleGeneralBlur}
                    className={styles.input}
                    style={{ borderRadius: '0.7rem', border: '1.5px solid #cbd5e1', marginTop: '0.2em', fontWeight: 500 }}
                />
              </div>
              </div>
              <div className={styles['input-mini-card']} style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 6px 0 #e0e7ef', padding: '1.1rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.5em' }}>🛏️</span>
                <div style={{ flex: 1 }}>
                  <label className={styles.inputLabel} style={{ fontWeight: 600, color: '#1a3557' }}>Nombre de Pièces</label>
                <input
                  type="number"
                  min={1}
                  value={inputsDescriptionBien.nombre_pieces}
                  onChange={e => {
                    const val = Number(e.target.value);
                    handleDescriptionChange('nombre_pieces', val);
                  }}
                  onBlur={handleDescriptionBlur}
                  style={{ borderRadius: '0.7rem', border: '1.5px solid #cbd5e1', width: 60, fontWeight: 600, fontSize: '1.1em', padding: '0.2em 0.7em' }}
                />
              </div>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'center', fontWeight: 600, color: '#0a6c9d', fontSize: '1.1em' }}>
              Surface totale pondérée : <span style={{ fontWeight: 800 }}>
                {(inputsGeneral.superficie ?? 0) + (inputsGeneral.superficie_terrasse ?? 0) * (inputsGeneral.ponderation_terrasse ?? 0)} m²
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* Colonne de droite : Tableau récapitulatif */}
        <motion.div 
          className="col-span-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
                
          <div className={styles.card}>
          <h2 style={{ fontSize: '1.35em', color: '#2563eb', fontWeight: 800, textShadow: '0 2px 8px #2563eb22', marginBottom: '1.1rem', letterSpacing: '-0.01em' }}>Impact des paramètres</h2>
            <div style={{
              marginTop: '2.5rem',
              background: '#181f2a',
              borderRadius: '1.2em',
              boxShadow: '0 2px 12px 0 #10162444',
              padding: '2.2em 2em 1.5em 2em',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '2.5em',
              flexWrap: 'wrap',
            }}>
              {/* Badge coef avec couleur dynamique */}
              <div style={{
                minWidth: 120,
                minHeight: 120,
                borderRadius: '50%',
                background: typeof coefficientValue === 'number' ? coefColor(coefficientValue) : '#64748b',
                boxShadow: '0 4px 24px 0 #2563eb55',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 900,
                fontSize: '2.7em',
                letterSpacing: '-0.03em',
                marginRight: '2.2em',
                animation: 'pulse 2s infinite',
                border: '4px solid #fff',
                transition: 'background 0.3s',
              }}>
                {typeof coefficientValue === 'number' ? coefficientValue.toFixed(2) : 'N/A'}
                <span style={{ fontSize: '0.32em', fontWeight: 500, marginTop: '-0.5em', letterSpacing: '0.01em' }}>Coef</span>
              </div>
              {/* Tableau simplifié : 1 ligne d'entête, 1 ligne de valeurs */}
              <div style={{ flex: 1, minWidth: 320 }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.98em', color: '#fff', background: 'none', textAlign: 'center' }}>
                  <tbody>
                    <tr style={{ background: 'rgba(30,41,59,0.95)' }}>
                      <th style={{ padding: '0.4em 0.2em', fontWeight: 700, letterSpacing: '0.01em', fontSize: '0.98em', minWidth: 60 }}>Vue</th>
                      <th style={{ padding: '0.4em 0.2em', fontWeight: 700, letterSpacing: '0.01em', fontSize: '0.98em', minWidth: 60 }}>Etage</th>
                      <th style={{ padding: '0.4em 0.2em', fontWeight: 700, letterSpacing: '0.01em', fontSize: '0.98em', minWidth: 60 }}>Adresse</th>
                    </tr>
                    <tr>
                      {['vue', 'etage', 'adresse'].map(param => {
                        const impactObj = coefficientImpacts.find(i => paramBackendToKey[i.parameter] === param);
                        const impact = impactObj ? impactObj.impact : 0;
                        let color = '#f1f5f9';
                        if (impact > 0) color = '#22c55e';
                        if (impact < 0) color = '#ef4444';
                        return (
                          <td key={param} style={{ padding: '0.4em 0.2em', fontWeight: 700, color, fontSize: '1.08em' }}>
                            {impact > 0 ? '+' : ''}{impact.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                    <tr style={{ background: 'rgba(30,41,59,0.95)' }}>
                      <th style={{ padding: '0.4em 0.2em', fontWeight: 700, letterSpacing: '0.01em', fontSize: '0.98em', minWidth: 60 }}>Exterieur</th>
                      
                      <th style={{ padding: '0.4em 0.2em', fontWeight: 700, letterSpacing: '0.01em', fontSize: '0.98em', minWidth: 60 }}>Etat</th>
                      <th style={{ padding: '0.4em 0.2em', fontWeight: 700, letterSpacing: '0.01em', fontSize: '0.98em', minWidth: 60 }}>Pièces</th>
                  </tr>
                    <tr>
                      {['exterieur', 'etat', 'nombre_pieces'].map(param => {
                        const impactObj = coefficientImpacts.find(i => paramBackendToKey[i.parameter] === param);
                        const impact = impactObj ? impactObj.impact : 0;
                        let color = '#f1f5f9';
                        if (impact > 0) color = '#22c55e';
                        if (impact < 0) color = '#ef4444';
                        return (
                          <td key={param} style={{ padding: '0.4em 0.2em', fontWeight: 700, color, fontSize: '1.08em' }}>
                            {impact > 0 ? '+' : ''}{impact.toFixed(2)}
                      </td>
                        );
                      })}
                    </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </motion.div>
      </div>

      {/* Paramètres qualitatifs en bas */}
      <motion.div 
        className={styles.paramGrid}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '1.2rem',
          flexWrap: 'wrap',
          marginTop: '2.2rem',
          justifyContent: 'flex-start',
        }}>
        {Object.entries(paramOptions).map(([param, options]) => (
            <div
              key={param}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                borderRadius: '1.2em',
                background: '#181f2a',
                overflow: 'hidden',
                minWidth: 170,
                maxWidth: 220,
                flex: '1 1 170px',
                boxShadow: '0 2px 8px 0 #10162444',
                padding: '1.1em 0.7em 1.2em 0.7em',
                marginBottom: '0.3em',
              }}
            >
              {/* Image de fond discrète */}
              <div style={{
                position: 'absolute',
                left: 0, top: 0, right: 0, bottom: 0,
                backgroundImage: `url(${paramImages[param as keyof typeof paramImages]})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.18,
                filter: 'brightness(0.5) blur(2px)',
                zIndex: 0,
              }} />
              {/* Label */}
              <span style={{
                fontWeight: 700,
                color: '#fff',
                fontSize: '1.08em',
                textTransform: 'capitalize',
                zIndex: 1,
                letterSpacing: '0.01em',
                marginBottom: '0.7em',
                marginLeft: '0.1em',
              }}>{param}</span>
              {/* Options empilées */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em', zIndex: 1 }}>
                {param !== 'nombre_pieces' ? (
                  options.map(([label, backendValue]: [string, string]) => {
                    const selected = inputsDescriptionBien[param as keyof DescriptionBienInputs] === backendValue;
                    const color = paramColor[param as keyof typeof paramColor] || '#2563eb';
                    const impact = getImpactForOption(param, backendValue, inputsDescriptionBien.ascenseur);
                    return (
                      <button
                        key={backendValue}
                        type="button"
                        onClick={() => handleDescriptionChange(param as keyof DescriptionBienInputs, backendValue)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                          borderRadius: '1.2em',
                          border: selected ? 'none' : '1.2px solid #fff',
                          background: selected ? color : 'rgba(24,31,42,0.72)',
                          color: '#fff',
                          fontWeight: selected ? 700 : 500,
                          fontSize: '0.97em',
                          padding: '0.22em 0.9em',
                          cursor: 'pointer',
                          outline: 'none',
                          boxShadow: selected ? `0 0 0 3px ${color}55, 0 2px 8px 0 ${color}55` : 'none',
                          transition: 'all 0.13s',
                          minHeight: '2em',
                          position: 'relative',
                          borderWidth: 0,
                          marginRight: 0,
                          opacity: selected ? 1 : 0.85,
                          filter: selected ? 'none' : 'brightness(1.1)',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = selected ? color : 'rgba(255,255,255,0.13)'}
                        onMouseOut={e => e.currentTarget.style.background = selected ? color : 'rgba(24,31,42,0.72)'}
                      >
                        {selected && <span style={{ fontWeight: 900, fontSize: '1.1em', marginRight: '0.5em', color: '#fff', textShadow: `0 0 6px ${color}` }}>✔</span>}
                        <span>{label}</span>
                        <span style={{ fontSize: '0.93em', color: selected ? '#dbeafe' : '#cbd5e1', fontWeight: 500, marginLeft: 'auto' }}>{impact > 0 ? '+' : ''}{impact.toFixed(2)}</span>
                      </button>
                    );
                  })
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7em' }}>
                    <input
                      type="number"
                      min={1}
                      value={inputsDescriptionBien.nombre_pieces}
                      onChange={e => {
                        const val = Number(e.target.value);
                        handleDescriptionChange('nombre_pieces', val);
                      }}
                      onBlur={handleDescriptionBlur}
                      style={{ borderRadius: '0.7rem', border: '1.5px solid #cbd5e1', width: 60, fontWeight: 600, fontSize: '1.1em', padding: '0.2em 0.7em' }}
                    />
                    <span style={{ fontSize: '0.93em', color: '#cbd5e1', fontWeight: 500 }}>
                      {getImpactForOption('nombre_pieces', inputsDescriptionBien.nombre_pieces.toString(), inputsDescriptionBien.ascenseur) > 0 ? '+' : ''}
                      {getImpactForOption('nombre_pieces', inputsDescriptionBien.nombre_pieces.toString(), inputsDescriptionBien.ascenseur).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
} 