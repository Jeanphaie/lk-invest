import React, { useEffect, useState } from 'react';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import createEmotionCache from './createEmotionCache';
import { theme } from './theme';
import HomeView from './components/HomeView';
import ProjectListView from './components/ProjectListView';
import ProjectDetailView from './components/ProjectDetailView';
import CreateProjectView from './components/CreateProjectView';
import { useAppStore } from './store/appStore';

// Import des styles externes (Bootstrap est géré globalement dans _app.tsx)
// import 'bootstrap/dist/css/bootstrap.min.css';

// Import des styles de base
// import './styles/base/variables.css';

// Ancien import conservé en commentaire pour référence
// import './css/DVFProperties.module.css';

const clientSideEmotionCache = createEmotionCache();

const App: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const { currentView, selectedProjectId } = useAppStore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const renderCurrentView = () => {
    if (!isClient) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
          <CircularProgress />
        </Box>
      );
    }

    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'projects':
        return <ProjectListView />;
      case 'project-detail':
        return selectedProjectId ? <ProjectDetailView projectId={selectedProjectId} /> : null;
      case 'create-project':
        return <CreateProjectView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <CacheProvider value={clientSideEmotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh' }}>
          {renderCurrentView()}
        </Box>
      </ThemeProvider>
    </CacheProvider>
  );
};

export default App; 