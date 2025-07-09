import { useState, useEffect, useCallback } from 'react';
import { webSocketService, WebSocketMessage } from '../services/webSocketService';

export interface ProcessingStatus {
  status: 'downloading_audio' | 'processing_audio' | 'generating_subtitles' | 'completed' | 'error';
  progress: number;
  message: string;
}

export const useProjectProcessing = (projectId: string | null) => {
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log('WebSocket message received:', message);
    
    switch (message.type) {
      case 'status':
        setProcessingStatus({
          status: message.status!,
          progress: message.progress || 0,
          message: message.message || ''
        });
        break;
      
      case 'subtitles':
        setSubtitles(message.data || []);
        break;
      
      case 'completion':
        // Handle completion notification with file paths
        console.log('Project completion data:', message.data);
        // This can be used to update UI with completion status
        break;
      
      case 'error':
        setError(message.message || 'An error occurred during processing');
        setProcessingStatus({
          status: 'error',
          progress: 0,
          message: message.message || 'Processing failed'
        });
        break;
      
      case 'heartbeat':
        // Just to keep connection alive
        break;
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;

    const connectWebSocket = async () => {
      try {
        await webSocketService.connect(projectId);
        setIsConnected(true);
        setError(null);
        
        // Add event listener for all message types
        webSocketService.addEventListener('*', handleWebSocketMessage);
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setError(error instanceof Error ? error.message : 'Failed to connect to real-time updates');
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      webSocketService.removeEventListener('*', handleWebSocketMessage);
      webSocketService.disconnect();
      setIsConnected(false);
    };
  }, [projectId, handleWebSocketMessage]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetProcessing = useCallback(() => {
    setProcessingStatus(null);
    setSubtitles([]);
    setError(null);
  }, []);

  return {
    processingStatus,
    subtitles,
    isConnected,
    error,
    clearError,
    resetProcessing
  };
};
