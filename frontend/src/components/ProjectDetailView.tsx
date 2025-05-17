"use client";

import React, { useEffect, useState } from 'react';
import { GoogleMap, useLoadScript, Marker, Circle } from '@react-google-maps/api';
import PropertyDescription from './project-sections/PropertyDescription';
import DvfAnalysis from './project-sections/DvfAnalysis';
import BusinessPlanTab from './project-sections/BusinessPlanTab';
import PdfReport from './project-sections/PdfReport';
import PhotosTab from './project-sections/PhotosTab';
import { Project, ProjectSchema } from '../../../shared/types/project';
import { useAppStore } from '../store/appStore';
import { z } from 'zod';

type TabType = 'description' | 'dvf' | 'business-plan' | 'pdf' | 'photos';

export default function ProjectDetailView({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<TabType>('description');
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setView } = useAppStore();

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du projet');
      }
      const data = await response.json();
      const parseResult = ProjectSchema.safeParse(data);
      if (!parseResult.success) {
        setError(
          'Erreur de validation des données projet: ' +
          parseResult.error.errors
            .map((e: z.ZodIssue) => `${e.path.join('.')} : ${e.message}`)
            .join(', ')
        );
        setProject(null);
        return;
      }
      setProject(parseResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleUpdateProject = async (updates: Partial<Project>) => {
    try {
      const parseResult = ProjectSchema.partial().safeParse(updates);
      if (!parseResult.success) {
        setError('Erreur de validation des données envoyées: ' + parseResult.error.errors.map((e: z.ZodIssue) => e.message).join(', '));
        return;
      }
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://163.172.32.45:3001';
      const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData.error || 'Erreur inconnue du serveur') +
          (errorData.details ? ': ' + JSON.stringify(errorData.details) : '')
        );
      }
      await fetchProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la mise à jour');
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;
  if (!project) return <div>Projet non trouvé</div>;
  if (!isLoaded) return <div>Chargement de Google Maps...</div>;

  const center = project.inputsGeneral?.latitude != null && project.inputsGeneral?.longitude != null
    ? { lat: Number(project.inputsGeneral.latitude), lng: Number(project.inputsGeneral.longitude) }
    : { lat: 48.8566, lng: 2.3522 }; // Paris par défaut

  const coordinates = project.inputsGeneral?.latitude != null && project.inputsGeneral?.longitude != null
    ? { lat: Number(project.inputsGeneral.latitude), lng: Number(project.inputsGeneral.longitude) }
    : null;

  const tabs = [
    { key: 'description', label: 'Description du bien' },
    { key: 'photos', label: 'Photos' },
    { key: 'dvf', label: 'Analyse DVF' },
    { key: 'business-plan', label: 'Business Plan' },
    { key: 'pdf', label: 'Rapport PDF' },
    
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="w-full">
        {/* Map en haut, non sticky */}
        <div className="w-full h-[260px] mb-0 relative">
          {/* Bouton retour à la liste, positionné en absolute au-dessus de la map */}
          <button
            onClick={() => setView('projects')}
            style={{
              position: 'absolute',
              top: 18,
              left: 18,
              zIndex: 50,
              background: 'rgba(255,255,255,0.92)',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              padding: '8px 18px',
              fontWeight: 500,
              color: '#2563eb',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.color = '#2563eb'; }}
          >
            <span style={{ marginRight: 8, fontSize: 20 }}>←</span>
            <span className="hidden md:inline">Retour à la liste</span>
          </button>
          {/* Map en fond */}
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              zoom={15}
              center={center}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: true,
              }}
            >
              {(() => {
                
                
                const iconUrl = "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png";
                
                
                
                if (typeof window === 'undefined' || !window.google) {
                  
                  return null;
                }

                
                const scaledSize = new window.google.maps.Size(24, 24);
                

                const markerOptions = {
                  position: center,
                  icon: {
                    url: iconUrl,
                    scaledSize: scaledSize,
                    anchor: new window.google.maps.Point(12, 24)
                  },
                  map: null, // Sera défini par le composant Marker
                  title: project.projectTitle || 'Location'
                };
                

                return (
                  <Marker
                    position={markerOptions.position}
                    icon={markerOptions.icon}
                    title={markerOptions.title}
                    onLoad={(marker) => {
                      
                    }}
                    onUnmount={(marker) => {
                      
                    }}
                  />
                );
              })()}
              {activeTab === 'dvf' && project.inputsDvf?.rayon && (
                <Circle
                  center={center}
                  radius={project.inputsDvf.rayon}
                  options={{
                    fillColor: '#4299e1',
                    fillOpacity: 0.1,
                    strokeColor: '#4299e1',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                />
              )}
            </GoogleMap>
          )}
        </div>
        {/* Bloc sticky : titre, adresse, tabs */}
        <div id="project-header-sticky" className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md rounded-b-xl shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold mb-1 truncate">{project.projectTitle}</h1>
              {project.inputsGeneral?.adresseBien && (
                <div className="text-base text-gray-600 mb-4 flex items-center">
                  <span className="mr-2">📍</span>{project.inputsGeneral.adresseBien}
                </div>
              )}
            </div>
            {/* Tabs sticky */}
            <div className="sticky top-0 z-30 w-full md:w-auto">
              <div className="flex flex-wrap gap-2 border-b border-gray-200 bg-transparent">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabType)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-md transition
                      ${activeTab === tab.key
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                        : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Contenu des tabs aligné au header */}
      <div className="max-w-7xl mx-auto px-4 py-6 w-full">
        {activeTab === 'description' && (
          <PropertyDescription
            project={project}
            handleUpdateProject={handleUpdateProject}
          />
        )}
        {activeTab === 'dvf' && (
          <DvfAnalysis
            project={project}
            onUpdate={handleUpdateProject}
            coordinates={coordinates}
          />
        )}
        {activeTab === 'business-plan' && (
          <div id="bpTabRoot">
            <BusinessPlanTab
              project={project}
              onUpdate={handleUpdateProject}
            />
          </div>
        )}
        {activeTab === 'pdf' && (
          <PdfReport
            project={project}
            onUpdate={handleUpdateProject}
          />
        )}
        {activeTab === 'photos' && (
          <PhotosTab projectId={String(project.id)} />
        )}
      </div>
    </div>
  );
} 