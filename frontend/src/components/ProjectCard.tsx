import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  IconButton,
  styled,
  Tooltip,
} from '@mui/material';
import { Project } from '../../../shared/types/project';
import { InputsGeneral } from '../../../shared/types/generalInputs';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LinkIcon from '@mui/icons-material/Link';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EuroIcon from '@mui/icons-material/Euro';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));


interface ProjectCardProps {
  project: Project;
  onClick?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(project);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <StyledCard onClick={handleClick} sx={{ cursor: onClick ? 'pointer' : 'default' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }} noWrap>
            {project.projectTitle}
          </Typography>
        </Box>

        {project.inputsGeneral?.description_quartier && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <LocationOnIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" noWrap>
              {project.inputsGeneral.description_quartier}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          {project.inputsBusinessPlan?.prix_achat && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <EuroIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                {formatPrice(project.inputsBusinessPlan.prix_achat)}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CalendarTodayIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {new Date(project.createdAt).toLocaleDateString('fr-FR')}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </StyledCard>
  );
}; 