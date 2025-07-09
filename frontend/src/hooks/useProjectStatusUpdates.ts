import { useEffect, useCallback } from 'react';
import { webSocketService, WebSocketMessage } from '../services/webSocketService';

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
    if (!project) return;
    
    console.log('Project status update:', { project_id, type, status, progress });
    
    switch (type) {
      case 'status':
        if (status) {
          updateProjectCallback(project_id, {
            status: status === 'completed' ? 'completed' : 'processing',
            progress
          });
        }
        break;
      
      case 'completion':
        // Project is fully completed
        const completionData = message.data || {};
        updateProjectCallback(project_id, {
          status: 'completed',
          subtitlesCount: completionData.subtitle_count || 0
        });
        break;
      
      case 'error':
        updateProjectCallback(project_id, {
          status: 'error'
        });
        break;
    }
  }, [projects, updateProjectCallback]);

  useEffect(() => {
    // Listen for all WebSocket messages
    webSocketService.addEventListener('*', handleWebSocketMessage);
    
    return () => {
      webSocketService.removeEventListener('*', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage]);
};
