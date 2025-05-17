import React, { useState, useMemo, useEffect } from 'react';
import { Pagination, Button, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { LineChart, CartesianGrid, XAxis, YAxis, Line, ReferenceLine, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useHover } from '../context/HoverContext';
import styles from '../styles/modules/tabs/dvf/DvfTab.module.css';
import dynamic from 'next/dynamic';
import axios from 'axios';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { DvfTransaction } from '../../../shared/types/dvfTransaction';
import { InputsDvf } from '../../../shared/types/dvfInputs';
import { DvfSeries } from '../../../shared/types/dvfSeries';
import { Project } from '../../../shared/types/project';
import { APIProvider, Map } from '@vis.gl/react-google-maps';

interface DvfTabProps {
  dvfProperties: DvfTransaction[];
  dvfResults: any;
  trendSeries: DvfSeries[];
  distributionSeries: any[];
  scatterSeries: any[];
  dvfDataLoaded: boolean;
  updateFilter: (name: keyof InputsDvf | 'all', value: any, shouldFetch?: boolean) => void;
  MapWithCircle: React.ComponentType<any>;
  dvfFilters: InputsDvf;
  calculatedZoom: number;
  showOutliers: boolean;
  setShowOutliers: (show: boolean) => void;
  selectedMarker: DvfTransaction | null;
  setSelectedMarker: (marker: DvfTransaction | null) => void;
  coordinates: { lat: number; lng: number } | null;
  loading: boolean;
  handleUpdateProject: (data: any) => void;
  project: Project;
}

const DvfTab: React.FC<DvfTabProps> = ({
  dvfProperties,
  dvfResults,
  trendSeries,
  distributionSeries,
  scatterSeries,
  dvfDataLoaded,
  updateFilter,
  MapWithCircle,
  dvfFilters,
  calculatedZoom,
  showOutliers,
  setShowOutliers,
  selectedMarker,
  setSelectedMarker,
  coordinates,
  loading,
  handleUpdateProject,
  project
}) => {
  const { hoveredKey, setHoveredKey } = useHover();
  type LocalInputsDvf = Omit<InputsDvf, 'rayon'> & { rayon: string | number };
  const [localFilters, setLocalFilters] = useState<LocalInputsDvf>({ ...dvfFilters, rayon: dvfFilters.rayon ?? '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortConfig, setSortConfig] = useState<{ field: string; direction: 'asc' | 'desc' }>({ 
    field: 'date_mutation', 
    direction: 'desc' 
  });
  const [openaiError, setOpenaiError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = (name: keyof InputsDvf, value: any) => {
    let newValue: any = value;
    if (name === 'rayon') {
      newValue = value; // string autorisé temporairement
    } else if (name === 'outlierLowerBoundPercent' || name === 'outlierUpperBoundCoeff') {
      newValue = Number(value);
    }
    setLocalFilters((prev: LocalInputsDvf) => ({
      ...prev,
      [name]: newValue
    }));
  };

  const applyFilters = () => {
    // Conversion du rayon en number pour l'API
    const filtersToApply: InputsDvf = {
      ...localFilters,
      rayon: typeof localFilters.rayon === 'string' ? parseFloat(localFilters.rayon.replace(',', '.')) : localFilters.rayon
    };
    console.log('applyFilters called', filtersToApply);
    updateFilter('all', filtersToApply, true);
  };

  const processedData = useMemo(() => {
    if (!dvfResults) {
      return [];
    }
    const avgPrice = dvfResults.arrondissement_avg_for_outliers;
    const lowerBoundPercent = Number(dvfFilters.outlierLowerBoundPercent) / 100;
    const upperBoundCoeff = Number(dvfFilters.outlierUpperBoundCoeff);
    const processed = dvfProperties.map(prop => {
      const isOutlier = prop.prix_m2 < (avgPrice * lowerBoundPercent) || prop.prix_m2 > (avgPrice * upperBoundCoeff);
      return {
        ...prop,
        is_outlier: isOutlier
      };
    });
    return processed;
  }, [dvfProperties, dvfResults, dvfFilters.outlierLowerBoundPercent, dvfFilters.outlierUpperBoundCoeff]);

  const sortedData = useMemo(() => {
    return [...processedData].sort((a, b) => {
      if (sortConfig.field === 'date_mutation') {
        return sortConfig.direction === 'desc' 
          ? new Date(b.date_mutation).getTime() - new Date(a.date_mutation).getTime()
          : new Date(a.date_mutation).getTime() - new Date(b.date_mutation).getTime();
      }
      return 0;
    });
  }, [processedData, sortConfig]);

  const filteredData = useMemo(() => {
    const filtered = sortedData.filter(prop => showOutliers || !prop.is_outlier);
    return filtered;
  }, [sortedData, showOutliers]);

  // Nouveau : filtrage par texte
  const filteredAndSearchedData = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    if (!text) return filteredData;
    return filteredData.filter(prop => {
      // Filtre sur adresse, prix, code postal, etc.
      const adresse = [prop.numero ?? '', prop.voie ?? ''].join(' ').toLowerCase();
      const prix = (prop.valeur_fonciere || prop.prix || '').toString();
      const prixM2 = (prop.prix_m2 || '').toString();
      const codePostal = (prop.code_postal || '').toString();
      return (
        adresse.includes(text) ||
        prix.includes(text) ||
        prixM2.includes(text) ||
        codePostal.includes(text)
      );
    });
  }, [filteredData, filterText]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = useMemo(() => {
    const pageData = filteredAndSearchedData.slice(startIndex, endIndex);
    return pageData;
  }, [filteredAndSearchedData, startIndex, endIndex]);
  
  const totalPages = useMemo(() => {
    return Math.ceil(filteredAndSearchedData.length / itemsPerPage);
  }, [filteredAndSearchedData.length, itemsPerPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  const handleShowOutliersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const show = e.target.checked;
    setShowOutliers(show);
    setCurrentPage(1);
  };

  const priceTrendDomain = [0, Math.max(...trendSeries.map(item => item.selection_avg)) * 1.2];

  // Calcul dynamique des ticks pour l'axe Y du graphique temporel
  const minK = Math.floor((priceTrendDomain[0] / 1000) / 2.5) * 2.5;
  const maxK = Math.ceil((priceTrendDomain[1] / 1000) / 2.5) * 2.5;
  const ticks = [];
  for (let v = minK; v <= maxK; v += 2.5) {
    ticks.push(v * 1000); // Remettre en €/m² pour l'axe
  }

  const renderPaginationItems = () => {
    const items = [];
    
    if (totalPages > 0) {
      items.push(
        <Pagination.Item
          key={1}
          active={currentPage === 1}
          onClick={() => handlePageChange(1)}
        >
          1
        </Pagination.Item>
      );
    }

    if (currentPage > 3) {
      items.push(<Pagination.Ellipsis key="ellipsis1" />);
    }

    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (i > 1 && i < totalPages) {
        items.push(
          <Pagination.Item
            key={i}
            active={currentPage === i}
            onClick={() => handlePageChange(i)}
          >
            {i}
          </Pagination.Item>
        );
      }
    }

    if (currentPage < totalPages - 2) {
      items.push(<Pagination.Ellipsis key="ellipsis2" />);
    }

    if (totalPages > 1) {
      items.push(
        <Pagination.Item
          key={totalPages}
          active={currentPage === totalPages}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }

    return items;
  };

  

  useEffect(() => {
    if (dvfProperties && dvfProperties.length > 0) {
      
      // Vérifie la présence des champs
      dvfProperties.slice(0, 3).forEach((p, i) => {
      
      });
    }
    // Synchronise le state local à chaque changement de données DVF
    setCurrentPage(1);
  }, [dvfProperties]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Bloc description quartier en haut */}
      <div className={styles['quartier-card']}>
        <span className={styles['quartier-icon']}>🏙️</span>
        <span className={styles['quartier-description']}>
          {project?.inputsGeneral?.description_quartier || "Aucune description disponible"}
        </span>
        <Button
          variant="outline-primary"
          size="sm"
          className={styles['regen-button']}
          onClick={async () => {

            
            setOpenaiError(null);
            if (!coordinates?.lat || !coordinates?.lng) {
              console.log('Erreur: Coordonnées manquantes');
              setOpenaiError('Les coordonnées du bien sont manquantes. Veuillez d\'abord définir l\'adresse du bien.');
              return;
            }
            try {
              const url = `http://163.172.32.45:3001/api/dvf/${project.id}/generate-quartier-description`;
              console.log('Appel API vers:', url);
              const response = await axios.post(url, {
                latitude: coordinates.lat,
                longitude: coordinates.lng,
                rayon: dvfFilters.rayon
              });
              
              if (response.data.description) {
                handleUpdateProject({
                  ...project,
                  inputsGeneral: {
                    ...project.inputsGeneral,
                    description_quartier: response.data.description
                  }
                });
              }
            } catch (error) {
              console.error('Erreur détaillée lors de la génération de la description:', error);
              if (axios.isAxiosError(error)) {
                console.error('Détails de l\'erreur Axios:', {
                  status: error.response?.status,
                  data: error.response?.data,
                  message: error.message
                });
              }
              setOpenaiError('Erreur lors de la génération de la description');
            }
          }}
        >
          Régénérer
        </Button>
        <Button
          variant="outline-primary"
          size="sm"
          className={styles['regen-button']}
          style={{ marginLeft: '1em' }}
          onClick={() => setShowFilters(true)}
        >
          Filtres
        </Button>
      </div>

      {/* Bloc KPI horizontal avec tooltips */}
      <div className={styles['kpi-row']} style={{flexWrap: 'wrap'}}>
        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-sel">Prix moyen des transactions sélectionnées (hors outliers)</Tooltip>}>
          <div className={styles['kpi-card-blue']}>
            <div className={styles['kpi-title']}>Prix moyen sélection</div>
            <div className={styles['kpi-value']}>{((dvfResults?.sel_final_avg || 0) / 1000).toFixed(1)} k€/m²</div>
            <div className={styles['kpi-info']}>Basé sur {dvfResults?.selection_total_count - dvfResults?.selection_outlier_count || 0} transactions</div>
            <div style={{ fontSize: '0.88em', color: '#6c757d', marginTop: 4, fontStyle: 'italic' }}>
              Ignorées : {dvfResults?.selection_outlier_count ?? '-'} / {dvfResults?.selection_total_count ?? '-'}
            </div>
          </div>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-arr">Prix moyen de l'arrondissement (hors outliers)</Tooltip>}>
          <div className={styles['kpi-card-green']}>
            <div className={styles['kpi-title']}>Prix moyen arrondissement</div>
            <div className={styles['kpi-value']}>{((dvfResults?.arr_final_avg || 0) / 1000).toFixed(1)} k€/m²</div>
            <div className={styles['kpi-info']}>Basé sur {dvfResults?.arrondissement_total_count - dvfResults?.arrondissement_outlier_count || 0} transactions</div>
            <div style={{ fontSize: '0.88em', color: '#6c757d', marginTop: 4, fontStyle: 'italic' }}>
              Ignorées : {dvfResults?.arrondissement_outlier_count ?? '-'} / {dvfResults?.arrondissement_total_count ?? '-'}
            </div>
          </div>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-premium">Moyenne des 10% des transactions les plus chères (hors outliers)</Tooltip>}>
          <div className={styles['kpi-card-red']}>
            <div className={styles['kpi-title']}>Moyenne Premium (top 10%)</div>
            <div className={styles['kpi-value']}>{((dvfResults?.premium_final_avg || 0) / 1000).toFixed(1)} k€/m²</div>
            <div className={styles['kpi-info']}>Basé sur {dvfResults?.premium_total_count - dvfResults?.premium_outlier_count || 0} transactions</div>
            <div style={{ fontSize: '0.88em', color: '#6c757d', marginTop: 4, fontStyle: 'italic' }}>
              Ignorées : {dvfResults?.premium_outlier_count ?? '-'} / {dvfResults?.premium_total_count ?? '-'}
            </div>
          </div>
        </OverlayTrigger>
        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-outliers">Bornes utilisées pour exclure les valeurs aberrantes (outliers)</Tooltip>}>
          <div className={styles['kpi-card-gray']}>
            <div className={styles['kpi-title']}>Valeurs aberrantes</div>
            <div className={styles['kpi-value']}>
              Min: {dvfResults?.outlier_lower_bound ? Math.round(dvfResults.outlier_lower_bound).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €' : '-'}<br/>
              Max: {dvfResults?.outlier_upper_bound ? Math.round(dvfResults.outlier_upper_bound).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €' : '-'}
            </div>
            <div style={{ fontSize: '0.98em', color: '#1a3557', marginTop: 8 }}>
              Prix moyen pour outliers : {dvfResults?.arrondissement_avg_for_outliers ? Math.round(dvfResults.arrondissement_avg_for_outliers).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €' : '-'}
            </div>
          </div>
        </OverlayTrigger>
      </div>

      {/* Première ligne : Inputs, Cartes de résultats et Méthodologie */}
      <div className="grid grid-cols-12 gap-4">
        <Offcanvas show={showFilters} onHide={() => setShowFilters(false)} placement="end" backdrop scroll>
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>Filtres de recherche</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <div className="space-y-2 text-xs">
              <div className="space-y-2">
            <div>
                  <label className="block font-medium text-gray-700 mb-1">Rayon (km)</label>
              <input
                    type="text"
                    className="block w-full rounded-md border-gray-300 shadow-sm px-2 py-1 text-xs"
                    value={localFilters.rayon ?? ''}
                    onChange={e => {
                      setLocalFilters(prev => ({ ...prev, rayon: e.target.value }));
                    }}
                    onBlur={e => {
                      let val = e.target.value.replace(',', '.');
                      let num = parseFloat(val);
                      if (isNaN(num) || num <= 0) {
                        setLocalFilters(prev => ({ ...prev, rayon: '0.05' }));
                      } else {
                        setLocalFilters(prev => ({ ...prev, rayon: num }));
                      }
                    }}
                    inputMode="decimal"
                    step="any"
                    pattern="[0-9]*[.,]?[0-9]*"
                  />
            </div>
            <div>
                  <label className="block font-medium text-gray-700 mb-1">Prix minimum (k€)</label>
              <input
                    type="number"
                    className="block w-full rounded-md border-gray-300 shadow-sm px-2 py-1 text-xs"
                    value={localFilters.prixMin || ''}
                onChange={(e) => handleFilterChange('prixMin', parseFloat(e.target.value))}
              />
            </div>
            <div>
                  <label className="block font-medium text-gray-700 mb-1">Surface minimum (m²)</label>
              <input
                    type="number"
                    className="block w-full rounded-md border-gray-300 shadow-sm px-2 py-1 text-xs"
                    value={localFilters.surfaceMin || ''}
                onChange={(e) => handleFilterChange('surfaceMin', parseFloat(e.target.value))}
              />
            </div>
            <div>
                  <label className="block font-medium text-gray-700 mb-1">Prix/m² minimum (€)</label>
              <input
                    type="number"
                    className="block w-full rounded-md border-gray-300 shadow-sm px-2 py-1 text-xs"
                    value={localFilters.prixM2Min || ''}
                onChange={(e) => handleFilterChange('prixM2Min', parseFloat(e.target.value))}
              />
            </div>
            <div>
                  <label className="block font-medium text-gray-700 mb-1">Seuil valeurs aberrantes (%)</label>
              <input
                    type="number"
                    className="block w-full rounded-md border-gray-300 shadow-sm px-2 py-1 text-xs"
                    value={localFilters.outlierLowerBoundPercent || ''}
                onChange={(e) => handleFilterChange('outlierLowerBoundPercent', parseFloat(e.target.value))}
              />
            </div>
            <div>
                  <label className="block font-medium text-gray-700 mb-1">Seuil maximum (coefficient)</label>
              <input
                    type="number"
                step="0.01"
                    className="block w-full rounded-md border-gray-300 shadow-sm px-2 py-1 text-xs"
                    value={localFilters.outlierUpperBoundCoeff || ''}
                onChange={(e) => handleFilterChange('outlierUpperBoundCoeff', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            <button
                onClick={() => { applyFilters(); setShowFilters(false); }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-all mt-2 text-sm font-semibold"
                >
                  Appliquer les filtres
            </button>
              <div className="mt-6 border-t pt-3 text-sm">
                <h3 className="text-base font-semibold mb-2">🧮 Méthodologie d'analyse</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    <b>Recherche géographique</b> : sélection des transactions dans le rayon choisi autour du bien cible.
                  </li>
                  <li>
                    <b>Application des filtres</b> : prix, surface, prix/m² (pour affiner la pertinence).
                  </li>
                  <li>
                    <b>Calcul des statistiques</b> : moyennes, médianes, premium (top 10%), bornes outliers.
                  </li>
                  <li>
                    <b>Détection des valeurs aberrantes (outliers)</b> :
                    <ul className="list-disc list-inside ml-4">
                      <li><span className="font-bold text-blue-700">Seuil bas</span> = moyenne arrondissement × seuil (%)</li>
                      <li><span className="font-bold text-red-600">Seuil haut</span> = moyenne arrondissement × coefficient maximum</li>
                      <li className="text-gray-600">Exemple : si seuil = 65% et coeff = 2,5, seules les transactions entre 6 500 €/m² et 25 000 €/m² sont retenues (si la moyenne arr. est 10 000 €/m²).</li>
                    </ul>
                  </li>
                  <li>
                    <b>Prime/décote</b> : calcul de l'écart à la moyenne premium (top 10%) pour situer le bien par rapport au marché haut de gamme.
                  </li>
                </ol>
                <div className="mt-2 text-xs text-gray-500">
                  <span className="font-semibold">Astuce :</span> jouer sur le rayon et les seuils outliers pour affiner la sélection et obtenir des statistiques plus robustes ou plus ciblées.
                </div>
              </div>
            </div>
          </Offcanvas.Body>
        </Offcanvas>


              </div>

      {/* Deuxième ligne : Graphiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Bloc graphique d'évolution */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Évolution des prix</h3>
          <div className="w-full" style={{minWidth: 320, height: 340}}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendSeries} margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis 
                  yAxisId="left"
                  domain={[
                    Math.floor(Math.min(...trendSeries.map(y => Math.min(y.selection_avg || Infinity, y.arrondissement_avg || Infinity))) * 0.95),
                    Math.ceil(Math.max(...trendSeries.map(y => Math.max(y.selection_avg || 0, y.arrondissement_avg || 0))) * 1.05)
                  ]}
                  tickFormatter={v => (v / 1000).toFixed(1)}
                  label={{ value: 'k€/m²', angle: -90, position: 'insideLeft', offset: 10 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[
                    Math.floor(Math.min(...trendSeries.map(y => y.premium_avg || Infinity)) * 0.95),
                    Math.ceil(Math.max(...trendSeries.map(y => y.premium_avg || 0)) * 1.05)
                  ]}
                tickFormatter={v => (v / 1000).toFixed(1)}
                  label={{ value: 'Premium (k€/m²)', angle: 90, position: 'insideRight', offset: 10 }}
              />
                <RechartsTooltip formatter={(value: any) => (value / 1000).toFixed(1)} />
                <Line yAxisId="left" type="monotone" dataKey="selection_avg" stroke="#1a3557" strokeWidth={4} dot={true} name="Sélection" />
                <Line yAxisId="left" type="monotone" dataKey="arrondissement_avg" stroke="#10B981" strokeWidth={2} name="Arrondissement" />
                <Line yAxisId="right" type="monotone" dataKey="premium_avg" stroke="#EF4444" strokeWidth={2} name="Premium (top 10%)" />
                {dvfResults?.sel_final_avg && (
                  <ReferenceLine y={dvfResults.sel_final_avg} yAxisId="left" stroke="#1a3557" strokeDasharray="4 2" strokeWidth={3}
                    label={{ value: `${(dvfResults.sel_final_avg/1000).toFixed(1)} k€/m² (moyenne sélection)`, position: 'right', fill: '#1a3557', fontWeight: 700, fontSize: 16 }} />
                )}
            </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="flex items-center"><span className="inline-block w-4 h-2 mr-1 rounded bg-[#1a3557]"></span>Sélection</span>
            <span className="flex items-center"><span className="inline-block w-4 h-2 mr-1 rounded bg-[#10B981]"></span>Arrondissement</span>
            <span className="flex items-center"><span className="inline-block w-4 h-2 mr-1 rounded bg-[#EF4444]"></span>Premium (top 10%)</span>
          </div>
        </div>
        {/* Bloc tableau des moyennes annuelles */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Statistiques annuelles</h3>
        <div className="overflow-x-auto">
            <table className="min-w-full max-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                  <th className="px-1 py-2 bg-gray-50 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-normal leading-tight">Année</th>
                  <th className="px-1 py-2 bg-gray-50 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-normal leading-tight">Prix moyen<br />sélection</th>
                  <th className="px-1 py-2 bg-gray-50 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-normal leading-tight">Nb.<br />transactions</th>
                  <th className="px-1 py-2 bg-gray-50 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-normal leading-tight">Prix moyen<br />arr.</th>
                  <th className="px-1 py-2 bg-gray-50 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-normal leading-tight">Nb.<br />trans.<br />arr.</th>
                  <th className="px-1 py-2 bg-gray-50 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-normal leading-tight">Prix moyen<br />premium</th>
                  <th className="px-1 py-2 bg-gray-50 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider whitespace-normal leading-tight">Nb.<br />trans.<br />premium</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trendSeries.map((year) => (
                <tr key={year.year}>
                    <td className="px-2 py-2 whitespace-nowrap">{year.year}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-blue-600 text-right">{((year.selection_avg || 0) / 1000).toFixed(1)} k€/m²</td>
                    <td className="px-2 py-2 whitespace-nowrap text-right">{year.selection_count}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-green-600 text-right">{((year.arrondissement_avg || 0) / 1000).toFixed(1)} k€/m²</td>
                    <td className="px-2 py-2 whitespace-nowrap text-right">{year.arrondissement_count}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-red-600 text-right">{((year.premium_avg || 0) / 1000).toFixed(1)} k€/m²</td>
                    <td className="px-2 py-2 whitespace-nowrap text-right">{year.premium_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Troisième ligne : Carte et Liste des transactions */}
      <div className="grid grid-cols-12 gap-4">
        {/* Carte */}
        <div className="col-span-4 bg-white rounded-lg shadow" style={{ height: '600px' }}>
          {coordinates && (
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
              <Map
                center={coordinates}
                zoom={calculatedZoom}
                style={{ width: '100%', height: '100%' }}
                mapId="dvf-map"
              >
            <MapWithCircle
              coordinates={coordinates}
              zoom={calculatedZoom}
              radius={dvfFilters.rayon * 1000}
              dvfProperties={dvfProperties}
              selectedMarker={selectedMarker}
              setSelectedMarker={setSelectedMarker}
              dvfFilters={dvfFilters}
              showOutliers={showOutliers}
            />
              </Map>
            </APIProvider>
          )}
        </div>

        {/* Liste des transactions */}
        <div className="col-span-8 bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2 gap-2">
            <h3 className="text-lg font-semibold">Transactions</h3>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <input
                type="text"
                placeholder="Filtrer par adresse ou prix..."
                className="border rounded px-2 py-1 text-xs w-full md:w-48"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
              />
              <div className="flex items-center">
                <input
                type="checkbox"
                  id="showOutliers"
                checked={showOutliers}
                  onChange={handleShowOutliersChange}
                  className="mr-2"
                />
                <label htmlFor="showOutliers" className="text-xs">Afficher les valeurs aberrantes</label>
              </div>
              <select
                value={itemsPerPage}
                onChange={e => handleItemsPerPageChange(Number(e.target.value))}
                className="border rounded px-2 py-1 text-xs"
              >
                <option value={10}>10 par page</option>
                <option value={25}>25 par page</option>
                <option value={50}>50 par page</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-[13px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Prix</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Surface</th>
                  <th className="px-2 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Prix/m²</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Adresse</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Code Postal</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Pièces</th>
                </tr>
              </thead>
              <tbody>
                {currentPageData.map((property: any, idx: number) => {
                  console.log('DVF property:', property);
                  return (
                    <tr
                      key={property.id}
                      className={`text-xs ${property.is_outlier ? 'bg-red-50' : ''} ${selectedMarker?.id === property.id ? 'bg-yellow-100' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-100 cursor-pointer transition-all duration-100`}
                      style={{ verticalAlign: 'middle', height: 38 }}
                      onClick={() => setSelectedMarker(property)}
                      onMouseEnter={() => { console.log('hover', property.id); setSelectedMarker(property); }}
                      onMouseLeave={() => setSelectedMarker(null)}
                    >
                      <td className="px-2 py-1 whitespace-nowrap align-middle">{new Date(property.date_mutation).toLocaleDateString('fr-FR')}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-right align-middle">{Math.round(property.valeur_fonciere / 1000).toLocaleString('fr-FR')} k€</td>
                      <td className="px-2 py-1 whitespace-nowrap text-right align-middle">{property.surface_reelle_bati} m²</td>
                      <td className="px-2 py-1 whitespace-nowrap text-right align-middle">{(property.prix_m2 / 1000).toFixed(1)}</td>
                      <td
                        className="px-2 py-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px] align-middle"
                      >{[
                        property.numero ?? '',
                        property.voie ?? ''
                      ].filter(Boolean).join(' ') || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-center align-middle">{property.code_postal}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-center align-middle">{property.nombre_pieces_principales ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-center">
            <Pagination>
              {renderPaginationItems()}
            </Pagination>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DvfTab; 