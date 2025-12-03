import { useState, useCallback, useEffect } from 'react';
import { projectService, ProjectData } from '../services/projectService';
import { youtubeService } from '../services/youtubeService';
import { wsManager } from '../services/websocket';

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

// Central mapping function to keep transformations consistent
const toFrontendProject = (project: ProjectData, userId: string | undefined): Project => ({
  ...project,
  videoTitle: project.title,
  videoUrl: project.youtube_url,
  subtitlesCount: project.subtitle_count,
  userId: userId || 'default',
  createdAt: project.created_at ? new Date(project.created_at) : new Date(),
  updatedAt: project.updated_at ? new Date(project.updated_at) : new Date()
});

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
        
        // Ensure we have an array to work with
        if (!Array.isArray(backendProjects)) {
          console.error('Expected array of projects, got:', backendProjects);
          setProjects([]);
          setError('Invalid response format from server');
          return;
        }
        
        // Transform backend data to frontend format
        const transformedProjects: Project[] = backendProjects.map(p => toFrontendProject(p, userId));
        
        setProjects(transformedProjects);
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError(err instanceof Error ? err.message : 'Failed to load projects');
        // Ensure projects is always an array
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [userId]);

  const createProject = useCallback(async (
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
    resolution: string = '720p',
    videoFile?: File,
    preFetchedVideoInfo?: any,
    language?: string,
    audioLanguage?: string
  ): Promise<Project | null> => {
    if (!userId) return null;

    const projectId = 'project_' + Date.now();

    if (projectData.videoUrl) {
      const videoInfo = preFetchedVideoInfo || await youtubeService.getVideoInfo(projectData.videoUrl);
      
      // Connect WebSocket BEFORE starting processing to receive all status updates
      await wsManager.connect(projectId);
      
      await youtubeService.processVideo({
        url: projectData.videoUrl,
        project_id: projectId,
        resolution,
        video_info: videoInfo,
        language,
        audio_language: audioLanguage
      });
      
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

      setProjects(prev => [newProject, ...prev]);
      return { ...newProject, status: 'processing' };
    } else if (videoFile) {
      // Connect WebSocket BEFORE starting processing to receive all status updates
      await wsManager.connect(projectId);
      
      await projectService.uploadProjectFile(
        videoFile,
        projectId,
        projectData.title,
        projectData.description,
        language
      );
      
      const newProject: Project = {
        ...projectData,
        id: projectId,
        status: 'processing',
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      setProjects(prev => [newProject, ...prev]);
      return { ...newProject, status: 'processing' };
    } else {
      throw new Error('Either video URL or video file must be provided');
    }
  }, [userId]);

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

  // Real-time project status updates via WebSocket
  const updateProjectFromWebSocket = useCallback(async (projectId: string, updates: Partial<Project>) => {
    // If the project is completed, refetch the full project data from backend
    if (updates.status === 'completed') {
      try {
        // Fetch the updated project data from the backend
        const backendProjects = await projectService.listProjects();
        const updatedProject = backendProjects.find(p => p.id === projectId);
        
        if (updatedProject) {
          // Transform the backend data to frontend format using central mapper
          const transformedProject: Project = toFrontendProject(updatedProject, userId);
          
          // Update the project with complete data from backend
          setProjects(prevProjects => 
            prevProjects.map(project =>
              project.id === projectId ? transformedProject : project
            )
          );
          return;
        }
      } catch (error) {
        console.error('Failed to refetch project data after completion:', error);
      }
    }
    
    // Fallback to regular update if refetch fails or for other status updates
    setProjects(prevProjects => 
      prevProjects.map(project =>
        project.id === projectId
          ? { ...project, ...updates, updatedAt: new Date() }
          : project
      )
    );
  }, [userId]);

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
    updateProjectFromWebSocket,
    deleteProject,
    getProject
  };
};