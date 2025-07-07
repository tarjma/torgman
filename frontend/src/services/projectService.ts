import apiClient from './apiClient';
import { API_CONFIG } from '../config/api';

export interface ProjectData {
  id: string;
  title: string;
  description?: string;
  youtube_url?: string;
  duration: number;
  status: 'draft' | 'processing' | 'completed' | 'error';
  language: string;
  subtitle_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SubtitleData {
  id: string;
  project_id: string;
  start_time: number;
  end_time: number;
  text: string;
  speaker_id?: string;
  confidence?: number;
  created_at?: string;
}

export const projectService = {
  async listProjects(limit = 50, offset = 0): Promise<ProjectData[]> {
    const response = await apiClient.get(API_CONFIG.ENDPOINTS.PROJECTS, {
      params: { limit, offset }
    });
    return response.data;
  },

  async getProject(projectId: string): Promise<ProjectData> {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}`);
    return response.data;
  },

  async getProjectSubtitles(projectId: string): Promise<SubtitleData[]> {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/subtitles`);
    return response.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    await apiClient.delete(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}`);
  },

  async updateProjectStatus(projectId: string, status: string, subtitleCount?: number): Promise<void> {
    const params = new URLSearchParams();
    params.append('status', status);
    if (subtitleCount !== undefined) {
      params.append('subtitle_count', subtitleCount.toString());
    }
    
    await apiClient.put(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/status?${params.toString()}`);
  }
};
