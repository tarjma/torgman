import apiClient from './apiClient';

export interface ApiKeyConfig {
  gemini_api_key: string;
}

export interface ApiKeyStatus {
  has_api_key: boolean;
  api_key_source: 'environment' | 'user_set' | 'none';
}

export const apiKeyService = {
  async getStatus(): Promise<ApiKeyStatus> {
    const response = await apiClient.get('/api/config/api-key/status');
    return response.data;
  },

  async setApiKey(apiKey: string): Promise<void> {
    await apiClient.post('/api/config/api-key', {
      gemini_api_key: apiKey
    });
  },

  async clearApiKey(): Promise<void> {
    await apiClient.delete('/api/config/api-key');
  }
};
