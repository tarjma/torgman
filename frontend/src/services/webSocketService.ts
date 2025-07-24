import { API_CONFIG, WS_CONFIG } from '../config/api';

export interface WebSocketMessage {
  project_id: string;
  type: 'status' | 'subtitles' | 'error' | 'heartbeat' | 'completion' | 'translating' | 'pong' | 'export_status';
  status?: 'downloading_audio' | 'downloading_video' | 'downloading_thumbnail' | 'extracting_audio' | 'processing_audio' | 'generating_subtitles' | 'saving_data' | 'completed' | 'translating' | 'export_started' | 'generating_clips' | 'compositing_video' | 'export_completed' | 'export_failed';
  progress?: number;
  message?: string;
  data?: any;
  // Export specific fields
  filename?: string;
  file_size?: number;
  download_url?: string;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private connectionCheckTimer: number | null = null;
  private isManualDisconnect = false;
  private lastHeartbeatTime: number = 0;

  connect(projectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.projectId = projectId;
      const wsUrl = `${API_CONFIG.BASE_URL.replace('http', 'ws')}/ws/${projectId}`;
      
      try {
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log(`WebSocket connected for project ${projectId}`);
          this.reconnectAttempts = 0;
          this.isManualDisconnect = false;
          this.lastHeartbeatTime = Date.now();
          this.startHeartbeat();
          this.startConnectionMonitoring();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('Raw WebSocket message received:', event.data);
            console.log('Parsed WebSocket message:', message);
            
            // Update last heartbeat time for any received message
            this.lastHeartbeatTime = Date.now();
            
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket connection closed', { code: event.code, reason: event.reason });
          this.stopHeartbeat();
          this.stopConnectionMonitoring();
          if (!this.isManualDisconnect) {
            this.attemptReconnect();
          }
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
    this.isManualDisconnect = true;
    this.stopHeartbeat();
    this.stopConnectionMonitoring();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Don't clear projectId here - we need it for reconnection
    // this.projectId = null;
    this.reconnectAttempts = 0;
  }

  // Method to fully reset the service (when switching projects)
  reset() {
    this.disconnect();
    this.projectId = null;
    this.eventHandlers.clear();
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
    console.log('Handling WebSocket message:', message);
    
    // Handle pong messages specially (don't emit to handlers)
    if (message.type === 'pong') {
      console.log('Received pong from server - connection is alive');
      return;
    }
    
    // Emit to specific event type handlers
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      console.log(`Found ${handlers.length} handlers for message type: ${message.type}`);
      handlers.forEach(handler => handler(message));
    } else {
      console.log(`No handlers found for message type: ${message.type}`);
    }

    // Emit to all handlers
    const allHandlers = this.eventHandlers.get('*');
    if (allHandlers) {
      console.log(`Found ${allHandlers.length} wildcard handlers`);
      allHandlers.forEach(handler => handler(message));
    } else {
      console.log('No wildcard handlers found');
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

  private startHeartbeat() {
    this.stopHeartbeat();
    // Send heartbeat every 15 seconds (more frequent for long operations)
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping', project_id: this.projectId });
        console.log('Sent WebSocket heartbeat');
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startConnectionMonitoring() {
    this.stopConnectionMonitoring();
    // Check connection health every 30 seconds
    this.connectionCheckTimer = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastHeartbeatTime;
      
      // If no message received in 45 seconds, consider connection stale
      if (timeSinceLastMessage > 45000) {
        console.warn('WebSocket connection appears stale, forcing reconnection');
        this.forceReconnect().catch(error => {
          console.error('Forced reconnection failed:', error);
        });
      }
    }, 30000);
  }

  private stopConnectionMonitoring() {
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
      this.connectionCheckTimer = null;
    }
  }

  sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  ensureConnection(): Promise<void> {
    if (this.isConnected()) {
      return Promise.resolve();
    }
    
    if (this.projectId) {
      console.log('WebSocket not connected, attempting to reconnect...');
      return this.connect(this.projectId);
    }
    
    return Promise.reject(new Error('No project ID set for WebSocket connection'));
  }

  forceReconnect(): Promise<void> {
    if (this.projectId) {
      console.log('Forcing WebSocket reconnection...');
      
      // Close current connection without clearing project ID
      this.isManualDisconnect = true;
      this.stopHeartbeat();
      this.stopConnectionMonitoring();
      
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.reconnectAttempts = 0;
      
      // Reconnect with the same project ID
      return this.connect(this.projectId);
    }
    
    return Promise.reject(new Error('No project ID set for WebSocket reconnection'));
  }

  // Add method to check connection health
  checkConnectionHealth(): boolean {
    const timeSinceLastMessage = Date.now() - this.lastHeartbeatTime;
    const isStale = timeSinceLastMessage > 45000;
    
    if (isStale) {
      console.warn(`WebSocket connection is stale (${timeSinceLastMessage}ms since last message)`);
    }
    
    return this.isConnected() && !isStale;
  }

  // Get current project ID
  getProjectId(): string | null {
    return this.projectId;
  }
}

// Global WebSocket service instance
export const webSocketService = new WebSocketService();
