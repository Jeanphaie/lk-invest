"use client";

import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Card, Row, Col } from 'react-bootstrap';

interface Project {
  id: string;
  projectTitle: string;
  adresseBien?: string;
  createdAt: string;
  photos?: {
    coverPhoto?: string;
    // Optionally add other fields if you use them
  };
}

const UPLOADS_BASE_URL = process.env.NEXT_PUBLIC_UPLOADS_URL || 'http://163.172.32.45:3001';

export default function ProjectListView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setView, setSelectedProject } = useAppStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des projets');
        }
        const data = await response.json();
        setProjects(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    setView('project-detail');
  };

  const handleDelete = async (projectId: string) => {
    if (!window.confirm("Supprimer ce projet ? Cette action est irréversible.")) return;
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erreur lors de la suppression');
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      alert('Erreur lors de la suppression du projet.');
    }
  };

  const filteredProjects = projects.filter(project =>
    project.projectTitle.toLowerCase().includes(search.toLowerCase()) ||
    (project.adresseBien || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => setView('home')}
            className="text-blue-500 hover:underline mb-4"
          >
            ← Retour à l'accueil
          </button>
          <h1 className="text-3xl font-bold">Liste des Projets</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <input
            type="text"
            placeholder="Rechercher un projet..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border px-3 py-2 rounded mb-2 w-64"
          />
          <button
            onClick={() => setView('create-project')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Nouveau Projet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <Card 
            key={project.id} 
            className="mb-3 cursor-pointer hover:shadow-lg transition-shadow relative"
            onClick={() => handleProjectSelect(project.id)}
          >
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-red-600 bg-transparent border-none p-0 m-0 text-xl leading-none z-20"
              onClick={e => { e.stopPropagation(); handleDelete(project.id); }}
              title="Supprimer le projet"
              aria-label="Supprimer le projet"
            >
              &times;
            </button>
            <Card.Body>
              <Row>
                <Col md={4}>
                  {project.photos?.coverPhoto ? (
                    <img
                      src={`${UPLOADS_BASE_URL}${project.photos.coverPhoto.replace('/data/lki/uploads', '/uploads')}`}
                      alt="Cover"
                      className="project-cover-photo"
                      style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: 120, backgroundColor: '#f8f9fa', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="text-muted">Aucune image</span>
                    </div>
                  )}
                </Col>
                <Col md={8}>
                  <h2 className="text-xl font-semibold mb-2">{project.projectTitle}</h2>
                  {project.adresseBien && (
                    <p className="text-gray-600 mb-4">{project.adresseBien}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Créé le: {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
} 