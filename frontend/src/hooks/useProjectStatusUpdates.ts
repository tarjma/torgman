import { useEffect, useCallback } from 'react';
import { globalWebSocketService } from '../services/globalWebSocketService';
import { WebSocketMessage } from '../types/websocket';

export interface ProjectProcessingUpdateHandler {
  (projectId: string, updates: {
    status?: 'processing' | 'completed' | 'error' | 'failed';
    progress?: number;
    currentStage?: string; // Current backend stage
    stageMessage?: string; // Arabic message for stage
    duration?: number;
    subtitlesCount?: number;
  }): void;
}

export const useProjectStatusUpdates = (
  projects: any[], 
  updateProjectCallback: ProjectProcessingUpdateHandler
) => {
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    const { project_id, type, status, progress } = message;
    
    // Only handle messages for projects that exist in our list
    const project = projects.find(p => p.id === project_id);
    if (!project) {
      console.log(`Ignoring message for unknown project: ${project_id}`);
      return;
    }
    
    console.log('Project status update:', { project_id, type, status, progress, message });
    
    switch (type) {
      case 'status':
        if (status) {
          const newStatus = status === 'completed' ? 'completed' : 'processing';
          console.log(`Updating project ${project_id} status to: ${newStatus}, progress: ${progress}, stage: ${status}`);
          
          // Map backend status to user-friendly Arabic messages
          const stageMessages: Record<string, string> = {
            'downloading_video': 'جاري تحميل الفيديو...',
            'downloading_thumbnail': 'جاري تحميل الصورة المصغرة...',
            'extracting_audio': 'جاري استخراج الصوت من الفيديو...',
            'generating_subtitles': 'جاري توليد الترجمات باستخدام الذكاء الاصطناعي...',
            'saving_data': 'جاري حفظ البيانات...',
            'completed': 'اكتمل بنجاح!',
            'processing': 'جاري المعالجة...'
          };
          
          updateProjectCallback(project_id, {
            status: newStatus,
            progress: progress || 0,
            currentStage: status,
            stageMessage: stageMessages[status] || 'جاري المعالجة...'
          });
        }
        break;
      
      case 'completion':
        // Project is fully completed
        const completionData = message.data || {};
        console.log(`Project ${project_id} completed with data:`, completionData);
        updateProjectCallback(project_id, {
          status: 'completed',
          subtitlesCount: completionData.subtitle_count || 0
        });
        break;
      
      case 'error':
        console.log(`Project ${project_id} failed with error:`, message.message);
        updateProjectCallback(project_id, {
          status: 'error'
        });
        break;
        
      default:
        console.log(`Unhandled message type: ${type}`);
        break;
    }
  }, [projects, updateProjectCallback]);

  useEffect(() => {
    // Extract project IDs for WebSocket connections
    const projectIds = projects
      .filter(project => project.status === 'processing')
      .map(project => project.id);
    
    console.log(`Setting up WebSocket connections for processing projects:`, projectIds);
    
    // Ensure connections to all processing projects
    globalWebSocketService.ensureProjectConnections(projectIds).catch(error => {
      console.error('Failed to setup WebSocket connections:', error);
    });
    
    // Listen for all WebSocket messages
    globalWebSocketService.addEventListener('*', handleWebSocketMessage);
    
    return () => {
      globalWebSocketService.removeEventListener('*', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage, projects]);
};

/**
 * Polling fallback hook for projects that might have missed WebSocket updates
 * Checks project status every 10 seconds for processing projects
 */
export const useProjectPollingFallback = (
  projects: any[],
  updateProjectCallback: ProjectProcessingUpdateHandler
) => {
  useEffect(() => {
    const processingProjects = projects.filter(p => p.status === 'processing');
    
    if (processingProjects.length === 0) {
      return; // No processing projects, no need to poll
    }
    
    console.log(`Starting polling fallback for ${processingProjects.length} processing projects`);
    
    const checkProjectStatus = async () => {
      for (const project of processingProjects) {
        try {
          // Fetch latest project data from backend
          const response = await fetch(`/api/projects/${project.id}`);
          if (response.ok) {
            const updatedProject = await response.json();
            
            // If status changed, update it
            if (updatedProject.status !== project.status) {
              console.log(`Polling detected status change for ${project.id}: ${project.status} -> ${updatedProject.status}`);
              updateProjectCallback(project.id, {
                status: updatedProject.status,
                subtitlesCount: updatedProject.subtitle_count,
                progress: updatedProject.status === 'completed' ? 100 : project.progress
              });
            }
          }
        } catch (error) {
          console.error(`Failed to poll status for project ${project.id}:`, error);
        }
      }
    };
    
    // Poll every 10 seconds
    const interval = setInterval(checkProjectStatus, 10000);
    
    // Also check immediately
    checkProjectStatus();
    
    return () => {
      clearInterval(interval);
    };
  }, [projects, updateProjectCallback]);
};
