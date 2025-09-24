import { buildProjectWsUrl } from '../config/api';
import { WebSocketEventHandler, WebSocketMessage } from '../types/websocket';

export class GlobalWebSocketService {
  private connections: Map<string, WebSocket> = new Map();
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectTimers: Map<string, number> = new Map();
  private heartbeatTimers: Map<string, number> = new Map();

  /**
   * Connect to a specific project's WebSocket
   */
  connectToProject(projectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Don't create duplicate connections
      if (this.connections.has(projectId)) {
        console.log(`Already connected to project ${projectId}`);
        resolve();
        return;
      }

  const wsUrl = buildProjectWsUrl(projectId);
      
      try {
        console.log(`Connecting to WebSocket for project ${projectId}: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log(`WebSocket connected for project ${projectId}`);
          this.connections.set(projectId, ws);
          this.startHeartbeat(projectId);
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log(`WebSocket message from project ${projectId}:`, message);
            this.handleMessage(message);
          } catch (error) {
            console.error(`Error parsing WebSocket message from project ${projectId}:`, error);
          }
        };

        ws.onclose = (event) => {
          console.log(`WebSocket connection closed for project ${projectId}`, { code: event.code, reason: event.reason });
          this.cleanup(projectId);
        };

        ws.onerror = (error) => {
          console.error(`WebSocket error for project ${projectId}:`, error);
          this.cleanup(projectId);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from a specific project's WebSocket
   */
  disconnectFromProject(projectId: string) {
    const ws = this.connections.get(projectId);
    if (ws) {
      ws.close();
      this.cleanup(projectId);
    }
  }

  /**
   * Disconnect from all projects
   */
  disconnectAll() {
    this.connections.forEach((ws, projectId) => {
      ws.close();
      this.cleanup(projectId);
    });
    this.connections.clear();
    this.eventHandlers.clear();
  }

  /**
   * Ensure connection to all active projects
   */
  async ensureProjectConnections(projectIds: string[]) {
    console.log(`Ensuring WebSocket connections for projects:`, projectIds);
    
    // Disconnect from projects that are no longer needed
    const currentConnections = Array.from(this.connections.keys());
    for (const connectedProject of currentConnections) {
      if (!projectIds.includes(connectedProject)) {
        console.log(`Disconnecting from obsolete project: ${connectedProject}`);
        this.disconnectFromProject(connectedProject);
      }
    }

    // Connect to new projects
    const connectPromises = projectIds
      .filter(projectId => !this.connections.has(projectId))
      .map(projectId => 
        this.connectToProject(projectId).catch(error => {
          console.error(`Failed to connect to project ${projectId}:`, error);
        })
      );

    await Promise.all(connectPromises);
  }

  /**
   * Add event listener for WebSocket messages
   */
  addEventListener(eventType: string, handler: WebSocketEventHandler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event listener
   */
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
    // Handle pong messages specially (don't emit to handlers)
    if (message.type === 'pong') {
      console.log(`Received pong from project ${message.project_id} - connection is alive`);
      return;
    }
    
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

  private startHeartbeat(projectId: string) {
    this.stopHeartbeat(projectId);
    
    const timer = setInterval(() => {
      const ws = this.connections.get(projectId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', project_id: projectId }));
        console.log(`Sent heartbeat to project ${projectId}`);
      } else {
        this.stopHeartbeat(projectId);
      }
    }, 15000);
    
    this.heartbeatTimers.set(projectId, timer);
  }

  private stopHeartbeat(projectId: string) {
    const timer = this.heartbeatTimers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(projectId);
    }
  }

  private cleanup(projectId: string) {
    this.connections.delete(projectId);
    this.stopHeartbeat(projectId);
    
    const reconnectTimer = this.reconnectTimers.get(projectId);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      this.reconnectTimers.delete(projectId);
    }
  }

  /**
   * Get connection status for a project
   */
  isConnectedToProject(projectId: string): boolean {
    const ws = this.connections.get(projectId);
    return ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get all connected project IDs
   */
  getConnectedProjects(): string[] {
    return Array.from(this.connections.keys()).filter(projectId => 
      this.isConnectedToProject(projectId)
    );
  }
}

// Global instance
export const globalWebSocketService = new GlobalWebSocketService();
