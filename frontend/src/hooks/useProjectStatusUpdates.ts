import { useEffect, useCallback } from 'react';
import { globalWebSocketService, WebSocketMessage } from '../services/globalWebSocketService';

export interface ProjectProcessingUpdateHandler {
  (projectId: string, updates: {
    status?: 'processing' | 'transcribed' | 'completed' | 'error' | 'failed';
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
          const newStatus = status === 'transcribed' ? 'transcribed' : status === 'completed' ? 'completed' : 'processing';
          console.log(`Updating project ${project_id} status to: ${newStatus}, progress: ${progress}, stage: ${status}`);
          
          // Map backend status to user-friendly Arabic messages
          const stageMessages: Record<string, string> = {
            'downloading_video': 'جاري تحميل الفيديو...',
            'downloading_thumbnail': 'جاري تحميل الصورة المصغرة...',
            'extracting_audio': 'جاري استخراج الصوت من الفيديو...',
            'generating_subtitles': 'جاري توليد الترجمات باستخدام الذكاء الاصطناعي...',
            'saving_data': 'جاري حفظ البيانات...',
            'transcribed': 'اكتمل التفريغ بنجاح!',
            'completed': 'اكتملت الترجمة بنجاح!',
            'processing': 'جاري المعالجة...'
          };
          
          updateProjectCallback(project_id, {
            status: newStatus,
            progress
          });
        }
        break;
      
      case 'completion':
        // Project transcription is completed (not yet translated)
        const completionData = message.data || {};
        console.log(`Project ${project_id} transcription completed with data:`, completionData);
        updateProjectCallback(project_id, {
          status: 'transcribed',
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
