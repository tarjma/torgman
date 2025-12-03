import { useEffect, useCallback } from 'react';
import { wsManager } from '../services/websocket';
import { WebSocketMessage } from '../types/websocket';
import { Subtitle } from '../types';

export interface SubtitleUpdateHandler {
  (subtitles: Subtitle[]): void;
}

export interface StatusUpdateHandler {
  (status: string, message: string): void;
}

export const useProjectSubtitleUpdates = (
  projectId: string | null,
  onSubtitlesUpdate: SubtitleUpdateHandler,
  onStatusUpdate?: StatusUpdateHandler
) => {
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (!projectId || message.project_id !== projectId) return;
    
    if (message.type === 'subtitles' && message.data) {
      const backendSubtitles = message.data;
      const frontendSubtitles: Subtitle[] = backendSubtitles.map((sub: any) => ({
        id: sub.id || `sub_${Date.now()}_${Math.random()}`,
        start_time: sub.start_time,
        end_time: sub.end_time,
        text: sub.text,
        originalText: sub.text,
        translatedText: sub.translation || '',
        position: { x: 50, y: 80 },
        styling: {
          fontFamily: 'Noto Sans Arabic, Arial, sans-serif',
          fontSize: 20,
          color: '#ffffff',
          backgroundColor: '#000000',
          opacity: 1,
          outline: true,
          outlineColor: '#000000',
          bold: false,
          italic: false,
          alignment: 'center' as const
        }
      }));
      
      onSubtitlesUpdate(frontendSubtitles);
    } else if ((message.type === 'status' || message.type === 'completion' || message.type === 'error' || message.type === 'export_status') && onStatusUpdate) {
      if (message.type === 'export_status') {
        const status = message.status || 'processing';
        const messageText = message.message || 
          (status === 'export_started' ? 'جاري تصدير الفيديو...' :
           status === 'export_completed' ? 'تم تصدير الفيديو بنجاح' :
           status === 'export_failed' ? 'فشل تصدير الفيديو' :
           'جاري معالجة التصدير...');
        
        onStatusUpdate(status, messageText);
        
        // If export is completed, show download link
        if (status === 'export_completed' && (message.download_url || message.data?.download_url)) {
          // Create a temporary link to trigger download
          const downloadUrl = message.data?.download_url || message.download_url;
          const filename = message.data?.filename || message.filename || 'exported_video.mp4';
          
          const link = document.createElement('a');
          link.href = `${window.location.origin}${downloadUrl}`;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        // Handle other status updates (translation, etc.)
        onStatusUpdate(message.status || message.type, message.message || 'Processing...');
      }
    }
  }, [projectId, onSubtitlesUpdate, onStatusUpdate]);

  useEffect(() => {
    if (!projectId) {
      // Clear active project when no project is active
      wsManager.clearActiveProject();
      return;
    }
    
    const connectWebSocket = async () => {
      if (!wsManager.isActiveProjectConnected() || wsManager.getActiveProjectId() !== projectId) {
        await wsManager.setActiveProject(projectId);
      }
    };
    
    connectWebSocket();
    wsManager.addEventListener('*', handleWebSocketMessage);
    
    return () => {
      wsManager.removeEventListener('*', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage, projectId]);
};
