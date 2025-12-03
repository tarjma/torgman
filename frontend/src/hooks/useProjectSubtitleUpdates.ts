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
    // Only handle messages for the current project
    if (!projectId || message.project_id !== projectId) return;
    
    console.log('WebSocket message received:', { project_id: message.project_id, type: message.type });
    
    if (message.type === 'subtitles' && message.data) {
      console.log('Processing subtitle update message:', message);
      console.log('Subtitle data received:', message.data);
      
      // Convert backend subtitle format to frontend format
      const backendSubtitles = message.data;
      const frontendSubtitles: Subtitle[] = backendSubtitles.map((sub: any) => ({
        id: sub.id || `sub_${Date.now()}_${Math.random()}`, // Generate ID if missing
        start_time: sub.start_time,
        end_time: sub.end_time,
        text: sub.text,
        originalText: sub.text,
        translatedText: sub.translation || '', // Include translation from backend
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
      
      console.log('Converted subtitles:', frontendSubtitles);
      onSubtitlesUpdate(frontendSubtitles);
    } else if ((message.type === 'status' || message.type === 'completion' || message.type === 'error' || message.type === 'export_status') && onStatusUpdate) {
      // Handle status updates for translation progress and export status
      if (message.type === 'export_status') {
        // Handle export-specific status updates
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
    
    // Set active project for WebSocket
    const connectWebSocket = async () => {
      try {
        if (!wsManager.isActiveProjectConnected() || wsManager.getActiveProjectId() !== projectId) {
          console.log(`Connecting WebSocket for project: ${projectId}`);
          await wsManager.setActiveProject(projectId);
        }
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };
    
    connectWebSocket();
    
    // Listen for WebSocket messages
    wsManager.addEventListener('*', handleWebSocketMessage);
    
    return () => {
      wsManager.removeEventListener('*', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage, projectId]);
};
