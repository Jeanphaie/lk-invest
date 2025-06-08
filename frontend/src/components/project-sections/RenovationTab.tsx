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

const RenovationTab: React.FC<RenovationTabProps> = ({ project, handleUpdateProject }): JSX.Element => {
  const [inputs, setInputs] = useState<RenovationBienInputs>(project.inputsRenovationBien || DEFAULT_VALUES);
  const [localInputs, setLocalInputs] = useState<RenovationBienInputs>(inputs);

  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isEditing3D, setIsEditing3D] = useState(false);
  const [isHtmlPlan, setIsHtmlPlan] = useState(false);
  const [isHtml3D, setIsHtml3D] = useState(false);

  useEffect(() => {
    // Synchroniser seulement si la prop a changé (deep compare)
    if (JSON.stringify(project.inputsRenovationBien || DEFAULT_VALUES) !== JSON.stringify(localInputs)) {
      setLocalInputs(project.inputsRenovationBien || DEFAULT_VALUES);
    }
    setInputs(project.inputsRenovationBien || DEFAULT_VALUES);
  }, [project.inputsRenovationBien]);

  // Calcul de la surface pondérée avant travaux
  const surfacePondereAvant = Math.round(
    (project.inputsGeneral?.superficie || 0) + 
    ((project.inputsGeneral?.superficie_terrasse || 0) * (project.inputsGeneral?.ponderation_terrasse || 0))
  );

  // Calcul de la surface pondérée après travaux
  const surfacePondereApres = Math.round(
    localInputs.superficie_apres + (localInputs.superficie_exterieur_apres * (project.inputsGeneral?.ponderation_terrasse || 0))
  );

  // Calcul de la date de fin
  const dateFin = localInputs.date_debut && localInputs.duree_mois 
    ? new Date(new Date(localInputs.date_debut).setMonth(new Date(localInputs.date_debut).getMonth() + localInputs.duree_mois))
    : null;

  // Fonction utilitaire pour parser les nombres
  function parseInputNumber(value: string | number): number {
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  // Fonction utilitaire pour l'affichage des champs numériques
  function safeNumberInputValue(val: any) {
    return (val === undefined || val === null || Number.isNaN(val)) ? '' : val;
  }

  const handleInputChange = (field: string, value: number | string) => {
    // Mise à jour uniquement de l'état local
    setLocalInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInputBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const inputField = e.target.name as keyof RenovationBienInputs;
    const value = parseInputNumber(e.target.value);
    
    // Mise à jour de l'état local avec la valeur parsée
    const updatedInputs = {
      ...localInputs,
      [inputField]: value
    };
    setLocalInputs(updatedInputs);
    
    // Envoi au backend
    await handleUpdateProject({ ...project, inputsRenovationBien: updatedInputs });
  };

  const handleTextareaBlur = async (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const textareaField = e.target.name as keyof RenovationBienInputs;
    const value = e.target.value;
    const updatedInputs = {
      ...localInputs,
      [textareaField]: value
    };
    setLocalInputs(updatedInputs);
    await handleUpdateProject({ ...project, inputsRenovationBien: updatedInputs });
  };

  const handleDivBlur = async (e: React.FocusEvent<HTMLDivElement>, field: keyof RenovationBienInputs) => {
    const value = e.currentTarget.innerHTML;
    const updatedInputs = {
      ...localInputs,
      [field]: value
    };
    setLocalInputs(updatedInputs);
    await handleUpdateProject({ ...project, inputsRenovationBien: updatedInputs });
  };

  return (
    <div className={styles.container}>
      {/* Bloc 1: Avant travaux */}
      <div className={styles.beforeWorks}>
        <div className={styles.sectionHeader}>
          <span className={styles.icon}>🏠</span>
          <h3>Avant travaux</h3>
        </div>
        <div className={styles.formGrid}>
          <div>
            <label className={styles['form-label']}>Surface principale</label>
            <div>{project.inputsGeneral?.superficie || 0} m²</div>
          </div>
          <div>
            <label className={styles['form-label']}>Surface extérieure</label>
            <div>{project.inputsGeneral?.superficie_terrasse || 0} m²</div>
          </div>
          <div>
            <label className={styles['form-label']}>Nombre de pièces</label>
            <div>{project.inputsDescriptionBien?.nombre_pieces || 0}</div>
          </div>
          <div>
            <label className={styles['form-label']}>Surface pondérée</label>
            <div className={styles.valueHighlight}>{surfacePondereAvant} m²</div>
          </div>
        </div>
      </div>

      {/* Bloc 2: Après travaux */}
      <div className={styles.afterWorks}>
        <div className={styles.sectionHeader}>
          <span className={styles.icon}>🛠️</span>
          <h3>Après travaux</h3>
        </div>
        <div className={styles.formGrid}>
          <div>
            <label className={styles['form-label']}>Surface principale</label>
            <input
              className={styles['form-control']}
              type="number"
              name="superficie_apres"
              value={safeNumberInputValue(localInputs.superficie_apres)}
              onChange={e => handleInputChange('superficie_apres', e.target.value)}
              onBlur={handleInputBlur}
            />
          </div>
          <div>
            <label className={styles['form-label']}>Surface extérieure</label>
            <input
              className={styles['form-control']}
              type="number"
              name="superficie_exterieur_apres"
              value={safeNumberInputValue(localInputs.superficie_exterieur_apres)}
              onChange={e => handleInputChange('superficie_exterieur_apres', e.target.value)}
              onBlur={handleInputBlur}
            />
          </div>
          <div>
            <label className={styles['form-label']}>Nombre de pièces</label>
            <input
              className={styles['form-control']}
              type="number"
              name="nombre_pieces_apres"
              value={safeNumberInputValue(localInputs.nombre_pieces_apres)}
              onChange={e => handleInputChange('nombre_pieces_apres', e.target.value)}
              onBlur={handleInputBlur}
            />
          </div>
          <div>
            <label className={styles['form-label']}>Surface pondérée</label>
            <div className={styles.valueHighlight}>{surfacePondereApres} m²</div>
          </div>
        </div>
      </div>

      {/* Bloc 3: Calendrier */}
      <div className={styles.calendar}>
        <div className={styles.sectionHeader}>
          <span className={styles.icon}>📅</span>
          <h3>Calendrier</h3>
        </div>
        <div className={styles.formGrid}>
          <div>
            <label className={styles['form-label']}>Date de début</label>
            <input
              className={styles['form-control']}
              type="date"
              name="date_debut"
              value={localInputs.date_debut}
              onChange={e => handleInputChange('date_debut', e.target.value)}
              onBlur={handleInputBlur}
            />
          </div>
          <div>
            <label className={styles['form-label']}>Durée (mois)</label>
            <input
              className={styles['form-control']}
              type="number"
              name="duree_mois"
              value={safeNumberInputValue(localInputs.duree_mois)}
              onChange={e => handleInputChange('duree_mois', e.target.value)}
              onBlur={handleInputBlur}
            />
          </div>
          <div>
            <label className={styles['form-label']}>Date de fin</label>
            <div className={styles.valueHighlight}>{dateFin ? dateFin.toLocaleDateString('fr-FR') : '-'}</div>
          </div>
        </div>
      </div>

      {/* Bloc 4: Plan de rénovation */}
      <div className={styles.afterWorks}>
        <div className={styles.sectionHeader}>
          <span className={styles.icon}>📐</span>
          <h3>Plan de rénovation</h3>
        </div>
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
                onBlur={(e) => handleDivBlur(e, 'plan_renovation')}
                dangerouslySetInnerHTML={{ __html: localInputs.plan_renovation || '' }}
              />
            ) : (
              <textarea
                name="plan_renovation"
                value={localInputs.plan_renovation || ''}
                onChange={e => handleInputChange('plan_renovation', e.target.value)}
                onBlur={handleTextareaBlur}
                className={styles['form-control']}
                rows={4}
              />
            )}
          </div>
        ) : (
          <div className={styles.previewContainer}>
            {isHtmlPlan ? (
              <div dangerouslySetInnerHTML={{ __html: localInputs.plan_renovation || '' }} />
            ) : (
              <div className={styles.textContent}>{localInputs.plan_renovation}</div>
            )}
          </div>
        )}
      </div>

      {/* Bloc 5: Explication 3D */}
      <div className={styles.afterWorks}>
        <div className={styles.sectionHeader}>
          <span className={styles.icon}>🧩</span>
          <h3>Explication 3D</h3>
        </div>
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
                onBlur={(e) => handleDivBlur(e, 'explication_3d')}
                dangerouslySetInnerHTML={{ __html: localInputs.explication_3d || '' }}
              />
            ) : (
              <textarea
                name="explication_3d"
                value={localInputs.explication_3d || ''}
                onChange={e => handleInputChange('explication_3d', e.target.value)}
                onBlur={handleTextareaBlur}
                className={styles['form-control']}
                rows={4}
              />
            )}
          </div>
        ) : (
          <div className={styles.previewContainer}>
            {isHtml3D ? (
              <div dangerouslySetInnerHTML={{ __html: localInputs.explication_3d || '' }} />
            ) : (
              <div className={styles.textContent}>{localInputs.explication_3d}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RenovationTab;