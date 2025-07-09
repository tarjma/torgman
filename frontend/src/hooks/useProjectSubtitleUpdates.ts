import { useEffect, useCallback } from 'react';
import { webSocketService, WebSocketMessage } from '../services/webSocketService';
import { Subtitle } from '../types';

export interface SubtitleUpdateHandler {
  (subtitles: Subtitle[]): void;
}

export const useProjectSubtitleUpdates = (
  projectId: string | null,
  onSubtitlesUpdate: SubtitleUpdateHandler
) => {
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    // Only handle messages for the current project
    if (!projectId || message.project_id !== projectId) return;
    
    console.log('Subtitle update received:', { project_id: message.project_id, type: message.type });
    
    if (message.type === 'subtitles' && message.data) {
      // Convert backend subtitle format to frontend format
      const backendSubtitles = message.data;
      const frontendSubtitles: Subtitle[] = backendSubtitles.map((sub: any) => ({
        id: sub.id,
        start_time: sub.start_time,
        end_time: sub.end_time,
        text: sub.text,
        originalText: sub.text,
        translatedText: '',
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
    }
  }, [projectId, onSubtitlesUpdate]);

  useEffect(() => {
    if (!projectId) return;
    
    // Listen for WebSocket messages
    webSocketService.addEventListener('*', handleWebSocketMessage);
    
    return () => {
      webSocketService.removeEventListener('*', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage, projectId]);
};
