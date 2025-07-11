import { SubtitleConfig, defaultSubtitleConfig } from '../types/subtitleConfig';
import apiClient from './apiClient';

export const subtitleConfigService = {
  async getConfig(): Promise<SubtitleConfig> {
    try {
      const response = await apiClient.get('/api/config/subtitle-style');
      return response.data;
    } catch (error) {
      console.error('Failed to get subtitle config:', error);
      return defaultSubtitleConfig;
    }
  },

  async updateConfig(config: SubtitleConfig): Promise<void> {
    await apiClient.put('/api/config/subtitle-style', config);
  },

  async resetConfig(): Promise<void> {
    await apiClient.post('/api/config/subtitle-style/reset');
  },

  async translateProjectSubtitles(projectId: string): Promise<void> {
    await apiClient.post(`/api/projects/${projectId}/translate`);
  }
};
