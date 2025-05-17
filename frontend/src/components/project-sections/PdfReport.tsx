"use client";

import { useState } from 'react';
import styles from '../../styles/components/PdfReport.module.css';
import { Project } from '../../../../shared/types/project';
import { 
  PdfDynamicFields, 
  PdfSections, 
  DEFAULT_PDF_DYNAMIC_FIELDS,
  PdfConfigSchema,
  PdfDataSchema
} from '../../../../shared/types/pdf';

interface PdfReportProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
}

export default function PdfReport({ project, onUpdate }: PdfReportProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialisation des sections avec les valeurs par défaut ou celles du projet
  const [sections, setSections] = useState<PdfSections>(() => {
    const defaultSections = {
      cover: true,
      summary: true,
      property: true,
      valuation_lk: true,
      valuation_casa: true,
      financial: true
    };
    return project.pdfConfig?.sections || defaultSections;
  });

  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Initialisation des champs dynamiques avec les valeurs par défaut ou celles du projet
  const [pdfFields, setPdfFields] = useState<PdfDynamicFields>(() => ({
    ...DEFAULT_PDF_DYNAMIC_FIELDS,
    ...(project.pdfConfig?.dynamic_fields || {})
  }));

  const handleSectionToggle = (section: keyof PdfSections) => {
    const newSections = {
      ...sections,
      [section]: !sections[section]
    };
    setSections(newSections);
    
    // Mise à jour immédiate du projet
    onUpdate({
      pdfConfig: {
        ...project.pdfConfig,
        sections: newSections
      }
    });
  };

  const handleFieldChange = (field: keyof PdfDynamicFields, value: string) => {
    const newFields = {
      ...pdfFields,
      [field]: value
    };
    setPdfFields(newFields);
  };

  const handleFieldBlur = () => {
    // Mise à jour du projet uniquement lors du blur
    onUpdate({
      pdfConfig: {
        ...project.pdfConfig,
        dynamic_fields: pdfFields
      }
    });
  };

  const handleGeneratePdf = async (e: React.FormEvent) => {
    e.preventDefault?.(); // au cas où c'est dans un <form>
    setLoading(true);
    setError(null);

    // Log des données envoyées
    console.log('[PDF FRONT] Données envoyées :', {
      projectId: project.id,
      pdfConfig: project.pdfConfig,
      // Ajoute ici d'autres champs si besoin
    });

    try {
      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          pdfConfig: {
            ...project.pdfConfig,
            sections,
            dynamic_fields: pdfFields,
          },
        }),
      });

      console.log('[PDF FRONT] Status de la réponse :', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('[PDF FRONT] Erreur HTTP :', response.status, text);
        setError(`Erreur HTTP ${response.status} : ${text}`);
        return;
      }

      const blob = await response.blob();
      console.log('[PDF FRONT] Blob reçu :', blob);

      if (blob.type === 'application/pdf' && blob.size > 1000) {
        const url = window.URL.createObjectURL(blob);
        setPdfUrl(url);
        setRawResponse(null);
        console.log('[PDF FRONT] PDF généré et prêt à être affiché/téléchargé');
      } else {
        const text = await blob.text();
        setRawResponse(text);
        setPdfUrl(null);
        console.warn('[PDF FRONT] Réponse inattendue (pas un PDF) :', text);
      }
    } catch (error) {
      console.error('[PDF FRONT] Exception attrapée :', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full">
      {/* Colonne gauche : paramètres */}
      <div className="md:w-1/2 w-full bg-white rounded-lg shadow p-6 min-w-[340px] max-w-full">
        <h2 className="text-2xl font-semibold mb-6">Configuration du PDF</h2>
        <form onSubmit={handleGeneratePdf} className="space-y-6">
          <div className="flex justify-end space-x-4">
            <button
              type="submit"
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Générer le PDF
            </button>
          </div>

          {/* Sections à inclure */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Sections à inclure</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sections.cover}
                  onChange={() => handleSectionToggle('cover')}
                  className="rounded border-gray-300"
                />
                <span>Page de couverture</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sections.summary}
                  onChange={() => handleSectionToggle('summary')}
                  className="rounded border-gray-300"
                />
                <span>Résumé</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sections.property}
                  onChange={() => handleSectionToggle('property')}
                  className="rounded border-gray-300"
                />
                <span>Description du bien</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sections.valuation_lk}
                  onChange={() => handleSectionToggle('valuation_lk')}
                  className="rounded border-gray-300"
                />
                <span>Valorisation LK</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sections.valuation_casa}
                  onChange={() => handleSectionToggle('valuation_casa')}
                  className="rounded border-gray-300"
                />
                <span>Valorisation Casa</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sections.financial}
                  onChange={() => handleSectionToggle('financial')}
                  className="rounded border-gray-300"
                />
                <span>Données financières</span>
              </label>
            </div>
          </div>

          <div className={styles.pdfDynSection}>
            <h3>Champs PDF dynamiques</h3>
            {/* Ligne 1 : Sous-titre projet */}
            <div className={styles.pdfDynRow}>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Sous-titre projet</label>
                <input
                  type="text"
                  className={styles.pdfDynInput}
                  placeholder="Sous-titre projet"
                  value={pdfFields.sous_titre_projet}
                  onChange={(e) => handleFieldChange('sous_titre_projet', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.sous_titre_projet && <div className={styles.pdfDynDefault}>(Aucun sous-titre)</div>}
              </div>
            </div>
            {/* Ligne 2 : Contact 1 */}
            <div className={styles.pdfDynRow}>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Contact 1 - Nom</label>
                <input
                  type="text"
                  className={styles.pdfDynInput}
                  placeholder="Contact 1 - Nom"
                  value={pdfFields.contact1_nom}
                  onChange={(e) => handleFieldChange('contact1_nom', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.contact1_nom && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Contact 1 - Email</label>
                <input
                  type="text"
                  className={styles.pdfDynInput}
                  placeholder="Contact 1 - Email"
                  value={pdfFields.contact1_email}
                  onChange={(e) => handleFieldChange('contact1_email', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.contact1_email && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Contact 1 - Téléphone</label>
                <input
                  type="text"
                  className={styles.pdfDynInput}
                  placeholder="Contact 1 - Téléphone"
                  value={pdfFields.contact1_tel}
                  onChange={(e) => handleFieldChange('contact1_tel', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.contact1_tel && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
            </div>
            {/* Ligne 3 : Contact 2 */}
            <div className={styles.pdfDynRow}>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Contact 2 - Nom</label>
                <input
                  type="text"
                  className={styles.pdfDynInput}
                  placeholder="Contact 2 - Nom"
                  value={pdfFields.contact2_nom}
                  onChange={(e) => handleFieldChange('contact2_nom', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.contact2_nom && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Contact 2 - Email</label>
                <input
                  type="text"
                  className={styles.pdfDynInput}
                  placeholder="Contact 2 - Email"
                  value={pdfFields.contact2_email}
                  onChange={(e) => handleFieldChange('contact2_email', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.contact2_email && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Contact 2 - Téléphone</label>
                <input
                  type="text"
                  className={styles.pdfDynInput}
                  placeholder="Contact 2 - Téléphone"
                  value={pdfFields.contact2_tel}
                  onChange={(e) => handleFieldChange('contact2_tel', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.contact2_tel && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
            </div>
            {/* Ligne 4 : Description générale */}
            <div className={styles.pdfDynRow}>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Description générale</label>
                <textarea
                  className={styles.pdfDynTextarea}
                  placeholder="Description générale"
                  value={pdfFields.description_general}
                  onChange={(e) => handleFieldChange('description_general', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.description_general && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
            </div>
            {/* Ligne 5 : Titre rénovation */}
            <div className={styles.pdfDynRow}>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Titre rénovation</label>
                <input
                  type="text"
                  className={styles.pdfDynInput}
                  placeholder="Titre rénovation"
                  value={pdfFields.titre_renovation}
                  onChange={(e) => handleFieldChange('titre_renovation', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.titre_renovation && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
            </div>
            {/* Ligne 6 : Projet rénovation */}
            <div className={styles.pdfDynRow}>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Projet rénovation</label>
                <textarea
                  className={styles.pdfDynTextarea}
                  placeholder="Projet rénovation"
                  value={pdfFields.projet_renovation}
                  onChange={(e) => handleFieldChange('projet_renovation', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.projet_renovation && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
            </div>
            {/* Ligne 7 : Détail rénovation */}
            <div className={styles.pdfDynRow}>
              <div className={styles.pdfDynCol}>
                <label className={styles.pdfDynLabel}>Détail rénovation</label>
                <textarea
                  className={styles.pdfDynTextarea}
                  placeholder="Détail rénovation"
                  value={pdfFields.detail_renovation}
                  onChange={(e) => handleFieldChange('detail_renovation', e.target.value)}
                  onBlur={handleFieldBlur}
                />
                {!pdfFields.detail_renovation && <div className={styles.pdfDynDefault}>(Non renseigné)</div>}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Colonne droite : prévisualisation */}
      <div className="md:w-1/2 w-full">
        {loading && (
          <div className="bg-white rounded-lg shadow p-6">
            <p>Génération du PDF en cours...</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium mb-4 text-red-500">Erreur</h3>
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {pdfUrl && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Prévisualisation du PDF</h3>
              <a
                href={pdfUrl}
                download="rapport.pdf"
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
              >
                Télécharger
              </a>
            </div>
            <iframe
              src={pdfUrl}
              width="100%"
              height="800px"
              style={{ border: '1px solid #ccc' }}
              title="Prévisualisation PDF"
            />
          </div>
        )}

        {rawResponse && (
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h3 className="text-lg font-medium mb-4">Réponse brute du backend</h3>
            <pre className="whitespace-pre-wrap text-red-500">{rawResponse}</pre>
          </div>
        )}
      </div>
    </div>
  );
} 
