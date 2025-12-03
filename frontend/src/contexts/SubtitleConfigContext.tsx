import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { SubtitleConfig } from '../types/subtitleConfig';
import { subtitleConfigService } from '../services/subtitleConfigService';

interface SubtitleConfigContextType {
  config: SubtitleConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  updateConfig: (newConfig: SubtitleConfig) => void;
  updateField: <K extends keyof SubtitleConfig>(key: K, value: SubtitleConfig[K]) => void;
  resetConfig: () => Promise<void>;
  reloadConfig: () => Promise<void>;
  translateProject: (projectId: string) => Promise<void>;
}

const SubtitleConfigContext = createContext<SubtitleConfigContextType | null>(null);

export const SubtitleConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SubtitleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const loadedConfig = await subtitleConfigService.getConfig();
    setConfig(loadedConfig);
    setIsLoading(false);
  }, []);

  // Update entire config - immediate local update, debounced save
  const updateConfig = useCallback((newConfig: SubtitleConfig) => {
    setConfig(newConfig);
    
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      await subtitleConfigService.updateConfig(newConfig);
      setIsSaving(false);
    }, 500);
  }, []);

  // Update single field - convenience method
  const updateField = useCallback(<K extends keyof SubtitleConfig>(key: K, value: SubtitleConfig[K]) => {
    setConfig(prev => {
      if (!prev) return prev;
      const newConfig = { ...prev, [key]: value };
      
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      
      saveTimerRef.current = setTimeout(async () => {
        setIsSaving(true);
        await subtitleConfigService.updateConfig(newConfig);
        setIsSaving(false);
      }, 500);
      
      return newConfig;
    });
  }, []);

  const resetConfig = useCallback(async () => {
    setError(null);
    await subtitleConfigService.resetConfig();
    const defaultConfig = await subtitleConfigService.getDefaultConfig();
    setConfig(defaultConfig);
  }, []);

  const translateProject = useCallback(async (projectId: string) => {
    setError(null);
    await subtitleConfigService.translateProjectSubtitles(projectId);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return (
    <SubtitleConfigContext.Provider value={{
      config,
      isLoading,
      isSaving,
      error,
      updateConfig,
      updateField,
      resetConfig,
      reloadConfig: loadConfig,
      translateProject
    }}>
      {children}
    </SubtitleConfigContext.Provider>
  );
};

export const useSubtitleConfig = (): SubtitleConfigContextType => {
  const context = useContext(SubtitleConfigContext);
  if (!context) {
    throw new Error('useSubtitleConfig must be used within a SubtitleConfigProvider');
  }
  return context;
};
