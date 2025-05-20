import React, { FC, useState, useEffect, ChangeEvent } from 'react';
import { Card, Form, Row, Col } from 'react-bootstrap';
import { Project } from '../../../../shared/types/project';
import { RenovationBienInputs } from '../../../../shared/types/renovationBienInputs';
import { RenovationBienResults } from '../../../../shared/types/renovationBienResults';
import styles from '../../styles/modules/tabs/RenovationTab.module.css';

interface RenovationTabProps {
  project: Project;
  handleUpdateProject: (project: Project) => void;
}

const DEFAULT_VALUES: RenovationBienInputs = {
  superficie_apres: 50,
  superficie_exterieur_apres: 0,
  nombre_pieces_apres: 3,
  date_debut: new Date().toISOString().split('T')[0],
  duree_mois: 6,
  plan_renovation: '',
  explication_3d: ''
};

const RenovationTab: FC<RenovationTabProps> = ({ project, handleUpdateProject }) => {
  const [inputs, setInputs] = useState<RenovationBienInputs>(
    project.inputsRenovationBien || DEFAULT_VALUES
  );

  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isEditing3D, setIsEditing3D] = useState(false);
  const [isHtmlPlan, setIsHtmlPlan] = useState(false);
  const [isHtml3D, setIsHtml3D] = useState(false);

  // Calcul de la surface pondérée avant travaux
  const surfacePondereAvant = Math.round(
    (project.inputsGeneral?.superficie || 0) + 
    ((project.inputsGeneral?.superficie_terrasse || 0) * (project.inputsGeneral?.ponderation_terrasse || 0))
  );

  // Calcul de la surface pondérée après travaux
  const surfacePondereApres = Math.round(
    inputs.superficie_apres + (inputs.superficie_exterieur_apres * (project.inputsGeneral?.ponderation_terrasse || 0))
  );

  // Calcul de la date de fin
  const dateFin = inputs.date_debut && inputs.duree_mois 
    ? new Date(new Date(inputs.date_debut).setMonth(new Date(inputs.date_debut).getMonth() + inputs.duree_mois))
    : null;

  const handleInputChange = (field: keyof RenovationBienInputs, value: any) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBlur = async () => {
    try {
      const response = await fetch(`/api/renovation/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputs),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la sauvegarde');
      }

      const updatedProject = await response.json();
      setInputs(updatedProject.inputsRenovationBien || {});
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      // Vous pouvez ajouter ici une notification d'erreur si vous le souhaitez
    }
  };

  const handleSave = async () => {
    try {
      const updatedProject = {
        ...project,
        inputsRenovationBien: inputs
      };
      await handleUpdateProject(updatedProject);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  return (
    <div className={styles.renovationTab}>
      {/* Bloc 1: Avant travaux */}
      <Card className={styles.section}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Avant travaux</h2>
        </div>
        <Card.Body className={styles.cardBody}>
          <Row>
            <Col md={3}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Surface principale</Form.Label>
                <div className={styles.value}>{project.inputsGeneral?.superficie || 0} m²</div>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Surface extérieure</Form.Label>
                <div className={styles.value}>{project.inputsGeneral?.superficie_terrasse || 0} m²</div>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Nombre de pièces</Form.Label>
                <div className={styles.value}>{project.inputsDescriptionBien?.nombre_pieces || 0}</div>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Surface pondérée</Form.Label>
                <div className={styles.valueHighlight}>{surfacePondereAvant} m²</div>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Bloc 2: Après travaux */}
      <Card className={styles.section}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Après travaux</h2>
        </div>
        <Card.Body className={styles.cardBody}>
          <Row>
            <Col md={3}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Surface principale</Form.Label>
                <Form.Control
                  className={styles.input}
                  type="number"
                  name="superficie_apres"
                  value={inputs.superficie_apres}
                  onChange={(e) => handleInputChange('superficie_apres', parseFloat(e.target.value))}
                  onBlur={handleBlur}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Surface extérieure</Form.Label>
                <Form.Control
                  className={styles.input}
                  type="number"
                  name="superficie_exterieur_apres"
                  value={inputs.superficie_exterieur_apres}
                  onChange={(e) => handleInputChange('superficie_exterieur_apres', parseFloat(e.target.value))}
                  onBlur={handleBlur}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Nombre de pièces</Form.Label>
                <Form.Control
                  className={styles.input}
                  type="number"
                  name="nombre_pieces_apres"
                  value={inputs.nombre_pieces_apres}
                  onChange={(e) => handleInputChange('nombre_pieces_apres', parseInt(e.target.value))}
                  onBlur={handleBlur}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Surface pondérée</Form.Label>
                <div className={styles.valueHighlight}>{surfacePondereApres} m²</div>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Bloc 3: Calendrier */}
      <Card className={styles.section}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Calendrier</h2>
        </div>
        <Card.Body className={styles.cardBody}>
          <Row>
            <Col md={4}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Date de début</Form.Label>
                <Form.Control
                  className={styles.input}
                  type="date"
                  name="date_debut"
                  value={inputs.date_debut}
                  onChange={(e) => handleInputChange('date_debut', e.target.value)}
                  onBlur={handleBlur}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Durée (mois)</Form.Label>
                <Form.Control
                  className={styles.input}
                  type="number"
                  name="duree_mois"
                  value={inputs.duree_mois}
                  onChange={(e) => handleInputChange('duree_mois', parseInt(e.target.value))}
                  onBlur={handleBlur}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className={styles.formGroup}>
                <Form.Label className={styles.label}>Date de fin</Form.Label>
                <div className={styles.valueHighlight}>
                  {dateFin ? dateFin.toLocaleDateString('fr-FR') : '-'}
                </div>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Bloc 4: Plan de rénovation */}
      <Card className={styles.section}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Plan de rénovation</h2>
        </div>
        <Card.Body className={styles.cardBody}>
          <div className={styles.toggleContainer}>
            <div className={styles.toggle}>
              <input
                type="checkbox"
                id="toggle-plan"
                checked={isEditingPlan}
                onChange={() => setIsEditingPlan(!isEditingPlan)}
                className={styles.toggleInput}
              />
              <label
                htmlFor="toggle-plan"
                className={`${styles.toggleSlider} ${isEditingPlan ? styles.toggleSliderActive : ''}`}
              />
            </div>
            <span className={styles.toggleLabel}>Mode édition</span>
            
            {isEditingPlan && (
              <>
                <div className={styles.toggle}>
                  <input
                    type="checkbox"
                    id="toggle-html-plan"
                    checked={isHtmlPlan}
                    onChange={() => setIsHtmlPlan(!isHtmlPlan)}
                    className={styles.toggleInput}
                  />
                  <label
                    htmlFor="toggle-html-plan"
                    className={`${styles.toggleSlider} ${isHtmlPlan ? styles.toggleSliderActive : ''}`}
                  />
                </div>
                <span className={styles.toggleLabel}>Mode HTML</span>
              </>
            )}
          </div>

          {isEditingPlan ? (
            <div className={styles.editorContainer}>
              <div className={styles.toolbar}>
                <button
                  onClick={() => setIsHtmlPlan(!isHtmlPlan)}
                  className={styles.toggleButton}
                >
                  {isHtmlPlan ? 'Mode Texte' : 'Mode HTML'}
                </button>
              </div>
              {isHtmlPlan ? (
                <div
                  contentEditable
                  className={styles.htmlEditor}
                  onBlur={(e) => {
                    handleInputChange('plan_renovation', e.currentTarget.innerHTML);
                    handleBlur();
                  }}
                  dangerouslySetInnerHTML={{ __html: inputs.plan_renovation || '' }}
                />
              ) : (
                <textarea
                  className={styles.textEditor}
                  value={inputs.plan_renovation || ''}
                  onChange={(e) => handleInputChange('plan_renovation', e.target.value)}
                  onBlur={handleBlur}
                  placeholder="Décrivez le plan de rénovation..."
                />
              )}
            </div>
          ) : (
            <div className={styles.previewContainer}>
              {isHtmlPlan ? (
                <div dangerouslySetInnerHTML={{ __html: inputs.plan_renovation || '' }} />
              ) : (
                <div className={styles.textContent}>{inputs.plan_renovation}</div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Bloc 5: Explication 3D */}
      <Card className={styles.section}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Explication 3D</h2>
        </div>
        <Card.Body className={styles.cardBody}>
          <div className={styles.toggleContainer}>
            <div className={styles.toggle}>
              <input
                type="checkbox"
                id="toggle-3d"
                checked={isEditing3D}
                onChange={() => setIsEditing3D(!isEditing3D)}
                className={styles.toggleInput}
              />
              <label
                htmlFor="toggle-3d"
                className={`${styles.toggleSlider} ${isEditing3D ? styles.toggleSliderActive : ''}`}
              />
            </div>
            <span className={styles.toggleLabel}>Mode édition</span>
            
            {isEditing3D && (
              <>
                <div className={styles.toggle}>
                  <input
                    type="checkbox"
                    id="toggle-html-3d"
                    checked={isHtml3D}
                    onChange={() => setIsHtml3D(!isHtml3D)}
                    className={styles.toggleInput}
                  />
                  <label
                    htmlFor="toggle-html-3d"
                    className={`${styles.toggleSlider} ${isHtml3D ? styles.toggleSliderActive : ''}`}
                  />
                </div>
                <span className={styles.toggleLabel}>Mode HTML</span>
              </>
            )}
          </div>

          {isEditing3D ? (
            <div className={styles.editorContainer}>
              <div className={styles.toolbar}>
                <button
                  onClick={() => setIsHtml3D(!isHtml3D)}
                  className={styles.toggleButton}
                >
                  {isHtml3D ? 'Mode Texte' : 'Mode HTML'}
                </button>
              </div>
              {isHtml3D ? (
                <div
                  contentEditable
                  className={styles.htmlEditor}
                  onBlur={(e) => {
                    handleInputChange('explication_3d', e.currentTarget.innerHTML);
                    handleBlur();
                  }}
                  dangerouslySetInnerHTML={{ __html: inputs.explication_3d || '' }}
                />
              ) : (
                <textarea
                  className={styles.textEditor}
                  value={inputs.explication_3d || ''}
                  onChange={(e) => handleInputChange('explication_3d', e.target.value)}
                  onBlur={handleBlur}
                  placeholder="Décrivez l'explication 3D..."
                />
              )}
            </div>
          ) : (
            <div className={styles.previewContainer}>
              {isHtml3D ? (
                <div dangerouslySetInnerHTML={{ __html: inputs.explication_3d || '' }} />
              ) : (
                <div className={styles.textContent}>{inputs.explication_3d}</div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      <button onClick={handleSave} className={styles.saveButton}>
        Enregistrer
      </button>
    </div>
  );
};

export default RenovationTab;