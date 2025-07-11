import { useState, useCallback, useEffect } from 'react';
import { apiKeyService, ApiKeyStatus } from '../services/apiKeyService';

export const useApiKey = () => {
  const [status, setStatus] = useState<ApiKeyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const currentStatus = await apiKeyService.getStatus();
      setStatus(currentStatus);
    } catch (err) {
      setError('Failed to load API key status');
      console.error('Error loading API key status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setApiKey = useCallback(async (apiKey: string) => {
    try {
      setError(null);
      await apiKeyService.setApiKey(apiKey);
      await loadStatus(); // Reload status after setting
    } catch (err) {
      setError('Failed to set API key');
      console.error('Error setting API key:', err);
      throw err;
    }
  }, [loadStatus]);

  const clearApiKey = useCallback(async () => {
    try {
      setError(null);
      await apiKeyService.clearApiKey();
      await loadStatus(); // Reload status after clearing
    } catch (err) {
      setError('Failed to clear API key');
      console.error('Error clearing API key:', err);
      throw err;
    }
  }, [loadStatus]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return {
    status,
    isLoading,
    error,
    setApiKey,
    clearApiKey,
    reloadStatus: loadStatus
  };
};
