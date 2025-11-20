import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Form, Row, Col, Alert, Spinner } from 'react-bootstrap';
import Image from 'next/image';
import axios from 'axios';
import { FaUpload, FaTrash, FaCheck, FaFilePdf, FaPlus, FaMinus, FaDownload } from 'react-icons/fa';
import { Photos, PlanPhoto, PlansStructure } from '../../../../shared/types/photos';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://163.172.32.45:3001';

interface PlansSectionProps {
  projectId: string;
  photos: Photos;
  selectedPlansPhotosForPdf: number[];
  onUpload: (files: FileList, planType: 'before' | 'after', floor: 1 | 2) => Promise<void>;
  onDelete: (planType: 'before' | 'after', floor: 1 | 2, photoId: number) => Promise<void>;
  onTogglePdfSelection: (photoId: number) => Promise<void>;
  onDownload: (photoUrl: string) => void;
  onDescriptionUpdate?: () => Promise<void>; // Callback pour rafraîchir les données après mise à jour
  loading: boolean;
  uploading: string | null;
}

// Fonction utilitaire pour normaliser les chemins
const normalizePath = (path: string) => {
  return path.startsWith('/uploads/') ? path : `/uploads/${path}`;
};

// Fonction utilitaire pour détecter si un fichier est un PDF
const isPdfFile = (url: string): boolean => {
  return url.toLowerCase().endsWith('.pdf');
};

// Fonction pour obtenir le label d'un étage
const getFloorLabel = (floor: 1 | 2): string => {
  return floor === 1 ? '1er niveau' : '2ème niveau';
};

