import { useEffect, useCallback } from 'react';
import { globalWebSocketService, WebSocketMessage } from '../services/globalWebSocketService';

export interface ProjectProcessingUpdateHandler {
  (projectId: string, updates: {
    status?: 'processing' | 'completed' | 'error';
    progress?: number;
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
          console.log(`Updating project ${project_id} status to: ${newStatus}`);
          updateProjectCallback(project_id, {
            status: newStatus,
            progress
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
