import { useState, useEffect, useCallback } from 'react';
import { SubtitleConfig } from '../types/subtitleConfig';
import { subtitleConfigService } from '../services/subtitleConfigService';

export const useSubtitleConfig = () => {
  // Initialize with null to indicate loading state
  const [config, setConfig] = useState<SubtitleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedConfig = await subtitleConfigService.getConfig();
      setConfig(loadedConfig);
    } catch (err) {
      setError('Failed to load subtitle configuration');
      console.error('Error loading subtitle config:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: SubtitleConfig) => {
    try {
      setError(null);
      await subtitleConfigService.updateConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      setError('Failed to update subtitle configuration');
      console.error('Error updating subtitle config:', err);
      throw err;
    }
  }, []);

  const resetConfig = useCallback(async () => {
    try {
      setError(null);
      await subtitleConfigService.resetConfig();
      // After reset, fetch the fresh default config from backend
      const defaultConfig = await subtitleConfigService.getDefaultConfig();
      setConfig(defaultConfig);
    } catch (err) {
      setError('Failed to reset subtitle configuration');
      console.error('Error resetting subtitle config:', err);
      throw err;
    }
  }, []);

  const translateProject = useCallback(async (projectId: string) => {
    try {
      setError(null);
      await subtitleConfigService.translateProjectSubtitles(projectId);
    } catch (err) {
      setError('Failed to translate project subtitles');
      console.error('Error translating subtitles:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    isLoading,
    error,
    updateConfig,
    resetConfig,
    translateProject,
    reloadConfig: loadConfig
  };
};
