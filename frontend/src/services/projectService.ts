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

export interface CaptionData {
  start: number;
  end: number;
  text: string;
  confidence?: number;
  translation?: string;
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

  async getProjectSubtitles(projectId: string): Promise<CaptionData[]> {
    const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/subtitles`);
    return response.data;
  },

  async updateProjectSubtitles(projectId: string, subtitles: any[]): Promise<void> {
    await apiClient.put(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/subtitles`, subtitles);
  },

  async updateSubtitleText(projectId: string, subtitleIndex: number, text: string, translation?: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('text', text);
    if (translation !== undefined) {
      params.append('translation', translation);
    }
    
    await apiClient.put(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/subtitles/${subtitleIndex}?${params.toString()}`);
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
  },

  async uploadProjectFile(
    file: File,
    projectId: string, 
    title: string,
    description?: string,
    language: string = 'ar'
  ): Promise<{
    project_id: string;
    status: string;
    message: string;
  }> {
    console.log('uploadProjectFile called', { fileName: file.name, projectId, title, description, language });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    formData.append('title', title);
    if (description) {
      formData.append('description', description);
    }
    formData.append('language', language);

    console.log('Making API call to upload endpoint...');
    
    const response = await apiClient.post(API_CONFIG.ENDPOINTS.PROJECTS_UPLOAD, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    console.log('Upload response:', response.data);
    return response.data;
  },

  async getProjectThumbnail(projectId: string): Promise<string> {
    try {
      const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/thumbnail`, {
        responseType: 'blob',
      });
      
      // Create a URL for the blob
      const blob = new Blob([response.data]);
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error fetching project thumbnail:', error);
      return '';
    }
  },

  async getProjectVideo(projectId: string): Promise<string> {
    try {
      // Return the API endpoint URL for the video
      return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/video`;
    } catch (error) {
      console.error('Error getting project video URL:', error);
      return '';
    }
  },

  async translateProjectSubtitles(projectId: string): Promise<void> {
    await apiClient.post(`/api/projects/${projectId}/translate`);
  },

  async exportVideoWithSubtitles(
    projectId: string, 
    options: {
      subtitleStyle?: any;
      outputFormat?: string;
      outputQuality?: string;
    } = {}
  ): Promise<{
    message: string;
    output_file: string;
    file_size: number;
    format: string;
    quality: string;
  }> {
    const response = await apiClient.post(`${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/export`, {
      subtitle_style: options.subtitleStyle,
      output_format: options.outputFormat || 'mp4',
      output_quality: options.outputQuality || '720p'
    });
    return response.data;
  },

  async downloadExportedVideo(projectId: string, filename: string): Promise<string> {
    const response = await apiClient.get(
      `${API_CONFIG.ENDPOINTS.PROJECTS}/${projectId}/export/${filename}`,
      { responseType: 'blob' }
    );
    
    // Create download URL
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
    return filename;
  }
};
