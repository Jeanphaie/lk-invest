import React, { useEffect, useState } from 'react';
import { Card, Button, Row, Col, Spinner, Form, Badge, Alert } from 'react-bootstrap';
import Image from 'next/image';
import { FaUpload, FaTrash, FaStar, FaDownload, FaCheck } from 'react-icons/fa';
import { Photos, Photo, PhotosSchema } from '../../../../shared/types/photos';

interface PhotosTabProps {
  projectId: string;
}

// Définition des catégories valides
const photoCategories = ['before', '3d', 'during', 'after'] as const;
type PhotoCategory = typeof photoCategories[number];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://163.172.32.45:3001';

// Fonction utilitaire pour normaliser les chemins
const normalizePath = (path: string) => {
  return path.startsWith('/uploads/') ? path : `/uploads/${path}`;
};

const categories: { key: PhotoCategory; label: string; canSelectForPdf: boolean }[] = [
  { key: 'before', label: 'Avant', canSelectForPdf: true },
  { key: '3d', label: '3D', canSelectForPdf: true },
  { key: 'during', label: 'Pendant', canSelectForPdf: false },
  { key: 'after', label: 'Après', canSelectForPdf: false },
];

// Fonction utilitaire pour trier les photos d'une catégorie
function sortedPhotos(photos: Photos, category: PhotoCategory, sortOrder: 'asc' | 'desc'): Photo[] {
  const categoryPhotos = photos[category] || [];
  return [...categoryPhotos].sort((a: Photo, b: Photo) => {
    if (sortOrder === 'asc') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function PhotosTab({ projectId }: PhotosTabProps) {
  // États typés strictement
  const [photos, setPhotos] = useState<Photos>({ before: [], '3d': [], during: [], after: [], selectedBeforePhotosForPdf: [], selected3dPhotosForPdf: [] });
  const [selectedBeforePhotosForPdf, setSelectedBeforePhotosForPdf] = useState<number[]>([]);
  const [selected3dPhotosForPdf, setSelected3dPhotosForPdf] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchPhotos = async () => {
    // Guard pour projectId
    if (!projectId) {
      console.error('ProjectId is undefined or empty');
      setError('ID du projet manquant');
      return;
    }

    setLoading(true);
    try {
      console.log('\n=== fetchPhotos START ===');
      console.log('ProjectId:', projectId);
      console.log('Type of projectId:', typeof projectId);
      
      const photosUrl = `${API_BASE_URL}/api/photos/project/${projectId}`;
      
      console.log('Fetching from URL:', photosUrl);
      
      const photosRes = await fetch(photosUrl);

      console.log('Response status:', {
        photos: photosRes.status
      });

      if (!photosRes.ok) {
        const photosError = await photosRes.text();
        console.error('API Errors:', {
          photos: photosError
        });
        throw new Error('Failed to fetch photos');
      }

      const photosDataRaw = await photosRes.json();
      console.log('[FRONT][FETCH][RAW]', photosDataRaw);

      // Validation Zod
      const parse = PhotosSchema.safeParse(photosDataRaw);
      if (!parse.success) {
        console.error('Erreur validation Zod Photos:', parse.error);
        setError('Erreur de validation des photos (structure inattendue)');
        setLoading(false);
        return;
      }
      setPhotos(parse.data);
      setSelectedBeforePhotosForPdf(parse.data.selectedBeforePhotosForPdf || []);
      setSelected3dPhotosForPdf(parse.data.selected3dPhotosForPdf || []);
      setCoverPhoto(parse.data.coverPhoto || null);
      console.log('[FRONT][FETCH][PARSED]', parse.data);
      
      console.log('=== fetchPhotos END ===\n');
    } catch (e) {
      console.error('Error fetching photos:', e);
      setError(e instanceof Error ? e.message : 'Erreur chargement photos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('\n=== State Update ===');
    console.log('selectedBeforePhotosForPdf:', selectedBeforePhotosForPdf);
    console.log('selected3dPhotosForPdf:', selected3dPhotosForPdf);
  }, [selectedBeforePhotosForPdf, selected3dPhotosForPdf]);

  useEffect(() => {
    fetchPhotos();
  }, [projectId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    // Vérification du nombre de fichiers
    if (e.target.files.length > 40) {
      setError('Vous ne pouvez charger que 40 fichiers à la fois.');
      return;
    }
    // Vérification de la taille de chaque fichier
    for (const file of Array.from(e.target.files)) {
      if (file.size > 50 * 1024 * 1024) {
        setError(`Le fichier "${file.name}" dépasse la taille maximale de 50 Mo.`);
        return;
      }
    }
    setUploading(category);
    const formData = new FormData();
    Array.from(e.target.files).forEach(file => {
      formData.append('photos', file);
    });
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${projectId}/${category}/multiple`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Erreur upload photo');
        setUploading(null);
        return;
      }
      const data = await response.json();
      console.log('Upload response:', data);
      await fetchPhotos();
    } catch (e) {
      console.error('Upload error:', e);
      setError('Erreur upload photo');
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (category: string, photoId: number) => {
    setLoading(true);
    try {
      // Trouver la photo pour récupérer son url
      const photo = photos[category as PhotoCategory]?.find((p: Photo) => p.id === photoId);
      if (!photo) {
        setError('Photo introuvable');
        setLoading(false);
        return;
      }
      console.log('Deleting photo:', { projectId, category, photoId, photoPath: photo.url });
      
      const response = await fetch(`${API_BASE_URL}/api/photos/${projectId}/${category}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoPath: photo.url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la suppression');
      }
      
      // Mettre à jour l'état local immédiatement
      setPhotos(prevPhotos => {
        const newPhotos = { ...prevPhotos };
        if (newPhotos[category as PhotoCategory]) {
          newPhotos[category as PhotoCategory] = newPhotos[category as PhotoCategory]!.filter((p: Photo) => p.id !== photoId);
        }
        return newPhotos;
      });

      // Rafraîchir les données du serveur après un court délai
      setTimeout(() => {
        fetchPhotos();
      }, 100);
    } catch (e) {
      console.error('Delete error:', e);
      setError(e instanceof Error ? e.message : 'Erreur suppression photo');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (photoPath: string) => {
    // Extraire le nom du fichier du chemin
    const filename = photoPath.split('/').pop();
    if (!filename) return;

    // Extraire la catégorie du chemin (before, 3d, during, after)
    const pathParts = photoPath.split('/');
    const category = pathParts[pathParts.length - 2];
    
    // Construire l'URL de téléchargement
    const downloadUrl = `${API_BASE_URL}/api/photos/${projectId}/${category}/download?filename=${filename}`;
    
    // Créer un lien temporaire pour le téléchargement
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename; // Force le téléchargement
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSetCover = async (photoPath: string) => {
    console.log('[FRONT][COVER][BEFORE]', { photoPath, coverPhoto });
    try {
      await fetch(`${API_BASE_URL}/api/photos/${projectId}/cover`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ photoUrl: photoPath }),
      });
      setCoverPhoto(photoPath);
      console.log('[FRONT][COVER][AFTER SETSTATE]', photoPath);
    } catch (e) {
      console.error('Error setting cover photo:', e);
    }
  };

  const handleTogglePdfSelection = async (category: PhotoCategory, photoId: number) => {
    console.log('[FRONT][PDF][BEFORE]', { category, photoId, selectedBeforePhotosForPdf, selected3dPhotosForPdf });
    if (!(category === 'before' || category === '3d')) return;
    let updated: number[];
    if (category === 'before') {
      updated = selectedBeforePhotosForPdf.includes(photoId)
        ? selectedBeforePhotosForPdf.filter(id => id !== photoId)
        : [...selectedBeforePhotosForPdf, photoId];
      setSelectedBeforePhotosForPdf(updated);
      console.log('[FRONT][PDF][AFTER SETSTATE before]', updated);
    } else {
      updated = selected3dPhotosForPdf.includes(photoId)
        ? selected3dPhotosForPdf.filter(id => id !== photoId)
        : [...selected3dPhotosForPdf, photoId];
      setSelected3dPhotosForPdf(updated);
      console.log('[FRONT][PDF][AFTER SETSTATE 3d]', updated);
    }
    const payload = category === 'before'
      ? { selectedBeforePhotosForPdf: updated }
      : { selected3dPhotosForPdf: updated };
    console.log('[FRONT][PDF][API PAYLOAD]', payload);
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/photos/project/${projectId}/selected-for-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log('[FRONT][PDF][API RESPONSE]', data);
    } catch (e) {
      setError('Erreur lors de la sélection PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>Gestion des photos du projet</h3>
        <Button 
          variant="outline-secondary" 
          size="sm"
          onClick={handleSortToggle}
        >
          Trier {sortOrder === 'asc' ? '↑' : '↓'}
        </Button>
      </div>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <div className="text-center"><Spinner animation="border" /></div>}
      
      <Row>
        {categories.map(cat => (
          <Col md={6} key={cat.key} className="mb-4">
            <Card className="h-100 shadow-sm">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div>
                  <Card.Title className="mb-0">{cat.label}</Card.Title>
                  <Badge bg="secondary" className="ms-2">
                    {(photos[cat.key as PhotoCategory] || []).length} photos
                  </Badge>
                </div>
                <Form.Control
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  multiple
                  onChange={(e) => handleUpload(e as React.ChangeEvent<HTMLInputElement>, cat.key)}
                  style={{ display: 'none' }}
                  id={`file-upload-${cat.key}`}
                />
                <label htmlFor={`file-upload-${cat.key}`}>
                  <Button 
                    as="span" 
                    variant="primary" 
                    size="sm"
                    disabled={!!uploading}
                    className="d-flex align-items-center gap-2"
                  >
                    <FaUpload />
                    {uploading === cat.key ? 'Upload...' : 'Ajouter des photos'}
                  </Button>
                </label>
              </Card.Header>
              <Card.Body>
                <div className="mt-3 d-flex flex-wrap gap-3">
                  {sortedPhotos(photos, cat.key as PhotoCategory, sortOrder).map((photo: Photo) => {
                    const normalizedPath = normalizePath(photo.url);
                    const isSelected = cat.key === 'before'
                      ? selectedBeforePhotosForPdf.includes(photo.id)
                      : cat.key === '3d'
                        ? selected3dPhotosForPdf.includes(photo.id)
                        : false;
                    


                    return (
                      <div key={normalizedPath} className="photo-thumbnail">
                        <div className={`photo-container ${coverPhoto === normalizedPath ? 'selected-cover' : ''} ${isSelected ? 'selected-for-pdf' : ''}`}>
                          <Image
                            src={`${API_BASE_URL}${normalizedPath}`}
                            alt="photo"
                            fill
                            sizes="150px"
                            className="photo-image"
                            style={{ objectFit: 'cover' }}
                            onClick={() => window.open(`${API_BASE_URL}${normalizedPath}`, '_blank')}
                          />
                        </div>
                        <div className="photo-actions">
                          <Button
                            size="sm"
                            variant="link"
                            className="action-btn delete-btn"
                            onClick={() => handleDelete(cat.key, photo.id)}
                            title="Supprimer"
                          >
                            <FaTrash size={14} />
                          </Button>
                          {cat.canSelectForPdf && (
                            <div 
                              className={`pdf-selector ${isSelected ? 'selected' : ''}`}
                              onClick={() => !loading && handleTogglePdfSelection(cat.key as PhotoCategory, photo.id)}
                              title="Sélectionner pour le PDF"
                              style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.5 : 1 }}
                            >
                              <Form.Check
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                label=""
                                disabled={loading}
                              />
                            </div>
                          )}
                          <div className="bottom-actions">
                            <Button
                              size="sm"
                              variant="link"
                              className={`action-btn cover-btn ${coverPhoto === normalizedPath ? 'active' : ''}`}
                              onClick={() => handleSetCover(normalizedPath)}
                              title={coverPhoto === normalizedPath ? "Photo de couverture actuelle" : "Définir comme photo de couverture"}
                            >
                              <FaStar size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="link"
                              className="action-btn download-btn"
                              onClick={() => handleDownload(`${API_BASE_URL}${normalizedPath}`)}
                              title="Télécharger"
                            >
                              <FaDownload size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <style jsx>{`
        .photo-thumbnail {
          position: relative;
          width: 150px;
          height: 150px;
          margin-bottom: 1rem;
        }

        .photo-container {
          width: 100%;
          height: 100%;
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s ease;
          cursor: pointer;
          background-color: #f0f0f0;
        }

        .photo-container:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .photo-container :global(.photo-image) {
          transition: all 0.3s ease;
        }

        .selected-cover {
          border: 3px solid #ffc107;
          box-shadow: 0 0 10px rgba(255, 193, 7, 0.5);
        }

        .photo-actions {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 4px;
          opacity: 0;
          transition: opacity 0.2s ease;
          background: linear-gradient(180deg, 
            rgba(0,0,0,0.4) 0%, 
            rgba(0,0,0,0) 20%,
            rgba(0,0,0,0) 80%,
            rgba(0,0,0,0.4) 100%
          );
        }

        .photo-thumbnail:hover .photo-actions {
          opacity: 1;
        }

        .action-btn {
          width: 28px;
          height: 28px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white !important;
          opacity: 0.9;
          transition: all 0.2s ease;
          background: rgba(0, 0, 0, 0.5) !important;
          border-radius: 4px;
        }

        .action-btn:hover {
          opacity: 1;
          color: white !important;
          background: rgba(0, 0, 0, 0.7) !important;
        }

        .action-btn.active {
          color: #ffc107 !important;
          background: rgba(0, 0, 0, 0.7) !important;
        }

        .delete-btn {
          position: absolute;
          top: 8px;
          right: 8px;
        }

        .bottom-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 8px;
          margin-top: auto;
        }

        .pdf-selector {
          position: absolute;
          bottom: 8px;
          left: 8px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          border-radius: 4px;
          padding: 2px;
          border: 2px solid rgba(255, 255, 255, 0.5);
          transition: all 0.2s ease;
        }

        .pdf-selector :global(input[type="checkbox"]) {
          margin: 0;
          cursor: pointer;
          width: 18px;
          height: 18px;
          border: 2px solid white;
          background-color: transparent;
          appearance: none;
          -webkit-appearance: none;
          border-radius: 3px;
        }

        .pdf-selector :global(.form-check) {
          margin: 0;
          padding: 0;
          min-height: auto;
        }

        .pdf-selector.selected {
          background: rgba(40, 167, 69, 0.8);
          border-color: #28a745;
        }

        .pdf-selector.selected :global(input[type="checkbox"]) {
          border-color: white;
          background-color: white;
          position: relative;
        }

        .pdf-selector.selected :global(input[type="checkbox"])::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #28a745;
          font-size: 12px;
          font-weight: bold;
        }

        .pdf-selector:hover {
          background: rgba(0, 0, 0, 0.9);
          transform: scale(1.1);
        }

        .pdf-selector.selected:hover {
          background: rgba(40, 167, 69, 0.9);
        }

        .photo-container.selected-for-pdf {
          box-shadow: 0 0 0 3px #28a745;
        }
      `}</style>
    </div>
  );
} 