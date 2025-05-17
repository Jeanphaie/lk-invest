"use client";

import { useState, useEffect } from 'react';
import DvfTab from '../DvfTab';
import dynamic from 'next/dynamic';
import { InputsDvf } from '../../../../shared/types/dvfInputs';
import { Project } from '../../../../shared/types/project';
import * as z from 'zod';
import { DvfTransaction } from '../../../../shared/types/dvfTransaction';
import { DvfSeries } from '../../../../shared/types/dvfSeries';
import { DvfDistribution } from '../../../../shared/types/dvfDistribution';
import { DvfScatter } from '../../../../shared/types/dvfScatter';
import { ResultsDvfMetadata } from '../../../../shared/types/dvfMetadataResults';
import { ResultsDvfMetadataSchema } from '../../../../shared/types/dvfMetadataResults';
import { DvfTransactionSchema } from '../../../../shared/types/dvfTransaction';
import { DvfSeriesSchema } from '../../../../shared/types/dvfSeries';
import { DvfDistributionSchema } from '../../../../shared/types/dvfDistribution';
import { DvfScatterSchema } from '../../../../shared/types/dvfScatter';
import { Switch } from '@headlessui/react';

const DynamicMapWithCircle = dynamic(
  () => import('../map/MapWithCircle'),
  { ssr: false }
);

interface DvfAnalysisProps {
  project: Pick<Project, 'id' | 'projectTitle' | 'createdAt' | 'updatedAt' | 'inputsGeneral' | 'inputsDvf' | 'resultsDvfMetadata' | 'dvfTransactions' | 'dvfSeries' | 'dvfDistributions'>;
  onUpdate: (updates: Partial<Project>) => void;
  coordinates: { lat: number; lng: number } | null;
}

// Type local pour la réponse de l'API analyse DVF
interface DvfAnalyseResponse {
  dvfResults: ResultsDvfMetadata;
  dvfProperties: DvfTransaction[];
  trendSeries: DvfSeries[];
  distributionSeries: DvfDistribution[];
  scatterSeries: DvfScatter[];
  dvfPremiumProperties?: DvfTransaction[];
}

// Schéma local pour la réponse de l'API analyse DVF
const DvfAnalyseResponseSchema = z.object({
  dvfResults: ResultsDvfMetadataSchema,
  dvfProperties: z.array(DvfTransactionSchema),
  trendSeries: z.array(DvfSeriesSchema),
  distributionSeries: z.array(DvfDistributionSchema),
  scatterSeries: z.array(DvfScatterSchema),
  dvfPremiumProperties: z.array(DvfTransactionSchema).optional(),
});

// Fonction utilitaire pour normaliser les transactions DVF
function normalizeDvfTransaction(t: any) {
  return {
    ...t,
    numero: t.numero ?? t.adresse_numero ?? '',
    voie: t.voie ?? t.adresse_nom_voie ?? '',
  };
}

