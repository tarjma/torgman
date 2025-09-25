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
  resolution_sizes?: Array<{
    resolution: string;
    bytes: number;
    human_size: string;
    detail?: {
      type: string;
      format_id?: string;
      video_format_id?: string;
      audio_format_id?: string;
    };
  }>;
}

export interface ProcessYouTubeRequest {
  url: string;
  project_id: string;
  // Legacy field kept optional for backward compatibility; backend now derives source language automatically
  language?: string;
  resolution?: string;
  video_info?: YouTubeVideoInfo; // Optional field to pass pre-fetched video info
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
