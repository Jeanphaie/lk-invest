import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ProjectData {
  // Add project data fields here
  [key: string]: any;
}

interface ProjectsContextType {
  projectData: ProjectData;
  setProjectData: (data: ProjectData) => void;
}

const defaultContext: ProjectsContextType = {
  projectData: {},
  setProjectData: () => {},
};

export const ProjectsCtx = createContext<ProjectsContextType>(defaultContext);

interface ProjectsProviderProps {
  children: ReactNode;
}

export const ProjectsProvider: React.FC<ProjectsProviderProps> = ({ children }) => {
  const [projectData, setProjectData] = useState<ProjectData>({});

  return (
    <ProjectsCtx.Provider value={{ projectData, setProjectData }}>
      {children}
    </ProjectsCtx.Provider>
  );
};

export const useProjects = () => useContext(ProjectsCtx); 