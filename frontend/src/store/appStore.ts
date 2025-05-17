import { create } from 'zustand';

type View = 'home' | 'projects' | 'project-detail' | 'create-project';

interface AppState {
  currentView: View;
  selectedProjectId: string | null;
  setView: (view: View) => void;
  setSelectedProject: (projectId: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'home',
  selectedProjectId: null,
  setView: (view) => set({ currentView: view }),
  setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),
})); 