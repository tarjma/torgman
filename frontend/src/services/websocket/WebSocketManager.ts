/**
 * Unified WebSocket Manager
 * 
 * Handles WebSocket connections for both:
 * - Multiple projects (home page - tracking all project statuses)
 * - Single project (editor page - detailed project updates)
 * 
 * Consolidates the functionality of webSocketService.ts and globalWebSocketService.ts
 */

import { buildProjectWsUrl, WS_CONFIG } from '../../config/api';
import { WebSocketEventHandler, WebSocketMessage } from '../../types/websocket';

interface ConnectionState {
  ws: WebSocket;
  heartbeatTimer: number | null;
  connectionCheckTimer: number | null;
  reconnectTimer: number | null;
  reconnectAttempts: number;
  lastHeartbeatTime: number;
  isManualDisconnect: boolean;
}

class WebSocketManager {
  private connections: Map<string, ConnectionState> = new Map();
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  
  // Track the "active" project for single-project mode (editor page)
  private activeProjectId: string | null = null;

  /**
   * Connect to a project's WebSocket
   */
  connect(projectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Don't create duplicate connections
      if (this.connections.has(projectId)) {
        const state = this.connections.get(projectId)!;
        if (state.ws.readyState === WebSocket.OPEN) {
          console.log(`Already connected to project ${projectId}`);
          resolve();
          return;
        }
        // Connection exists but not open, clean it up
        this.cleanupConnection(projectId);
      }

      const wsUrl = buildProjectWsUrl(projectId);

      try {
        console.log(`Connecting to WebSocket for project ${projectId}: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        const state: ConnectionState = {
          ws,
          heartbeatTimer: null,
          connectionCheckTimer: null,
          reconnectTimer: null,
          reconnectAttempts: 0,
          lastHeartbeatTime: Date.now(),
          isManualDisconnect: false,
        };

        ws.onopen = () => {
          console.log(`WebSocket connected for project ${projectId}`);
          state.reconnectAttempts = 0;
          state.isManualDisconnect = false;
          state.lastHeartbeatTime = Date.now();
          this.connections.set(projectId, state);
          this.startHeartbeat(projectId);
          this.startConnectionMonitoring(projectId);
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log(`WebSocket message from project ${projectId}:`, message);

            // Update last heartbeat time
            const connState = this.connections.get(projectId);
            if (connState) {
              connState.lastHeartbeatTime = Date.now();
            }

            this.handleMessage(message);
          } catch (error) {
            console.error(`Error parsing WebSocket message from project ${projectId}:`, error);
          }
        };

        ws.onclose = (event) => {
          console.log(`WebSocket connection closed for project ${projectId}`, {
            code: event.code,
            reason: event.reason,
          });
          const connState = this.connections.get(projectId);
          if (connState && !connState.isManualDisconnect) {
            this.attemptReconnect(projectId);
          } else {
            this.cleanupConnection(projectId);
          }
        };

        ws.onerror = (error) => {
          console.error(`WebSocket error for project ${projectId}:`, error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from a specific project
   */
  disconnect(projectId: string): void {
    const state = this.connections.get(projectId);
    if (state) {
      state.isManualDisconnect = true;
      state.ws.close();
      this.cleanupConnection(projectId);
    }
  }

  /**
   * Disconnect from all projects
   */
  disconnectAll(): void {
    this.connections.forEach((state, projectId) => {
      state.isManualDisconnect = true;
      state.ws.close();
      this.cleanupConnection(projectId);
    });
    this.connections.clear();
    this.eventHandlers.clear();
    this.activeProjectId = null;
  }

  /**
   * Set the active project (for single-project mode like editor page)
   * This also connects to the project's WebSocket
   */
  async setActiveProject(projectId: string): Promise<void> {
    // If switching projects, disconnect from the old one
    if (this.activeProjectId && this.activeProjectId !== projectId) {
      this.disconnect(this.activeProjectId);
    }
    
    this.activeProjectId = projectId;
    await this.connect(projectId);
  }

  /**
   * Clear the active project and disconnect
   */
  clearActiveProject(): void {
    if (this.activeProjectId) {
      this.disconnect(this.activeProjectId);
      this.activeProjectId = null;
    }
    this.eventHandlers.clear();
  }

  /**
   * Reset everything (when leaving a page or switching context)
   */
  reset(): void {
    this.disconnectAll();
  }

  /**
   * Ensure connections to multiple projects (for home page)
   */
  async ensureProjectConnections(projectIds: string[]): Promise<void> {
    console.log(`Ensuring WebSocket connections for projects:`, projectIds);

    // Disconnect from projects that are no longer needed (except active project)
    const currentConnections = Array.from(this.connections.keys());
    for (const connectedProject of currentConnections) {
      if (!projectIds.includes(connectedProject) && connectedProject !== this.activeProjectId) {
        console.log(`Disconnecting from obsolete project: ${connectedProject}`);
        this.disconnect(connectedProject);
      }
    }

    // Connect to new projects
    const connectPromises = projectIds
      .filter((projectId) => !this.connections.has(projectId))
      .map((projectId) =>
        this.connect(projectId).catch((error) => {
          console.error(`Failed to connect to project ${projectId}:`, error);
        })
      );

    await Promise.all(connectPromises);
  }

  /**
   * Add event listener for WebSocket messages
   */
  addEventListener(eventType: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Send a message to a specific project
   */
  sendMessage(projectId: string, message: unknown): void {
    const state = this.connections.get(projectId);
    if (state && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send a message to the active project
   */
  sendToActiveProject(message: unknown): void {
    if (this.activeProjectId) {
      this.sendMessage(this.activeProjectId, message);
    }
  }

  /**
   * Check if connected to a specific project
   */
  isConnected(projectId: string): boolean {
    const state = this.connections.get(projectId);
    return state ? state.ws.readyState === WebSocket.OPEN : false;
  }

  /**
   * Check if connected to the active project
   */
  isActiveProjectConnected(): boolean {
    return this.activeProjectId ? this.isConnected(this.activeProjectId) : false;
  }

  /**
   * Get all connected project IDs
   */
  getConnectedProjects(): string[] {
    return Array.from(this.connections.keys()).filter((projectId) =>
      this.isConnected(projectId)
    );
  }

  /**
   * Get the active project ID
   */
  getActiveProjectId(): string | null {
    return this.activeProjectId;
  }

  /**
   * Ensure the active project is connected
   */
  async ensureActiveConnection(): Promise<void> {
    if (!this.activeProjectId) {
      throw new Error('No active project set');
    }

    if (!this.isConnected(this.activeProjectId)) {
      console.log('Active project not connected, reconnecting...');
      await this.connect(this.activeProjectId);
    }
  }

  /**
   * Force reconnection to the active project
   */
  async forceReconnect(): Promise<void> {
    if (!this.activeProjectId) {
      throw new Error('No active project set for reconnection');
    }

    console.log(`Forcing reconnection to project ${this.activeProjectId}`);
    this.disconnect(this.activeProjectId);
    await this.connect(this.activeProjectId);
  }

  /**
   * Check connection health for the active project
   */
  checkConnectionHealth(): boolean {
    if (!this.activeProjectId) return false;

    const state = this.connections.get(this.activeProjectId);
    if (!state) return false;

    const timeSinceLastMessage = Date.now() - state.lastHeartbeatTime;
    const isStale = timeSinceLastMessage > 45000;

    if (isStale) {
      console.warn(
        `WebSocket connection is stale (${timeSinceLastMessage}ms since last message)`
      );
    }

    return this.isConnected(this.activeProjectId) && !isStale;
  }

  // Private methods

  private handleMessage(message: WebSocketMessage): void {
    // Handle pong messages specially (don't emit to handlers)
    if (message.type === 'pong') {
      console.log(`Received pong from project ${message.project_id} - connection is alive`);
      return;
    }

    // Emit to specific event type handlers
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Emit to project-specific handlers (using project_id as event type)
    if (message.project_id) {
      const projectHandlers = this.eventHandlers.get(message.project_id);
      if (projectHandlers) {
        projectHandlers.forEach((handler) => handler(message));
      }
    }

    // Emit to wildcard handlers
    const allHandlers = this.eventHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach((handler) => handler(message));
    }
  }

  private startHeartbeat(projectId: string): void {
    this.stopHeartbeat(projectId);

    const state = this.connections.get(projectId);
    if (!state) return;

    state.heartbeatTimer = window.setInterval(() => {
      const connState = this.connections.get(projectId);
      if (connState && connState.ws.readyState === WebSocket.OPEN) {
        connState.ws.send(JSON.stringify({ type: 'ping', project_id: projectId }));
        console.log(`Sent heartbeat to project ${projectId}`);
      }
    }, 15000);
  }

  private stopHeartbeat(projectId: string): void {
    const state = this.connections.get(projectId);
    if (state?.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
  }

  private startConnectionMonitoring(projectId: string): void {
    this.stopConnectionMonitoring(projectId);

    const state = this.connections.get(projectId);
    if (!state) return;

    state.connectionCheckTimer = window.setInterval(() => {
      const connState = this.connections.get(projectId);
      if (!connState) return;

      const timeSinceLastMessage = Date.now() - connState.lastHeartbeatTime;

      // If no message received in 45 seconds, consider connection stale
      if (timeSinceLastMessage > 45000) {
        console.warn(`WebSocket connection for project ${projectId} appears stale`);
        // Only force reconnect for the active project
        if (projectId === this.activeProjectId) {
          this.forceReconnect().catch((error) => {
            console.error('Forced reconnection failed:', error);
          });
        }
      }
    }, 30000);
  }

  private stopConnectionMonitoring(projectId: string): void {
    const state = this.connections.get(projectId);
    if (state?.connectionCheckTimer) {
      clearInterval(state.connectionCheckTimer);
      state.connectionCheckTimer = null;
    }
  }

  private attemptReconnect(projectId: string): void {
    const state = this.connections.get(projectId);
    if (!state) return;

    if (state.reconnectAttempts >= WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      console.error(`Max reconnection attempts reached for project ${projectId}`);
      this.cleanupConnection(projectId);
      return;
    }

    state.reconnectAttempts++;
    console.log(
      `Attempting to reconnect to project ${projectId} (${state.reconnectAttempts}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`
    );

    state.reconnectTimer = window.setTimeout(() => {
      this.connect(projectId).catch((error) => {
        console.error(`Reconnection failed for project ${projectId}:`, error);
      });
    }, WS_CONFIG.RECONNECT_INTERVAL);
  }

  private cleanupConnection(projectId: string): void {
    const state = this.connections.get(projectId);
    if (state) {
      this.stopHeartbeat(projectId);
      this.stopConnectionMonitoring(projectId);

      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
      }
    }

    this.connections.delete(projectId);
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager();

// Export class for testing
export { WebSocketManager };
