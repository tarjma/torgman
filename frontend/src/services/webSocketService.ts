import { API_CONFIG, WS_CONFIG } from '../config/api';

export interface WebSocketMessage {
  project_id: string;
  type: 'status' | 'subtitles' | 'error' | 'heartbeat' | 'completion';
  status?: 'downloading_audio' | 'downloading_video' | 'downloading_thumbnail' | 'extracting_audio' | 'processing_audio' | 'generating_subtitles' | 'saving_data' | 'completed';
  progress?: number;
  message?: string;
  data?: any;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  connect(projectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.projectId = projectId;
      const wsUrl = `${API_CONFIG.BASE_URL.replace('http', 'ws')}/ws/${projectId}`;
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log(`WebSocket connected for project ${projectId}`);
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.projectId = null;
    this.reconnectAttempts = 0;
  }

  addEventListener(eventType: string, handler: WebSocketEventHandler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  removeEventListener(eventType: string, handler: WebSocketEventHandler) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(message: WebSocketMessage) {
    // Emit to specific event type handlers
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // Emit to all handlers
    const allHandlers = this.eventHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message));
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (!this.projectId) {
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.projectId) {
        this.connect(this.projectId).catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, WS_CONFIG.RECONNECT_INTERVAL);
  }

  sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Global WebSocket service instance
export const webSocketService = new WebSocketService();
