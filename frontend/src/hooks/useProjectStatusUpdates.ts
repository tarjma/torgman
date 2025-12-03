import { useEffect, useCallback } from 'react';
import { wsManager } from '../services/websocket';
import { WebSocketMessage } from '../types/websocket';

export interface ProjectProcessingUpdateHandler {
  (projectId: string, updates: {
    status?: 'processing' | 'transcribed' | 'completed' | 'error' | 'failed';
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
    if (!project) return;
    
    switch (type) {
      case 'status':
        if (status) {
          const newStatus = status === 'transcribed' ? 'transcribed' : status === 'completed' ? 'completed' : 'processing';
          
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
            progress: progress || 0,
            currentStage: status,
            stageMessage: stageMessages[status] || 'جاري المعالجة...'
          });
        }
        break;
      
      case 'completion':
        const completionData = message.data || {};
        updateProjectCallback(project_id, {
          status: 'transcribed',
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
    const projectIds = projects
      .filter(project => project.status === 'processing')
      .map(project => project.id);
    
    // Ensure connections to all processing projects
    wsManager.ensureProjectConnections(projectIds).catch(() => {});
    
    wsManager.addEventListener('*', handleWebSocketMessage);
    
    return () => {
      wsManager.removeEventListener('*', handleWebSocketMessage);
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
    
    if (processingProjects.length === 0) return;
    
    const checkProjectStatus = async () => {
      for (const project of processingProjects) {
        const response = await fetch(`/api/projects/${project.id}`);
        if (response.ok) {
          const updatedProject = await response.json();
          if (updatedProject.status !== project.status) {
            updateProjectCallback(project.id, {
              status: updatedProject.status,
              subtitlesCount: updatedProject.subtitle_count,
              progress: updatedProject.status === 'completed' ? 100 : project.progress
            });
          }
        }
      }
    };
    
    const interval = setInterval(checkProjectStatus, 10000);
    checkProjectStatus();
    
    return () => clearInterval(interval);
  }, [projects, updateProjectCallback]);
};
