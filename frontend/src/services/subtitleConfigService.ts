import { SubtitleConfig } from '../types/subtitleConfig';
import apiClient from './apiClient';

// Fallback configuration for when backend is unavailable
const fallbackConfig: SubtitleConfig = {
  // Basic text properties
  fontSize: '28',
  fontFamily: 'Cairo',
  fontWeight: 'Bold',
  
  // Colors
  color: '#ffffff',
  secondaryColor: '#0000ff',
  outlineColor: '#000000',
  backgroundColor: '#80000000',
  
  // Style flags
  bold: false,
  italic: false,
  underline: false,
  strikeOut: false,
  
  // Scaling and spacing
  scaleX: 100,
  scaleY: 100,
  spacing: 0,
  angle: 0,
  
  // Border and shadow
  borderStyle: 1,
  outline: 2,
  shadow: 1,
  
  // Alignment (2 = bottom center, standard for subtitles)
  alignment: 2,
  
  // Margins
  margin: {
    left: 10.0,
    right: 10.0,
    vertical: 10.0,
    top: 10.0,
    bottom: 10.0
  },
  
  // Legacy compatibility
  padding: '8px 12px',
  borderRadius: '4px',
  lineHeight: '1.4',
  maxWidth: '80%',
  position: 'bottom-center'
};

export const subtitleConfigService = {
  async getConfig(): Promise<SubtitleConfig> {
    try {
      const response = await apiClient.get('/api/config/subtitle-style');
      return response.data;
    } catch (error) {
      console.error('Failed to get subtitle config from backend, using fallback:', error);
      return fallbackConfig;
    }
  },

  async getDefaultConfig(): Promise<SubtitleConfig> {
    try {
      // Request fresh default config from backend
      const response = await apiClient.get('/api/config/subtitle-style/default');
      return response.data;
    } catch (error) {
      console.error('Failed to get default subtitle config from backend, using fallback:', error);
      return fallbackConfig;
    }
  },

  async updateConfig(config: SubtitleConfig): Promise<void> {
    await apiClient.put('/api/config/subtitle-style', config);
  },

  async resetConfig(): Promise<void> {
    await apiClient.post('/api/config/subtitle-style/reset');
  },

  async translateProjectSubtitles(projectId: string): Promise<void> {
    await apiClient.post(`/api/projects/${projectId}/translate`, {
      source_language: 'en',
      target_language: 'ar'
    });
  }
};
