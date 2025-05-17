import { useState, useEffect } from 'react';
import { useLoadScript } from '@react-google-maps/api';
import { useAppStore } from '../store/appStore';

const libraries = ['places'];

interface FormData {
  projectTitle: string;
  adresseBien: string;
  latitude: number;
  longitude: number;
}

export default function CreateProjectView() {
  const { setView, setSelectedProject } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    projectTitle: '',
    adresseBien: '',
    latitude: 0,
    longitude: 0
  });

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as any,
  });

  useEffect(() => {
    if (isLoaded) {
      const input = document.getElementById('adresseBien') as HTMLInputElement;
      const autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'fr' },
        fields: ['formatted_address', 'geometry'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address && place.geometry?.location) {
          const location = place.geometry.location;
          setFormData(prev => ({
            ...prev,
            adresseBien: place.formatted_address || '',
            latitude: location.lat(),
            longitude: location.lng()
          }));
        }
      });
    }
  }, [isLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectTitle: formData.projectTitle,
          inputsGeneral: {
            projectTitle: formData.projectTitle,
            superficie: 0,
            superficie_terrasse: 0,
            ponderation_terrasse: 0.3,
            latitude: formData.latitude,
            longitude: formData.longitude,
            adresseBien: formData.adresseBien
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la création du projet');
      }

      const data = await response.json();
      setSelectedProject(data.id);
      setView('project-detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isLoaded) {
    return <div>Chargement de Google Maps...</div>;
  }

  return (
    <div className="flex flex-col items-center p-24">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <button 
            onClick={() => setView('projects')}
            className="text-blue-500 hover:underline"
          >
            ← Retour à la liste des projets
          </button>
        </div>

        <h1 className="text-4xl font-bold mb-8">Créer un nouveau projet</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="projectTitle" className="block text-sm font-medium text-gray-700">
              Titre du projet *
            </label>
            <input
              type="text"
              id="projectTitle"
              name="projectTitle"
              required
              value={formData.projectTitle}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="adresseBien" className="block text-sm font-medium text-gray-700">
              Adresse du bien
            </label>
            <input
              type="text"
              id="adresseBien"
              name="adresseBien"
              value={formData.adresseBien}
              onChange={handleChange}
              placeholder="Commencez à taper une adresse..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>


          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-md text-white ${
                loading ? 'bg-blue-400' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {loading ? 'Création en cours...' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 