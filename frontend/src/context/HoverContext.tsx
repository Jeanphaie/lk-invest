import React, { createContext, useContext, useState, ReactNode } from 'react';

interface HoverContextType {
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  hoveredKey: string | null;
  setHoveredKey: (key: string | null) => void;
}

const defaultContext: HoverContextType = {
  hoveredId: null,
  setHoveredId: () => {},
  hoveredKey: null,
  setHoveredKey: () => {},
};

export const HoverContext = createContext<HoverContextType>(defaultContext);

interface HoverProviderProps {
  children: ReactNode;
}

export const HoverProvider: React.FC<HoverProviderProps> = ({ children }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  return (
    <HoverContext.Provider value={{ hoveredId, setHoveredId, hoveredKey, setHoveredKey }}>
      {children}
    </HoverContext.Provider>
  );
};

export const useHover = () => useContext(HoverContext); 