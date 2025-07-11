import { useEffect, useCallback } from 'react';
import { webSocketService, WebSocketMessage } from '../services/webSocketService';
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
    } else if ((message.type === 'status' || message.type === 'completion' || message.type === 'error') && onStatusUpdate) {
      // Handle status updates for translation progress
      onStatusUpdate(message.status || message.type, message.message || 'Processing...');
    }
  }, [projectId, onSubtitlesUpdate, onStatusUpdate]);

  useEffect(() => {
    if (!projectId) {
      // Disconnect WebSocket when no project is active
      webSocketService.disconnect();
      return;
    }
    
    // Connect to WebSocket for this project
    const connectWebSocket = async () => {
      try {
        if (!webSocketService.isConnected() || webSocketService.getProjectId() !== projectId) {
          console.log(`Connecting WebSocket for project: ${projectId}`);
          await webSocketService.connect(projectId);
        }
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };
    
    connectWebSocket();
    
    // Listen for WebSocket messages
    webSocketService.addEventListener('*', handleWebSocketMessage);
    
    return () => {
      webSocketService.removeEventListener('*', handleWebSocketMessage);
    };
  }, [handleWebSocketMessage, projectId]);
};
