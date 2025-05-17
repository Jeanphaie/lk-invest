import { useMap } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';
import { DvfTransaction } from '../../../../shared/types/dvfTransaction';
import { InputsDvf } from '../../../../shared/types/dvfInputs';

interface MapWithCircleProps {
  coordinates: { lat: number; lng: number };
  zoom: number;
  radius: number;
  dvfProperties: DvfTransaction[];
  selectedMarker: DvfTransaction | null;
  setSelectedMarker: (marker: DvfTransaction | null) => void;
  dvfFilters: InputsDvf;
  showOutliers: boolean;
}

// Composant pour dessiner le cercle sur la carte
const CircleOverlay = ({ center, radius }: { center: google.maps.LatLngLiteral; radius: number }) => {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.1,
        map,
        center,
        radius,
      });
    } else {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(radius);
    }

    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map, center, radius]);

  return null;
};

const MapWithCircle = ({
  coordinates,
  zoom,
  radius,
  dvfProperties,
  selectedMarker,
  setSelectedMarker,
  dvfFilters,
  showOutliers
}: MapWithCircleProps) => {
  const map = useMap();
  const markersRef = useRef<{ [key: string]: google.maps.Marker }>({});

  useEffect(() => {
    if (!map) return;

    // --- Marker projet (center) ---
    const projectMarker = new google.maps.Marker({
      position: coordinates,
      map,
      title: 'Adresse du projet',
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        scale: 7,
        fillColor: '#FFD600', // jaune
        fillOpacity: 1,
        strokeColor: '#FFA000',
        strokeWeight: 2,
      },
      zIndex: 9999,
      clickable: false,
    });

    // --- Markers DVF ---
    // Filtrer les propriétés selon les critères
    const filteredProperties = dvfProperties.filter(property => {
      if (!showOutliers && property.is_outlier) return false;
      if (dvfFilters.prixMin && property.prix < dvfFilters.prixMin) return false;
      if (dvfFilters.surfaceMin && property.surface < dvfFilters.surfaceMin) return false;
      if (dvfFilters.prixM2Min && property.prix_m2 < dvfFilters.prixM2Min) return false;
      return true;
    });

    // Mettre à jour les marqueurs
    filteredProperties.forEach(property => {
      if (!markersRef.current[property.id.toString()]) {
        const marker = new google.maps.Marker({
          position: { lat: property.latitude, lng: property.longitude },
          map,
          title: property.voie,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: property.is_outlier ? '#FF0000' : '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => {
          setSelectedMarker(property);
        });

        markersRef.current[property.id.toString()] = marker;
      }
    });

    // Animation du marker sélectionné
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      if (selectedMarker && id === selectedMarker.id.toString()) {
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11, // plus gros
          fillColor: '#FFD600', // jaune ou autre couleur visible
          fillOpacity: 1,
          strokeColor: '#FFA000',
          strokeWeight: 3,
        });
        marker.setZIndex(10000);
      } else {
        const property = filteredProperties.find(p => p.id.toString() === id);
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: property?.is_outlier ? '#FF0000' : '#4285F4',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        });
        marker.setZIndex(1);
      }
    });

    // Supprimer les marqueurs qui ne sont plus dans la liste filtrée
    Object.keys(markersRef.current).forEach(id => {
      if (!filteredProperties.find(p => p.id.toString() === id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

    return () => {
      Object.values(markersRef.current).forEach(marker => marker.setMap(null));
      markersRef.current = {};
      projectMarker.setMap(null);
    };
  }, [map, dvfProperties, showOutliers, dvfFilters, setSelectedMarker, coordinates, selectedMarker]);

  return <CircleOverlay center={coordinates} radius={radius} />;
};

export default MapWithCircle; 