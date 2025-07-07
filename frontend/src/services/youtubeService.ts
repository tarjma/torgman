import apiClient from './apiClient';
import { API_CONFIG } from '../config/api';

export interface YouTubeVideoInfo {
  title: string;
  duration: number;
  thumbnail?: string;
  video_id: string;
  uploader?: string;
  description?: string;
  available_resolutions?: string[];
  recommended_resolution?: string;
}

export interface ProcessYouTubeRequest {
  url: string;
  project_id: string;
  language: string;
  resolution?: string;
}

export const youtubeService = {
  async getVideoInfo(url: string): Promise<YouTubeVideoInfo> {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.YOUTUBE_INFO, {
      params: { url }
    });
    return response.data;
  },

  async processVideo(request: ProcessYouTubeRequest): Promise<{
    project_id: string;
    status: string;
    message: string;
  }> {
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.YOUTUBE_PROCESS, request);
    return response.data;
  }
};
