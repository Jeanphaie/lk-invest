import React from 'react';
import { Grid, Box, TextField, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import { ProjectCard } from './ProjectCard';
import { Project } from '../../../shared/types/project';

interface ProjectFilters {
  search: string;
  sortBy: 'name' | 'date' | 'budget';
}

interface ProjectListProps {
  projects: Project[];
  filters: ProjectFilters;
  onFiltersChange: (filters: ProjectFilters) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  filters,
  onFiltersChange,
}) => {
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: event.target.value });
  };

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    onFiltersChange({ ...filters, sortBy: event.target.value as ProjectFilters['sortBy'] });
  };

  const filteredProjects = projects
    .filter((project) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          project.projectTitle.toLowerCase().includes(searchLower) ||
          project.inputsGeneral?.description_quartier?.toLowerCase().includes(searchLower) ||
          project.inputsGeneral?.projectTitle.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sortBy === 'name') {
        return a.projectTitle.localeCompare(b.projectTitle);
      }
      if (filters.sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (filters.sortBy === 'budget') {
        const budgetA = a.inputsBusinessPlan?.prix_achat || 0;
        const budgetB = b.inputsBusinessPlan?.prix_achat || 0;
        return budgetB - budgetA;
      }
      return 0;
    });

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          label="Rechercher"
          variant="outlined"
          size="small"
          value={filters.search}
          onChange={handleSearchChange}
          sx={{ flexGrow: 1 }}
        />
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Trier par</InputLabel>
          <Select
            value={filters.sortBy}
            label="Trier par"
            onChange={handleSortChange}
          >
            <MenuItem value="name">Nom</MenuItem>
            <MenuItem value="date">Date</MenuItem>
            <MenuItem value="budget">Budget</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1.5 }}>
        {filteredProjects.map((project) => (
          <Box
            key={project.id}
            sx={{
              width: {
                xs: '100%',
                sm: '50%',
                md: '33.33%'
              },
              p: 1.5
            }}
          >
            <ProjectCard project={project} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}; 