export default function PlansSection({
  projectId,
  photos,
  selectedPlansPhotosForPdf,
  onUpload,
  onDelete,
  onTogglePdfSelection,
  onDownload,
  onDescriptionUpdate,
  loading,
  uploading
}: PlansSectionProps) {
  // Récupérer la structure des plans (avec fallback sur plans si plansStructured n'existe pas)
  // Si plansStructured existe, l'utiliser directement
  // Sinon, créer une structure temporaire depuis plans pour l'affichage
  let plansStructure: PlansStructure | undefined = photos.plansStructured;
  
  if (!plansStructure && photos.plans && photos.plans.length > 0) {
    // Migration temporaire côté frontend pour l'affichage
    // Tous les plans existants sont considérés comme "before" par défaut, étage 1
    plansStructure = {
      before: {
        floor1: photos.plans.map((p: any) => ({
          ...p,
          floor: p.floor || 1,
          floorLabel: p.floorLabel || (p.floor === 2 ? '2ème niveau' : '1er niveau'),
          planType: p.planType || 'before' as const
        })),
        floor2: photos.plans.filter((p: any) => p.floor === 2).map((p: any) => ({
          ...p,
          floor: 2,
          floorLabel: '2ème niveau',
          planType: p.planType || 'before' as const
        }))
      },
      after: {
        floor1: [],
        floor2: []
      }
    };
    // Filtrer floor1 pour exclure ceux qui sont floor2
    if (plansStructure.before?.floor1) {
      plansStructure.before.floor1 = plansStructure.before.floor1.filter((p: any) => p.floor !== 2);
    }
  }
  
  if (!plansStructure) {
    plansStructure = {
      before: { floor1: [], floor2: [] },
      after: { floor1: [], floor2: [] }
    };
  }

  // Initialiser les sections ouvertes en fonction du contenu
  const hasBeforeFloor1 = (plansStructure.before?.floor1?.length || 0) > 0;
  const hasBeforeFloor2 = (plansStructure.before?.floor2?.length || 0) > 0;
  const hasAfterFloor1 = (plansStructure.after?.floor1?.length || 0) > 0;
  const hasAfterFloor2 = (plansStructure.after?.floor2?.length || 0) > 0;

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'before-floor1': hasBeforeFloor1,
    'before-floor2': hasBeforeFloor2,
    'after-floor1': hasAfterFloor1,
    'after-floor2': hasAfterFloor2,
    'descriptions': true // Toujours ouvert
  });
  const [floor1Description, setFloor1Description] = useState<string>(photos.floor1Description || '');
  const [floor2Description, setFloor2Description] = useState<string>(photos.floor2Description || '');
  const [floor1Prompt, setFloor1Prompt] = useState<string>(photos.floor1Prompt || '');
  const [floor2Prompt, setFloor2Prompt] = useState<string>(photos.floor2Prompt || '');
  const [generatingDescription, setGeneratingDescription] = useState<1 | 2 | null>(null);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Mettre à jour les descriptions et prompts locaux quand photos change
  useEffect(() => {
    console.log('[PlansSection] Updating descriptions/prompts from photos:', {
      floor1Description: photos.floor1Description,
      floor2Description: photos.floor2Description,
      floor1Prompt: photos.floor1Prompt,
      floor2Prompt: photos.floor2Prompt
    });
    setFloor1Description(photos.floor1Description || '');
    setFloor2Description(photos.floor2Description || '');
    setFloor1Prompt(photos.floor1Prompt || '');
    setFloor2Prompt(photos.floor2Prompt || '');
  }, [photos.floor1Description, photos.floor2Description, photos.floor1Prompt, photos.floor2Prompt]);

  // Mettre à jour les sections ouvertes quand le contenu change
  useEffect(() => {
    const hasBeforeFloor1 = (plansStructure.before?.floor1?.length || 0) > 0;
    const hasBeforeFloor2 = (plansStructure.before?.floor2?.length || 0) > 0;
    const hasAfterFloor1 = (plansStructure.after?.floor1?.length || 0) > 0;
    const hasAfterFloor2 = (plansStructure.after?.floor2?.length || 0) > 0;

    setExpandedSections(prev => ({
      ...prev,
      'before-floor1': hasBeforeFloor1 || prev['before-floor1'],
      'before-floor2': hasBeforeFloor2 || prev['before-floor2'],
      'after-floor1': hasAfterFloor1 || prev['after-floor1'],
      'after-floor2': hasAfterFloor2 || prev['after-floor2'],
      'descriptions': true // Toujours ouvert
    }));
  }, [plansStructure.before?.floor1?.length, plansStructure.before?.floor2?.length, plansStructure.after?.floor1?.length, plansStructure.after?.floor2?.length]);

  const handleDescriptionBlur = async (floor: 1 | 2) => {
    const description = floor === 1 ? floor1Description : floor2Description;
    const prompt = floor === 1 ? floor1Prompt : floor2Prompt;
    const descriptionField = floor === 1 ? 'floor1Description' : 'floor2Description';
    const promptField = floor === 1 ? 'floor1Prompt' : 'floor2Prompt';
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${projectId}/plans/description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [descriptionField]: description,
          [promptField]: prompt
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }

      // Rafraîchir les données
      if (onDescriptionUpdate) {
        await onDescriptionUpdate();
      }
    } catch (error) {
      console.error('Error saving description/prompt:', error);
      // Ne pas alerter l'utilisateur, juste logger l'erreur
    }
  };

  const handlePromptBlur = async (floor: 1 | 2) => {
    // Sauvegarder le prompt quand l'utilisateur quitte le champ
    await handleDescriptionBlur(floor);
  };

  const handleGenerateDescription = async (floor: 1 | 2) => {
    const prompt = floor === 1 ? floor1Prompt : floor2Prompt;
    
    if (!prompt || prompt.trim() === '') {
      alert('Veuillez saisir un prompt pour générer la description');
      return;
    }

    setGeneratingDescription(floor);
    try {
      const url = `${API_BASE_URL}/api/photos/${projectId}/plans/generate-description`;
      console.log('[PlansSection] Appel API vers:', url);
      console.log('[PlansSection] Prompt:', prompt.trim());
      console.log('[PlansSection] Floor:', floor);
      
      const response = await axios.post(url, {
        prompt: prompt.trim(),
        floor: floor
      });
      
      console.log('[PlansSection] Réponse API:', response.data);
      
      if (response.data && response.data.description) {
        const generatedDescription = response.data.description;

        // Remplacer la description avec le résultat généré
        if (floor === 1) {
          setFloor1Description(generatedDescription);
        } else {
          setFloor2Description(generatedDescription);
        }

        // Sauvegarder automatiquement
        const fieldName = floor === 1 ? 'floor1Description' : 'floor2Description';
        const saveResponse = await axios.post(`${API_BASE_URL}/api/photos/${projectId}/plans/description`, {
          [fieldName]: generatedDescription
        });

        if (saveResponse.status === 200 && onDescriptionUpdate) {
          await onDescriptionUpdate();
        }
      } else {
        throw new Error('Réponse invalide de l\'API');
      }
    } catch (error) {
      console.error('[PlansSection] Erreur détaillée lors de la génération de la description:', error);
      if (axios.isAxiosError(error)) {
        console.error('[PlansSection] Détails de l\'erreur Axios:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Erreur lors de la génération de la description';
        alert(`Erreur: ${errorMessage}`);
      } else {
        alert('Erreur lors de la génération de la description. Veuillez réessayer.');
      }
    } finally {
      setGeneratingDescription(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, planType: 'before' | 'after', floor: 1 | 2) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await onUpload(e.target.files, planType, floor);
    e.target.value = ''; // Reset input
  };

  const renderPlanPhoto = (photo: PlanPhoto, planType: 'before' | 'after', floor: 1 | 2) => {
    const normalizedPath = normalizePath(photo.url);
    // S'assurer que les IDs sont comparés comme des nombres
    const photoId = typeof photo.id === 'string' ? parseInt(photo.id, 10) : photo.id;
    const isSelected = selectedPlansPhotosForPdf.some(id => (typeof id === 'string' ? parseInt(id, 10) : id) === photoId);
    const isPdf = isPdfFile(photo.url);
    const fileUrl = `${API_BASE_URL}${normalizedPath}`;
    
    // Extraire le nom du fichier pour les routes API
    const filename = normalizedPath.split('/').pop() || '';

    return (
      <div key={`${photo.id}-${planType}-${floor}`} className="plan-photo-thumbnail">
        {/* Conteneur d'image avec frame fixe */}
        <div className={`plan-photo-container ${isSelected ? 'selected-for-pdf' : ''}`}>
          <div className="plan-frame">
            {isPdf ? (
              <div 
                className="pdf-preview-container"
                onClick={() => window.open(fileUrl, '_blank')}
                title="Cliquer pour ouvrir le PDF"
              >
                <iframe
                  src={`${API_BASE_URL}/api/photos/${projectId}/plans/view?filename=${encodeURIComponent(filename)}#page=1&zoom=50`}
                  className="pdf-iframe"
                  title="PDF Preview"
                  style={{
                    border: 'none',
                    pointerEvents: 'none'
                  }}
                  onError={(e) => {
                    console.error('Erreur chargement PDF iframe:', e);
                  }}
                />
                <div className="pdf-overlay">
                  <FaFilePdf size={20} />
                </div>
              </div>
            ) : (
              <div 
                className="image-wrapper"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(fileUrl, '_blank');
                }}
              >
                <img
                  src={fileUrl}
                  alt="plan"
                  className="photo-image"
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Barre d'outils en dessous de l'image - toujours visible */}
        <div className="plan-toolbar">
          <div className="plan-toolbar-left">
            {photo.planType && (
              <Badge bg={photo.planType === 'before' ? 'info' : 'success'} className="plan-type-badge">
                {photo.planType === 'before' ? 'Avant' : 'Après'}
              </Badge>
            )}
          </div>
          <div className="plan-toolbar-right">
            <Button
              size="sm"
              variant="outline-danger"
              className="toolbar-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(planType, floor, photo.id);
              }}
              title="Supprimer"
              disabled={loading}
            >
              <FaTrash size={12} />
            </Button>
            <Button
              size="sm"
              variant="outline-primary"
              className="toolbar-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(normalizedPath);
              }}
              title="Télécharger"
              disabled={loading}
            >
              <FaDownload size={12} />
            </Button>
            <div 
              className={`toolbar-pdf-selector ${isSelected ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!loading) {
                  // Utiliser photoId (normalisé) au lieu de photo.id
                  const photoId = typeof photo.id === 'string' ? parseInt(photo.id, 10) : photo.id;
                  console.log('[PlansSection] Toggling PDF selection for photo:', photoId, 'isSelected:', isSelected, 'selectedPlansPhotosForPdf:', selectedPlansPhotosForPdf);
                  onTogglePdfSelection(photoId);
                }
              }}
              title="Sélectionner pour le PDF"
              style={{ pointerEvents: loading ? 'none' : 'auto', opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              <Form.Check
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                label="PDF"
                disabled={loading}
                style={{ margin: 0, fontSize: '0.75rem', pointerEvents: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFloorSection = (planType: 'before' | 'after', floor: 1 | 2) => {
    const sectionKey = `${planType}-floor${floor}`;
    const isExpanded = expandedSections[sectionKey];
    const floorPlans = planType === 'before' 
      ? (plansStructure.before?.[`floor${floor}` as 'floor1' | 'floor2'] || [])
      : (plansStructure.after?.[`floor${floor}` as 'floor1' | 'floor2'] || []);
    const floorLabel = getFloorLabel(floor);
    const uploadKey = `upload-${planType}-${floor}`;
    const isUploading = uploading === `${planType}-${floor}`;

    return (
      <Card key={sectionKey} className="mb-3 shadow-sm">
        <Card.Header 
          className="d-flex justify-content-between align-items-center cursor-pointer"
          onClick={() => toggleSection(sectionKey)}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="link"
              size="sm"
              className="p-0 me-2"
              onClick={(e) => {
                e.stopPropagation();
                toggleSection(sectionKey);
              }}
            >
              {isExpanded ? <FaMinus /> : <FaPlus />}
            </Button>
            <strong>{floorLabel}</strong>
            <Badge bg="secondary">{floorPlans.length} plan{floorPlans.length > 1 ? 's' : ''}</Badge>
          </div>
          <Form.Control
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => handleFileUpload(e as React.ChangeEvent<HTMLInputElement>, planType, floor)}
            style={{ display: 'none' }}
            id={uploadKey}
            disabled={loading || !!uploading}
          />
          <label htmlFor={uploadKey}>
            <Button 
              as="span" 
              variant="primary" 
              size="sm"
              disabled={loading || !!uploading}
              className="d-flex align-items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <FaUpload />
              {isUploading ? 'Upload...' : 'Ajouter'}
            </Button>
          </label>
        </Card.Header>
        {isExpanded && (
          <Card.Body>
            {floorPlans.length === 0 ? (
              <Alert variant="info" className="mb-0">
                Aucun plan pour cet étage. Cliquez sur "Ajouter" pour en uploader.
              </Alert>
            ) : (
              <div className="d-flex flex-wrap gap-3">
                {floorPlans.map(photo => renderPlanPhoto(photo, planType, floor))}
              </div>
            )}
          </Card.Body>
        )}
      </Card>
    );
  };

  return (
      <Card className="h-100 shadow-sm">
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <Card.Title className="mb-0">📐 Plans du bien</Card.Title>
            <Badge bg="secondary" className="ms-2">
              {((plansStructure.before?.floor1?.length || 0) + 
                (plansStructure.before?.floor2?.length || 0) +
                (plansStructure.after?.floor1?.length || 0) + 
                (plansStructure.after?.floor2?.length || 0))} plan{((plansStructure.before?.floor1?.length || 0) + 
                (plansStructure.before?.floor2?.length || 0) +
                (plansStructure.after?.floor1?.length || 0) + 
                (plansStructure.after?.floor2?.length || 0)) > 1 ? 's' : ''}
            </Badge>
            {photos.plans && photos.plans.length > 0 && !photos.plansStructured && (
              <Badge bg="warning" className="ms-2" title="Cliquez pour migrer les plans existants">
                Migration nécessaire
              </Badge>
            )}
          </div>
          {photos.plans && photos.plans.length > 0 && !photos.plansStructured && (
            <Button
              variant="outline-warning"
              size="sm"
              onClick={async () => {
                try {
                  const response = await fetch(`${API_BASE_URL}/api/photos/${projectId}/plans/migrate`, {
                    method: 'POST'
                  });
                  if (response.ok) {
                    window.location.reload(); // Recharger pour voir les changements
                  } else {
                    alert('Erreur lors de la migration');
                  }
                } catch (error) {
                  console.error('Migration error:', error);
                  alert('Erreur lors de la migration');
                }
              }}
            >
              Migrer les plans existants
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {/* Section des descriptions par niveau - AU-DESSUS des plans - TOUJOURS OUVERTE */}
        <Card className="mb-4 shadow-sm">
          <Card.Header style={{ padding: '0.75rem 1rem' }}>
            <strong style={{ fontSize: '0.95rem' }}>📝 Descriptions des niveaux (pour le PDF)</strong>
          </Card.Header>
          <Card.Body>
              <Row>
                <Col md={6}>
                  {/* Prompt pour génération AI */}
                  <Form.Group className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <Form.Label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 0 }}>
                        Prompt AI - 1er niveau
                        <small className="text-muted ms-2" style={{ fontSize: '0.7rem', fontWeight: 400 }}>(Décrivez les travaux à réaliser)</small>
                      </Form.Label>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleGenerateDescription(1)}
                        disabled={loading || generatingDescription === 1 || !floor1Prompt.trim()}
                        style={{ 
                          minWidth: '80px',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.7rem',
                          whiteSpace: 'nowrap',
                          height: 'auto'
                        }}
                      >
                        {generatingDescription === 1 ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-1" style={{ width: '0.7rem', height: '0.7rem', borderWidth: '0.1rem' }} />
                            <span style={{ fontSize: '0.7rem' }}>...</span>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.7rem' }}>🤖 Générer</span>
                        )}
                      </Button>
                    </div>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={floor1Prompt}
                      onChange={(e) => setFloor1Prompt(e.target.value)}
                      onBlur={() => handlePromptBlur(1)}
                      placeholder="Ex: Refonte complète de la cuisine avec îlot central, rénovation de la salle de bain, ouverture de la pièce à vivre..."
                      disabled={loading || generatingDescription === 1}
                      style={{ fontSize: '0.8rem', width: '100%' }}
                    />
                  </Form.Group>
                  
                  {/* Description générée */}
                  <Form.Group className="mb-3">
                    <Form.Label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Description - 1er niveau
                      <small className="text-muted ms-2" style={{ fontSize: '0.7rem', fontWeight: 400 }}>(Affichée dans le PDF entre les plans avant/après)</small>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={8}
                      value={floor1Description}
                      onChange={(e) => setFloor1Description(e.target.value)}
                      onBlur={() => handleDescriptionBlur(1)}
                      placeholder="Décrivez les travaux prévus pour ce niveau..."
                      disabled={loading}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  {/* Prompt pour génération AI */}
                  <Form.Group className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <Form.Label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 0 }}>
                        Prompt AI - 2ème niveau
                        <small className="text-muted ms-2" style={{ fontSize: '0.7rem', fontWeight: 400 }}>(Décrivez les travaux à réaliser)</small>
                      </Form.Label>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleGenerateDescription(2)}
                        disabled={loading || generatingDescription === 2 || !floor2Prompt.trim()}
                        style={{ 
                          minWidth: '80px',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.7rem',
                          whiteSpace: 'nowrap',
                          height: 'auto'
                        }}
                      >
                        {generatingDescription === 2 ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-1" style={{ width: '0.7rem', height: '0.7rem', borderWidth: '0.1rem' }} />
                            <span style={{ fontSize: '0.7rem' }}>...</span>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.7rem' }}>🤖 Générer</span>
                        )}
                      </Button>
                    </div>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={floor2Prompt}
                      onChange={(e) => setFloor2Prompt(e.target.value)}
                      onBlur={() => handlePromptBlur(2)}
                      placeholder="Ex: Création de deux chambres avec dressing, aménagement d'un bureau, rénovation de la salle de bain..."
                      disabled={loading || generatingDescription === 2}
                      style={{ fontSize: '0.8rem', width: '100%' }}
                    />
                  </Form.Group>
                  
                  {/* Description générée */}
                  <Form.Group className="mb-3">
                    <Form.Label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Description - 2ème niveau
                      <small className="text-muted ms-2" style={{ fontSize: '0.7rem', fontWeight: 400 }}>(Affichée uniquement s'il y a des plans pour ce niveau)</small>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={8}
                      value={floor2Description}
                      onChange={(e) => setFloor2Description(e.target.value)}
                      onBlur={() => handleDescriptionBlur(2)}
                      placeholder="Décrivez les travaux prévus pour ce niveau..."
                      disabled={loading}
                      style={{ fontSize: '0.8rem' }}
                    />
                  </Form.Group>
                </Col>
              </Row>
          </Card.Body>
        </Card>
        
        <Row>
          <Col md={6}>
            <h5 className="mb-3 text-primary">AVANT</h5>
            {renderFloorSection('before', 1)}
            {renderFloorSection('before', 2)}
          </Col>
          <Col md={6}>
            <h5 className="mb-3 text-success">APRÈS</h5>
            {renderFloorSection('after', 1)}
            {renderFloorSection('after', 2)}
          </Col>
        </Row>
      </Card.Body>
      <style jsx>{`
        .plan-photo-thumbnail {
          position: relative;
          width: 150px;
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          isolation: isolate; /* Créer un nouveau contexte de stacking */
          z-index: 1;
        }

        .plan-photo-container {
          width: 100%;
          height: 150px;
          position: relative;
          border-radius: 8px 8px 0 0;
          overflow: hidden !important; /* Force le clipping */
          transition: all 0.3s ease;
          cursor: pointer;
          background-color: #fff;
          border: 2px solid #e0e0e0;
          border-bottom: none;
          z-index: 1; /* En dessous de la toolbar */
        }

        .plan-photo-container:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          border-color: #0d6efd;
        }

        .selected-for-pdf {
          border-color: #0d6efd;
          box-shadow: 0 0 10px rgba(13, 110, 253, 0.5);
        }

        /* Frame fixe pour contenir l'image/PDF - strictement limité */
        .plan-frame {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden !important; /* Force le clipping */
          background-color: #fff;
          z-index: 1; /* En dessous de tout */
          contain: layout style paint; /* Isolation CSS pour éviter les débordements */
        }

        .plan-frame .image-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
          pointer-events: auto;
          overflow: hidden;
          cursor: pointer;
        }

        .plan-frame .image-wrapper .photo-image {
          max-width: 100% !important;
          max-height: 100% !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
          background-color: #fff;
          display: block;
          pointer-events: auto;
        }

        .plan-frame .pdf-preview-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: #fff;
          overflow: hidden;
          z-index: 1;
          pointer-events: auto; /* Permettre les clics sur le PDF */
        }

        /* Barre d'outils en dessous - toujours visible et au-dessus */
        .plan-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          background-color: #f8f9fa;
          border: 2px solid #e0e0e0;
          border-top: none;
          border-radius: 0 0 8px 8px;
          min-height: 36px;
          gap: 8px;
          position: relative;
          z-index: 100 !important; /* Au-dessus de tout */
          margin-top: 0;
          flex-shrink: 0;
          pointer-events: auto !important; /* Toujours cliquable */
        }

        .plan-photo-container.selected-for-pdf + .plan-toolbar {
          border-color: #0d6efd;
        }

        .plan-toolbar-left {
          display: flex;
          align-items: center;
          flex: 1;
        }

        .plan-toolbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .toolbar-btn {
          padding: 2px 6px;
          font-size: 0.75rem;
          line-height: 1.2;
          border-width: 1px;
        }

        .toolbar-pdf-selector {
          padding: 2px 4px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid #dee2e6;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          z-index: 101 !important; /* Au-dessus de la toolbar */
          pointer-events: auto !important; /* Toujours cliquable */
        }

        .toolbar-pdf-selector:hover {
          background: rgba(13, 110, 253, 0.1);
          border-color: #0d6efd;
        }

        .toolbar-pdf-selector.selected {
          background: rgba(13, 110, 253, 0.9);
          border-color: #0d6efd;
          color: white;
        }

        .toolbar-pdf-selector.selected :global(label) {
          color: white;
        }

        .plan-type-badge {
          font-size: 0.7rem;
          padding: 2px 6px;
        }

        .pdf-preview-container {
          width: 100%;
          height: 100%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pdf-iframe {
          width: 100%;
          height: 100%;
        }

        .pdf-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 8px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cursor-pointer {
          cursor: pointer;
        }
      `}</style>
    </Card>
  );
}

