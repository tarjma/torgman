import { useState, useCallback, useEffect } from 'react';
import { projectService, ProjectData } from '../services/projectService';
import { youtubeService } from '../services/youtubeService';
import { webSocketService } from '../services/webSocketService';

// Map backend ProjectData to frontend Project type
interface Project extends Omit<ProjectData, 'youtube_url' | 'subtitle_count'> {
  videoTitle: string;
  videoUrl?: string;
  videoFile?: string;
  subtitlesCount: number;
  userId: string;
  thumbnail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const useProjects = (userId?: string) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load projects from backend
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const backendProjects = await projectService.listProjects();
        
        // Transform backend data to frontend format
        const transformedProjects: Project[] = backendProjects.map(project => ({
          ...project,
          videoTitle: project.title,
          videoUrl: project.youtube_url,
          subtitlesCount: project.subtitle_count,
          userId: userId || 'default',
          createdAt: project.created_at ? new Date(project.created_at) : new Date(),
          updatedAt: project.updated_at ? new Date(project.updated_at) : new Date()
        }));
        
        setProjects(transformedProjects);
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [userId]);

  const createProject = useCallback(async (
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
    resolution: string = '720p'
  ) => {
    if (!userId) return null;

    try {
      // First get YouTube video info
      if (projectData.videoUrl) {
        const videoInfo = await youtubeService.getVideoInfo(projectData.videoUrl);
        
        // Create project ID
        const projectId = 'project_' + Date.now();
        
        // Start processing the video with resolution
        await youtubeService.processVideo({
          url: projectData.videoUrl,
          project_id: projectId,
          language: projectData.language || 'ar',
          resolution
        });

        // Connect to WebSocket for real-time updates
        await webSocketService.connect(projectId);
        
        const newProject: Project = {
          ...projectData,
          id: projectId,
          videoTitle: videoInfo.title,
          duration: videoInfo.duration,
          thumbnail: videoInfo.thumbnail,
          status: 'processing',
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const updatedProjects = [...projects, newProject];
        setProjects(updatedProjects);
        
        return newProject;
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      setError(error instanceof Error ? error.message : 'Failed to create project');
      return null;
    }
    
    return null;
  }, [projects, userId]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      // Update local state immediately for better UX
      const updatedProjects = projects.map(project =>
        project.id === id
          ? { ...project, ...updates, updatedAt: new Date() }
          : project
      );
      setProjects(updatedProjects);

      // If status is being updated, sync with backend
      if (updates.status) {
        await projectService.updateProjectStatus(id, updates.status, updates.subtitlesCount);
      }
    } catch (error) {
      console.error('Failed to update project:', error);
      setError(error instanceof Error ? error.message : 'Failed to update project');
    }
  }, [projects]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await projectService.deleteProject(id);
      const updatedProjects = projects.filter(project => project.id !== id);
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Failed to delete project:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete project');
    }
  }, [projects]);

  const getProject = useCallback((id: string) => {
    return projects.find(project => project.id === id);
  }, [projects]);

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    getProject
  };
};