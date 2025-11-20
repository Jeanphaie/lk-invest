import React, { useEffect, useState } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import { Photos, PhotosSchema } from '../../../../shared/types/photos';
import PlansSection from './PlansSection';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://163.172.32.45:3001';

interface PlansTabProps {
  projectId: string;
}

export default function PlansTab({ projectId }: PlansTabProps) {
  const [photos, setPhotos] = useState<Photos>({ 
    before: [], 
    plans: [], 
    '3d': [], 
    during: [], 
    after: [], 
    selectedBeforePhotosForPdf: [], 
    selected3dPhotosForPdf: [],
    selectedPlansPhotosForPdf: [],
    selectedDuringPhotosForPdf: [],
    selectedAfterPhotosForPdf: []
  });
  const [selectedPlansPhotosForPdf, setSelectedPlansPhotosForPdf] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = async () => {
    if (!projectId) {
      console.error('ProjectId is undefined or empty');
      setError('ID du projet manquant');
      return;
    }

    setLoading(true);
    try {
      const photosUrl = `${API_BASE_URL}/api/photos/project/${projectId}`;
      const photosRes = await fetch(photosUrl);

      if (!photosRes.ok) {
        const photosError = await photosRes.text();
        console.error('API Errors:', { photos: photosError });
        throw new Error('Failed to fetch photos');
      }

      const photosDataRaw = await photosRes.json();
      
      // Validation Zod
      const parse = PhotosSchema.safeParse(photosDataRaw);
      if (!parse.success) {
        console.error('Erreur validation Zod Photos:', parse.error);
        setError('Erreur de validation des photos (structure inattendue)');
        setLoading(false);
        return;
      }
      
      setPhotos(parse.data);
      setSelectedPlansPhotosForPdf(parse.data.selectedPlansPhotosForPdf || []);
    } catch (e) {
      console.error('Error fetching photos:', e);
      setError(e instanceof Error ? e.message : 'Erreur chargement photos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [projectId]);

  const handleDownload = (photoPath: string) => {
    const normalizedPath = photoPath.startsWith('/uploads/') ? photoPath : `/uploads/${photoPath}`;
    const filename = normalizedPath.split('/').pop();
    if (!filename) return;

    const pathParts = normalizedPath.split('/');
    const category = pathParts[pathParts.length - 2] || 'plans';
    
    const downloadUrl = `${API_BASE_URL}/api/photos/${projectId}/${category}/download?filename=${encodeURIComponent(filename)}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePlansUpload = async (files: FileList, planType: 'before' | 'after', floor: 1 | 2) => {
    if (files.length === 0) return;
    
    // Vérification de la taille de chaque fichier
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        setError(`Le fichier "${file.name}" dépasse la taille maximale de 50 Mo.`);
        return;
      }
    }
    
    setUploading(`${planType}-${floor}`);
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('photos', file);
    });
    formData.append('planType', planType);
    formData.append('floor', floor.toString());
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${projectId}/plans/upload-structured`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Erreur upload plan');
        setUploading(null);
        return;
      }
      
      await fetchPhotos();
    } catch (e) {
      console.error('Upload plan error:', e);
      setError('Erreur upload plan');
    } finally {
      setUploading(null);
    }
  };

  const handlePlansDelete = async (planType: 'before' | 'after', floor: 1 | 2, photoId: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce plan ?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${projectId}/plans/delete-structured`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoId, planType, floor }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la suppression');
      }
      
      await fetchPhotos();
    } catch (e) {
      console.error('Delete plan error:', e);
      if (e instanceof Error) {
        setError(`Erreur lors de la suppression: ${e.message}`);
      } else {
        setError('Une erreur inattendue est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePlansTogglePdfSelection = async (photoId: number) => {
    console.log('[PlansTab] handlePlansTogglePdfSelection called with photoId:', photoId);
    
    let updated: number[];
    if (selectedPlansPhotosForPdf.includes(photoId)) {
      updated = selectedPlansPhotosForPdf.filter(id => id !== photoId);
    } else {
      updated = [...selectedPlansPhotosForPdf, photoId];
    }
    
    setSelectedPlansPhotosForPdf(updated);

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/photos/project/${projectId}/selected-for-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPlansPhotosForPdf: updated }),
      });
      
      if (res.ok) {
        await fetchPhotos();
      } else {
        throw new Error('Erreur lors de la sélection PDF');
      }
    } catch (e) {
      setError('Erreur lors de la sélection PDF');
      console.error('[PlansTab][PDF][ERROR]', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Gestion des plans du projet</h3>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <div className="text-center"><Spinner animation="border" /></div>}
      
      <PlansSection
        projectId={projectId}
        photos={photos}
        selectedPlansPhotosForPdf={selectedPlansPhotosForPdf}
        onUpload={handlePlansUpload}
        onDelete={handlePlansDelete}
        onTogglePdfSelection={handlePlansTogglePdfSelection}
        onDownload={handleDownload}
        onDescriptionUpdate={fetchPhotos}
        loading={loading}
        uploading={uploading}
      />
    </div>
  );
}