export default function DvfAnalysis({ project, onUpdate, coordinates }: DvfAnalysisProps) {
  const [mounted, setMounted] = useState(false);
  const [dvfData, setDvfData] = useState<DvfAnalyseResponse | null>(() => {
    if (
      project.resultsDvfMetadata &&
      Array.isArray(project.dvfTransactions) && project.dvfTransactions.length > 0 &&
      Array.isArray(project.dvfSeries) && project.dvfSeries.length > 0 &&
      Array.isArray(project.dvfDistributions) && project.dvfDistributions.length > 0
    ) {
      return {
        dvfResults: project.resultsDvfMetadata,
        dvfProperties: project.dvfTransactions.map(normalizeDvfTransaction),
        trendSeries: project.dvfSeries,
        distributionSeries: project.dvfDistributions,
        scatterSeries: [], // à adapter si tu veux stocker aussi le scatter
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOutliers, setShowOutliers] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<DvfTransaction | null>(null);
  const [showPremium, setShowPremium] = useState(false);

  const [dvfFilters, setDvfFilters] = useState<InputsDvf>({
    rayon: Number(project.inputsDvf?.rayon ?? 0),
    prixMin: project.inputsDvf?.prixMin ?? null,
    surfaceMin: project.inputsDvf?.surfaceMin ?? null,
    prixM2Min: project.inputsDvf?.prixM2Min ?? null,
    outlierLowerBoundPercent: Number(project.inputsDvf?.outlierLowerBoundPercent ?? 65),
    outlierUpperBoundCoeff: Number(project.inputsDvf?.outlierUpperBoundCoeff ?? 3)
  });

  useEffect(() => {
    setMounted(true);
    // Si pas de données, fetch
    if (!dvfData) {
      fetchDvfData();
    }
    // Sinon, rien à faire (on garde les données déjà présentes)
    // eslint-disable-next-line
  }, []);

  const fetchDvfData = async (filters: InputsDvf = dvfFilters) => {
    if (!mounted || project.inputsGeneral?.latitude == null || project.inputsGeneral?.longitude == null) {
      console.error('❌ Coordonnées manquantes:', project.inputsGeneral);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const requestData = { ...filters };
      const response = await fetch(`http://163.172.32.45:3001/api/dvf/${project.id}/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`Erreur analyse DVF: ${response.statusText}`);
      }
      
      const rawData = await response.json();
      const validatedData = DvfAnalyseResponseSchema.parse(rawData);
      setDvfData(validatedData);
      
      await onUpdate({
        inputsDvf: filters,
        resultsDvfMetadata: validatedData.dvfResults,
        inputsGeneral: project.inputsGeneral
      });

      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error);
      if (error instanceof z.ZodError) {
        setError('Erreur de validation des données reçues');
        console.error('Erreur de validation des données:', error.errors);
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Une erreur inattendue est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = async (name: keyof InputsDvf | 'all', value: any, shouldFetch = false) => {
    console.log('updateFilter called', name, value, shouldFetch);
    let newFilters: InputsDvf;
    if (name === 'all') {
      newFilters = { ...value };
    } else {
      newFilters = { ...dvfFilters, [name]: value };
    }
    setDvfFilters(newFilters);
    if (shouldFetch) {
      if (!project.inputsGeneral?.latitude || !project.inputsGeneral?.longitude) {
        console.error('❌ Coordonnées manquantes pour fetchDvfData:', project.inputsGeneral);
        return;
      }
      await fetchDvfData(newFilters);
    }
  };

  const calculateZoomLevel = (radiusKm: number) => {
    const zoom = Math.round(14 - Math.log2(radiusKm));
    return Math.min(Math.max(zoom, 12), 18);
  };

  // Choix de la liste à afficher
  // On prend d'abord la réponse API (dvfData.dvfPremiumProperties), sinon le champ du projet (project.dvfPremiumTransactions), sinon []
  const transactionsToShow = showPremium
    ? (dvfData?.dvfPremiumProperties || (project as any).dvfPremiumTransactions || [])
    : (dvfData?.dvfProperties || []);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle sélection/premium */}
      <div className="flex items-center gap-4 mb-2">
        <Switch.Group>
          <Switch.Label className="mr-2 text-sm font-medium">Afficher Premium</Switch.Label>
          <Switch
            checked={showPremium}
            onChange={setShowPremium}
            className={`${showPremium ? 'bg-red-500' : 'bg-blue-600'} relative inline-flex h-6 w-11 items-center rounded-full`}
          >
            <span
              className={`${showPremium ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition`}
            />
          </Switch>
        </Switch.Group>
        <span className="text-xs text-gray-500">{showPremium ? 'Transactions premium (top 10%)' : 'Transactions sélection (rayon)'}</span>
      </div>
      {/* Table et carte avec la bonne liste */}
      {mounted && (
        <DvfTab
          dvfProperties={transactionsToShow}
          dvfResults={dvfData?.dvfResults as ResultsDvfMetadata}
          trendSeries={dvfData?.trendSeries || []}
          distributionSeries={dvfData?.distributionSeries || []}
          scatterSeries={dvfData?.scatterSeries || []}
          dvfDataLoaded={!loading}
          updateFilter={updateFilter}
          MapWithCircle={DynamicMapWithCircle}
          dvfFilters={dvfFilters}
          calculatedZoom={calculateZoomLevel(dvfFilters.rayon)}
          showOutliers={showOutliers}
          setShowOutliers={setShowOutliers}
          selectedMarker={selectedMarker}
          setSelectedMarker={setSelectedMarker}
          coordinates={coordinates}
          loading={loading}
          handleUpdateProject={onUpdate}
          project={project}
        />
      )}
    </div>
  );
} 